import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { View } from 'react-native'

import DorpDownMenu from '@/components/common/DorpDownMenu'
import { createStyle } from '@/utils/tools'
import { PILL_BASE_HEIGHT } from '@/utils/pillSize'
import { usePillTextColor } from '@/screens/Square/tokens'
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
  const pillTextColor = usePillTextColor()

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
        fontSize={13}
        btnStyle={styles.button}
        menuWidth={160}
        forceDown
      >
        <View style={styles.inner}>
          <Text color={pillTextColor} numberOfLines={1} style={styles.text}>{currentListName}</Text>
          <Text color={pillTextColor} style={styles.arrow}>▾</Text>
        </View>
      </DorpDownMenu>
    </View>
  )
})

const styles = createStyle({
  container: {
    // 父容器是 flexDirection:'row' + alignItems:'center'。
    // 这里不能用 alignSelf:'flex-start'（在 row 中控制的是垂直方向，会让药丸整体靠上、与左侧平台选择器不齐）。
    // 只保留宽度约束，让父级居中生效。
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 220,
  },
  button: {
    alignSelf: 'flex-start',
    minHeight: PILL_BASE_HEIGHT,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
    backgroundColor: 'rgba(128,128,128,0.08)',
    marginRight: 6,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: PILL_BASE_HEIGHT,
    paddingLeft: 14,
    paddingRight: 14,
  },
  text: {
    // 不拉伸：文字按榜单名长度自适应，过长时由 numberOfLines 截断
    // 不额外加 paddingRight，▾ 与其他筛选药丸一样只靠 arrow.marginLeft:4
    flexShrink: 1,
    fontSize: 13,
  },
  arrow: {
    fontSize: 14,
    marginLeft: 4,
  },
})
