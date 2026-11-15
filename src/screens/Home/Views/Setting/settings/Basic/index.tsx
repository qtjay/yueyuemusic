import { memo } from 'react'

import Section from '../../components/Section'
import Source from './Source'
import Language from './Language'
import IsStartupAutoPlay from './IsStartupAutoPlay'
import { useI18n } from '@/lang/i18n'

export default memo(() => {
  const t = useI18n()


  return (
    <Section title={t('setting_basic')}>
      <IsStartupAutoPlay />
      <Language />
      <Source />
    </Section>
  )
})
