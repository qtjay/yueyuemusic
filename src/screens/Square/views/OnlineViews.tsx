import { memo, useEffect, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import SongListPage from '@/screens/Home/Views/SongList'
import LeaderboardVertical from '@/screens/Home/Views/Leaderboard/Vertical'
import { getListDetailAll as getSongListDetailAll } from '@/core/songlist'
import { getListDetailAll as getBoardDetailAll } from '@/core/leaderboard'
import { overwriteListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { handlePlay } from '@/components/OnlineList/listAction'
import { enqueueCacheMusic } from '@/core/musicCache/queue'
import { toast } from '@/utils/tools'
import { emitLeaderboardBatch, setLeaderboardSongsHandler, type SquareDetailPayload } from '@/core/squareBridge'
import boardState from '@/store/leaderboard/state'
import {
  AddToListModal,
  ListActionBar,
  PagedSongList,
  SectionHeader,
  SectionShell,
  TrackRow,
  useBatchSelection,
  useCachedIds,
} from '../components'
import { RADIUS, SPACE, type SquareColors } from '../tokens'

/** 一级：保留原有专辑网格、最新/最热等分类筛选 */
export const SonglistView = memo(({ colors }: { colors: SquareColors }) => (
  <View style={{ flex: 1, paddingTop: SPACE.lg, paddingHorizontal: SPACE.lg, paddingBottom: 0 }}>
    <SectionShell colors={colors} style={{ flex: 1, padding: 0, borderRadius: RADIUS.lg, marginBottom: 0 }}>
      <SongListPage />
    </SectionShell>
  </View>
))
SonglistView.displayName = 'SonglistView'

export const LeaderboardView = memo(({ colors }: { colors: SquareColors }) => {
  const [songs, setSongs] = useState<LX.Music.MusicInfoOnline[]>([])
  useEffect(() => {
    // 子组件首帧可能早于注册，先用当前榜单数据兜底
    setSongs(boardState.listDetailInfo.list)
    setLeaderboardSongsHandler(setSongs)
    return () => setLeaderboardSongsHandler(null)
  }, [])

  const playAll = () => {
    if (!songs.length) return
    void overwriteListMusics('temp', songs).then(() => { void playList('temp', 0) })
  }
  const cacheAll = () => {
    const n = enqueueCacheMusic(songs)
    toast(n ? `已加入缓存队列 ${n} 首` : '没有可缓存的歌曲')
  }
  const totalSec = songs.reduce((acc, m) => {
    const raw = (m as unknown as { interval?: string }).interval
    if (!raw || !raw.includes(':')) return acc
    const [mm, ss] = raw.split(':').map(Number)
    return acc + (Number.isFinite(mm) && Number.isFinite(ss) ? mm * 60 + ss : 0)
  }, 0)
  const durationText = totalSec >= 3600
    ? `${Math.floor(totalSec / 3600)} 小时 ${Math.floor((totalSec % 3600) / 60)} 分钟`
    : `${Math.floor(totalSec / 60)} 分钟`

  return (
    <View style={{ flex: 1, paddingTop: SPACE.lg, paddingHorizontal: SPACE.lg, paddingBottom: 0 }}>
      <SectionShell colors={colors} style={{ flex: 1, padding: 0, borderRadius: RADIUS.lg, marginBottom: 0 }}>
        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={playAll} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md }}>
                <Text style={{ color: '#fff', fontSize: 15 }}>▶</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>播放全部</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={cacheAll} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="缓存全部">
                <Icon name="download-2" color={colors.text2} size={20} />
              </TouchableOpacity>
              <TouchableOpacity onPress={emitLeaderboardBatch} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="批量编辑">
                <Icon name="menu" color={colors.text2} size={20} />
              </TouchableOpacity>
            </View>
          </View>
          <Text numberOfLines={1} style={{ fontSize: 11, color: colors.text3, marginLeft: 38 + SPACE.md, marginTop: 2 }}>
            {songs.length} 首 · {durationText}
          </Text>
        </View>
        <View style={{ flex: 1, paddingHorizontal: SPACE.md }}><LeaderboardVertical /></View>
      </SectionShell>
    </View>
  )
})
LeaderboardView.displayName = 'LeaderboardView'

const rowKey = (music: LX.Music.MusicInfoOnline, index: number) => `${music.source}_${music.id}_${index}`

/** 二级：Square 统一风格的歌曲列表（顶栏返回/内搜索由容器控制） */
export const OnlineDetailView = memo(({ colors, isTablet, isCompact, payload, filterText, onPlaySong }: {
  colors: SquareColors
  isTablet: boolean
  isCompact: boolean
  payload: SquareDetailPayload
  filterText: string
  onPlaySong: () => void
}) => {
  const [songs, setSongs] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(false)
  const [addMusics, setAddMusics] = useState<LX.Music.MusicInfo[]>([])
  const batch = useBatchSelection()
  const cachedIds = useCachedIds()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSongs([])
    batch.exit()
    void (async() => {
      try {
        const list = payload.mode == 'songlist'
          ? await getSongListDetailAll(payload.source, payload.id)
          : await getBoardDetailAll(payload.id)
        if (!cancelled) setSongs(list)
      } catch {
        if (!cancelled) { setSongs([]); toast('加载失败，请稍后重试') }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [payload.id, payload.mode, payload.source])

  const keyword = filterText.trim().toLowerCase()
  const visibleSongs = keyword
    ? songs.filter(m => m.name.toLowerCase().includes(keyword) || m.singer.toLowerCase().includes(keyword))
    : songs
  const ids = visibleSongs.map(rowKey)
  const getSelected = () => visibleSongs.filter((m, i) => batch.selected.includes(rowKey(m, i)))

  const playAll = () => {
    if (!visibleSongs.length) return
    void overwriteListMusics('temp', visibleSongs).then(() => {
      void playList('temp', 0)
      onPlaySong()
    })
  }
  const cacheAll = () => {
    const n = enqueueCacheMusic(visibleSongs)
    toast(n ? `已加入缓存队列 ${n} 首` : '没有可缓存的歌曲')
  }

  return (
    <View style={{ flex: 1 }}>
      <PagedSongList
        colors={colors}
        songs={visibleSongs}
        resetKey={`${payload.id}_${filterText}`}
        expanded={batch.batchMode}
        loading={loading}
        header={
          <SectionShell colors={colors} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 }}>
            <SectionHeader
              colors={colors}
              title={payload.name || (payload.mode == 'songlist' ? '歌单' : '排行榜')}
              hint={`${visibleSongs.length} 首`}
            />
            <ListActionBar
              colors={colors}
              batch={batch}
              ids={ids}
              songs={visibleSongs}
              onPlayAll={playAll}
              onCacheAll={cacheAll}
              getSelected={getSelected}
              onAddToList={musics => setAddMusics(musics)}
            />
          </SectionShell>
        }
        renderRow={(music, index) => (
          <TrackRow
            colors={colors}
            index={index}
            musicInfo={music}
            isTablet={isTablet}
            isCompact={isCompact}
            textSize="small"
            onPress={() => { handlePlay(music); onPlaySong() }}
            cached={cachedIds.has(music.id)}
            batchMode={batch.batchMode}
            selected={batch.selected.includes(rowKey(music, index))}
            onToggleSelect={() => batch.toggle(rowKey(music, index))}
          />
        )}
      />
      <AddToListModal
        colors={colors}
        visible={addMusics.length > 0}
        musics={addMusics}
        onClose={() => { setAddMusics([]); batch.exit() }}
      />
    </View>
  )
})
OnlineDetailView.displayName = 'OnlineDetailView'
