import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { playList, playNext, playPrev, togglePlay } from '@/core/player/player'
import { setApiSource } from '@/core/apiSource'
import { setTheme } from '@/core/theme'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import settingState from '@/store/setting/state'
import themeState from '@/store/theme/state'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import { getListMusicSync } from '@/utils/listManage'
import { getUserApiList, getUserLists } from '@/utils/data'
import { toast, confirmDialog } from '@/utils/tools'
import { batchCacheMusic } from '@/core/musicCache/batch'
import {
  UNGROUPED_ID,
  clearCache,
  getCacheGroups,
  getCacheMaxSize,
  getCacheStats,
  removeCacheByGroup,
  setCacheMaxSize,
  type CacheGroup,
} from '@/core/musicCache'
import UserApiEditModal, { type UserApiEditModalType } from '@/screens/Home/Views/Setting/settings/Basic/UserApiEditModal'
import SettingPage from '@/screens/Home/Views/Setting'
import { Chip, Empty, SectionHeader, SectionShell, TrackRow, usePlayerTick } from '../components'
import { RADIUS, SPACE, type SquareColors } from '../tokens'

const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

/** 我的歌单（收藏置顶 + 歌曲列表 + 批量缓存） */
export const MyListView = memo(({ colors, isTablet, isCompact, onPlaySong }: {
  colors: SquareColors
  isTablet: boolean
  isCompact: boolean
  onPlaySong: () => void
}) => {
  usePlayerTick()
  type NavList = { id: string, name?: string }
  const lists = listState.allList as unknown as NavList[]
  const [activeId, setActiveId] = useState(() => lists[0]?.id ?? 'love')
  const songs = (getListMusicSync(activeId) ?? []).filter(m => m.source != 'local') as LX.Music.MusicInfoOnline[]

  const handleCacheAll = () => {
    if (!songs.length) return
    toast(`开始缓存 ${songs.length} 首歌曲...`)
    void batchCacheMusic(songs, {
      listId: activeId,
      listName: lists.find(l => l.id == activeId)?.name,
    }).then(res => toast(`缓存完成：成功 ${res.success}，跳过 ${res.skipped}，失败 ${res.failed}`))
  }

  return (
    <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column', padding: SPACE.lg }}>
      <SectionShell colors={colors} style={isTablet ? { width: 220, marginRight: SPACE.lg } : { marginBottom: SPACE.md }}>
        <SectionHeader colors={colors} title="歌单" />
        <ScrollView horizontal={!isTablet} style={{ maxHeight: isTablet ? undefined : 64 }}>
          {lists.map(list => (
            <Chip
              key={list.id}
              colors={colors}
              label={list.name ?? list.id}
              active={list.id == activeId}
              onPress={() => setActiveId(list.id)}
            />
          ))}
        </ScrollView>
      </SectionShell>
      <SectionShell colors={colors} style={{ flex: 1 }}>
        <SectionHeader
          colors={colors}
          title={lists.find(l => l.id == activeId)?.name ?? '歌单'}
          hint={`${songs.length} 首`}
          right={songs.length
            ? <TouchableOpacity onPress={handleCacheAll}><Text style={{ color: colors.accent, fontSize: 13 }}>批量缓存</Text></TouchableOpacity>
            : undefined}
        />
        {songs.length
          ? <ScrollView>
              {songs.map((music, index) => (
                <TrackRow
                  key={`${music.source}_${music.id}_${index}`}
                  colors={colors}
                  index={index}
                  musicInfo={music}
                  isTablet={isTablet}
                  isCompact={isCompact}
                  onPress={() => { void playList(activeId, index); onPlaySong() }}
                />
              ))}
            </ScrollView>
          : <Empty colors={colors} text="这个歌单还没有歌曲" />}
      </SectionShell>
    </View>
  )
})
MyListView.displayName = 'MyListView'

