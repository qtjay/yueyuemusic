import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import songlistState, { type SortInfo, type Source } from '@/store/songlist/state'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'

export interface SortTabProps {
  onSortChange: (id: string) => void
}

export interface SortTabType {
  setSource: (source: Source, activeTab: SortInfo['id']) => void
}


export default forwardRef<SortTabType, SortTabProps>(({ onSortChange }, ref) => {
  const [sortList, setSortList] = useState<SortInfo[]>([])
  const [activeId, setActiveId] = useState<SortInfo['id']>('')
  const t = useI18n()
  const theme = useTheme()
  const scrollViewRef = useRef<ScrollView>(null)

  useImperativeHandle(ref, () => ({
    setSource(source, activeTab) {
      scrollViewRef.current?.scrollTo({ x: 0 })
      setSortList(songlistState.sortList[source]!)
      setActiveId(activeTab)
    },
  }))

  const sorts = useMemo(() => {
    return sortList.map(s => ({ label: t(`songlist_${s.tid}`), id: s.id }))
  }, [sortList, t])

  const handleSortChange = (id: string) => {
    onSortChange(id)
    setActiveId(id)
  }

  return (
    <ScrollView ref={scrollViewRef} style={styles.container} keyboardShouldPersistTaps={'always'} horizontal>
      {
        sorts.map(s => (
          <TouchableOpacity style={[styles.button, activeId == s.id ? { backgroundColor: theme['c-primary-background-active'] } : null]} onPress={() => { handleSortChange(s.id) }} key={s.id}>
            <Text style={styles.buttonText} color={activeId == s.id ? theme['c-primary-font-active'] : theme['c-font']}>{s.label}</Text>
          </TouchableOpacity>
        ))
      }
    </ScrollView>
  )
})


const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    // paddingLeft: 5,
    // paddingRight: 5,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 36,
    paddingLeft: 14,
    paddingRight: 14,
    marginRight: 6,
    marginVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  buttonText: {
    textAlign: 'center',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
})
