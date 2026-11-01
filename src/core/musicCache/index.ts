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
  /** 本地文件绝对路径 */
  path: string
  /** 文件字节大小 */
  size: number
  /** 缓存时间 */
  createdAt: number
}

const CACHE_INDEX_KEY = 'yueyue_music_cache_index'
/** 缓存根目录，放在应用私有文档目录，避免被系统随意清理 */
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
    try {
      await mkdir(CACHE_DIR)
    } catch { /* 目录可能已存在 */ }
  }
  cacheDirReady = true
}

/** 已缓存歌曲列表（按时间倒序） */
export const getCacheList = async(): Promise<MusicCacheItem[]> => {
  const index = await loadIndex()
  return Object.values(index).sort((a, b) => b.createdAt - a.createdAt)
}

/** 缓存统计：歌曲数与占用字节 */
export const getCacheStats = async(): Promise<{ count: number, totalSize: number }> => {
  const list = await getCacheList()
  return { count: list.length, totalSize: list.reduce((sum, item) => sum + (item.size || 0), 0) }
}

export const isCached = async(musicInfo: LX.Music.MusicInfoOnline, quality: LX.Quality): Promise<boolean> => {
  const index = await loadIndex()
  const item = index[buildCacheKey(musicInfo, quality)]
  return !!item && await existsFile(item.path)
}

/**
 * 获取本地缓存文件路径，不存在则返回 null
 * 播放时优先走这里，实现离线播放
 */
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

/**
 * 查找该歌曲任意音质的本地缓存文件
 * 用于离线播放：即使当前播放音质与缓存音质不同，也能命中已缓存文件
 */
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

/**
 * 缓存歌曲到本地
 * @param url 在线音频地址
 * @param onProgress 下载进度回调（0~1）
 */
export const cacheMusic = async(
  musicInfo: LX.Music.MusicInfoOnline,
  quality: LX.Quality,
  url: string,
  onProgress?: (progress: number) => void,
): Promise<MusicCacheItem> => {
  await ensureCacheDir()
  const key = buildCacheKey(musicInfo, quality)
  const path = buildCacheFilePath(musicInfo, quality)

  // 已存在同名缓存则先删除，保证重新缓存取到最新文件
  if (await existsFile(path)) {
    try { await unlink(path) } catch { /* ignore */ }
  }

  const result = await downloadFile(url, path, {
    progress: (res) => {
      if (!onProgress) return
      const total = Number(res.contentLength)
      if (total > 0) onProgress(Math.min(1, Number(res.bytesWritten) / total))
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
    path,
    size: Number(fileInfo.size ?? 0),
    createdAt: Date.now(),
  }
  index[key] = item
  await saveIndex()
  return item
}

/** 删除指定缓存 */
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

/** 清空全部缓存 */
export const clearCache = async() => {
  const index = await loadIndex()
  await removeCache(Object.keys(index))
  cacheIndex = {}
  await saveIndex()
}

/** 删除失效缓存记录（文件已被系统清理的情况） */
export const pruneInvalidCache = async(): Promise<number> => {
  const index = await loadIndex()
  const invalidKeys: string[] = []
  for (const [key, item] of Object.entries(index)) {
    if (!await existsFile(item.path)) invalidKeys.push(key)
  }
  if (invalidKeys.length) await removeCache(invalidKeys)
  return invalidKeys.length
}
