import { Dimensions } from 'react-native'

/**
 * 筛选药丸 / 菜单的基准尺寸（未经 createStyle 缩放）。
 *
 * 全站走 createStyle 按屏幕缩放后，平板上 36 会放大到约 55~60dp，用户觉得偏高，
 * 因此平板把基准调小到 28（缩放后约 45dp），手机保持 36。
 * Square 的 pillStyles 与内嵌旧 Home 组件都引用这里，保证两边同源、等高。
 */
export const PILL_BASE_HEIGHT = Dimensions.get('window').width >= 600 ? 28 : 36
