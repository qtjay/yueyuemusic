import { useWindowDimensions } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import themeState from '@/store/theme/state'

/** musicsquare 设计令牌（oklch 近似为 hex） */
export const COLOR = {
  light: {
    accent: '#31c27c',
    accentStrong: '#20a866',
    accentSoft: 'rgba(49, 194, 124, 0.12)',
    bg: '#f7faf8',
    header: '#ffffff',
    surface: '#ffffff',
    surface2: '#f0f5f2',
    surface3: '#e8efeb',
    text: '#333b37',
    text2: '#6d7b74',
    text3: '#94a19b',
    line: '#e3eae6',
    danger: '#e05252',
  },
  dark: {
    accent: '#4ed89a',
    accentStrong: '#7ae8b4',
    accentSoft: 'rgba(78, 216, 154, 0.14)',
    bg: '#232624',
    header: '#2b2f2c',
    surface: '#2f3330',
    surface2: '#3a3f3c',
    surface3: '#454a47',
    text: '#eceeed',
    text2: '#a9b2ad',
    text3: '#7d8781',
    line: '#3d423f',
    danger: '#e06666',
  },
} as const

export type SquareColors = typeof COLOR.light | typeof COLOR.dark

export const RADIUS = { sm: 10, md: 14, lg: 18, pill: 999 } as const
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const
export const SIDEBAR_W = 200
export const PLAYER_H = 84
export const TABLET_BREAKPOINT = 600
export const TRACK_ROW_H = 60

/** 主题切换时 useTheme() 会触发重渲染，据此读取当前明暗 */
export const useSquareColors = (): SquareColors => {
  useTheme()
  return themeState.theme.isDark ? COLOR.dark : COLOR.light
}

/**
 * 600dp 分界：平板（含折叠展开）常驻侧栏，手机用抽屉。
 * useWindowDimensions 会随旋转/分屏实时更新，对应 musicsquare「窗口缩放也正确响应」的经验。
 */
export const useLayoutMode = () => {
  const { width, height } = useWindowDimensions()
  return {
    width,
    height,
    isTablet: width >= TABLET_BREAKPOINT,
    isCompact: width < 520,
  }
}
