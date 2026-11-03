import { memo, useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import playerState from '@/store/player/state'
import { PLAYER_H, RADIUS, SPACE, TRACK_ROW_H, type SquareColors } from './tokens'

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
    <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1 }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: colors.text3 }]}>　{hint}</Text> : null}
    </View>
    {right}
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

export const TrackRow = memo(({ colors, index, musicInfo, isTablet, isCompact, onPress, onCache, cached }: {
  colors: SquareColors
  index: number
  musicInfo: LX.Music.MusicInfoOnline
  isTablet: boolean
  isCompact?: boolean
  onPress: () => void
  onCache?: () => void
  cached?: boolean
}) => {
  const meta = musicInfo.meta as Record<string, any> | undefined
  const quality = meta?._qualitys
    ? Object.keys(meta._qualitys).find(k => meta._qualitys[k]) ?? ''
    : ''
  const interval = (musicInfo as any).interval as string | undefined
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.trackRow, { height: TRACK_ROW_H, borderBottomColor: colors.line }]}
    >
      <Text style={[styles.trackIndex, { color: colors.text3 }]}>{index + 1}</Text>
      <View style={[styles.trackCover, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.trackCoverText, { color: colors.accent }]}>{musicInfo.name?.slice(0, 1) ?? '♪'}</Text>
      </View>
      <View style={styles.trackMain}>
        <Text numberOfLines={1} style={[styles.trackName, { color: colors.text }]}>{musicInfo.name}</Text>
        <Text numberOfLines={1} style={[styles.trackSub, { color: colors.text3 }]}>{musicInfo.singer}</Text>
      </View>
      {isTablet && !isCompact
        ? <Text numberOfLines={1} style={[styles.trackAlbum, { color: colors.text2 }]}>{meta?.albumName ?? ''}</Text>
        : null}
      {isTablet && quality
        ? <Text style={[styles.qualityTag, { color: colors.accent, backgroundColor: colors.accentSoft }]}>{quality}</Text>
        : null}
      {interval ? <Text style={[styles.trackTime, { color: colors.text3 }]}>{interval}</Text> : null}
      {onCache
        ? <TouchableOpacity onPress={onCache} style={styles.trackAction}>
            <Icon name={cached ? 'checkbox-marked' : 'download-2'} color={cached ? colors.accent : colors.text3} size={18} />
          </TouchableOpacity>
        : null}
    </TouchableOpacity>
  )
})
TrackRow.displayName = 'TrackRow'

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
  return (
    <View style={[styles.miniPlayer, {
      height: PLAYER_H,
      backgroundColor: colors.header,
      borderTopColor: colors.line,
    }]}>
      <View style={[styles.miniProgressTrack, { backgroundColor: colors.surface3 }]}>
        <View style={[styles.miniProgressBar, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
      </View>
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
      <Text style={[styles.miniTime, { color: colors.text3 }]}>{playerState.progress.nowPlayTimeStr} / {playerState.progress.maxPlayTimeStr}</Text>
    </View>
  )
})
MiniPlayer.displayName = 'MiniPlayer'

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACE.lg, marginBottom: SPACE.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.md },
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
  trackSub: { fontSize: 11, marginTop: 3 },
  trackAlbum: { width: 110, fontSize: 12, marginHorizontal: SPACE.sm },
  qualityTag: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: SPACE.sm, overflow: 'hidden' },
  trackTime: { width: 46, fontSize: 11, textAlign: 'right' },
  trackAction: { paddingHorizontal: SPACE.sm, paddingVertical: SPACE.sm },
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
  miniProgressTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  miniProgressBar: { height: 3 },
  miniInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  miniCover: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  miniName: { fontSize: 14, fontWeight: '500' },
  miniSub: { fontSize: 11, marginTop: 3 },
  miniControls: { flexDirection: 'row', alignItems: 'center' },
  miniBtn: { paddingHorizontal: SPACE.md },
  miniPlayBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  miniTime: { fontSize: 11, marginLeft: SPACE.lg },
})
