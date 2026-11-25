import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { createFixedStyle } from '@/utils/tools'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'


export interface CurrentTagBtnProps {
  onShowList: () => void
}

export interface CurrentTagBtnType {
  setCurrentTagInfo: (name: string) => void
}

export default forwardRef<CurrentTagBtnType, CurrentTagBtnProps>(({ onShowList }, ref) => {
  const t = useI18n()
  const [name, setName] = useState('')

  useImperativeHandle(ref, () => ({
    setCurrentTagInfo(name) {
      if (!name) name = t('songlist_tag_default')
      setName(name)
    },
  }))

  return (
    <Button style={styles.btn} onPress={onShowList}>
      <View style={styles.inner}>
        <Text style={styles.sourceMenu}>{name}</Text>
        <Text style={styles.arrow}>▾</Text>
      </View>
    </Button>
  )
})


const styles = createFixedStyle({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 14,
    marginLeft: 4,
  },
  btn: {
    minHeight: 36,
    paddingLeft: 14,
    paddingRight: 14,
    justifyContent: 'center',
    marginHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  sourceMenu: {
    fontSize: 13,
    textAlign: 'center',
    // minWidth: 70,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
})
