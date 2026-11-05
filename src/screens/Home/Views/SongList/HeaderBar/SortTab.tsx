import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { View } from 'react-native'
import DorpDownMenu from '@/components/common/DorpDownMenu'
import songlistState, { type SortInfo, type Source } from '@/store/songlist/state'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'

export interface SortTabProps {
  onSortChange: (id: string) => void
}

export interface SortTabType {
  setSource: (source: Source, activeTab: SortInfo['id']) => void
}

/** 排序项改下拉菜单，与平台选择器同款交互，避免一排胶囊挤占筛选栏 */
export default forwardRef<SortTabType, SortTabProps>(({ onSortChange }, ref) => {
  const [sortList, setSortList] = useState<SortInfo[]>([])
  const [activeId, setActiveId] = useState<SortInfo['id']>('')
  const t = useI18n()

  useImperativeHandle(ref, () => ({
    setSource(source, activeTab) {
      setSortList(songlistState.sortList[source]!)
      setActiveId(activeTab)
    },
  }))

  const sorts = useMemo(
    () => sortList.map(s => ({ label: t(`songlist_${s.tid}`), action: s.id })),
    [sortList, t],
  )
  const activeLabel = sorts.find(s => s.action == activeId)?.label ?? ''

  return (
    <DorpDownMenu
      menus={sorts}
      activeId={activeId}
      onPress={({ action }) => { onSortChange(action); setActiveId(action) }}
      fontSize={16}
      btnStyle={styles.button}
    >
      <View style={styles.inner}>
        <Text numberOfLines={1} style={styles.label}>{activeLabel}</Text>
        <Text style={styles.arrow}>▾</Text>
      </View>
    </DorpDownMenu>
  )
})

const styles = createStyle({
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
    paddingLeft: 16,
    paddingRight: 12,
  },
  label: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  arrow: {
    fontSize: 14,
    marginLeft: 4,
  },
})
