import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Image, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { playList } from '@/core/player/player'
import {
  createList,
  removeUserList,
  updateUserList,
  updateUserListPosition,
  removeListMusics,
  updateListMusics,
  updateListMusicPosition,
} from '@/core/list'
import { setTheme } from '@/core/theme'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import themeState from '@/store/theme/state'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import { getListMusicSync } from '@/utils/listManage'
import { getUserLists } from '@/utils/data'
import { toast, confirmDialog } from '@/utils/tools'
import {
  enqueueCacheMusic,
  getCacheQueueState,
  subscribeCacheQueue,
  pauseCacheQueue,
  resumeCacheQueue,
  removeCacheQueueItem,
  clearFinishedCacheQueue,
  type CacheQueueState,
} from '@/core/musicCache/queue'
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
import { AddToListModal, Chip, Empty, ListActionBar, SectionHeader, SectionShell, TrackRow, useCachedIds, usePlayerTick } from '../components'
import { RADIUS, SPACE, type SquareColors } from '../tokens'

const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

type ListEntry = { id: string, name?: string }
const BUILTIN_IDS = ['default', 'love', 'temp', 'download']
/** 内置 default 列表显示为「未播放历史」 */
export const DEFAULT_LIST_NAME = '未播放历史'
const displayListName = (id: string, name?: string) =>
  id == 'default' ? DEFAULT_LIST_NAME : (name ?? id)

const QUEUE_STATUS_TEXT: Record<string, string> = {
  pending: '等待中',
  running: '缓存中',
  done: '已完成',
  skipped: '已缓存',
  failed: '失败',
}

