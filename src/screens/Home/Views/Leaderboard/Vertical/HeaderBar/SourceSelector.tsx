import { forwardRef, useImperativeHandle, useRef } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { createStyle } from '@/utils/tools'
import { PILL_BASE_HEIGHT } from '@/utils/pillSize'
import SourceSelector, {
  type SourceSelectorType as _SourceSelectorType,
  type SourceSelectorProps as _SourceSelectorProps,
} from '@/components/SourceSelector'
import leaderboardState, { type Source, type InitState } from '@/store/leaderboard/state'

type Sources = Readonly<InitState['sources']>
type SourceSelectorCommonProps = _SourceSelectorProps<Sources>
type SourceSelectorCommonType = _SourceSelectorType<Sources>

export interface SourceSelectorProps {
  onSourceChange: SourceSelectorCommonProps['onSourceChange']
  style?: ViewStyle
}

export interface SourceSelectorType {
  setSource: (source: Source) => void
}

export default forwardRef<SourceSelectorType, SourceSelectorProps>(({ style, onSourceChange }, ref) => {
  const sourceSelectorRef = useRef<SourceSelectorCommonType>(null)

  useImperativeHandle(ref, () => ({
    setSource(source) {
      sourceSelectorRef.current?.setSourceList(leaderboardState.sources, source)
    },
  }), [])


  return (
    <View style={StyleSheet.compose<ViewStyle, ViewStyle, ViewStyle>(styles.selector, style)}>
      <SourceSelector ref={sourceSelectorRef} onSourceChange={onSourceChange} center forceDown />
    </View>
  )
})

const styles = createStyle({
  selector: {
    // 公共 SourceSelector 内部是 height:'100%'，minHeight 压不住它，必须用固定 height
    // 才能与 ActiveListName / SortTab 等药丸等高。
    height: PILL_BASE_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
    backgroundColor: 'rgba(128,128,128,0.08)',
    marginRight: 6,
  },
})
