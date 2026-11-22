import { LIST_IDS } from '@/config/constant'
import { overwriteListMusics } from '@/core/list'
import playerState from '@/store/player/state'
import { getListMusicSync } from '@/utils/listManage'

/**
 * 切到随机播放时把当前播放队列打乱一次。
 * 当前歌曲保持在原 index 不动（播放器靠 playerPlayIndex 定位），只打乱其余歌曲；
 * 只处理 temp 队列，避免改写用户歌单 / 播放历史的顺序。
 */
export const shuffleCurrentQueue = () => {
  const listId = playerState.playInfo.playerListId
  if (listId != LIST_IDS.TEMP) return

  const current = [...getListMusicSync(LIST_IDS.TEMP)]
  if (current.length < 3) return

  const music = playerState.playMusicInfo.musicInfo
  const idx = music ? current.findIndex(m => m.id == music.id) : -1
  if (idx < 0) return

  const rest = [...current.slice(0, idx), ...current.slice(idx + 1)]
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = rest[i]
    rest[i] = rest[j]
    rest[j] = tmp
  }
  const next = [...rest.slice(0, idx), current[idx], ...rest.slice(idx)]
  void overwriteListMusics(LIST_IDS.TEMP, next)
}
