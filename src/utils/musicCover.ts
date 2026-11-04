import { getPicUrl } from '@/core/music/online'

/** 列表封面缓存 + 并发限流，避免长列表一次性发起大量图片请求 */
const cache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()
const queue: Array<() => void> = []
let active = 0
const MAX_CONCURRENT = 4

const keyOf = (musicInfo: LX.Music.MusicInfoOnline) => `${musicInfo.source}_${musicInfo.id}`

const pump = () => {
  while (active < MAX_CONCURRENT && queue.length) queue.shift()!()
}

export const getCachedMusicCover = (musicInfo: LX.Music.MusicInfoOnline): string =>
  cache.get(keyOf(musicInfo)) ?? (musicInfo.meta.picUrl as string | undefined) ?? ''

export const loadMusicCover = (musicInfo: LX.Music.MusicInfoOnline): Promise<string> => {
  const key = keyOf(musicInfo)
  const cached = getCachedMusicCover(musicInfo)
  if (cached) {
    cache.set(key, cached)
    return Promise.resolve(cached)
  }
  if (inflight.has(key)) return inflight.get(key)!

  const task = new Promise<string>((resolve, reject) => {
    queue.push(() => {
      active++
      void getPicUrl({ musicInfo, isRefresh: false, allowToggleSource: false })
        .then(url => {
          if (url) { cache.set(key, url); resolve(url) }
          else reject(new Error('empty pic url'))
        })
        .catch(reject)
        .finally(() => {
          active--
          inflight.delete(key)
          pump()
        })
    })
    pump()
  })
  inflight.set(key, task)
  return task
}
