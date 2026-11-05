import { memo, useEffect, useState } from 'react'
import { View } from 'react-native'
import SongListPage from '@/screens/Home/Views/SongList'
import LeaderboardPage from '@/screens/Home/Views/Leaderboard'
import { getListDetailAll as getSongListDetailAll } from '@/core/songlist'
import { getListDetailAll as getBoardDetailAll } from '@/core/leaderboard'
import { overwriteListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { handlePlay } from '@/components/OnlineList/listAction'
import { enqueueCacheMusic } from '@/core/musicCache/queue'
import { toast } from '@/utils/tools'
import { type SquareDetailPayload } from '@/core/squareBridge'
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
  <View style={{ flex: 1, padding: SPACE.lg }}>
    <SectionShell colors={colors} style={{ flex: 1, padding: 0, borderRadius: RADIUS.lg }}>
      <SongListPage />
    </SectionShell>
  </View>
))
SonglistView.displayName = 'SonglistView'

export const LeaderboardView = memo(({ colors }: { colors: SquareColors }) => (
  <View style={{ flex: 1, padding: SPACE.lg }}>
    <SectionShell colors={colors} style={{ flex: 1, padding: 0, borderRadius: RADIUS.lg }}>
      <LeaderboardPage />
    </SectionShell>
  </View>
))
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
