import { memo, useEffect, useRef, useState, type ReactElement } from 'react'
import { ActivityIndicator, FlatList, Image, Modal, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type GestureResponderEvent } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { playNext, playPrev, togglePlay, collectMusic, uncollectMusic } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { getListMusicSync } from '@/utils/listManage'
import { getCachedMusicIds, subscribeCacheUpdate } from '@/core/musicCache'
import { addListMusics } from '@/core/list'
import { enqueueCacheMusic } from '@/core/musicCache/queue'
import { toast } from '@/utils/tools'
import { getCachedMusicCover, loadMusicCover } from '@/utils/musicCover'
import listState from '@/store/list/state'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'
import { PLAYER_H, RADIUS, SPACE, TRACK_ROW_H, type SquareColors } from './tokens'

/** 已缓存歌曲 id 集合：缓存写入/删除后自动刷新，供列表蓝色勾使用 */
export const useCachedIds = () => {
  const [ids, setIds] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    const refresh = () => { void getCachedMusicIds().then(setIds) }
    refresh()
    return subscribeCacheUpdate(refresh)
  }, [])
  return ids
}

/** 播放器状态轮询（500ms）：无需依赖内部事件名，旋转/后台回来都能同步 */
export const usePlayerTick = () => {
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), 500)
    return () => clearInterval(timer)
  }, [])
}

export const SectionShell = memo(({ colors, children, style }: {
  colors: SquareColors
  children: React.ReactNode
  style?: object
}) => (
  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}>
    {children}
  </View>
))
SectionShell.displayName = 'SectionShell'

export const SectionHeader = memo(({ colors, title, hint, right }: {
  colors: SquareColors
  title: string
  hint?: string
  right?: React.ReactNode
}) => (
  <View style={styles.sectionHeader}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={[styles.sectionTitle, { color: colors.text, flexShrink: 1 }]}>{title}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: colors.text3, flexShrink: 0 }]}>　{hint}</Text> : null}
    </View>
    {right ? <View style={styles.sectionHeaderRight}>{right}</View> : null}
  </View>
))
SectionHeader.displayName = 'SectionHeader'

export const Empty = memo(({ colors, icon = '🎧', text }: {
  colors: SquareColors
  icon?: string
  text: string
}) => (
  <View style={styles.empty}>
    <Text style={{ fontSize: 34 }}>{icon}</Text>
    <Text style={[styles.emptyText, { color: colors.text3 }]}>{text}</Text>
  </View>
))
Empty.displayName = 'Empty'

export const Chip = memo(({ colors, label, active, onPress }: {
  colors: SquareColors
  label: string
  active?: boolean
  onPress: () => void
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.chip, {
      backgroundColor: active ? colors.accent : colors.surface2,
      borderColor: active ? colors.accent : colors.line,
    }]}
  >
    <Text style={[styles.chipText, { color: active ? '#fff' : colors.text2 }]}>{label}</Text>
  </TouchableOpacity>
))
Chip.displayName = 'Chip'

export const SearchBox = memo(({ colors, value, onChangeText, onSubmit, placeholder }: {
  colors: SquareColors
  value: string
  onChangeText: (text: string) => void
  onSubmit: () => void
  placeholder: string
}) => (
  <View style={[styles.searchBox, {
    backgroundColor: colors.surface2,
    borderColor: colors.line,
  }]}>
    <TextInput
      style={[styles.searchInput, { color: colors.text }]}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      placeholderTextColor={colors.text3}
      returnKeyType="search"
      autoCorrect={false}
    />
    <TouchableOpacity onPress={onSubmit} style={[styles.searchBtn, { backgroundColor: colors.accent }]}>
      <Text style={styles.searchBtnText}>搜索</Text>
    </TouchableOpacity>
  </View>
))
SearchBox.displayName = 'SearchBox'

