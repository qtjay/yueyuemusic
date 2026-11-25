import { forwardRef, useImperativeHandle, useRef } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { createStyle } from '@/utils/tools'
import { PILL_BASE_HEIGHT } from '@/utils/pillSize'
import SourceSelector, {
  type SourceSelectorType as _SourceSelectorType,
  type SourceSelectorProps as _SourceSelectorProps,
} from '@/components/SourceSelector'
import songlistState, { type Source, type InitState } from '@/store/songlist/state'

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
      sourceSelectorRef.current?.setSourceList(songlistState.sources, source)
    },
  }), [])


  return (
    <View style={StyleSheet.compose<ViewStyle>(styles.selector, style)}>
      <SourceSelector ref={sourceSelectorRef} onSourceChange={onSourceChange} center forceDown />
    </View>
  )
})

const styles = createStyle({
  selector: {
    minHeight: PILL_BASE_HEIGHT,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
    backgroundColor: 'rgba(128,128,128,0.08)',
    marginRight: 6,
  },
})
