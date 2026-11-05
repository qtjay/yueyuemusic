import { memo, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { search } from '@/core/search/music'
import { handlePlay } from '@/components/OnlineList/listAction'
import { playList } from '@/core/player/player'
import { overwriteListMusics } from '@/core/list'
import { enqueueCacheMusic } from '@/core/musicCache/queue'
import { toast } from '@/utils/tools'
import {
  AddToListModal,
  Chip,
  ListActionBar,
  PagedSongList,
  SectionHeader,
  SectionShell,
  TrackRow,
  useBatchSelection,
  useCachedIds,
} from '../components'
import { type SquareColors } from '../tokens'

export interface SearchQuery {
  text: string
  seq: number
}

const HOT_WORDS = ['周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '毛不易', '轻音乐', '摇篮曲', '白噪音']

/** 发现 / 聚合搜索：首屏 20 首，上滑时顶部模块随列表滚出 */
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

  return (
    <View style={{ flex: 1 }}>
      <PagedSongList
        colors={colors}
        songs={results}
        resetKey={`${query.text}_${query.seq}`}
        expanded={batch.batchMode}
        loading={loading}
        empty={searched ? undefined : null}
        header={
          <View>
            <SectionShell colors={colors}>
              <SectionHeader colors={colors} title="发现音乐" hint="热搜词" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {HOT_WORDS.map(word => <Chip key={word} colors={colors} label={word} onPress={() => onHotWord(word)} />)}
              </View>
            </SectionShell>
            {searched
              ? <SectionShell colors={colors} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 }}>
                  <SectionHeader colors={colors} title="搜索结果" hint={`${query.text} · ${results.length} 首`} />
                  <ListActionBar
                    colors={colors}
                    batch={batch}
                    ids={results.map(rowKey)}
                    songs={results}
                    onPlayAll={playAll}
                    onCacheAll={cacheAll}
                    getSelected={getSelected}
                    onAddToList={musics => setAddMusics(musics)}
                  />
                </SectionShell>
              : null}
            {!searched
              ? <SectionShell colors={colors}>
                  <SectionHeader colors={colors} title="开始聆听" hint="使用提示" />
                  <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 22 }}>
                    点上方热搜词，或在搜索框输入歌名 / 歌手开始找歌。结果可播放全部、缓存全部、加入歌单；底部播放条可拖动进度、收藏到我的收藏。
                  </Text>
                </SectionShell>
              : null}
          </View>
        }
        renderRow={(item, index) => (
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
DiscoverSearchView.displayName = 'DiscoverSearchView'