const ActionButton = ({ colors, label, onPress }: {
  colors: SquareColors
  label: string
  onPress: () => void
}) => (
  <TouchableOpacity onPress={onPress} style={[styles.actionBtn, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
    <Text style={[styles.actionBtnText, { color: colors.text }]}>{label}</Text>
  </TouchableOpacity>
)

/** 我的歌单：两级页面（歌单列表 → 歌曲列表），各自带新建/删除/改名/移动位置 */
export const MyListView = memo(({ colors, isTablet, isCompact, onPlaySong, onGoDiscover }: {
  colors: SquareColors
  isTablet: boolean
  isCompact: boolean
  onPlaySong: () => void
  onGoDiscover: () => void
}) => {
  usePlayerTick()
  const lists = listState.allList as unknown as ListEntry[]
  const [level, setLevel] = useState<'lists' | 'songs'>('lists')
  const [activeId, setActiveId] = useState(() => lists[0]?.id ?? 'love')
  const [selected, setSelected] = useState<string[]>([])
  const [editor, setEditor] = useState<{ mode: 'create' | 'rename' | 'songRename', value: string } | null>(null)
  const [batchMode, setBatchMode] = useState(false)
  const [addMusics, setAddMusics] = useState<LX.Music.MusicInfo[]>([])
  const songs = (getListMusicSync(activeId) ?? []) as LX.Music.MusicInfo[]
  const activeName = displayListName(activeId, lists.find(l => l.id == activeId)?.name)
  const cachedIds = useCachedIds()

  const clearSelection = () => setSelected([])
  const toggleSelect = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x != id) : [...s, id])

  const openList = (id: string) => { setActiveId(id); setLevel('songs'); clearSelection() }
  const backToLists = () => { setLevel('lists'); clearSelection() }

  const handleCreate = () => {
    if (level == 'songs') {
      onGoDiscover()
      toast('搜索歌曲后，用歌曲菜单的「添加到」加入当前歌单')
      return
    }
    setEditor({ mode: 'create', value: '' })
  }

  const handleDelete = () => {
    if (!selected.length) { toast('请先选中要删除的项'); return }
    void confirmDialog({ message: `确定删除选中的 ${selected.length} 项？` }).then(async ok => {
      if (!ok) return
      if (level == 'lists') {
        const ids = selected.filter(id => !BUILTIN_IDS.includes(id))
        if (!ids.length) { toast('内置歌单不能删除'); return }
        await removeUserList(ids)
      } else {
        await removeListMusics(activeId, selected)
      }
      clearSelection()
    })
  }

  const handleRename = () => {
    if (selected.length != 1) { toast('请选中一项再改名'); return }
    const id = selected[0]
    if (level == 'lists') {
      if (BUILTIN_IDS.includes(id)) { toast('内置歌单不能改名'); return }
      setEditor({ mode: 'rename', value: lists.find(l => l.id == id)?.name ?? '' })
    } else {
      setEditor({ mode: 'songRename', value: songs.find(m => m.id == id)?.name ?? '' })
    }
  }

  const handleMove = (dir: -1 | 1) => {
    if (!selected.length) { toast('请先选中要移动的项'); return }
    if (level == 'lists') {
      // 位置 API 作用于「用户歌单」数组，索引必须基于 userList，不能用含内置列表的 allList
      const userIds = (listState.userList as unknown as ListEntry[]).map(l => l.id)
      const idx = userIds.findIndex(id => selected.includes(id))
      if (idx < 0) { toast('内置歌单不能调整顺序'); return }
      const pos = Math.max(0, Math.min(userIds.length - 1, idx + dir))
      void updateUserListPosition(pos, selected)
    } else {
      const ids = songs.map(m => m.id)
      const idx = ids.findIndex(id => selected.includes(id))
      const pos = Math.max(0, Math.min(ids.length - 1, idx + dir))
      void updateListMusicPosition(activeId, pos, selected)
    }
    clearSelection()
  }

  const handleCacheAll = () => {
    const count = enqueueCacheMusic(songs, { listId: activeId, listName: activeName })
    toast(count ? `已加入缓存队列 ${count} 首，可在缓存管理页查看` : '没有可缓存的歌曲')
  }

  const handleCacheOne = (music: LX.Music.MusicInfo) => {
    const count = enqueueCacheMusic([music], { listId: activeId, listName: activeName })
    if (count) toast('已加入缓存队列')
  }

  // 批量编辑复用管理态的选中集合，避免两套复选状态
  const songIds = songs.map(m => m.id)
  const batch = {
    batchMode,
    setBatchMode,
    selected,
    toggle: toggleSelect,
    selectAll: (ids: string[]) => setSelected(ids),
    invert: (ids: string[]) => setSelected(s => ids.filter(id => !s.includes(id))),
    exit: () => { setBatchMode(false); clearSelection() },
  }
  const getSelected = () => songs.filter(m => selected.includes(m.id))
  const playAll = () => {
    if (!songs.length) return
    void playList(activeId, 0)
    onPlaySong()
  }
  const deleteSelected = () => {
    if (!selected.length) { toast('请先选中歌曲'); return }
    void confirmDialog({ message: `从歌单移除选中的 ${selected.length} 首？` }).then(ok => {
      if (ok) void removeListMusics(activeId, selected)
      batch.exit()
    })
  }

  const submitEditor = async() => {
    if (!editor) return
    const name = editor.value.trim()
    if (!name) { setEditor(null); return }
    if (editor.mode == 'create') {
      await createList({ name })
    } else if (editor.mode == 'rename') {
      const raw = (listState.userList as unknown as ListEntry[]).find(l => l.id == selected[0])
      if (raw) await updateUserList([{ ...raw, name } as LX.List.UserListInfo])
    } else {
      const music = songs.find(m => m.id == selected[0])
      if (music) await updateListMusics([{ id: music.id, musicInfo: { ...music, name } as LX.Music.MusicInfo }])
    }
    setEditor(null)
    clearSelection()
  }

  const actions = [
    { label: level == 'lists' ? '新建' : '＋添加', onPress: handleCreate },
    { label: '删除', onPress: handleDelete },
    { label: '改名', onPress: handleRename },
    { label: '↑', onPress: () => handleMove(-1) },
    { label: '↓', onPress: () => handleMove(1) },
  ]

  return (
    <View style={{ flex: 1, padding: SPACE.lg }}>
      <SectionShell colors={colors} style={{ flex: 1 }}>
        <SectionHeader
          colors={colors}
          title={level == 'lists' ? '我的歌单' : activeName}
          hint={level == 'lists' ? `${lists.length} 个` : `${songs.length} 首`}
          right={level == 'songs'
            ? <TouchableOpacity onPress={backToLists}><Text style={{ color: colors.accent, fontSize: 13 }}>‹ 返回歌单</Text></TouchableOpacity>
            : undefined}
        />
        {!batchMode
          ? <View style={styles.actionRow}>
              {actions.map(a => <ActionButton key={a.label} colors={colors} label={a.label} onPress={a.onPress} />)}
            </View>
          : null}
        {level == 'songs'
          ? <ListActionBar
              colors={colors}
              batch={batch}
              ids={songIds}
              songs={songs}
              onPlayAll={playAll}
              onCacheAll={handleCacheAll}
              getSelected={getSelected}
              onAddToList={musics => setAddMusics(musics)}
              showDelete
              onDelete={deleteSelected}
            />
          : null}
        <ScrollView style={{ flex: 1 }}>
          {level == 'lists'
            ? lists.map((list, index) => {
                const count = (getListMusicSync(list.id) ?? []).length
                const active = selected.includes(list.id)
                return (
                  <View key={list.id} style={[styles.manageRow, { borderBottomColor: colors.line, backgroundColor: active ? colors.accentSoft : 'transparent' }]}>
                    <TouchableOpacity onPress={() => toggleSelect(list.id)} style={[styles.checkBox, { borderColor: colors.accent }]}>
                      <Text style={{ color: colors.accent, fontSize: 12 }}>{active ? '✓' : ''}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openList(list.id)} style={{ flex: 1 }}>
                      <Text style={[styles.manageName, { color: colors.text }]}>{displayListName(list.id, list.name)}</Text>
                      <Text style={[styles.hint, { color: colors.text3 }]}>{count} 首</Text>
                    </TouchableOpacity>
                  </View>
                )
              })
            : songs.length
              ? songs.map((music, index) => {
                  const active = selected.includes(music.id)
                  return (
                    <View key={`${music.source}_${music.id}_${index}`} style={[styles.manageRow, { borderBottomColor: colors.line, backgroundColor: active ? colors.accentSoft : 'transparent' }]}>
                      <TouchableOpacity onPress={() => toggleSelect(music.id)} style={[styles.checkBox, { borderColor: colors.accent }]}>
                        <Text style={{ color: colors.accent, fontSize: 12 }}>{active ? '✓' : ''}</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <TrackRow
                          colors={colors}
                          index={index}
                          musicInfo={music as LX.Music.MusicInfoOnline}
                          isTablet={isTablet}
                          isCompact={isCompact}
                          textSize="small"
                          onPress={batchMode
                            ? () => toggleSelect(music.id)
                            : () => { void playList(activeId, index); onPlaySong() }}
                          onCache={batchMode ? undefined : () => handleCacheOne(music)}
                          cached={cachedIds.has(music.id)}
                        />
                      </View>
                    </View>
                  )
                })
              : <Empty colors={colors} text="这个歌单还没有歌曲，点「＋添加」去搜索添加" />}
        </ScrollView>
      </SectionShell>

      <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <View style={styles.modalMask}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editor?.mode == 'create' ? '新建歌单' : '改名'}
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.line, backgroundColor: colors.surface2 }]}
              value={editor?.value ?? ''}
              onChangeText={v => setEditor(e => e ? { ...e, value: v } : e)}
              placeholder="输入名称"
              placeholderTextColor={colors.text3}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setEditor(null)} style={styles.modalBtn}>
                <Text style={{ color: colors.text2, fontSize: 14 }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { void submitEditor() }} style={[styles.modalBtn, { backgroundColor: colors.accent, borderRadius: RADIUS.sm }]}>
                <Text style={{ color: '#fff', fontSize: 14 }}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AddToListModal
        colors={colors}
        visible={addMusics.length > 0}
        musics={addMusics}
        onClose={() => { setAddMusics([]); batch.exit() }}
      />
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
  const [nameMap, setNameMap] = useState<Record<string, string>>({ default: DEFAULT_LIST_NAME, love: '我的收藏' })
  const [queue, setQueue] = useState<CacheQueueState>(getCacheQueueState)

  const load = useCallback(async() => {
    const [g, s, m, lists] = await Promise.all([getCacheGroups(), getCacheStats(), getCacheMaxSize(), getUserLists()])
    const names: Record<string, string> = { default: DEFAULT_LIST_NAME, love: '我的收藏' }
    for (const l of lists) names[l.id] = l.name
    setNameMap(names)
    setGroups(g)
    setStats(s)
    setMaxSize(String(m))
    setDraft(String(m))
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => subscribeCacheQueue(setQueue), [])

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
        <SectionHeader
          colors={colors}
          title="正在缓存"
          hint={`${queue.done}/${queue.total}${queue.paused ? ' · 已暂停' : ''}`}
          right={<View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={() => queue.paused ? resumeCacheQueue() : pauseCacheQueue()}>
              <Text style={{ color: colors.accent, fontSize: 13 }}>{queue.paused ? '继续' : '暂停'}</Text>
            </TouchableOpacity>
            {queue.items.length
              ? <TouchableOpacity onPress={clearFinishedCacheQueue} style={{ marginLeft: SPACE.md }}>
                  <Text style={{ color: colors.text3, fontSize: 13 }}>清除已完成</Text>
                </TouchableOpacity>
              : null}
          </View>}
        />
        {queue.items.length
          ? queue.items.map(item => (
              <View key={item.key} style={[styles.groupRow, { borderBottomColor: colors.line }]}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.groupName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.hint, { color: colors.text3 }]}>{item.singer} · {QUEUE_STATUS_TEXT[item.status]}</Text>
                </View>
                <TouchableOpacity onPress={() => removeCacheQueueItem(item.key)}>
                  <Text style={{ color: colors.danger, fontSize: 13 }}>移除</Text>
                </TouchableOpacity>
              </View>
            ))
          : <Empty colors={colors} text="暂无缓存任务" />}
      </SectionShell>

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
  const desktopLyric = useSettingValue('desktopLyric.enable')
  const quality = useSettingValue('player.playQuality')
  const apiModalRef = useRef<UserApiEditModalType>(null)

  const isDark = themeState.theme.isDark
  const qualities: LX.Quality[] = ['128k', '320k', 'flac']

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.lg }}>
      <SectionShell colors={colors}>
        <SectionHeader
          colors={colors}
          title="自定义音源"
          right={<TouchableOpacity onPress={() => (apiModalRef.current as any)?.show()}><Text style={{ color: colors.accent, fontSize: 13 }}>导入 / 管理</Text></TouchableOpacity>}
        />
        <Text style={[styles.hint, { color: colors.text3 }]}>
          音源由应用自动选择，播放失败时自动切换，无需手动干预
        </Text>
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

