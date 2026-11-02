import { Dirs } from 'react-native-file-system'
import { downloadFile, existsFile, stat, unlink, mkdir } from '@/utils/fs'
import { getData, saveData } from '@/plugins/storage'

export interface MusicCacheItem {
  /** 缓存唯一键：源_歌曲ID_音质 */
  key: string
  musicId: string
  source: string
  quality: string
  name: string
  singer: string
  /** 缓存时所属歌单 id（按歌单分类管理用） */
  listId?: string
  /** 缓存时所属歌单名称 */
  listName?: string
  path: string
  size: number
  createdAt: number
}

export interface CacheGroup {
  id: string
  name: string
  count: number
  size: number
}

const CACHE_INDEX_KEY = 'yueyue_music_cache_index'
const MAX_SIZE_KEY = 'yueyue_music_cache_max_size_mb'
const DEFAULT_MAX_SIZE_MB = 1024
/**「未归属歌单」分组的固定 id */
export const UNGROUPED_ID = '__none__'

export const CACHE_DIR = `${Dirs.DocumentDir}/music-cache`

let cacheIndex: Record<string, MusicCacheItem> | null = null
let cacheDirReady = false

const safeFileName = (str: string) => str.replace(/[\\/:*?"<>|]/g, '_')

export const buildCacheKey = (musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality): string =>
  `${musicInfo.source}_${musicInfo.id}_${quality}`

export const buildCacheFilePath = (musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality): string => {
  const ext = quality.startsWith('flac') || quality == 'wav' ? quality.split('bit')[0] : 'mp3'
  return `${CACHE_DIR}/${safeFileName(buildCacheKey(musicInfo, quality))}.${ext}`
}

const loadIndex = async(): Promise<Record<string, MusicCacheItem>> => {
  cacheIndex ??= (await getData<Record<string, MusicCacheItem>>(CACHE_INDEX_KEY)) ?? {}
  return cacheIndex
}

const saveIndex = async() => {
  await saveData(CACHE_INDEX_KEY, cacheIndex ?? {})
}

export const ensureCacheDir = async() => {
  if (cacheDirReady) return
  if (!await existsFile(CACHE_DIR)) {
    try { await mkdir(CACHE_DIR) } catch { /* 目录可能已存在 */ }
  }
  cacheDirReady = true
}

/** 缓存容量上限（MB），用户可在设置里自行调整 */
export const getCacheMaxSize = async(): Promise<number> => {
  const value = await getData<number>(MAX_SIZE_KEY)
  return typeof value == 'number' && value > 0 ? value : DEFAULT_MAX_SIZE_MB
}

export const setCacheMaxSize = async(mb: number) => {
  await saveData(MAX_SIZE_KEY, mb > 0 ? Math.round(mb) : DEFAULT_MAX_SIZE_MB)
  await enforceCacheLimit()
}

/** 超过容量上限时按时间从旧到新淘汰 */
export const enforceCacheLimit = async(): Promise<number> => {
  const index = await loadIndex()
  const maxBytes = (await getCacheMaxSize()) * 1024 * 1024
  let total = Object.values(index).reduce((sum, item) => sum + (item.size || 0), 0)
  if (total <= maxBytes) return 0

  const oldestFirst = Object.values(index).sort((a, b) => a.createdAt - b.createdAt)
  const keys: string[] = []
  for (const item of oldestFirst) {
    if (total <= maxBytes) break
    keys.push(item.key)
    total -= item.size || 0
  }
  await removeCache(keys)
  return keys.length
}

export const getCacheList = async(): Promise<MusicCacheItem[]> => {
  const index = await loadIndex()
  return Object.values(index).sort((a, b) => b.createdAt - a.createdAt)
}

export const getCacheStats = async(): Promise<{ count: number, totalSize: number }> => {
  const list = await getCacheList()
  return { count: list.length, totalSize: list.reduce((sum, item) => sum + (item.size || 0), 0) }
}

/** 按歌单分组统计 */
export const getCacheGroups = async(): Promise<CacheGroup[]> => {
  const list = await getCacheList()
  const map = new Map<string, CacheGroup>()
  for (const item of list) {
    const id = item.listId ?? UNGROUPED_ID
    const name = item.listName ?? (id == UNGROUPED_ID ? '其他' : id)
    const group = map.get(id) ?? { id, name, count: 0, size: 0 }
    group.count++
    group.size += item.size || 0
    map.set(id, group)
  }
  return [...map.values()].sort((a, b) => b.size - a.size)
}

export const isCached = async(musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality): Promise<boolean> => {
  const index = await loadIndex()
  const item = index[buildCacheKey(musicInfo, quality)]
  return !!item && await existsFile(item.path)
}

/** 播放时优先返回本地缓存文件，实现离线播放 */
export const getCachedMusicFilePath = async(musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality): Promise<string | null> => {
  await ensureCacheDir()
  const index = await loadIndex()
  const key = buildCacheKey(musicInfo, quality)
  const item = index[key]
  if (!item) return null
  if (!await existsFile(item.path)) {
    delete index[key]
    void saveIndex()
    return null
  }
  return item.path
}

/** 同歌任意音质的缓存都算命中（播放音质与缓存音质不同也能离线播） */
export const findAnyCachedFilePath = async(musicInfo: LX.Music.MusicInfoOnline): Promise<string | null> => {
  await ensureCacheDir()
  const index = await loadIndex()
  const prefix = `${musicInfo.source}_${musicInfo.id}_`
  for (const [key, item] of Object.entries(index)) {
    if (!key.startsWith(prefix)) continue
    if (await existsFile(item.path)) return item.path
  }
  return null
}

export interface CacheOptions {
  listId?: string
  listName?: string
  onProgress?: (progress: number) => void
}

/** 缓存歌曲到本地 */
export const cacheMusic = async(
  musicInfo: LX.Music.MusicInfoOnline,
  quality: LX.Quality,
  url: string,
  options: CacheOptions = {},
): Promise<MusicCacheItem> => {
  await ensureCacheDir()
  const key = buildCacheKey(musicInfo, quality)
  const path = buildCacheFilePath(musicInfo, quality)

  if (await existsFile(path)) {
    try { await unlink(path) } catch { /* ignore */ }
  }

  const result = await downloadFile(url, path, {
    progress: (res) => {
      if (!options.onProgress) return
      const total = Number(res.contentLength)
      if (total > 0) options.onProgress(Math.min(1, Number(res.bytesWritten) / total))
    },
  }).promise
  if (result.statusCode != 200) throw new Error(`缓存失败：HTTP ${result.statusCode}`)

  const fileInfo = await stat(path)
  const index = await loadIndex()
  const item: MusicCacheItem = {
    key,
    musicId: musicInfo.id,
    source: musicInfo.source,
    quality,
    name: musicInfo.name,
    singer: musicInfo.singer,
    listId: options.listId,
    listName: options.listName,
    path,
    size: Number(fileInfo.size ?? 0),
    createdAt: Date.now(),
  }
  index[key] = item
  await saveIndex()
  await enforceCacheLimit()
  return item
}

export const removeCache = async(keys: string[]) => {
  const index = await loadIndex()
  for (const key of keys) {
    const item = index[key]
    if (!item) continue
    try {
      if (await existsFile(item.path)) await unlink(item.path)
    } catch { /* ignore */ }
    delete index[key]
  }
  await saveIndex()
}

/** 清空某个歌单分组下的全部缓存 */
export const removeCacheByGroup = async(groupId: string) => {
  const index = await loadIndex()
  const keys = Object.values(index)
    .filter(item => (item.listId ?? UNGROUPED_ID) == groupId)
    .map(item => item.key)
  await removeCache(keys)
}

export const clearCache = async() => {
  const index = await loadIndex()
  await removeCache(Object.keys(index))
  cacheIndex = {}
  await saveIndex()
}

/** 删除文件已被系统清理的失效记录 */
export const pruneInvalidCache = async(): Promise<number> => {
  const index = await loadIndex()
  const invalidKeys: string[] = []
  for (const [key, item] of Object.entries(index)) {
    if (!await existsFile(item.path)) invalidKeys.push(key)
  }
  if (invalidKeys.length) await removeCache(invalidKeys)
  return invalidKeys.length
}
