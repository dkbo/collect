import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createRoom,
  joinRoom,
  leaveRoom,
  setGameType,
  setRoomStatus,
  subscribePlayers,
  subscribeRoom,
  type Room,
} from '@/core/room'
import { useRoomStore } from './useRoomStore'

vi.mock('@/core/firebase', () => ({ isFirebaseConfigured: true }))
vi.mock('@/core/room', () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  setGameType: vi.fn(),
  setRoomStatus: vi.fn(),
  subscribeRoom: vi.fn(() => vi.fn()),
  subscribePlayers: vi.fn(() => vi.fn()),
}))

const initialState = useRoomStore.getState()

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  roomId: 'R1',
  gameType: 'tank',
  hostId: 'S1',
  status: 'waiting',
  maxPlayers: 4,
  createdAt: null,
  ...overrides,
})

describe('useRoomStore', () => {
  beforeEach(() => {
    useRoomStore.setState(initialState, true)
  })

  it('reflects isFirebaseConfigured at module load', () => {
    expect(useRoomStore.getState().configured).toBe(true)
  })

  describe('isHost', () => {
    it('is false when there is no room yet', () => {
      useRoomStore.setState({ selfId: 'S1', room: null })
      expect(useRoomStore.getState().isHost()).toBe(false)
    })

    it('is true only when selfId matches room.hostId', () => {
      useRoomStore.setState({ selfId: 'S1', room: makeRoom({ hostId: 'S1' }) })
      expect(useRoomStore.getState().isHost()).toBe(true)

      useRoomStore.setState({ selfId: 'S2' })
      expect(useRoomStore.getState().isHost()).toBe(false)
    })
  })

  describe('create', () => {
    it('sets busy while pending, then stores roomId/selfId and subscribes on success', async () => {
      let resolveCreate!: (v: { roomId: string; selfId: string }) => void
      vi.mocked(createRoom).mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))

      const promise = useRoomStore.getState().create('Alice', 'race')
      expect(useRoomStore.getState().busy).toBe(true)

      resolveCreate({ roomId: 'R1', selfId: 'S1' })
      await promise

      expect(createRoom).toHaveBeenCalledWith('Alice', 'race')
      expect(useRoomStore.getState()).toMatchObject({ roomId: 'R1', selfId: 'S1', busy: false, error: null })
      expect(subscribeRoom).toHaveBeenCalledWith('R1', expect.any(Function))
      expect(subscribePlayers).toHaveBeenCalledWith('R1', expect.any(Function))
    })

    it('maps an unrecognized failure to the generic error message', async () => {
      vi.mocked(createRoom).mockRejectedValue(new Error('boom'))

      await useRoomStore.getState().create('Alice')

      expect(useRoomStore.getState()).toMatchObject({ busy: false, error: '連線發生錯誤，請稍後再試' })
    })
  })

  describe('join', () => {
    it('stores roomId/selfId and subscribes on success', async () => {
      vi.mocked(joinRoom).mockResolvedValue({ roomId: 'R2', selfId: 'S2' })

      await useRoomStore.getState().join('R2', 'Bob')

      expect(useRoomStore.getState()).toMatchObject({ roomId: 'R2', selfId: 'S2', busy: false })
      expect(subscribeRoom).toHaveBeenCalledWith('R2', expect.any(Function))
    })

    it('maps a known JoinError code to its user-facing message', async () => {
      vi.mocked(joinRoom).mockRejectedValue(new Error('full'))

      await useRoomStore.getState().join('R2', 'Bob')

      expect(useRoomStore.getState()).toMatchObject({ busy: false, error: '房間已滿（上限 4 人）' })
    })
  })

  describe('leave', () => {
    it('calls leaveRoom with the current isHost flag and resets state but keeps selfId', async () => {
      useRoomStore.setState({ roomId: 'R1', selfId: 'S1', room: makeRoom({ hostId: 'S1' }) })
      vi.mocked(leaveRoom).mockResolvedValue(undefined)

      await useRoomStore.getState().leave()

      expect(leaveRoom).toHaveBeenCalledWith('R1', 'S1', true)
      expect(useRoomStore.getState()).toMatchObject({ roomId: null, room: null, selfId: 'S1' })
    })

    it('does not throw when leaveRoom rejects, and still resets local state', async () => {
      useRoomStore.setState({ roomId: 'R1', selfId: 'S1', room: makeRoom({ hostId: 'other' }) })
      vi.mocked(leaveRoom).mockRejectedValue(new Error('network'))

      await expect(useRoomStore.getState().leave()).resolves.toBeUndefined()
      expect(useRoomStore.getState().roomId).toBeNull()
    })

    it('does not call leaveRoom when there is no active room', async () => {
      await useRoomStore.getState().leave()
      expect(leaveRoom).not.toHaveBeenCalled()
    })
  })

  describe('selectGame', () => {
    it('is a no-op when the caller is not the host', async () => {
      useRoomStore.setState({ roomId: 'R1', selfId: 'S2', room: makeRoom({ hostId: 'S1' }) })

      await useRoomStore.getState().selectGame('bomber')

      expect(setGameType).not.toHaveBeenCalled()
    })

    it('calls setGameType when the caller is the host', async () => {
      useRoomStore.setState({ roomId: 'R1', selfId: 'S1', room: makeRoom({ hostId: 'S1' }) })
      vi.mocked(setGameType).mockResolvedValue(undefined)

      await useRoomStore.getState().selectGame('bomber')

      expect(setGameType).toHaveBeenCalledWith('R1', 'bomber')
    })

    it('sets an error message when setGameType fails', async () => {
      useRoomStore.setState({ roomId: 'R1', selfId: 'S1', room: makeRoom({ hostId: 'S1' }) })
      vi.mocked(setGameType).mockRejectedValue(new Error('in-progress'))

      await useRoomStore.getState().selectGame('bomber')

      expect(useRoomStore.getState().error).toBe('遊戲進行中，目前無法加入')
    })
  })

  describe('startGame', () => {
    it('calls setRoomStatus("playing") only for the host', async () => {
      useRoomStore.setState({ roomId: 'R1', selfId: 'S1', room: makeRoom({ hostId: 'S1' }) })
      vi.mocked(setRoomStatus).mockResolvedValue(undefined)

      await useRoomStore.getState().startGame()

      expect(setRoomStatus).toHaveBeenCalledWith('R1', 'playing')
    })

    it('is a no-op for a non-host', async () => {
      useRoomStore.setState({ roomId: 'R1', selfId: 'S2', room: makeRoom({ hostId: 'S1' }) })

      await useRoomStore.getState().startGame()

      expect(setRoomStatus).not.toHaveBeenCalled()
    })
  })

  it('clearError resets the error field only', () => {
    useRoomStore.setState({ error: 'oops', roomId: 'R1' })
    useRoomStore.getState().clearError()
    expect(useRoomStore.getState()).toMatchObject({ error: null, roomId: 'R1' })
  })

  it('reset clears room state but preserves selfId', () => {
    useRoomStore.setState({ roomId: 'R1', selfId: 'S1', room: makeRoom(), busy: true, error: 'x' })
    useRoomStore.getState().reset()
    expect(useRoomStore.getState()).toMatchObject({ roomId: null, room: null, busy: false, error: null, selfId: 'S1' })
  })

  it('the subscribeRoom callback resets to lobby with a notice when the room is deleted', async () => {
    vi.mocked(createRoom).mockResolvedValue({ roomId: 'R1', selfId: 'S1' })
    await useRoomStore.getState().create('Alice')

    const onRoomChange = vi.mocked(subscribeRoom).mock.calls[0][1]
    onRoomChange(null)

    expect(useRoomStore.getState()).toMatchObject({ roomId: null, notice: '房主已關閉房間', selfId: 'S1' })
  })
})
