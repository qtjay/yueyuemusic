import { memo, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { search } from '@/core/search/music'
import { handlePlay } from '@/components/OnlineList/listAction'
import SongListPage from '@/screens/Home/Views/SongList'
import LeaderboardPage from '@/screens/Home/Views/Leaderboard'
import { Chip, Empty, SectionHeader, SectionShell, TrackRow, useCachedIds } from '../components'
import { RADIUS, SPACE, type SquareColors } from '../tokens'

export interface SearchQuery {
  text: string
  seq: number
}

const HOT_WORDS = ['周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '毛不易', '轻音乐', '摇篮曲', '白噪音']

/** 发现 / 聚合搜索（缓存入口统一收敛到「我的歌单」模块） */
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
  const cachedIds = useCachedIds()

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
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.lg }}>
      <SectionShell colors={colors}>
        <SectionHeader colors={colors} title="发现音乐" hint="热搜词" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {HOT_WORDS.map(word => <Chip key={word} colors={colors} label={word} onPress={() => onHotWord(word)} />)}
        </View>
      </SectionShell>

      {searched
        ? (
            <SectionShell colors={colors}>
              <SectionHeader colors={colors} title="搜索结果" hint={`${query.text} · ${results.length} 首`} />
              {loading
                ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
                : results.length
                  ? results.map((item, index) => (
                      <TrackRow
                        key={`${item.source}_${item.id}_${index}`}
                        colors={colors}
                        index={index}
                        musicInfo={item}
                        isTablet={isTablet}
                        isCompact={isCompact}
                        onPress={() => { handlePlay(item); onPlaySong() }}
                        cached={cachedIds.has(item.id)}
                      />
                    ))
                  : <Empty colors={colors} icon="🔍" text="没有找到歌曲，换个关键词试试" />}
            </SectionShell>
          )
        : null}
    </ScrollView>
  )
})
DiscoverSearchView.displayName = 'DiscoverSearchView'

/** 热门歌单：复用原有歌单页能力，外层套 musicsquare 卡片 */
export const SonglistView = memo(({ colors }: { colors: SquareColors }) => (
  <View style={{ flex: 1, padding: SPACE.lg }}>
    <SectionShell colors={colors} style={{ flex: 1, padding: 0, borderRadius: RADIUS.lg }}>
      <SongListPage />
    </SectionShell>
  </View>
))
SonglistView.displayName = 'SonglistView'

/** 排行榜：复用原有榜单页能力 */
export const LeaderboardView = memo(({ colors }: { colors: SquareColors }) => (
  <View style={{ flex: 1, padding: SPACE.lg }}>
    <SectionShell colors={colors} style={{ flex: 1, padding: 0, borderRadius: RADIUS.lg }}>
      <LeaderboardPage />
    </SectionShell>
  </View>
))
LeaderboardView.displayName = 'LeaderboardView'
