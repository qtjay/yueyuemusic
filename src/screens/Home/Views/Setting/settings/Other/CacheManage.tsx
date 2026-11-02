import { memo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()
  return (
    <SubTitle title={t('nav_download')}>
      <View style={{ flexDirection: 'row' }}>
        <Button onPress={() => setNavActiveId('nav_download')}>打开</Button>
      </View>
    </SubTitle>
  )
})
