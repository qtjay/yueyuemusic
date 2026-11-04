import { cacheSingleMusic, type BatchCacheOptions } from './batch'

export type CacheQueueStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed'

export interface CacheQueueItem {
  key: string
  musicInfo: LX.Music.MusicInfoOnline
  name: string
  singer: string
  status: CacheQueueStatus
  options: BatchCacheOptions
}

export interface CacheQueueState {
  items: CacheQueueItem[]
  paused: boolean
  currentKey: string | null
  done: number
  total: number
}

let state: CacheQueueState = { items: [], paused: false, currentKey: null, done: 0, total: 0 }
let looping = false
const listeners = new Set<(state: CacheQueueState) => void>()

const snapshot = (): CacheQueueState => ({ ...state, items: [...state.items] })
const emit = () => {
  const snap = snapshot()
  for (const fn of listeners) fn(snap)
}

export const getCacheQueueState = snapshot

export const subscribeCacheQueue = (fn: (state: CacheQueueState) => void) => {
  listeners.add(fn)
  fn(snapshot())
  return () => { listeners.delete(fn) }
}

const runQueue = async() => {
  if (looping) return
  looping = true
  try {
    while (!state.paused) {
      const item = state.items.find(i => i.status == 'pending')
      if (!item) break
      item.status = 'running'
      state.currentKey = item.key
      emit()

      const result = await cacheSingleMusic(item.musicInfo, item.options)
      // 任务可能已被用户从队列移除
      const current = state.items.find(i => i.key == item.key)
      if (current) current.status = result == 'success' ? 'done' : result == 'skipped' ? 'skipped' : 'failed'
      state.done++
      state.currentKey = null
      emit()
    }
  } finally {
    looping = false
  }
}

/** 加入缓存队列（立即返回，实际下载在后台串行执行） */
export const enqueueCacheMusic = (
  musicInfos: Array<LX.Music.MusicInfo | LX.Player.PlayMusic>,
  options: BatchCacheOptions = {},
): number => {
  const stamp = Date.now()
  const added: CacheQueueItem[] = []
  musicInfos.forEach((raw, index) => {
    const musicInfo: LX.Music.MusicInfo = 'metadata' in raw
      ? (raw as LX.Download.ListItem).metadata.musicInfo
      : raw as LX.Music.MusicInfo
    if (musicInfo.source == 'local') return
    added.push({
      key: `${musicInfo.source}_${musicInfo.id}_${stamp}_${index}`,
      musicInfo: musicInfo as LX.Music.MusicInfoOnline,
      name: musicInfo.name,
      singer: musicInfo.singer,
      status: 'pending',
      options,
    })
  })
  if (!added.length) return 0
  state.items.push(...added)
  state.total += added.length
  emit()
  void runQueue()
  return added.length
}

export const pauseCacheQueue = () => {
  if (state.paused) return
  state.paused = true
  emit()
}

export const resumeCacheQueue = () => {
  if (!state.paused) return
  state.paused = false
  emit()
  void runQueue()
}

/** 删除队列中的歌曲（正在下载的那首无法中断传输，完成后不再计入队列） */
export const removeCacheQueueItem = (key: string) => {
  const target = state.items.find(i => i.key == key)
  if (!target) return
  state.items = state.items.filter(i => i.key != key)
  if (target.status == 'pending') {
    state.total = Math.max(0, state.total - 1)
  } else if (target.status != 'running') {
    state.total = Math.max(0, state.total - 1)
    state.done = Math.max(0, state.done - 1)
  }
  if (state.currentKey == key) state.currentKey = null
  emit()
}

export const clearFinishedCacheQueue = () => {
  const finished = state.items.filter(i => i.status == 'done' || i.status == 'skipped' || i.status == 'failed')
  if (!finished.length) return
  state.items = state.items.filter(i => i.status == 'pending' || i.status == 'running')
  state.done -= finished.length
  state.total -= finished.length
  if (state.done < 0) state.done = 0
  emit()
}
