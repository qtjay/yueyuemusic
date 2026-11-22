import { insertBatchAndPlay } from '@/core/player/playQueue'
import { getListDetail, getListDetailAll } from '@/core/songlist'

const getListPlayIndex = (list: LX.Music.MusicInfoOnline[], index?: number) => {
  if (index == null) {
    index = 1
  } else {
    if (index < 1) index = 1
    else if (index > list.length) index = list.length
  }
  return index - 1
}

const playSongListDetail = async(source: LX.OnlineSource, link: string, playIndex?: number) => {
  if (link == null) return
  const id = decodeURIComponent(link)
  let list = (await getListDetail(id, source, 1)).list
  const fullList = await getListDetailAll(source, id)
  if (fullList.length) list = fullList
  if (!list.length) return
  // 统一模型：整批插入当前播放队列并立即播指定曲目
  insertBatchAndPlay(list, getListPlayIndex(list, playIndex))
}
export const playSonglist = async(source: LX.OnlineSource, link: string, playIndex?: number) => {
  try {
    await playSongListDetail(source, link, playIndex)
  } catch (err) {
    console.error(err)
    throw new Error('Get play list failed.')
  }
}
