/** Square 界面与内嵌旧页面之间的详情打开桥接 */
export interface SquareDetailPayload {
  mode: 'songlist' | 'leaderboard'
  id: string
  source: LX.OnlineSource
  name: string
}

let handler: ((payload: SquareDetailPayload) => void) | null = null
let songsHandler: ((songs: LX.Music.MusicInfoOnline[]) => void) | null = null
let batchHandler: (() => void) | null = null

/** 由 Square 容器注册；旧页面点击歌单/榜单时优先走这里 */
export const setSquareDetailHandler = (fn: ((payload: SquareDetailPayload) => void) | null) => {
  handler = fn
}

/** 返回 true 表示已交给 Square 处理，旧页面应跳过自身导航 */
export const openSquareDetail = (payload: SquareDetailPayload): boolean => {
  if (!handler) return false
  handler(payload)
  return true
}

/** 排行榜一级的歌曲列表变化通知，供 Square 自绘「播放全部」操作条使用 */
export const setLeaderboardSongsHandler = (fn: ((songs: LX.Music.MusicInfoOnline[]) => void) | null) => {
  songsHandler = fn
}
export const emitLeaderboardSongs = (songs: LX.Music.MusicInfoOnline[]) => {
  songsHandler?.(songs)
}

/** 由 MusicList 注册，Square 操作条的「批量编辑」按钮调用 */
export const setLeaderboardBatchHandler = (fn: (() => void) | null) => {
  batchHandler = fn
}
export const emitLeaderboardBatch = () => {
  batchHandler?.()
}
