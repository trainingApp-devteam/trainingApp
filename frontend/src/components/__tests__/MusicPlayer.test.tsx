import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MusicPlayer, { PLAYLIST_ID } from '../MusicPlayer'

type Events = Record<string, (event: { target: any; data: number }) => void>

function fakeYouTube() {
  const player = {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    nextVideo: vi.fn(),
    previousVideo: vi.fn(),
    setShuffle: vi.fn(),
    playVideoAt: vi.fn(),
    getVolume: vi.fn(() => 80),
    setVolume: vi.fn(),
    getPlaylist: vi.fn(() => ['a', 'b', 'c']),
  }
  let events: Events = {}
  const Player = vi.fn(function (this: unknown, _frame: HTMLIFrameElement, options: { events: Events }) { events = options.events; return player })
  window.YT = { Player, PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } } as any
  return { player, Player, fire: (name: string, data = 0) => act(() => events[name]({ target: player, data })) }
}

async function open(user: ReturnType<typeof userEvent.setup>, yt: ReturnType<typeof fakeYouTube>) {
  await user.click(screen.getByRole('button', { name: '音楽を再生' }))
  await vi.waitFor(() => expect(yt.Player).toHaveBeenCalled())
}

describe('MusicPlayer', () => {
  afterEach(() => { delete window.YT })

  test('does not contact YouTube until the user presses play', () => {
    render(<MusicPlayer />)

    expect(screen.getByRole('button', { name: '音楽を再生' })).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.querySelector('script[src*="youtube"]')).toBeNull()
  })

  test('plays the training playlist in a visible embedded player', async () => {
    const user = userEvent.setup()
    const yt = fakeYouTube()
    render(<MusicPlayer />)

    await open(user, yt)

    const frame = screen.getByTitle('トレーニング用プレイリスト（YouTube）') as HTMLIFrameElement
    expect(frame.src).toContain(`list=${PLAYLIST_ID}`)
    expect(frame.src).toContain('enablejsapi=1')
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
    expect(yt.Player).toHaveBeenCalledWith(frame, expect.anything())
    yt.fire('onReady')
    expect(yt.player.playVideo).toHaveBeenCalled()
  })

  test('controls the playlist and shows the play state', async () => {
    const user = userEvent.setup()
    const yt = fakeYouTube()
    render(<MusicPlayer />)
    await open(user, yt)

    yt.fire('onStateChange', 1)
    await user.click(screen.getByRole('button', { name: '一時停止' }))
    expect(yt.player.pauseVideo).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '次の曲' }))
    expect(yt.player.nextVideo).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '前の曲' }))
    expect(yt.player.previousVideo).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'シャッフル' }))
    expect(yt.player.setShuffle).toHaveBeenCalledWith(true)
    expect(screen.getByRole('button', { name: 'シャッフル' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('skips videos that cannot be embedded, and stops when none can be played', async () => {
    const user = userEvent.setup()
    const yt = fakeYouTube()
    render(<MusicPlayer />)
    await open(user, yt)

    yt.fire('onError', 150)
    expect(yt.player.nextVideo).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('再生できない動画')

    yt.fire('onError', 101)
    yt.fire('onError', 150)
    expect(yt.player.nextVideo).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('alert')).toHaveTextContent('このプレイリストの動画を再生できません')
  })

  test('lowers the volume while the timer sound plays, then restores it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const yt = fakeYouTube()
      const { rerender } = render(<MusicPlayer duckSignal={0} />)
      await open(user, yt)
      yt.fire('onStateChange', 1)

      rerender(<MusicPlayer duckSignal={1} />)
      expect(yt.player.setVolume).toHaveBeenLastCalledWith(16)
      act(() => { vi.advanceTimersByTime(5000) })
      expect(yt.player.setVolume).toHaveBeenLastCalledWith(80)
    } finally {
      vi.useRealTimers()
    }
  })
})
