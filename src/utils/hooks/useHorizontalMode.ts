import { useWindowDimensions } from 'react-native'
import { isHorizontalMode } from '../tools'

/** 用 RN 官方实时尺寸，旋转/分屏后立即重算，避免启动时读到旧方向残留横屏布局 */
export default () => {
  const { width, height } = useWindowDimensions()
  return isHorizontalMode(width, height)
}
