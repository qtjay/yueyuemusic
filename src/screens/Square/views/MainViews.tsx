import { memo, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, View } from 'react-native'
import { search } from '@/core/search/music'
import { handlePlay } from '@/components/OnlineList/listAction'
import { playList } from '@/core/player/player'
import { overwriteListMusics } from '@/core/list'
import { enqueueCacheMusic } from '@/core/musicCache/queue'
import { toast } from '@/utils/tools'
import {
  AddToListModal,
  Chip,
  Empty,
  ListActionBar,
  SectionHeader,
  SectionShell,
  TrackRow,
  useBatchSelection,
  useCachedIds,
} from '../components'
import { SPACE, type SquareColors } from '../tokens'

export interface SearchQuery {
  text: string
  seq: number
}

const HOT_WORDS = ['周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '毛不易', '轻音乐', '摇篮曲', '白噪音']

/** 发现 / 聚合搜索（列表虚拟化，封面只加载可见行） */
export const DiscoverSearchView = memo(({ colors, isTablet, isCompact, query, onHotWord, onPlaySong }: {
  colors: SquareColors
  isTablet: boolean
  isCompact: boolean
  query: SearchQuery
  onHotWord: (word: string) => void
  onPlaySong: () => void
}) => {
  const [results, setResults] = useState<LX.Music.MusicInfoOnline[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [addMusics, setAddMusics] = useState<LX.Music.MusicInfo[]>([])
  const cachedIds = useCachedIds()
  const batch = useBatchSelection()
  const rowKey = (music: LX.Music.MusicInfoOnline, index: number) => `${music.source}_${music.id}_${index}`
  const ids = results.map(rowKey)
  const getSelected = () => results.filter((m, i) => batch.selected.includes(rowKey(m, i)))

  const playAll = () => {
    if (!results.length) return
    void overwriteListMusics('temp', results).then(() => {
      void playList('temp', 0)
      onPlaySong()
    })
  }

  const cacheAll = () => {
    const n = enqueueCacheMusic(results)
    toast(n ? `已加入缓存队列 ${n} 首` : '没有可缓存的歌曲')
  }

  useEffect(() => {
    if (!query.text) return
    let cancelled = false
    setLoading(true)
    setSearched(true)
    void search(query.text, 1, 'all').then(list => {
      if (!cancelled) setResults(list)
    }).catch(() => {
      if (!cancelled) setResults([])
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [query.seq, query.text])

  const renderRow = ({ item, index }: { item: LX.Music.MusicInfoOnline, index: number }) => (
    <TrackRow
      colors={colors}
      index={index}
      musicInfo={item}
      isTablet={isTablet}
      isCompact={isCompact}
      textSize="small"
      onPress={() => { handlePlay(item); onPlaySong() }}
      cached={cachedIds.has(item.id)}
      batchMode={batch.batchMode}
      selected={batch.selected.includes(rowKey(item, index))}
      onToggleSelect={() => batch.toggle(rowKey(item, index))}
    />
  )

  return (
    <View style={{ flex: 1, padding: SPACE.lg }}>
      <SectionShell colors={colors}>
        <SectionHeader colors={colors} title="发现音乐" hint="热搜词" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {HOT_WORDS.map(word => <Chip key={word} colors={colors} label={word} onPress={() => onHotWord(word)} />)}
        </View>
      </SectionShell>

      {searched
        ? (
            <SectionShell colors={colors} style={{ flex: 1 }}>
              <SectionHeader colors={colors} title="搜索结果" hint={`${query.text} · ${results.length} 首`} />
              <ListActionBar
                colors={colors}
                batch={batch}
                ids={ids}
                songs={results}
                onPlayAll={playAll}
                onCacheAll={cacheAll}
                getSelected={getSelected}
                onAddToList={musics => setAddMusics(musics)}
              />
              <FlatList
                style={{ flex: 1 }}
                data={loading ? [] : results}
                keyExtractor={(item, index) => rowKey(item, index)}
                renderItem={renderRow}
                ListEmptyComponent={loading
                  ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
                  : <Empty colors={colors} icon="🔍" text="没有找到歌曲，换个关键词试试" />}
              />
            </SectionShell>
          )
        : null}
      <AddToListModal
        colors={colors}
        visible={addMusics.length > 0}
        musics={addMusics}
        onClose={() => { setAddMusics([]); batch.exit() }}
      />
    </View>
  )
})
DiscoverSearchView.displayName = 'DiscoverSearchView'
