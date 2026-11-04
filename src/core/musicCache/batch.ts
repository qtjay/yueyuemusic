import settingState from '@/store/setting/state'
import { getPlayQuality, handleGetOnlineMusicUrl } from '@/core/music/utils'
import { cacheMusic, isCached } from './index'

export interface BatchCacheResult {
  success: number
  skipped: number
  failed: number
}

export interface BatchCacheOptions {
  /** 缓存归属歌单，用于按歌单分类管理 */
  listId?: string
  listName?: string
  onProgress?: (done: number, total: number) => void
}

export type CacheSingleResult = 'success' | 'skipped' | 'failed'

/**
 * 缓存单曲（队列与批量共用）
 * 直接走 handleGetOnlineMusicUrl，绕过 getMusicUrl 的自动缓存，避免重复下载
 */
export const cacheSingleMusic = async(
  item: LX.Music.MusicInfo | LX.Player.PlayMusic,
  options: BatchCacheOptions = {},
): Promise<CacheSingleResult> => {
  try {
    // 下载列表项的歌曲信息在 metadata.musicInfo 中
    const musicInfo: LX.Music.MusicInfo = 'metadata' in item
      ? (item as LX.Download.ListItem).metadata.musicInfo
      : item as LX.Music.MusicInfo
    if (musicInfo.source == 'local') return 'skipped'

    const online = musicInfo as LX.Music.MusicInfoOnline
    const quality = getPlayQuality(settingState.setting['player.playQuality'], online)
    if (await isCached(online, quality)) return 'skipped'

    const { url, quality: urlQuality, musicInfo: targetMusicInfo } = await handleGetOnlineMusicUrl({
      musicInfo: online,
      isRefresh: false,
      allowToggleSource: true,
      onToggleSource: () => {},
    })
    if (!url.startsWith('http')) return 'skipped'

    await cacheMusic(targetMusicInfo as LX.Music.MusicInfoOnline, urlQuality, url, {
      listId: options.listId,
      listName: options.listName,
    })
    return 'success'
  } catch {
    return 'failed'
  }
}

/** 批量缓存歌曲（串行，避免同时发起大量下载） */
export const batchCacheMusic = async(
  musicInfos: Array<LX.Music.MusicInfo | LX.Player.PlayMusic>,
  options: BatchCacheOptions = {},
): Promise<BatchCacheResult> => {
  const result: BatchCacheResult = { success: 0, skipped: 0, failed: 0 }
  let done = 0

  for (const item of musicInfos) {
    const status = await cacheSingleMusic(item, options)
    if (status == 'success') result.success++
    else if (status == 'skipped') result.skipped++
    else result.failed++
    done++
    options.onProgress?.(done, musicInfos.length)
  }
  return result
}
