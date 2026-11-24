import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { getList } from '@/core/hotSearch'
import hotSearchActions from '@/store/hotSearch/action'
import hotSearchState from '@/store/hotSearch/state'
import { search } from '@/core/search/music'
import { getSearchHistory } from '@/core/search/search'
import { handlePlay } from '@/components/OnlineList/listAction'
import { insertBatchAndPlay } from '@/core/player/playQueue'
import { enqueueCacheMusic } from '@/core/musicCache/queue'
import { toast } from '@/utils/tools'
import musicSdk from '@/utils/musicSdk'
import {
  AddToListModal,
  Chip,
  FilterDropdown,
  HeaderBackText,
  ListActionBar,
  PagedSongList,
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

/** 网络不可用时的兜底词（保留哄睡场景常用词） */
const FALLBACK_HOT_WORDS = ['周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '毛不易', '轻音乐', '摇篮曲', '白噪音']
const HOT_PAGE_SIZE = 8
const HISTORY_SIZE = 3
const ALL = 'all'
/** 按「最高音质」分组，与 TrackRow 的 24bit/SQ/HQ 标签一一对应；每首歌只归一组 */
const TOP_QUALITY_KEYS = ['flac24bit', 'flac', '320k', '128k'] as const
const QUALITY_LABEL: Record<string, string> = {
  flac24bit: '24bit', flac: 'SQ', '320k': 'HQ', '128k': '标准',
}
const getTopQuality = (m: LX.Music.MusicInfoOnline): string => {
  const q = (m.meta as (LX.Music.MusicInfoMeta_online & { _qualitys?: Record<string, any> }) | undefined)?._qualitys
  if (q?.flac24bit) return 'flac24bit'
  if (q?.flac || q?.ape) return 'flac'
  if (q?.['320k']) return '320k'
  return '128k'
}

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
  // 搜索记录（最近 3 条气泡）、平台/音质下拉筛选、结果区顶部位置
  const [history, setHistory] = useState<string[]>([])
  const [platform, setPlatform] = useState(ALL)
  const [quality, setQuality] = useState(ALL)
  const [resultTop, setResultTop] = useState(0)

  useEffect(() => {
    void getSearchHistory().then(list => setHistory(list.slice(0, HISTORY_SIZE)))
  }, [query.seq])
  // 每次新搜索回到「全部」，避免上一次的筛选条件把结果挡空
  useEffect(() => { setPlatform(ALL); setQuality(ALL) }, [query.seq])

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

  // 平台名取音源中文名；选项只列本次结果里实际出现的平台/音质
  const sourceName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of musicSdk.sources) map[String(s.id)] = String(s.name)
    return map
  }, [])
  const platformOptions = useMemo(() => [
    { id: ALL, label: '全部' },
    ...Array.from(new Set(results.map(m => m.source))).map(id => ({ id, label: sourceName[id] ?? id })),
  ], [results, sourceName])
  const qualityOptions = useMemo(() => {
    const set = new Set<string>()
    for (const m of results) set.add(getTopQuality(m))
    return [ALL, ...TOP_QUALITY_KEYS.filter(k => set.has(k))]
  }, [results])
  const visibleResults = useMemo(() => results.filter(m => {
    if (platform != ALL && m.source != platform) return false
    if (quality == ALL) return true
    return getTopQuality(m) == quality
  }), [results, platform, quality])

  const getSelected = () => visibleResults.filter((m, i) => batch.selected.includes(rowKey(m, i)))
  const playAll = () => {
    if (!visibleResults.length) return
    insertBatchAndPlay(visibleResults)
    onPlaySong()
  }
  const cacheAll = () => {
    const n = enqueueCacheMusic(visibleResults)
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
        songs={visibleResults}
        resetKey={`${query.text}_${query.seq}`}
        expanded={batch.batchMode}
        loading={loading}
        empty={searched ? undefined : null}
        scrollSignal={searched && resultTop > 0 ? { offset: resultTop + SPACE.lg, token: query.seq } : undefined}
        scrollBottomPadding={searched ? 1200 : 0}
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
            <SectionShell colors={colors}>
              <SectionHeader colors={colors} title="搜索记录" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {history.length
                  ? history.map((word, i) => <Chip key={`${word}_${i}`} colors={colors} label={word} onPress={() => onHotWord(word)} />)
                  : <Text style={{ color: colors.text3, fontSize: 13 }}>还没有搜索记录</Text>}
              </View>
            </SectionShell>
            {searched
              ? <View onLayout={e => setResultTop(e.nativeEvent.layout.y)}>
                  <SectionShell colors={colors} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 }}>
                    <SectionHeader
                      colors={colors}
                      title="搜索结果"
                      hint={query.text}
                      right={batch.batchMode ? <HeaderBackText colors={colors} onPress={batch.exit} /> : undefined}
                    />
                    <ListActionBar
                      colors={colors}
                      batch={batch}
                      ids={visibleResults.map(rowKey)}
                      songs={visibleResults}
                      onPlayAll={playAll}
                      onCacheAll={cacheAll}
                      getSelected={getSelected}
                      onAddToList={musics => setAddMusics(musics)}
                    />
                  </SectionShell>
                  <View style={{
                    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
                    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
                    backgroundColor: colors.surface,
                    borderBottomWidth: 1, borderBottomColor: colors.line,
                  }}>
                    <FilterDropdown colors={colors} label="平台" value={platform} options={platformOptions}
                      onChange={id => { setPlatform(id); batch.selectAll([]) }} />
                    <FilterDropdown colors={colors} label="音质" value={quality}
                      options={qualityOptions.map(q => ({ id: q, label: q == ALL ? '全部' : (QUALITY_LABEL[q] ?? q) }))}
                      onChange={id => { setQuality(id); batch.selectAll([]) }} />
                  </View>
                </View>
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
            onPress={() => { handlePlay(item, visibleResults, index); onPlaySong() }}
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
