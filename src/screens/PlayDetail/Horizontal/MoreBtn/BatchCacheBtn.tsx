import { memo } from 'react'
import Btn from './Btn'
import { toast } from '@/utils/tools'
import { batchCacheMusic } from '@/core/musicCache/batch'
import playerState from '@/store/player/state'
import listState from '@/store/list/state'

/** 批量缓存当前播放列表（临时列表则只缓存当前歌曲） */
export default memo(() => {
  const handlePress = () => {
    const listId = playerState.playMusicInfo?.listId ?? undefined
    const musics = listId ? listState.allMusicList.get(listId) : undefined
    const current = playerState.playMusicInfo?.musicInfo
    const targets = musics?.length ? musics : (current ? [current] : [])
    if (!targets.length) {
      toast('当前没有可缓存的歌曲')
      return
    }
    toast(`开始缓存 ${targets.length} 首歌曲...`)
    void batchCacheMusic(targets, {
      listId,
      listName: listId ? listState.allList.find(l => l.id == listId)?.name : undefined,
    }).then(res => {
      toast(`缓存完成：成功 ${res.success} 首，跳过 ${res.skipped} 首，失败 ${res.failed} 首`)
    })
  }

  return <Btn icon="download-2" onPress={handlePress} />
})
