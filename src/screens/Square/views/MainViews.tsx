import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { getList } from '@/core/hotSearch'
import hotSearchActions from '@/store/hotSearch/action'
import hotSearchState from '@/store/hotSearch/state'
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

/** 网络不可用时的兜底词（保留哄睡场景常用词） */
const FALLBACK_HOT_WORDS = ['周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '毛不易', '轻音乐', '摇篮曲', '白噪音']
const HOT_PAGE_SIZE = 8

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
  // 热搜词来自各音源实时榜单，加载失败才回退到静态推荐词
  const [hotWords, setHotWords] = useState<string[]>(FALLBACK_HOT_WORDS)
  const [hotLive, setHotLive] = useState(false)
  const [hotLoading, setHotLoading] = useState(false)
  const [hotPage, setHotPage] = useState(0)

  const loadHotWords = useCallback(async(refresh: boolean) => {
    setHotLoading(true)
    try {
      if (refresh) {
        for (const source of hotSearchState.sources) hotSearchActions.clearList(source)
      }
      const list = await getList('all')
      const seen = new Set<string>()
      const words: string[] = []
      for (const raw of list ?? []) {
        const w = typeof raw == 'string' ? raw.trim() : ''
        if (!w || seen.has(w)) continue
        seen.add(w)
        words.push(w)
      }
      if (words.length) {
        setHotWords(words)
        setHotLive(true)
        if (!refresh) setHotPage(0)
      }
    } catch {
      // 保留兜底推荐词，不打断首页
    } finally {
      setHotLoading(false)
    }
  }, [])
  useEffect(() => { void loadHotWords(false) }, [loadHotWords])

  const displayHotWords = useMemo(() => {
    if (hotWords.length <= HOT_PAGE_SIZE) return hotWords
    return Array.from({ length: HOT_PAGE_SIZE }, (_, i) =>
      hotWords[(hotPage * HOT_PAGE_SIZE + i) % hotWords.length])
  }, [hotWords, hotPage])
  const onShuffleHotWords = () => {
    setHotPage(p => p + 1)
    void loadHotWords(true)
  }
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
              <SectionHeader
                colors={colors}
                title="发现音乐"
                hint={hotLoading ? '热搜加载中…' : hotLive ? '实时热搜' : '推荐词'}
                right={hotWords.length > HOT_PAGE_SIZE
                  ? <TouchableOpacity onPress={onShuffleHotWords} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: colors.accent, fontSize: 12 }}>换一批</Text>
                    </TouchableOpacity>
                  : undefined}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {displayHotWords.map((word, i) => <Chip key={`${word}_${i}`} colors={colors} label={word} onPress={() => onHotWord(word)} />)}
              </View>
            </SectionShell>
            {searched
              ? <SectionShell colors={colors} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 }}>
                  <SectionHeader colors={colors} title="搜索结果" hint={query.text} />
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
                    点上方实时热搜词（可点「换一批」），或在搜索框输入歌名 / 歌手开始找歌。结果可播放全部、缓存全部、加入歌单；底部播放条可拖动进度、收藏到我的收藏。
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