/** 正在播放：下半圆旋转专辑（直边贴顶）+ 歌词；顶部无工具栏、无进度/控制 */
export const NowPlayingView = memo(({ colors, onBack }: {
  colors: SquareColors
  onBack: () => void
}) => {
  usePlayerTick()
  const music = playerState.playMusicInfo.musicInfo as LX.Music.MusicInfo | null
  const rotate = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim = Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 16000, useNativeDriver: true }))
    if (playerState.isPlay) anim.start()
    else anim.stop()
    return () => anim.stop()
  }, [playerState.isPlay, rotate])

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const lyric = playerState.lastLyric ?? '暂无歌词，换一首支持歌词的歌曲试试。'
  const picUrl = (music?.meta as Record<string, any> | undefined)?.picUrl as string | undefined

  return (
    <View style={[styles.npContainer, { backgroundColor: colors.bg }]}>
      <View style={styles.npHalf}>
        <Animated.View style={[styles.npDisc, { backgroundColor: colors.accentSoft, borderColor: colors.surface, transform: [{ rotate: spin }] }]}>
          {picUrl
            ? <Image source={{ uri: picUrl }} style={styles.npCover} resizeMode="cover" />
            : <View style={[styles.npCover, { alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: colors.accent, fontSize: 64 }}>♪</Text>
              </View>}
        </Animated.View>
      </View>
      <TouchableOpacity onPress={onBack} style={[styles.npCollapse, { backgroundColor: colors.surface }]}>
        <Text style={[styles.npCollapseText, { color: colors.text }]}>‹ 收起</Text>
      </TouchableOpacity>
      <Text style={[styles.npName, { color: colors.text }]} numberOfLines={1}>{music?.name ?? '暂无播放'}</Text>
      <Text style={[styles.npSinger, { color: colors.text3 }]} numberOfLines={1}>{music?.singer ?? ''}</Text>
      <ScrollView style={styles.npLyric} contentContainerStyle={{ paddingVertical: SPACE.xl }}>
        <Text style={[styles.npLyricText, { color: colors.text2 }]}>{lyric}</Text>
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
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACE.md },
  actionBtn: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 6, marginRight: SPACE.sm, marginBottom: SPACE.sm },
  actionBtnText: { fontSize: 13 },
  manageRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: SPACE.sm },
  checkBox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  manageName: { fontSize: 13, paddingVertical: 10 },
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '82%', borderRadius: RADIUS.lg, padding: SPACE.xl },
  modalTitle: { fontSize: 16, fontWeight: '600', marginBottom: SPACE.lg },
  modalInput: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: 8, fontSize: 14, marginBottom: SPACE.lg },
  modalBtn: { paddingHorizontal: SPACE.lg, paddingVertical: 8 },
  npContainer: { flex: 1, alignItems: 'center' },
  npHalf: { width: '100%', height: 190, alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' },
  npDisc: { width: 380, height: 380, borderRadius: 190, marginTop: -190, borderWidth: 2, overflow: 'hidden' },
  npCover: { width: '100%', height: '100%' },
  npCollapse: { position: 'absolute', left: SPACE.lg, top: SPACE.lg, paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: RADIUS.pill, zIndex: 2 },
  npCollapseText: { fontSize: 13 },
  npName: { fontSize: 22, fontWeight: '600', marginTop: SPACE.md, paddingHorizontal: SPACE.lg, textAlign: 'center' },
  npSinger: { fontSize: 13, marginTop: SPACE.sm, paddingHorizontal: SPACE.lg, textAlign: 'center' },
  npLyric: { flex: 1, width: '100%', marginTop: SPACE.xl, paddingHorizontal: SPACE.xl },
  npLyricText: { fontSize: 14, textAlign: 'center', lineHeight: 26 },
})