/** 缓存管理（容量自定义 + 按歌单分类删除） */
export const CacheView = memo(({ colors }: { colors: SquareColors }) => {
  const autoCache = useSettingValue('cache.auto')
  const [groups, setGroups] = useState<CacheGroup[]>([])
  const [stats, setStats] = useState({ count: 0, totalSize: 0 })
  const [maxSize, setMaxSize] = useState('1024')
  const [draft, setDraft] = useState('1024')
  const [nameMap, setNameMap] = useState<Record<string, string>>({ default: '试听列表', love: '我的收藏' })

  const load = useCallback(async() => {
    const [g, s, m, lists] = await Promise.all([getCacheGroups(), getCacheStats(), getCacheMaxSize(), getUserLists()])
    const names: Record<string, string> = { default: '试听列表', love: '我的收藏' }
    for (const l of lists) names[l.id] = l.name
    setNameMap(names)
    setGroups(g)
    setStats(s)
    setMaxSize(String(m))
    setDraft(String(m))
  }, [])

  useEffect(() => { void load() }, [load])

  const saveMax = () => {
    const mb = parseInt(draft)
    if (Number.isNaN(mb) || mb < 16 || mb > 10240) {
      toast('请输入 16 ~ 10240 之间的 MB 数')
      setDraft(maxSize)
      return
    }
    void setCacheMaxSize(mb).then(() => { setMaxSize(String(mb)); toast(`缓存上限已设为 ${mb} MB`); void load() })
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.lg }}>
      <SectionShell colors={colors}>
        <SectionHeader colors={colors} title="缓存管理" hint={`${stats.count} 首 · ${formatSize(stats.totalSize)}`} />
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>播放自动缓存</Text>
          <Switch value={autoCache} onValueChange={v => updateSetting({ 'cache.auto': v })} />
        </View>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>容量上限（MB）</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.surface2 }]}
            value={draft}
            onChangeText={setDraft}
            onBlur={saveMax}
            keyboardType="numeric"
            maxLength={5}
          />
          <TouchableOpacity onPress={saveMax} style={[styles.smallBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.smallBtnText}>保存</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.hint, { color: colors.text3 }]}>超过上限自动淘汰最旧的缓存</Text>
      </SectionShell>

      <SectionShell colors={colors}>
        <SectionHeader
          colors={colors}
          title="按歌单管理"
          right={<TouchableOpacity onPress={() => {
            void confirmDialog({ message: '清空全部缓存歌曲？' }).then(ok => { if (ok) void clearCache().then(load) })
          }}><Text style={{ color: colors.danger, fontSize: 13 }}>清空全部</Text></TouchableOpacity>}
        />
        {groups.length
          ? groups.map(group => (
              <View key={group.id} style={[styles.groupRow, { borderBottomColor: colors.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupName, { color: colors.text }]}>
                    {group.id == UNGROUPED_ID ? '其他' : (nameMap[group.id] ?? group.name)}
                  </Text>
                  <Text style={[styles.hint, { color: colors.text3 }]}>{group.count} 首 · {formatSize(group.size)}</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  void removeCacheByGroup(group.id).then(load)
                }}>
                  <Text style={{ color: colors.accent, fontSize: 13 }}>清空</Text>
                </TouchableOpacity>
              </View>
            ))
          : <Empty colors={colors} text="暂无缓存歌曲" />}
      </SectionShell>
    </ScrollView>
  )
})
CacheView.displayName = 'CacheView'

/** 精简设置：音源 / 桌面歌词 / 主题 / 音质 / 高级设置入口 */
export const SettingView = memo(({ colors, onOpenAdvanced }: {
  colors: SquareColors
  onOpenAdvanced: () => void
}) => {
  const apiSource = useSettingValue('common.apiSource')
  const desktopLyric = useSettingValue('desktopLyric.enable')
  const quality = useSettingValue('player.playQuality')
  const [apis, setApis] = useState<LX.UserApi.UserApiInfo[]>([])
  const apiModalRef = useRef<UserApiEditModalType>(null)

  useEffect(() => { void getUserApiList().then(setApis) }, [])

  const isDark = themeState.theme.isDark
  const qualities: LX.Quality[] = ['128k', '320k', 'flac']

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.lg }}>
      <SectionShell colors={colors}>
        <SectionHeader
          colors={colors}
          title="自定义音源"
          hint={`当前：${settingState.setting['common.apiSource'] || '未选择'}`}
          right={<TouchableOpacity onPress={() => (apiModalRef.current as any)?.show()}><Text style={{ color: colors.accent, fontSize: 13 }}>导入 / 管理</Text></TouchableOpacity>}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {apis.length
            ? apis.map(api => (
                <Chip
                  key={api.id}
                  colors={colors}
                  label={api.name}
                  active={api.id == apiSource}
                  onPress={() => setApiSource(api.id)}
                />
              ))
            : <Text style={[styles.hint, { color: colors.text3 }]}>还没有导入音源</Text>}
        </View>
      </SectionShell>

      <SectionShell colors={colors}>
        <SectionHeader colors={colors} title="播放" />
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>桌面歌词</Text>
          <Switch value={desktopLyric} onValueChange={v => updateSetting({ 'desktopLyric.enable': v })} />
        </View>
        <Text style={[styles.hint, { color: colors.text3, marginBottom: SPACE.sm }]}>播放音质</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {qualities.map(q => (
            <Chip key={q} colors={colors} label={q} active={q == quality} onPress={() => updateSetting({ 'player.playQuality': q })} />
          ))}
        </View>
      </SectionShell>

      <SectionShell colors={colors}>
        <SectionHeader colors={colors} title="外观" />
        <View style={{ flexDirection: 'row' }}>
          <Chip colors={colors} label="浅色" active={!isDark} onPress={() => setTheme('yueyue')} />
          <Chip colors={colors} label="深色" active={isDark} onPress={() => setTheme('yueyue_dark')} />
        </View>
      </SectionShell>

      <SectionShell colors={colors}>
        <SectionHeader colors={colors} title="更多" />
        <TouchableOpacity onPress={onOpenAdvanced} style={[styles.smallBtn, { backgroundColor: colors.surface2, alignSelf: 'flex-start' }]}>
          <Text style={[styles.smallBtnText, { color: colors.text }]}>高级设置（完整选项）</Text>
        </TouchableOpacity>
      </SectionShell>
      <UserApiEditModal ref={apiModalRef} />
    </ScrollView>
  )
})
SettingView.displayName = 'SettingView'

