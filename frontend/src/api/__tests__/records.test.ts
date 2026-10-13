import { createRecord, getRecord, updateRecord } from '../records'
import { apiRequest } from '../client'

vi.mock('../client', () => ({ apiRequest: vi.fn() }))

const backendSession = {
  id: 9,
  trainingDate: '2026-10-13',
  note: 'メモ',
  exercises: [
    { exerciseId: 5, exerciseName: 'チェストプレス', category: '胸', sets: [{ reps: 10, durationSeconds: null, weightKg: 40, calorieEstimateId: 3, estimatedCaloriesKcal: 3.15 }] },
    { exerciseId: 1, exerciseName: 'トレッドミル', category: '有酸素', sets: [{ reps: null, durationSeconds: 600, weightKg: null }] },
  ],
}

describe('records API mapping', () => {
  beforeEach(() => { vi.mocked(apiRequest).mockReset() })

  test('flattens a backend session into screen sets', async () => {
    vi.mocked(apiRequest).mockResolvedValue(backendSession)

    const record = await getRecord('9')

    expect(apiRequest).toHaveBeenCalledWith('/training-sessions/9')
    expect(record).toMatchObject({ id: '9', date: '2026-10-13', note: 'メモ', exerciseId: '5' })
    expect(record.sets).toEqual([
      { exerciseId: '5', exerciseName: 'チェストプレス', exerciseGroup: '胸', type: 'reps', reps: 10, timeSeconds: undefined, weight: 40, calorieEstimateId: 3, estimatedCaloriesKcal: 3.15 },
      { exerciseId: '1', exerciseName: 'トレッドミル', exerciseGroup: '有酸素', type: 'time', reps: undefined, timeSeconds: 600, weight: undefined, calorieEstimateId: undefined, estimatedCaloriesKcal: undefined },
    ])
  })

  test('groups sets by exercise when creating and keeps calorie estimate ids', async () => {
    vi.mocked(apiRequest).mockResolvedValue(backendSession)

    await createRecord({
      date: '2026-10-13',
      exerciseId: '5',
      sets: [
        { exerciseId: '5', type: 'reps', reps: 10, weight: 40, calorieEstimateId: 3 },
        { exerciseId: '1', type: 'time', timeSeconds: 600 },
        { exerciseId: '5', type: 'reps', reps: 8 },
      ],
    })

    const [path, init] = vi.mocked(apiRequest).mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/training-sessions')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.exercises).toHaveLength(2)
    expect(body.exercises[0]).toMatchObject({ exerciseId: 5, displayOrder: 1 })
    expect(body.exercises[0].sets).toEqual([
      { reps: 10, weightKg: 40, calorieEstimateId: 3 },
      { reps: 8 },
    ])
    expect(body.exercises[1]).toMatchObject({ exerciseId: 1, displayOrder: 2, sets: [{ durationSeconds: 600 }] })
  })

  test('updates with PUT and rejects sets without an exercise', async () => {
    vi.mocked(apiRequest).mockResolvedValue(backendSession)

    await updateRecord('9', { date: '2026-10-14', note: '更新', exerciseId: '5', sets: [{ type: 'reps', reps: 5 }] })
    const [path, init] = vi.mocked(apiRequest).mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/training-sessions/9')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toMatchObject({ trainingDate: '2026-10-14', note: '更新' })

    await expect(createRecord({ date: '2026-10-14', exerciseId: '', sets: [{ type: 'reps', reps: 5 }] })).rejects.toThrow('種目を選択してください')
  })
})