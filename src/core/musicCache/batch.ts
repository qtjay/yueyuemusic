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

/**
 * 批量缓存歌曲（串行，避免同时发起大量下载）
 * 直接走 handleGetOnlineMusicUrl，绕过 getMusicUrl 的自动缓存，避免重复下载
 */
export const batchCacheMusic = async(
  musicInfos: Array<LX.Music.MusicInfo | LX.Player.PlayMusic>,
  options: BatchCacheOptions = {},
): Promise<BatchCacheResult> => {
  const result: BatchCacheResult = { success: 0, skipped: 0, failed: 0 }
  const total = musicInfos.length
  let done = 0

  for (const item of musicInfos) {
    try {
      // 下载列表项的歌曲信息在 metadata.musicInfo 中
      const musicInfo: LX.Music.MusicInfo = 'metadata' in item
        ? (item as LX.Download.ListItem).metadata.musicInfo
        : item as LX.Music.MusicInfo
      if (musicInfo.source == 'local') {
        result.skipped++
      } else {
        const online = musicInfo as LX.Music.MusicInfoOnline
        const quality = getPlayQuality(settingState.setting['player.playQuality'], online)
        if (await isCached(online, quality)) {
          result.skipped++
        } else {
          const { url, quality: urlQuality, musicInfo: targetMusicInfo } = await handleGetOnlineMusicUrl({
            musicInfo: online,
            isRefresh: false,
            allowToggleSource: true,
            onToggleSource: () => {},
          })
          if (!url.startsWith('http')) {
            result.skipped++
          } else {
            await cacheMusic(targetMusicInfo as LX.Music.MusicInfoOnline, urlQuality, url, {
              listId: options.listId,
              listName: options.listName,
            })
            result.success++
          }
        }
      }
    } catch {
      result.failed++
    }
    done++
    options.onProgress?.(done, total)
  }
  return result
}
