import { forwardRef, type Ref, useImperativeHandle, useMemo, useState } from 'react'
import { View } from 'react-native'

import DorpDownMenu, { type DorpDownMenuProps as _DorpDownMenuProps } from '@/components/common/DorpDownMenu'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'

import { useSettingValue } from '@/store/setting/hook'
import { createFixedStyle } from '@/utils/tools'

type Sources = Readonly<Array<LX.OnlineSource | 'all'>>

export interface SourceSelectorProps<S extends Sources> {
  fontSize?: number
  center?: _DorpDownMenuProps<any>['center']
  forceDown?: boolean
  onSourceChange: (source: S[number]) => void
}

export interface SourceSelectorType<S extends Sources> {
  setSourceList: (list: S, activeSource: S[number]) => void
}

export const useSourceListI18n = (list: Sources) => {
  const sourceNameType = useSettingValue('common.sourceNameType')
  const t = useI18n()
  return useMemo(() => {
    return list.map(s => ({ label: t(`source_${sourceNameType}_${s}`), action: s }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, sourceNameType, t])
}

const Component = <S extends Sources>({ fontSize = 13, center, forceDown, onSourceChange }: SourceSelectorProps<S>, ref: Ref<SourceSelectorType<S>>) => {
  const sourceNameType = useSettingValue('common.sourceNameType')
  const [list, setList] = useState([] as unknown as S)
  const [source, setSource] = useState<S[number]>('kw')
  const t = useI18n()

  useImperativeHandle(ref, () => ({
    setSourceList(list, activeSource) {
      setList(list)
      setSource(activeSource)
    },
  }), [])

  const sourceList_t = useSourceListI18n(list)

  type DorpDownMenuProps = _DorpDownMenuProps<typeof sourceList_t>

  const handleChangeSource: DorpDownMenuProps['onPress'] = ({ action }) => {
    onSourceChange(action)
    setSource(action)
  }

  return (
    <DorpDownMenu
      menus={sourceList_t}
      center={center}
      onPress={handleChangeSource}
      fontSize={fontSize}
      activeId={source}
      forceDown={forceDown}
    >
      <View style={styles.sourceMenu}>
        <View style={styles.sourceInner}>
          {/* 用 style 直接给固定字号，不走 Text 的 size 属性（setSpText 会按屏幕放大） */}
          <Text style={{ fontSize, textAlign: center ? 'center' : 'left' }} numberOfLines={1}>{t(`source_${sourceNameType}_${source}`)}</Text>
          <Text style={styles.arrow}>▾</Text>
        </View>
      </View>
    </DorpDownMenu>
  )
}

export default forwardRef(Component) as <S extends Sources>(p: SourceSelectorProps<S> & { ref?: Ref<SourceSelectorType<S>> }) => JSX.Element | null


const styles = createFixedStyle({
  sourceInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    // 与其他筛选药丸一致：13 号字 + 14 号 ▾
    fontSize: 14,
    marginLeft: 4,
  },
  sourceMenu: {
    height: '100%',
    justifyContent: 'center',
    // 与实时热搜 Chip / SortTab / FilterDropdown 统一为 14 内边距
    paddingLeft: 14,
    paddingRight: 14,
    // backgroundColor: '#ccc',

  },
})
