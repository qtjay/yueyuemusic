import { useRef, forwardRef, useImperativeHandle } from 'react'
// import { Icon } from '@/components/common/Icon'
import Button from '@/components/common/Button'
// import { navigations } from '@/navigation'
import Modal, { type ModalType } from './Modal'
import { type Source } from '@/store/songlist/state'
import { createStyle } from '@/utils/tools'
import { PILL_BASE_HEIGHT } from '@/utils/pillSize'
import { usePillTextColor } from '@/screens/Square/tokens'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'

// export interface OpenListProps {
//   onTagChange: (name: string, id: string) => void
// }

export interface OpenListType {
  setInfo: (source: Source) => void
}

export default forwardRef<OpenListType, {}>((props, ref) => {
  const t = useI18n()
  const modalRef = useRef<ModalType>(null)
  const songlistInfoRef = useRef<{ source: Source }>({ source: 'kw' })
  const pillTextColor = usePillTextColor()

  useImperativeHandle(ref, () => ({
    setInfo(source) {
      songlistInfoRef.current.source = source
    },
  }))

  const handleOpenSonglist = (id: string) => {
    // console.log(id, songlistInfoRef.current.source)
    navigations.pushSonglistDetailScreen(commonState.componentIds.home!, {
      play_count: undefined,
      id,
      author: '',
      name: '',
      img: undefined,
      desc: undefined,
      source: songlistInfoRef.current.source,
    })
  }

  // const handleSourceChange: ModalProps['onSourceChange'] = (source) => {
  //   songlistInfoRef.current.source = source
  // }


  return (
    <>
      <Button style={styles.button} onPress={() => modalRef.current?.show(songlistInfoRef.current.source)}>
        <Text color={pillTextColor} style={styles.text}>{t('songlist_open')}</Text>
      </Button>
      <Modal ref={modalRef} onOpenId={handleOpenSonglist} />
    </>
  )
})

const styles = createStyle({
  button: {
    minHeight: PILL_BASE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    marginRight: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.12)',
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  text: {
    fontSize: 13,
  },
})
