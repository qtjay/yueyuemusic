import { memo, useEffect, useState } from 'react'
import { View, TouchableOpacity, Image } from 'react-native'
// import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, type RowInfo } from '@/utils/tools'
import { getCachedMusicCover, loadMusicCover } from '@/utils/musicCover'

/** 与 Square 歌曲列表统一行高 */
export const ITEM_HEIGHT = 60

const useQualityTag = (musicInfo: LX.Music.MusicInfoOnline) => {
  const t = useI18n()
  if (musicInfo.meta._qualitys.flac24bit) return t('quality_lossless_24bit')
  if (musicInfo.meta._qualitys.flac ?? musicInfo.meta._qualitys.ape) return t('quality_lossless')
  if (musicInfo.meta._qualitys['320k']) return t('quality_high_quality')
  return ''
}

export default memo(({ item, index, onPress, onLongPress, selectedList, cachedIds, rowInfo, isShowAlbumName, isShowInterval }: {
  item: LX.Music.MusicInfoOnline
  index: number
  showSource?: boolean
  onPress: (item: LX.Music.MusicInfoOnline, index: number) => void
  onLongPress: (item: LX.Music.MusicInfoOnline, index: number) => void
  onShowMenu: (item: LX.Music.MusicInfoOnline, index: number, position: { x: number, y: number, w: number, h: number }) => void
  selectedList: LX.Music.MusicInfoOnline[]
  cachedIds?: Set<string>
  rowInfo: RowInfo
  isShowAlbumName: boolean
  isShowInterval: boolean
}) => {
  const theme = useTheme()

  const isSelected = selectedList.includes(item)

  const qualityTag = useQualityTag(item)
  const cached = cachedIds?.has(item.id) ?? false
  const [cover, setCover] = useState(() => getCachedMusicCover(item))
  useEffect(() => {
    if (cover) return
    let cancelled = false
    void loadMusicCover(item).then(url => { if (!cancelled) setCover(url) }).catch(() => {})
    return () => { cancelled = true }
  }, [item.id, item.source, cover])

  const singer = `${item.singer}${isShowAlbumName && item.meta.albumName ? ` - ${item.meta.albumName}` : ''}`

  return (
    <View style={{ ...styles.listItem, width: rowInfo.rowWidth, height: ITEM_HEIGHT, backgroundColor: isSelected ? theme['c-primary-background-hover'] : 'rgba(0,0,0,0)' }}>
      <TouchableOpacity style={styles.listItemLeft} onPress={() => { onPress(item, index) }} onLongPress={() => { onLongPress(item, index) }}>
        <View style={styles.cover}>
          {cover
            ? <Image source={{ uri: cover }} style={styles.coverImg} resizeMode="cover" />
            : <Text size={16} color={theme['c-350']}>♪</Text>}
        </View>
        <View style={styles.itemInfo}>
          <Text numberOfLines={1} style={{ fontSize: 13 }}>{item.name}</Text>
          <View style={styles.listItemSingle}>
            { cached
              ? <View style={styles.cacheDot}><Text style={styles.cacheDotText}>✓</Text></View>
              : null }
            { qualityTag
              ? <View style={styles.miniTag}><Text style={styles.miniTagText} color={theme['c-primary-font-active']}>{qualityTag}</Text></View>
              : null }
            { item.source
              ? <View style={[styles.miniTag, styles.miniTagSource]}><Text style={styles.miniTagText} color={theme['c-500']}>{item.source}</Text></View>
              : null }
            <Text style={{ ...styles.listItemSingleText, fontSize: 10 }} color={theme['c-500']} numberOfLines={1}>{singer}</Text>
          </View>
        </View>
        {
          isShowInterval ? (
            <Text style={{ fontSize: 10 }} color={theme['c-250']} numberOfLines={1}>{item.interval}</Text>
          ) : null
        }
      </TouchableOpacity>
     {/* 排行榜行右侧不再放下载按钮，缓存状态由副标题蓝色圆勾表示 */}
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.isShowAlbumName === nextProps.isShowAlbumName &&
    prevProps.isShowInterval === nextProps.isShowInterval &&
    prevProps.cachedIds === nextProps.cachedIds &&
    nextProps.selectedList.includes(nextProps.item) == prevProps.selectedList.includes(prevProps.item)
  )
})

const styles = createStyle({
  listItem: {
    // width: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    // paddingLeft: 10,
    paddingRight: 2,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.12)',
  },
  listItemLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(128,128,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  coverImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  cacheDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2E86DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  cacheDotText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  miniTag: {
    borderRadius: 4,
    backgroundColor: 'rgba(49,194,124,0.14)',
    marginRight: 4,
    alignSelf: 'center',
  },
  miniTagSource: {
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  miniTagText: {
    fontSize: 9,
    fontWeight: '500',
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 2,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
  // listItemTitle: {
  //   // backgroundColor: 'rgba(0,0,0,0.2)',
  //   flexGrow: 0,
  //   flexShrink: 1,
  //   // fontSize: 15,
  // },
  listItemSingle: {
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    // alignItems: 'flex-end',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  listItemTimeLabel: {
    marginRight: 5,
    fontWeight: '400',
  },
  listItemSingleText: {
    // fontSize: 13,
    // paddingTop: 2,
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
  },
  listItemBadge: {
    // fontSize: 10,
    paddingLeft: 5,
    paddingTop: 2,
    alignSelf: 'flex-start',
  },
  listItemRight: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    justifyContent: 'center',
  },
  moreButton: {
    height: '80%',
    minWidth: 44,
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    // paddingTop: 10,
    // paddingBottom: 10,
    // backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
  },
})

