import { LIST_IDS } from '@/config/constant'
import { addListMusics, overwriteListMusics } from '@/core/list'
import { playList, playNext } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import settingState from '@/store/setting/state'
import { getListMusicSync } from '@/utils/listManage'
import { confirmDialog, openUrl, shareMusic, toast } from '@/utils/tools'
import { addDislikeInfo, hasDislike } from '@/core/dislikeList'
import playerState from '@/store/player/state'
import musicSdk from '@/utils/musicSdk'
import { toOldMusicInfo } from '@/utils'
import { clearMusicUrlByMusic } from '@/utils/data'

export const handlePlay = (musicInfo: LX.Music.MusicInfoOnline) => {
  // 播放历史只做记录，不再当播放队列
  void addListMusics(LIST_IDS.DEFAULT, [musicInfo], settingState.setting['list.addMusicLocationType'])

  // 单曲插播：放到当前播放队列「正在放的歌」之后并立即播放，播完自然继续原队列
  const current = [...getListMusicSync(LIST_IDS.TEMP)]
  const playing = playerState.playMusicInfo.musicInfo
  const found = playing ? current.findIndex(m => m.id == playing.id) : -1
  const at = found >= 0
    ? found + 1
    : Math.min(Math.max(playerState.playInfo.playerPlayIndex + 1, 0), current.length)
  const next = [...current.slice(0, at), musicInfo, ...current.slice(at)]
  void overwriteListMusics(LIST_IDS.TEMP, next).then(() => {
    void playList(LIST_IDS.TEMP, at)
  })
}
export const handlePlayLater = (musicInfo: LX.Music.MusicInfoOnline, selectedList: LX.Music.MusicInfoOnline[], onCancelSelect: () => void) => {
  if (selectedList.length) {
    addTempPlayList(selectedList.map(s => ({ listId: '', musicInfo: s })))
    onCancelSelect()
  } else {
    addTempPlayList([{ listId: '', musicInfo }])
  }
}


export const handleShare = (musicInfo: LX.Music.MusicInfoOnline) => {
  shareMusic(settingState.setting['common.shareType'], settingState.setting['download.fileName'], musicInfo)
}

export const handleShowMusicSourceDetail = async(minfo: LX.Music.MusicInfoOnline) => {
  const url = musicSdk[minfo.source as LX.OnlineSource]?.getMusicDetailPageUrl(toOldMusicInfo(minfo))
  if (!url) return
  void openUrl(url)
}

export const clearMusicUrl = async(musicInfo: LX.Music.MusicInfoOnline) => {
  try {
    await clearMusicUrlByMusic(musicInfo)
  } catch (error) {
    toast(global.i18n.t('list_remove_cache_fail_tip', { msg: (error as Error).message }))
    return
  }
  toast(global.i18n.t('list_remove_cache_success_tip'))
}

export const handleDislikeMusic = async(musicInfo: LX.Music.MusicInfoOnline) => {
  const confirm = await confirmDialog({
    message: musicInfo.singer ? global.i18n.t('lists_dislike_music_singer_tip', { name: musicInfo.name, singer: musicInfo.singer }) : global.i18n.t('lists_dislike_music_tip', { name: musicInfo.name }),
    cancelButtonText: global.i18n.t('cancel_button_text_2'),
    confirmButtonText: global.i18n.t('confirm_button_text'),
    bgClose: false,
  })
  if (!confirm) return
  await addDislikeInfo([{ name: musicInfo.name, singer: musicInfo.singer }])
  toast(global.i18n.t('lists_dislike_music_add_tip'))
  if (hasDislike(playerState.playMusicInfo.musicInfo)) {
    void playNext(true)
  }
}

