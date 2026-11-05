import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { View } from 'react-native'

import DorpDownMenu from '@/components/common/DorpDownMenu'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import type { BoardItem } from '@/store/leaderboard/state'

export interface ActiveListNameProps {
  boards: Readonly<BoardItem[]>
  onBoundChange: (id: string) => void
}
export interface ActiveListNameType {
  setBound: (id: string, name: string) => void
}

/** 榜单选择改为按钮下方展开的下拉菜单，与平台/排序选择器统一 */
export default forwardRef<ActiveListNameType, ActiveListNameProps>(({ boards, onBoundChange }, ref) => {
  const [currentListName, setCurrentListName] = useState('')
  const [activeId, setActiveId] = useState('')

  useImperativeHandle(ref, () => ({
    setBound(id, name) {
      setCurrentListName(name)
      setActiveId(id)
    },
  }), [])

  const menus = useMemo(() => boards.map(b => ({ label: b.name, action: b.id })), [boards])

  return (
    <View style={styles.container}>
      <DorpDownMenu
        menus={menus}
        activeId={activeId}
        onPress={({ action }) => onBoundChange(action)}
        fontSize={16}
        btnStyle={styles.button}
        forceDown
      >
        <View style={styles.inner}>
          <Text numberOfLines={1} style={styles.text}>{currentListName}</Text>
          <Text style={styles.arrow}>▾</Text>
        </View>
      </DorpDownMenu>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    minWidth: 0,
  },
  button: {
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.08)',
    marginRight: 6,
    marginVertical: 4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingLeft: 14,
    paddingRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 16,
    paddingRight: 6,
  },
  arrow: {
    fontSize: 14,
    marginLeft: 4,
  },
})
