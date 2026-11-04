import { memo, useEffect, useState, type ComponentProps } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { getList as getSongLists, getListDetailAll as getSongListDetailAll } from '@/core/songlist'
import { getBoardsList, getListDetailAll as getBoardDetailAll } from '@/core/leaderboard'
import { getSongListSetting, getLeaderboardSetting } from '@/utils/data'
import { overwriteListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { handlePlay } from '@/components/OnlineList/listAction'
import { enqueueCacheMusic } from '@/core/musicCache/queue'
import { toast } from '@/utils/tools'
import {
  AddToListModal,
  Empty,
  ListActionBar,
  SectionHeader,
  SectionShell,
  TrackRow,
  useBatchSelection,
  useCachedIds,
} from '../components'
import { RADIUS, SPACE, type SquareColors } from '../tokens'

interface BrowseEntry {
  id: string
  name: string
  sub?: string
  source: LX.OnlineSource
}

const rowKey = (music: LX.Music.MusicInfoOnline, index: number) => `${music.source}_${music.id}_${index}`

/** 热门歌单 / 排行榜：两级自绘视图，顶栏形态与搜索范围由容器控制 */
const OnlineBrowseView = memo(({ colors, isTablet, isCompact, mode, filterText, onDetailChange, backSeq, onPlaySong }: {
  colors: SquareColors
  isTablet: boolean
  isCompact: boolean
  mode: 'songlist' | 'leaderboard'
  filterText: string
  onDetailChange: (title: string | null) => void
  backSeq: number
  onPlaySong: () => void
}) => {
  const [entries, setEntries] = useState<BrowseEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<{ id: string, name: string, source: LX.OnlineSource } | null>(null)
  const [songs, setSongs] = useState<LX.Music.MusicInfoOnline[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [addMusics, setAddMusics] = useState<LX.Music.MusicInfo[]>([])
  const batch = useBatchSelection()
  const cachedIds = useCachedIds()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async() => {
      try {
        if (mode == 'songlist') {
          const setting = await getSongListSetting()
          const source = setting.source ?? 'kw'
          const res = await getSongLists(source, setting.tagId ?? '', setting.sortId ?? 'new', 1)
          if (!cancelled) setEntries(res.list.map(item => ({
            id: item.id,
            name: item.name,
            sub: item.author || item.play_count,
            source: item.source,
          })))
        } else {
          const setting = await getLeaderboardSetting()
          const source = setting.source ?? 'kw'
          const boards = await getBoardsList(source)
          if (!cancelled) setEntries(boards.map(board => ({
            id: `${source}__${board.bangid}`,
            name: board.name,
            source,
          })))
        }
      } catch {
        if (!cancelled) setEntries([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [mode])

  // 容器顶栏的返回按钮
  useEffect(() => {
    if (backSeq < 1) return
    setDetail(null)
    setSongs([])
    batch.exit()
    onDetailChange(null)
  }, [backSeq])

  const openDetail = (entry: BrowseEntry) => {
    setDetail({ id: entry.id, name: entry.name, source: entry.source })
    onDetailChange(entry.name)
    setSongs([])
    setDetailLoading(true)
    void (async() => {
      try {
        const list = mode == 'songlist'
          ? await getSongListDetailAll(entry.source, entry.id)
          : await getBoardDetailAll(entry.id)
        setSongs(list)
      } catch {
        setSongs([])
        toast('加载失败，请稍后重试')
      } finally {
        setDetailLoading(false)
      }
    })()
  }

  const backToEntries = () => {
    setDetail(null)
    setSongs([])
    batch.exit()
    onDetailChange(null)
  }

  const keyword = filterText.trim().toLowerCase()
  const visibleEntries = keyword
    ? entries.filter(e => e.name.toLowerCase().includes(keyword) || (e.sub ?? '').toLowerCase().includes(keyword))
    : entries
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
    <View style={{ flex: 1, padding: SPACE.lg }}>
      <SectionShell colors={colors} style={{ flex: 1 }}>
        <SectionHeader
          colors={colors}
          title={detail ? detail.name : (mode == 'songlist' ? '热门歌单' : '排行榜')}
          hint={detail ? `${visibleSongs.length} 首` : `${visibleEntries.length} 个`}
          right={detail
            ? <TouchableOpacity onPress={backToEntries}><Text style={{ color: colors.accent, fontSize: 13 }}>‹ 返回</Text></TouchableOpacity>
            : undefined}
        />
        {detail
          ? <>
              <ListActionBar
                colors={colors}
                batch={batch}
                ids={ids}
                onPlayAll={playAll}
                onCacheAll={cacheAll}
                getSelected={getSelected}
                onAddToList={musics => setAddMusics(musics)}
              />
              {detailLoading
                ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
                : <ScrollView style={{ flex: 1 }}>
                    {visibleSongs.length
                      ? visibleSongs.map((music, index) => (
                          <TrackRow
                            key={rowKey(music, index)}
                            colors={colors}
                            index={index}
                            musicInfo={music}
                            isTablet={isTablet}
                            isCompact={isCompact}
                            textSize="large"
                            onPress={() => { handlePlay(music); onPlaySong() }}
                            cached={cachedIds.has(music.id)}
                            batchMode={batch.batchMode}
                            selected={batch.selected.includes(rowKey(music, index))}
                            onToggleSelect={() => batch.toggle(rowKey(music, index))}
                          />
                        ))
                      : <Empty colors={colors} text="没有找到歌曲" />}
                  </ScrollView>}
            </>
          : loading
            ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
            : <ScrollView style={{ flex: 1 }}>
                {visibleEntries.length
                  ? visibleEntries.map(entry => (
                      <TouchableOpacity key={entry.id} onPress={() => openDetail(entry)} style={[styles.entryRow, { borderBottomColor: colors.line }]}>
                        <View style={[styles.entryCover, { backgroundColor: colors.accentSoft, borderRadius: RADIUS.sm }]}>
                          <Text style={{ color: colors.accent, fontSize: 18 }}>♪</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15 }}>{entry.name}</Text>
                          {entry.sub ? <Text numberOfLines={1} style={{ color: colors.text3, fontSize: 11, marginTop: 3 }}>{entry.sub}</Text> : null}
                        </View>
                        <Text style={{ color: colors.text3, fontSize: 16 }}>›</Text>
                      </TouchableOpacity>
                    ))
                  : <Empty colors={colors} text="暂无数据，换个关键词试试" />}
              </ScrollView>}
      </SectionShell>

      <AddToListModal
        colors={colors}
        visible={addMusics.length > 0}
        musics={addMusics}
        onClose={() => { setAddMusics([]); batch.exit() }}
      />
    </View>
  )
})
OnlineBrowseView.displayName = 'OnlineBrowseView'

export const SonglistView = memo((props: Omit<ComponentProps<typeof OnlineBrowseView>, 'mode'>) => (
  <OnlineBrowseView {...props} mode="songlist" />
))
SonglistView.displayName = 'SonglistView'

export const LeaderboardView = memo((props: Omit<ComponentProps<typeof OnlineBrowseView>, 'mode'>) => (
  <OnlineBrowseView {...props} mode="leaderboard" />
))
LeaderboardView.displayName = 'LeaderboardView'

const styles = {
  entryRow: { flexDirection: 'row' as const, alignItems: 'center' as const, borderBottomWidth: 1, paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm },
  entryCover: { width: 46, height: 46, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: SPACE.md },
}
