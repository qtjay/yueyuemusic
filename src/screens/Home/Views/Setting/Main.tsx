import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'

import Basic from './settings/Basic'
import Player from './settings/Player'
import List from './settings/List'
import Sync from './settings/Sync'
import Backup from './settings/Backup'
import Other from './settings/Other'

/** 只保留对当前 Square 界面/播放器/数据层确实生效的分组；桌面歌词与 LX Music 关于页已移除 */
export const SETTING_SCREENS = [
  'basic',
  'player',
  'list',
  'sync',
  'backup',
  'other',
] as const

export type SettingScreenIds = typeof SETTING_SCREENS[number]

// interface MainProps {
//   onUpdateActiveId: (id: string) => void
// }
export interface MainType {
  setActiveId: (id: SettingScreenIds) => void
}

const Main = forwardRef<MainType, {}>((props, ref) => {
  // 旧版本可能把已移除的分组（search/version）存进 settingActiveId，回退到 basic 避免空白页
  const [id, setId] = useState<SettingScreenIds>(() =>
    SETTING_SCREENS.includes(global.lx.settingActiveId as SettingScreenIds)
      ? global.lx.settingActiveId as SettingScreenIds
      : 'basic')

  useImperativeHandle(ref, () => ({
    setActiveId(id) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setId(id)
        })
      })
    },
  }))

  const component = useMemo(() => {
    switch (id) {
      case 'player': return <Player />
      case 'list': return <List />
      case 'sync': return <Sync />
      case 'backup': return <Backup />
      case 'other': return <Other />
      case 'basic':
      default: return <Basic />
    }
  }, [id])

  return component
})


export default Main

