import React, { useEffect, useRef, useState } from 'react'
import { ui } from '../styles/ui'

// 既定のYouTubeプレイリスト（公開/限定公開であること）
export const PLAYLIST_ID = 'PL8UB8_UnSIC5_shdHl9avGNMyR3zGls-e'

// プレイリストのURL（list=…を含むもの）またはIDから、プレイリストIDを取り出す。取り出せなければnull
export function parsePlaylistId(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (/^[A-Za-z0-9_-]{10,}$/.test(value)) return value
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
    if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) return null
    const list = url.searchParams.get('list')
    return list && /^[A-Za-z0-9_-]{10,}$/.test(list) ? list : null
  } catch {
    return null
  }
}

// YouTube IFrame Player API のうち、この画面で使う部分だけの型
type YTPlayer = {
  playVideo: () => void
  pauseVideo: () => void
  nextVideo: () => void
  previousVideo: () => void
  setShuffle: (shuffle: boolean) => void
  playVideoAt: (index: number) => void
  getVolume: () => number
  setVolume: (volume: number) => void
  getPlaylist: () => string[] | null
}
type YTNamespace = {
  Player: new (element: HTMLIFrameElement, options: { events: Record<string, (event: { target: YTPlayer; data: number }) => void> }) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiRequest: Promise<YTNamespace> | null = null

// APIスクリプトは「再生」を押したときに初めて読み込む（押すまでYouTubeへ通信しない）
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiRequest) {
    apiRequest = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        if (window.YT) resolve(window.YT)
      }
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => { apiRequest = null; reject(new Error('YouTubeを読み込めませんでした')) }
      document.head.appendChild(script)
    })
  }
  return apiRequest
}

// 埋め込み不可（101/150）、削除済み・非公開（100）、不正なID（2）、再生エラー（5）
const SKIPPABLE_ERRORS = [2, 5, 100, 101, 150]

type Props = {
  // 値が変わるたびに、タイマー終了音が聞こえるよう音量を一時的に下げる
  duckSignal?: number
  playlistId?: string
  // trueなら表示と同時に再生を始める（実行開始を押したときに使う）
  autoPlay?: boolean
  // trueの間は一時停止し、falseに戻ったら（再生中だった場合）再開する
  suspended?: boolean
}

export default function MusicPlayer({ duckSignal = 0, playlistId = PLAYLIST_ID, autoPlay = false, suspended = false }: Props): JSX.Element {
  const [opened, setOpened] = useState(autoPlay)
  const resumeRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const failuresRef = useRef(0)

  useEffect(() => {
    if (!opened || !frameRef.current) return
    let cancelled = false
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !frameRef.current) return
        playerRef.current = new YT.Player(frameRef.current, {
          events: {
            onReady: (event) => { if (!suspended) event.target.playVideo() },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                failuresRef.current = 0
                setPlaying(true)
              } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                setPlaying(false)
              }
            },
            onError: (event) => {
              if (!SKIPPABLE_ERRORS.includes(event.data)) return
              const length = event.target.getPlaylist()?.length ?? 0
              failuresRef.current += 1
              // 全曲が再生できない場合に飛ばし続けないよう止める
              if (length > 0 && failuresRef.current >= length) {
                setError('このプレイリストの動画を再生できません（埋め込み不可・非公開など）')
                return
              }
              setNotice('再生できない動画（埋め込み不可・非公開など）を飛ばしました')
              event.target.nextVideo()
            },
          },
        })
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'YouTubeを読み込めませんでした') })
    return () => {
      cancelled = true
      // iframeはReactが管理しているため、destroy()（iframeを取り除く）は使わずに止めるだけにする
      try { playerRef.current?.pauseVideo() } catch { /* 準備前 */ }
      playerRef.current = null
    }
  }, [opened])

  // タイマー終了音の間（約5秒）だけ音楽の音量を下げる
  useEffect(() => {
    const player = playerRef.current
    if (!duckSignal || !player || !playing) return
    const volume = player.getVolume()
    player.setVolume(Math.round(volume * 0.2))
    const timer = window.setTimeout(() => playerRef.current?.setVolume(volume), 5000)
    return () => { window.clearTimeout(timer); playerRef.current?.setVolume(volume) }
  }, [duckSignal])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (suspended) {
      resumeRef.current = playing
      if (playing) player.pauseVideo()
    } else if (resumeRef.current) {
      resumeRef.current = false
      player.playVideo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspended])

  function toggleShuffle() {
    const next = !shuffle
    setShuffle(next)
    playerRef.current?.setShuffle(next)
    if (next) playerRef.current?.playVideoAt(0)
  }

  const src = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}`
    + `&enablejsapi=1&playsinline=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`

  return (
    <section aria-labelledby="music-heading" className={ui.card}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="music-heading" className="text-lg font-semibold text-gray-100">音楽</h3>
        {opened && (
          <button type="button" onClick={() => { setOpened(false); setPlaying(false); setNotice(null); setError(null) }} className={`${ui.btnSecondary} ${ui.btnSmall}`}>
            音楽を閉じる
          </button>
        )}
      </div>

      {!opened && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className={ui.muted}>YouTubeのプレイリストを流しながらトレーニングできます。</p>
          <button type="button" onClick={() => { failuresRef.current = 0; setOpened(true) }} className={ui.btnPrimary}>音楽を再生</button>
        </div>
      )}

      {opened && (
        <>
          {/* YouTubeの規約上、プレーヤーは200×200px以上で表示したままにする（音声だけの再生はしない） */}
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg bg-black" style={{ aspectRatio: '16 / 9', minHeight: 200, minWidth: 200 }}>
            <iframe
              ref={frameRef}
              title="トレーニング用プレイリスト（YouTube）"
              src={src}
              className="h-full w-full"
              // 配信サーバーは Referrer-Policy: no-referrer を返すが、YouTubeの埋め込みは参照元が無いと再生できないため、この枠だけ送る
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => playerRef.current?.previousVideo()} className={`${ui.btnSecondary} ${ui.btnSmall}`}>前の曲</button>
            <button type="button" onClick={() => (playing ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo())} className={`${ui.btnPrimary} ${ui.btnSmall}`}>
              {playing ? '一時停止' : '再生'}
            </button>
            <button type="button" onClick={() => playerRef.current?.nextVideo()} className={`${ui.btnSecondary} ${ui.btnSmall}`}>次の曲</button>
            <button type="button" aria-pressed={shuffle} onClick={toggleShuffle} className={`${shuffle ? ui.btnPrimary : ui.btnSecondary} ${ui.btnSmall}`}>シャッフル</button>
          </div>
          {notice && !error && <p role="status" className={`mt-2 text-center ${ui.muted}`}>{notice}</p>}
          {error && <p role="alert" className={`mt-2 text-center ${ui.error}`}>{error}</p>}
          <p className="mt-2 text-center text-xs text-gray-300">画面ロックや別アプリへの切り替えで再生は止まります。広告が流れることがあります。</p>
        </>
      )}
    </section>
  )
}
