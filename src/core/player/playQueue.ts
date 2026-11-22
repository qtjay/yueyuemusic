import { LIST_IDS } from '@/config/constant'
import { overwriteListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import playerState from '@/store/player/state'
import { getListMusicSync } from '@/utils/listManage'

/** 正在播放列表最多保存的歌曲数 */
export const MAX_QUEUE_SIZE = 300

const getQueue = () => [...getListMusicSync(LIST_IDS.TEMP)]

/** 当前播放歌曲在真实队列数组中的位置 */
export const getQueueIndex = () => {
  const list = getListMusicSync(LIST_IDS.TEMP)
  const idx = playerState.playInfo.playerPlayIndex
  if (idx >= 0 && idx < list.length) return idx
  const id = playerState.playMusicInfo.musicInfo?.id
  const found = id ? list.findIndex(m => m.id == id) : -1
  return found >= 0 ? found : 0
}

/** 超过上限时按加入顺序移除数组尾部（最早加入的），并保护当前正在播放的歌 */
export const trimQueue = (list: LX.Music.MusicInfo[]) => {
  if (list.length <= MAX_QUEUE_SIZE) return list
  const keep = list.slice(0, MAX_QUEUE_SIZE)
  const currentId = playerState.playMusicInfo.musicInfo?.id
  const droppedCurrent = list.slice(MAX_QUEUE_SIZE).find(m => m.id == currentId)
  if (!droppedCurrent) return keep
  return [...keep.slice(0, -1), droppedCurrent]
}

const writeQueue = (list: LX.Music.MusicInfo[], onDone?: () => void) => {
  void overwriteListMusics(LIST_IDS.TEMP, trimQueue(list)).then(() => { onDone?.() })
}

/** 其它列表点「播放全部」：整批插到当前歌之前，并立即播这一批的第一首 */
export const insertBatchAndPlay = (songs: LX.Music.MusicInfo[]) => {
  if (!songs.length) return
  const current = getQueue()
  const at = Math.min(getQueueIndex(), current.length)
  writeQueue([...current.slice(0, at), ...songs, ...current.slice(at)], () => {
    void playList(LIST_IDS.TEMP, at)
  })
}

/** 其它列表「加入稍后播放」：整批插到当前歌之后，不切歌 */
export const insertBatchLater = (songs: LX.Music.MusicInfo[]) => {
  if (!songs.length) return
  const current = getQueue()
  const at = Math.min(getQueueIndex() + 1, current.length)
  writeQueue([...current.slice(0, at), ...songs, ...current.slice(at)])
}

/** 单点歌曲：插到当前歌之后并立即播，播完自然继续原队列 */
export const insertSingleAndPlay = (musicInfo: LX.Music.MusicInfo) => {
  const current = getQueue()
  const at = Math.min(getQueueIndex() + 1, current.length)
  writeQueue([...current.slice(0, at), musicInfo, ...current.slice(at)], () => {
    void playList(LIST_IDS.TEMP, at)
  })
}
