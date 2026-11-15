import { useEffect, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { getData, saveData } from '@/plugins/storage'

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
    text2: '#5a6861',
    text3: '#6d7b74',
    line: '#e3eae6',
    danger: '#e05252',
  },
  dark: {
    accent: '#2fb37c',
    accentStrong: '#4ed89a',
    accentSoft: 'rgba(47, 179, 124, 0.16)',
    bg: '#232624',
    header: '#2b2f2c',
    surface: '#2f3330',
    surface2: '#3a3f3c',
    surface3: '#454a47',
    text: '#eceeed',
    text2: '#bcc5c0',
    text3: '#a0aaa3',
    line: '#3d423f',
    danger: '#e06666',
  },
} as const

export type SquareColors = typeof COLOR.light | typeof COLOR.dark

export const RADIUS = { sm: 10, md: 14, lg: 18, pill: 999 } as const
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const

/**
 * 全局默认控件尺寸风格（项目约定）：
 * 今后所有新增/修改的按钮、选择框、图标按钮、拖拽手柄，
 * 只要需求未特别说明尺寸，一律套用本常量，不得另写死值。
 */
export const UI = {
  buttonMinHeight: 32,
  buttonFontSize: 12,
  buttonPaddingH: SPACE.xs,
  buttonRadius: RADIUS.sm,
  buttonGap: SPACE.xs,
  checkboxSize: 18,
  checkboxRadius: 9,
  iconButtonSize: 32,
  dragHandleSize: 44,
  headerFontSize: 14,
} as const

export const SIDEBAR_W = 200
export const PLAYER_H = 84
export const TABLET_BREAKPOINT = 600
export const TRACK_ROW_H = 60

/**
 * Square 独立深色模式：单一状态源 + 持久化 + 订阅。
 * 不复用旧主题系统（设置页原来传的 yueyue/yueyue_dark 主题 id 并不存在）。
 */
const COLOR_MODE_KEY = '@square_color_mode'
let darkMode = false
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const notify = () => { for (const fn of listeners) fn() }

/** 恢复上次的明暗选择，只执行一次 */
export const initColorMode = () => {
  if (loading) return loading
  loading = getData<boolean>(COLOR_MODE_KEY)
    .then(v => {
      darkMode = v === true
      loaded = true
      notify()
    })
    .catch(() => { loaded = true })
  return loading
}

export const setColorMode = (isDark: boolean) => {
  darkMode = isDark
  void saveData(COLOR_MODE_KEY, isDark)
  notify()
}

export const useColorMode = (): boolean => {
  const [dark, setDark] = useState(darkMode)
  useEffect(() => {
    const fn = () => setDark(darkMode)
    listeners.add(fn)
    if (!loaded) void initColorMode()
    return () => { listeners.delete(fn) }
  }, [])
  return dark
}

export const useSquareColors = (): SquareColors => useColorMode() ? COLOR.dark : COLOR.light

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
