import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { forwardRef, useImperativeHandle, useState } from 'react'


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
      <Text style={styles.sourceMenu}>{name}</Text>
    </Button>
  )
})


const styles = createStyle({
  btn: {
    minHeight: 40,
    paddingLeft: 16,
    paddingRight: 16,
    justifyContent: 'center',
    marginHorizontal: 6,
    marginVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  sourceMenu: {
    fontSize: 16,
    textAlign: 'center',
    // minWidth: 70,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
})