export const TrackRow = memo(({ colors, index, musicInfo, isTablet, isCompact, onPress, onCache, cached, textSize = 'normal', batchMode, selected, onToggleSelect }: {
  colors: SquareColors
  index: number
  musicInfo: LX.Music.MusicInfoOnline
  isTablet: boolean
  isCompact?: boolean
  onPress: () => void
  onCache?: () => void
  cached?: boolean
  /** compact=搜索/榜单/歌单详情（最紧凑），small=我的歌单，large=大字号 */
  textSize?: 'compact' | 'small' | 'normal' | 'large'
  batchMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) => {
  const meta = musicInfo.meta as Record<string, any> | undefined
  const qualitys = meta?._qualitys
  const quality = qualitys?.flac24bit ? '24bit' : (qualitys?.flac || qualitys?.ape) ? 'SQ' : qualitys?.['320k'] ? 'HQ' : ''
  const sourceTag = musicInfo.source || ''
  const [cover, setCover] = useState(() => getCachedMusicCover(musicInfo))
  useEffect(() => {
    if (cover) return
    let cancelled = false
    void loadMusicCover(musicInfo).then(url => { if (!cancelled) setCover(url) }).catch(() => {})
    return () => { cancelled = true }
  }, [musicInfo.id, musicInfo.source, cover])
  const interval = (musicInfo as any).interval as string | undefined
  const subText = `${musicInfo.singer ?? ''}${meta?.albumName ? ` - ${meta.albumName as string}` : ''}`
  // 四个歌曲列表统一以「我的歌单」字号为基准
  const scale = textSize == 'large'
    ? { name: 16, sub: 12, tag: 11, height: TRACK_ROW_H + 8 }
    : { name: 13, sub: 10, tag: 9, height: TRACK_ROW_H - 8 }
  return (
    <TouchableOpacity
      onPress={batchMode ? onToggleSelect : onPress}
      activeOpacity={0.7}
      style={[styles.trackRow, { height: scale.height, borderBottomColor: colors.line }]}
    >
      {batchMode
        ? <TouchableOpacity onPress={onToggleSelect} style={[styles.batchCheck, { borderColor: colors.accent, backgroundColor: selected ? colors.accent : 'transparent' }]}>
            <Text style={styles.batchCheckText}>{selected ? '✓' : ''}</Text>
          </TouchableOpacity>
        : <View style={[styles.trackCover, { backgroundColor: colors.accentSoft }]}>
            {cover
              ? <Image source={{ uri: cover }} style={styles.trackCoverImg} resizeMode="cover" />
              : <Text style={[styles.trackCoverText, { color: colors.accent }]}>{musicInfo.name?.slice(0, 1) ?? '♪'}</Text>}
          </View>}
      <View style={styles.trackMain}>
        <Text numberOfLines={1} style={[styles.trackName, { color: colors.text, fontSize: scale.name }]}>{musicInfo.name}</Text>
        <View style={styles.trackSubRow}>
          {cached
            ? <View style={styles.cacheDot}><Text style={styles.cacheDotText}>✓</Text></View>
            : null}
          {quality
            ? <Text style={[styles.miniTag, { color: colors.accent, backgroundColor: colors.accentSoft, fontSize: scale.tag }]}>{quality}</Text>
            : null}
          {sourceTag
            ? <Text style={[styles.miniTag, { color: colors.text2, backgroundColor: colors.surface3, fontSize: scale.tag }]}>{sourceTag}</Text>
            : null}
          <Text numberOfLines={1} style={[styles.trackSub, { color: colors.text3, fontSize: scale.sub }]}>{subText}</Text>
        </View>
      </View>
      {isTablet && !isCompact
        ? <Text numberOfLines={1} style={[styles.trackAlbum, { color: colors.text2 }]}>{meta?.albumName ?? ''}</Text>
        : null}
      {interval ? <Text style={[styles.trackTime, { color: colors.text3 }]}>{interval}</Text> : null}
      {/* 已缓存由副标题蓝色圆勾表示，右侧只保留「未缓存 → 下载」动作，避免两套勾选语义 */}
      {onCache && !cached
        ? <TouchableOpacity onPress={onCache} style={styles.trackAction}>
            <Icon name="download-2" color={colors.text3} size={18} />
          </TouchableOpacity>
        : null}
    </TouchableOpacity>
  )
})
TrackRow.displayName = 'TrackRow'

/** 批量编辑状态（全选/反选/退出） */
export const useBatchSelection = () => {
  const [batchMode, setBatchMode] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x != id) : [...s, id])
  const selectAll = (ids: string[]) => setSelected(ids)
  const invert = (ids: string[]) => setSelected(s => ids.filter(id => !s.includes(id)))
  const exit = () => { setBatchMode(false); setSelected([]) }
  return { batchMode, setBatchMode, selected, toggle, selectAll, invert, exit }
}

type BatchState = ReturnType<typeof useBatchSelection>

