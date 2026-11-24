import { playNext, setMusicUrl } from '@/core/player/player'
import { setStatusText } from '@/core/player/playStatus'
import { getPosition, isEmpty, setStop } from '@/plugins/player'
import { isActive } from '@/utils/tools'
import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { setNowPlayTime } from '@/core/player/progress'
import { getCurrentSourceId, isUserApiMode, markSourcePlaybackFailed, markSourcePlaybackSuccess, switchToRandomSource } from '@/core/musicSource/autoSelect'


export default () => {
  let retryNum = 0
  let prevTimeoutId: string | null = null

  let loadingTimeout: number | null = null
  let delayNextTimeout: number | null = null

  /** 音频加载失败时标记当前音源并随机换源，让随后的 URL 刷新走新音源 */
  const switchSourceOnError = async(reason: 'load' | 'timeout' = 'load') => {
    if (!isUserApiMode()) return
    // 25s 缓冲超时可能只是网络慢：只由调用方刷新 URL，不换源也不降权
    if (reason == 'timeout') return
    const failedId = getCurrentSourceId()
    markSourcePlaybackFailed(failedId)
    await switchToRandomSource(false, failedId)
  }

  const startLoadingTimeout = () => {
    // console.log('start load timeout')
    clearLoadingTimeout()
    loadingTimeout = BackgroundTimer.setTimeout(async() => {
      // 如果加载超时，则尝试刷新URL（先换音源）
      if (prevTimeoutId == playerState.musicInfo.id) {
        prevTimeoutId = null
        void playNext(true)
      } else {
        prevTimeoutId = playerState.musicInfo.id
        await switchSourceOnError('timeout')
        if (playerState.playMusicInfo.musicInfo) setMusicUrl(playerState.playMusicInfo.musicInfo, true)
      }
    }, 25000)
  }
  const clearLoadingTimeout = () => {
    if (!loadingTimeout) return
    // console.log('clear load timeout')
    BackgroundTimer.clearTimeout(loadingTimeout)
    loadingTimeout = null
  }

  const clearDelayNextTimeout = () => {
    // console.log(this.delayNextTimeout)
    if (!delayNextTimeout) return
    BackgroundTimer.clearTimeout(delayNextTimeout)
    delayNextTimeout = null
  }
  const addDelayNextTimeout = () => {
    clearDelayNextTimeout()
    delayNextTimeout = BackgroundTimer.setTimeout(() => {
      if (global.lx.isPlayedStop) {
        setStatusText('')
        return
      }
      void playNext(true)
    }, 5000)
  }

  const handleLoadstart = () => {
    console.log('handleLoadstart', playerState.isPlay)
    if (global.lx.isPlayedStop || !playerState.isPlay) return
    startLoadingTimeout()
    setStatusText(global.i18n.t('player__loading'))
  }

  // const handleLoadeddata = () => {
  //   setStatusText(global.i18n.t('player__loading'))
  // }

  // const handleCanplay = () => {
  //   setStatusText('')
  // }

  const handlePlaying = () => {
    setStatusText('')
    clearLoadingTimeout()
    // 音频真正开始播放，才允许清零播放层失败（取链成功不算），并记录实际成功的音质
    if (isUserApiMode()) {
      markSourcePlaybackSuccess(getCurrentSourceId(), String(settingState.setting['player.playQuality'] ?? '128k'))
    }
  }

  const handleEmpied = () => {
    clearDelayNextTimeout()
    clearLoadingTimeout()
  }

  const handleWating = () => {
    setStatusText(global.i18n.t('player__buffering'))
  }

  const handleError = async() => {
    if (!playerState.musicInfo.id) return
    clearLoadingTimeout()
    if (global.lx.isPlayedStop) return
    if (playerState.playMusicInfo.musicInfo && retryNum < 2) { // 若音频URL无效则尝试刷新2次URL
      let musicInfo = playerState.playMusicInfo.musicInfo
      // 每次刷新前先换源，避免同一个坏源反复给出失效链接
      await switchSourceOnError()
      void getPosition().then((position) => {
        if (position) setNowPlayTime(position)
      }).finally(() => {
        // console.log(this.retryNum)
        if (playerState.playMusicInfo.musicInfo !== musicInfo) return
        retryNum++
        setMusicUrl(playerState.playMusicInfo.musicInfo, true)
        setStatusText(global.i18n.t('player__refresh_url'))
      })
      return
    }
    if (!isEmpty()) void setStop()

    if (isActive()) {
      setStatusText(global.i18n.t('player__error'))
      setTimeout(addDelayNextTimeout)
    } else {
      console.warn('error skip to next')
      void playNext(true)
    }
  }

  const handleSetPlayInfo = () => {
    retryNum = 0
    prevTimeoutId = null
    clearDelayNextTimeout()
    clearLoadingTimeout()
  }

  // const handlePlayedStop = () => {
  //   clearDelayNextTimeout()
  //   clearLoadingTimeout()
  // }


  global.app_event.on('playerLoadstart', handleLoadstart)
  // global.app_event.on('playerLoadeddata', handleLoadeddata)
  // global.app_event.on('playerCanplay', handleCanplay)
  global.app_event.on('playerPlaying', handlePlaying)
  global.app_event.on('playerWaiting', handleWating)
  global.app_event.on('playerEmptied', handleEmpied)
  global.app_event.on('playerError', handleError)
  global.app_event.on('musicToggled', handleSetPlayInfo)
}