/** 简化正在播放页（手机：顶部吸顶 + 歌词独立滚动） */
export const NowPlayingView = memo(({ colors, isTablet, onBack }: {
  colors: SquareColors
  isTablet: boolean
  onBack: () => void
}) => {
  usePlayerTick()
  const music = playerState.playMusicInfo.musicInfo as LX.Music.MusicInfo | null
  const progress = Math.max(0, Math.min(1, playerState.progress.progress || 0))
  return (
    <View style={[styles.npContainer, { backgroundColor: colors.bg }]}>
      <View style={styles.npHeader}>
        <TouchableOpacity onPress={onBack} style={styles.npBack}>
          <Icon name="back-2" color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={[styles.npHeaderTitle, { color: colors.text }]}>正在播放</Text>
      </View>
      <View style={[styles.npCoverBig, { backgroundColor: colors.accentSoft }]}>
        <Text style={{ color: colors.accent, fontSize: 64 }}>♪</Text>
      </View>
      <Text style={[styles.npName, { color: colors.text }]} numberOfLines={1}>{music?.name ?? '暂无播放'}</Text>
      <Text style={[styles.npSinger, { color: colors.text3 }]} numberOfLines={1}>{music?.singer ?? ''}</Text>
      <View style={[styles.npProgressTrack, { backgroundColor: colors.surface3 }]}>
        <View style={[styles.npProgressBar, { backgroundColor: colors.accent, width: `${progress * 100}%` }]} />
      </View>
      <Text style={[styles.hint, { color: colors.text3 }]}>{playerState.progress.nowPlayTimeStr} / {playerState.progress.maxPlayTimeStr}</Text>
      <View style={styles.npControls}>
        <TouchableOpacity onPress={() => { void playPrev() }} style={styles.npBtn}>
          <Icon name="prevMusic" color={colors.text} size={26} />
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlay} style={[styles.npPlayBtn, { backgroundColor: colors.accent }]}>
          <Icon name={playerState.isPlay ? 'pause' : 'play'} color="#fff" size={28} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { void playNext(true) }} style={styles.npBtn}>
          <Icon name="nextMusic" color={colors.text} size={26} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.npLyric}>
        <Text style={[styles.npLyricText, { color: colors.text2 }]}>{playerState.lastLyric ?? '暂无歌词'}</Text>
      </ScrollView>
    </View>
  )
})
NowPlayingView.displayName = 'NowPlayingView'

/** 高级设置：完整旧设置页（复杂功能不占主界面，但保留可用） */
export const AdvancedView = memo(() => <SettingPage />)
AdvancedView.displayName = 'AdvancedView'

const styles = StyleSheet.create({
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.sm },
  settingLabel: { flex: 1, fontSize: 14 },
  input: { borderWidth: 1, borderRadius: RADIUS.sm, width: 90, paddingHorizontal: SPACE.sm, paddingVertical: 5, fontSize: 14, marginRight: SPACE.sm },
  smallBtn: { borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 7 },
  smallBtnText: { color: '#fff', fontSize: 13 },
  hint: { fontSize: 12, lineHeight: 18 },
  groupRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md, borderBottomWidth: 1 },
  groupName: { fontSize: 14 },
  npContainer: { flex: 1, alignItems: 'center', paddingHorizontal: SPACE.xl },
  npHeader: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingVertical: SPACE.md },
  npBack: { padding: SPACE.sm },
  npHeaderTitle: { fontSize: 15, marginLeft: SPACE.sm },
  npCoverBig: { width: 220, height: 220, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', marginTop: SPACE.xl },
  npName: { fontSize: 20, fontWeight: '600', marginTop: SPACE.xl },
  npSinger: { fontSize: 13, marginTop: SPACE.sm },
  npProgressTrack: { height: 4, borderRadius: 2, width: '90%', marginTop: SPACE.xl },
  npProgressBar: { height: 4, borderRadius: 2 },
  npControls: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.xl, gap: SPACE.xl },
  npBtn: { padding: SPACE.md },
  npPlayBtn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  npLyric: { flex: 1, width: '100%', marginTop: SPACE.xl },
  npLyricText: { fontSize: 14, textAlign: 'center', lineHeight: 24 },
})