/** 网易云式列表操作条：播放全部 / 缓存全部 / 批量编辑 → 全选 / 反选 / 加入歌单 / 缓存所选 */
export const ListActionBar = memo(({ colors, batch, ids, songs = [], onPlayAll, onCacheAll, getSelected, onAddToList, showDelete, onDelete }: {
  colors: SquareColors
  batch: BatchState
  ids: string[]
  songs?: LX.Music.MusicInfo[]
  onPlayAll: () => void
  onCacheAll: () => void
  getSelected: () => LX.Music.MusicInfo[]
  onAddToList: (musics: LX.Music.MusicInfo[]) => void
  showDelete?: boolean
  onDelete?: () => void
}) => {
  const count = batch.selected.length
  const totalSec = songs.reduce((acc, m) => {
    const raw = (m as unknown as { interval?: string }).interval
    if (!raw || !raw.includes(':')) return acc
    const [mm, ss] = raw.split(':').map(Number)
    return acc + (Number.isFinite(mm) && Number.isFinite(ss) ? mm * 60 + ss : 0)
  }, 0)
  const durationText = totalSec >= 3600
    ? `${Math.floor(totalSec / 3600)} 小时 ${Math.floor((totalSec % 3600) / 60)} 分钟`
    : `${Math.floor(totalSec / 60)} 分钟`
  const btn = (label: string, onPress: () => void, accent = false) => (
    <TouchableOpacity key={label} onPress={onPress} style={[styles.actionBtn, { backgroundColor: accent ? colors.accent : colors.surface2, borderColor: colors.line }]}>
      <Text style={[styles.actionBtnText, { color: accent ? '#fff' : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  )
  return (
    <View style={styles.actionRow}>
      {batch.batchMode
        ? <>
            {btn('全选', () => batch.selectAll(ids))}
            {btn('反选', () => batch.invert(ids))}
            {btn(`加入歌单 (${count})`, () => {
              if (!count) return toast('请先选择歌曲')
              onAddToList(getSelected())
            })}
            {btn(`缓存所选 (${count})`, () => {
              if (!count) return toast('请先选择歌曲')
              const n = enqueueCacheMusic(getSelected())
              toast(n ? `已加入缓存队列 ${n} 首` : '没有可缓存的歌曲')
              batch.exit()
            })}
            {showDelete ? btn(`删除 (${count})`, () => { if (count) onDelete?.() }) : null}
            {btn('完成', batch.exit, true)}
          </>
        : <View style={styles.actionBlock}>
            <View style={styles.actionHeader}>
              <TouchableOpacity onPress={onPlayAll} style={styles.playAllHit}>
                <View style={[styles.playAllIcon, { backgroundColor: colors.accent }]}>
                  <Text style={styles.playAllIconText}>▶</Text>
                </View>
                <Text style={[styles.playAllTitle, { color: colors.text }]}>播放全部</Text>
              </TouchableOpacity>
            <View style={styles.actionRight}>
              <TouchableOpacity onPress={onCacheAll} style={styles.iconBtn} accessibilityLabel="缓存全部">
                <Icon name="download-2" color={colors.text2} size={20} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => batch.setBatchMode(true)} style={styles.iconBtn} accessibilityLabel="批量编辑">
                <Icon name="menu" color={colors.text2} size={20} />
              </TouchableOpacity>
            </View>
            </View>
            <Text numberOfLines={1} style={[styles.playAllSub, { color: colors.text3 }]}>{songs.length} 首 · {durationText}</Text>
          </View>}
    </View>
  )
})
ListActionBar.displayName = 'ListActionBar'

export const AddToListModal = memo(({ colors, visible, musics, onClose }: {
  colors: SquareColors
  visible: boolean
  musics: LX.Music.MusicInfo[]
  onClose: () => void
}) => {
  const lists = (listState.allList as unknown as Array<{ id: string, name?: string }>).filter(l => l.id != 'temp')
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalMask}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>加入到歌单</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {lists.map(l => {
              const label = l.id == 'default' ? '未播放历史' : (l.name ?? l.id)
              return (
                <TouchableOpacity key={l.id} onPress={() => {
                  void addListMusics(l.id, musics, settingState.setting['list.addMusicLocationType']).then(() => {
                    toast(`已加入「${label}」`)
                    onClose()
                  })
                }} style={styles.modalItem}>
                  <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={styles.modalBtn}>
            <Text style={{ color: colors.text2, fontSize: 14 }}>取消</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
})
AddToListModal.displayName = 'AddToListModal'

const PAGE_SIZE = 20

/** 分页歌曲列表：首屏 20 首，触底或点「加载更多」续载；批量编辑时展开全部；顶部模块随列表整体上滑滚出 */
export const PagedSongList = memo(({ colors, songs, resetKey, expanded, header, renderRow, loading, empty }: {
  colors: SquareColors
  songs: LX.Music.MusicInfoOnline[]
  resetKey: string | number
  expanded: boolean
  header: ReactElement | null
  renderRow: (music: LX.Music.MusicInfoOnline, index: number) => ReactElement
  loading?: boolean
  empty?: ReactElement | null
}) => {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const canLoadMore = useRef(true)
  useEffect(() => { setLimit(PAGE_SIZE); canLoadMore.current = true }, [resetKey])
  const visible = expanded ? songs : songs.slice(0, limit)
  const hasMore = !expanded && limit < songs.length
  // 每次续载后需一次真实滚动手势，避免首屏不满一屏时自动把全部加载完
  const loadMore = (force = false) => {
    if (!hasMore || (!force && !canLoadMore.current)) return
    canLoadMore.current = false
    setLimit(n => Math.min(n + PAGE_SIZE, songs.length))
  }
  // 列表行与顶部卡片共用左右描边，末行/footer 收圆角，避免「卡片被切开」
  const rowBorder = { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.line }
  const rowLast = { borderBottomWidth: 1, borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg, overflow: 'hidden' as const }
  const emptyNode = loading
    ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
    : (empty ?? <Empty colors={colors} text="没有找到歌曲" />)
  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: SPACE.lg }}
      data={loading ? [] : visible}
      keyExtractor={(item, index) => `${item.source}_${item.id}_${index}`}
      ListHeaderComponent={header}
      renderItem={({ item, index }) => (
        <View style={[
          styles.pagedRow,
          rowBorder,
          { backgroundColor: colors.surface },
          !hasMore && index == (loading ? -1 : visible.length - 1) ? rowLast : null,
        ]}>{renderRow(item, index)}</View>
      )}
      ListFooterComponent={hasMore
        ? <TouchableOpacity onPress={() => loadMore(true)} style={[styles.loadMore, { backgroundColor: colors.surface, borderColor: colors.line }, rowLast]}>
            <Text style={{ color: colors.text2, fontSize: 12 }}>加载更多（还有 {songs.length - limit} 首）</Text>
          </TouchableOpacity>
        : null}
      onEndReached={() => loadMore()}
      onMomentumScrollEnd={() => { canLoadMore.current = true }}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={empty === null
        ? null
        : <View style={[styles.pagedEmpty, rowBorder, rowLast, { backgroundColor: colors.surface }]}>{emptyNode}</View>}
    />
  )
})
PagedSongList.displayName = 'PagedSongList'

export interface NavItem {
  id: string
  label: string
  icon: string
}

export const SideNav = memo(({ colors, items, activeId, onSelect }: {
  colors: SquareColors
  items: NavItem[]
  activeId: string
  onSelect: (id: string) => void
  isTablet?: boolean
  onClose?: () => void
}) => (
  <View style={[styles.sideNav, { backgroundColor: colors.header, borderRightColor: colors.line }]}>
    <View style={styles.brand}>
      <View style={styles.brandRow}>
        <View style={[styles.brandMark, { backgroundColor: colors.accent }]}>
          <Text style={styles.brandMarkText}>♪</Text>
        </View>
        <Text style={[styles.brandName, { color: colors.text }]} numberOfLines={1}>悦悦哄睡</Text>
      </View>
      <Text style={[styles.brandSub, { color: colors.text3 }]}>Music Square</Text>
    </View>
    <View style={styles.navItems}>
      <Text style={[styles.navGroupTitle, { color: colors.text3 }]}>音乐</Text>
      {items.map(item => {
        const active = item.id == activeId
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[styles.navItem, {
              backgroundColor: active ? colors.accentSoft : 'transparent',
            }]}
          >
            <Icon name={item.icon} color={active ? colors.accent : colors.text2} size={19} />
            <Text style={[styles.navLabel, { color: active ? colors.accent : colors.text }]}>{item.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
    <Text style={[styles.sideFooter, { color: colors.text3 }]}>基于 LX Music · 简洁版</Text>
  </View>
))
SideNav.displayName = 'SideNav'

export const MiniPlayer = memo(({ colors, isTablet, onOpen }: {
  colors: SquareColors
  isTablet: boolean
  onOpen: () => void
}) => {
  usePlayerTick()
  const music = playerState.playMusicInfo.musicInfo as LX.Music.MusicInfo | null
  const name = music?.name ?? '暂无播放'
  const singer = music?.singer ?? '点一下开始听歌'
  const progress = Math.max(0, Math.min(1, playerState.progress.progress || 0))
  const [seeking, setSeeking] = useState<number | null>(null)
  const [addMusics, setAddMusics] = useState<LX.Music.MusicInfo[]>([])
  const trackWidth = useRef(1)
  const displayProgress = seeking ?? progress
  const collected = !!music && getListMusicSync(LIST_IDS.LOVE).some(m => m.id == music.id)

  const ratioOf = (evt: GestureResponderEvent) => {
    const x = evt.nativeEvent.locationX
    return Math.max(0, Math.min(1, trackWidth.current > 1 ? x / trackWidth.current : 0))
  }
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: evt => setSeeking(ratioOf(evt)),
    onPanResponderMove: evt => setSeeking(ratioOf(evt)),
    onPanResponderRelease: evt => {
      const ratio = ratioOf(evt)
      setSeeking(null)
      const maxTime = playerState.progress.maxPlayTime
      if (maxTime > 0) global.app_event.setProgress(Math.round(ratio * maxTime))
    },
    onPanResponderTerminate: () => setSeeking(null),
  })).current

  const openAddToList = () => {
    if (!music) return
    const target = 'progress' in music
      ? (music as unknown as { metadata: { musicInfo: LX.Music.MusicInfo } }).metadata.musicInfo
      : music
    setAddMusics([target])
  }

  return (
    <View style={[styles.miniPlayer, {
      height: PLAYER_H + 14,
      backgroundColor: colors.header,
      borderTopColor: colors.line,
      flexDirection: 'column',
      justifyContent: 'center',
      paddingHorizontal: 0,
    }]}>
      <View style={styles.miniSeekRow}>
        <Text style={[styles.miniTime, { color: colors.text3 }]}>{playerState.progress.nowPlayTimeStr}</Text>
        <View
          onLayout={e => { trackWidth.current = e.nativeEvent.layout.width || 1 }}
          {...pan.panHandlers}
          style={styles.miniSeekTrack}
        >
          <View style={[styles.miniSeekRail, { backgroundColor: colors.surface3 }]}>
            <View style={[styles.miniProgressBar, { backgroundColor: colors.accent, width: `${displayProgress * 100}%` }]} />
          </View>
          <View style={[styles.miniSeekThumb, { left: `${displayProgress * 100}%`, backgroundColor: colors.accent }]} />
        </View>
        <Text style={[styles.miniTime, { color: colors.text3 }]}>{playerState.progress.maxPlayTimeStr}</Text>
      </View>

      <View style={styles.miniMainRow}>
        <TouchableOpacity onPress={onOpen} style={styles.miniInfo}>
          <View style={[styles.miniCover, { backgroundColor: colors.accentSoft }]}>
            <Text style={{ color: colors.accent, fontSize: 18 }}>♪</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[styles.miniName, { color: colors.text }]}>{name}</Text>
            <Text numberOfLines={1} style={[styles.miniSub, { color: colors.text3 }]}>{singer}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.miniControls}>
          <TouchableOpacity
            onPress={() => { if (!music) return; collected ? uncollectMusic() : collectMusic() }}
            style={styles.miniBtn}
            accessibilityLabel={collected ? '取消收藏' : '收藏到我的收藏'}
          >
            <Icon name="love" color={collected ? colors.accent : colors.text3} size={19} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openAddToList} style={styles.miniBtn} accessibilityLabel="添加到歌单">
            <Icon name="add-music" color={colors.text2} size={19} />
          </TouchableOpacity>
          {isTablet
            ? <TouchableOpacity onPress={() => { void playPrev() }} style={styles.miniBtn}>
                <Icon name="prevMusic" color={colors.text2} size={20} />
              </TouchableOpacity>
            : null}
          <TouchableOpacity onPress={togglePlay} style={[styles.miniPlayBtn, { backgroundColor: colors.accent }]}>
            <Icon name={playerState.isPlay ? 'pause' : 'play'} color="#fff" size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { void playNext(true) }} style={styles.miniBtn}>
            <Icon name="nextMusic" color={colors.text2} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <AddToListModal
        colors={colors}
        visible={addMusics.length > 0}
        musics={addMusics}
        onClose={() => setAddMusics([])}
      />
    </View>
  )
})
MiniPlayer.displayName = 'MiniPlayer'

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACE.lg, marginBottom: SPACE.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.md },
  sectionHeaderRight: { flexShrink: 0, marginLeft: SPACE.sm },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  sectionHint: { fontSize: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56 },
  emptyText: { fontSize: 13, marginTop: SPACE.md },
  chip: { height: 32, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 0, borderRadius: RADIUS.pill, borderWidth: 1, marginRight: SPACE.sm, marginBottom: SPACE.sm },
  chipText: { fontSize: 13 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, paddingLeft: SPACE.md, paddingRight: 4, flex: 1, minWidth: 0, height: 40 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingHorizontal: SPACE.sm, height: 36 },
  searchBtn: { minWidth: 56, height: 30, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  trackRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: SPACE.sm },
  trackIndex: { width: 26, fontSize: 12, textAlign: 'center' },
  trackCover: { width: 40, height: 40, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  trackCoverText: { fontSize: 18 },
  trackMain: { flex: 1, minWidth: 0 },
  trackName: { fontSize: 14 },
  trackSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  trackSub: { flex: 1, minWidth: 0, fontSize: 11 },
  cacheDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#2E86DE', alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  cacheDotText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  miniTag: { fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginRight: 5, overflow: 'hidden' },
  trackAlbum: { width: 110, fontSize: 12, marginHorizontal: SPACE.sm },
  trackTime: { width: 46, fontSize: 11, textAlign: 'right' },
  trackAction: { paddingHorizontal: SPACE.sm, paddingVertical: SPACE.sm },
  batchCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.sm },
  batchCheckText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingVertical: SPACE.sm },
  actionSpacer: { flex: 1, minWidth: 8 },
  actionBlock: { width: '100%' },
  actionHeader: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingTop: SPACE.sm },
  playAllHit: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  playAllIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  playAllIconText: { color: '#fff', fontSize: 15 },
  playAllTitle: { fontSize: 16, fontWeight: '600' },
  playAllSub: { fontSize: 11, marginLeft: 38 + SPACE.md, marginTop: 2, marginBottom: SPACE.sm },
  actionRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: SPACE.sm },
  pagedRow: { paddingHorizontal: SPACE.md },
  pagedEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.lg },
  loadMore: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.md, borderWidth: 1, borderTopWidth: 0 },
  trackCoverImg: { width: '100%', height: '100%', borderRadius: RADIUS.sm },
  actionBtn: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 6, marginRight: SPACE.sm, marginBottom: SPACE.sm },
  actionBtnText: { fontSize: 13 },
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '82%', borderRadius: RADIUS.lg, padding: SPACE.xl },
  modalTitle: { fontSize: 16, fontWeight: '600', marginBottom: SPACE.lg },
  modalItem: { paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.2)' },
  modalBtn: { paddingHorizontal: SPACE.lg, paddingVertical: 8, alignSelf: 'flex-end' },
  sideNav: { width: 200, borderRightWidth: 1, paddingTop: SPACE.xl, paddingHorizontal: SPACE.md },
  navItems: { flexShrink: 0 },
  brand: { flexDirection: 'column', alignItems: 'flex-start', paddingHorizontal: SPACE.sm, marginBottom: SPACE.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.sm },
  brandMarkText: { color: '#fff', fontSize: 20 },
  brandName: { fontSize: 17, fontWeight: '700' },
  brandSub: { fontSize: 11, marginTop: 4 },
  navGroupTitle: { fontSize: 11, paddingHorizontal: SPACE.sm, marginBottom: SPACE.sm },
  navItem: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: 11, marginBottom: 2 },
  navLabel: { fontSize: 14, marginLeft: SPACE.md },
  sideFooter: { fontSize: 10, padding: SPACE.md },
  miniPlayer: { borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, position: 'relative', flexShrink: 0 },
  miniSeekRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: SPACE.lg },
  miniSeekTrack: { flex: 1, height: 18, justifyContent: 'center', marginHorizontal: SPACE.sm },
  miniSeekRail: { height: 3, borderRadius: 2, overflow: 'hidden', width: '100%' },
  miniSeekThumb: { position: 'absolute', width: 10, height: 10, borderRadius: 5, marginLeft: -5 },
  miniMainRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: SPACE.lg },
  miniProgressBar: { height: 3 },
  miniInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniCover: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  miniName: { fontSize: 14, fontWeight: '500' },
  miniSub: { fontSize: 11, marginTop: 3 },
  miniControls: { flexDirection: 'row', alignItems: 'center' },
  miniBtn: { paddingHorizontal: SPACE.md },
  miniPlayBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  miniTime: { fontSize: 11 },
})
