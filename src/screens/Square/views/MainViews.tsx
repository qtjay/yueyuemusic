import { memo, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { search } from '@/core/search/music'
import { handlePlay } from '@/components/OnlineList/listAction'
import { batchCacheMusic } from '@/core/musicCache/batch'
import { toast } from '@/utils/tools'
import playerState from '@/store/player/state'
import SongListPage from '@/screens/Home/Views/SongList'
import LeaderboardPage from '@/screens/Home/Views/Leaderboard'
import { Chip, Empty, SectionHeader, SectionShell, TrackRow } from '../components'
import { RADIUS, SPACE, type SquareColors } from '../tokens'

export interface SearchQuery {
  text: string
  seq: number
}

const HOT_WORDS = ['周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '毛不易', '轻音乐', '摇篮曲', '白噪音']

/** 发现 / 聚合搜索 / 历史播放（musicsquare 的 discover + search + history 合并） */
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

  const handleCacheAll = () => {
    if (!results.length) return
    toast(`开始缓存 ${results.length} 首歌曲...`)
    void batchCacheMusic(results).then(res => {
      toast(`缓存完成：成功 ${res.success}，跳过 ${res.skipped}，失败 ${res.failed}`)
    })
  }

  const handleCacheOne = (musicInfo: LX.Music.MusicInfoOnline) => {
    toast('开始缓存...')
    void batchCacheMusic([musicInfo]).then(res => toast(res.success ? '缓存成功' : '缓存失败或已缓存'))
  }

  const playedList = playerState.playedList.slice(-10).reverse()

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.lg }}>
      <SectionShell colors={colors}>
        <SectionHeader colors={colors} title="发现音乐" hint="输入歌名 / 歌手，回车搜索" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {HOT_WORDS.map(word => <Chip key={word} colors={colors} label={word} onPress={() => onHotWord(word)} />)}
        </View>
      </SectionShell>

      {searched
        ? (
            <SectionShell colors={colors}>
              <SectionHeader
                colors={colors}
                title="搜索结果"
                hint={`${query.text} · ${results.length} 首`}
                right={results.length
                  ? <TouchableOpacity onPress={handleCacheAll}><Text style={{ color: colors.accent, fontSize: 13 }}>批量缓存</Text></TouchableOpacity>
                  : undefined}
              />
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
                        onCache={() => handleCacheOne(item)}
                      />
                    ))
                  : <Empty colors={colors} icon="🔍" text="没有找到歌曲，换个关键词试试" />}
            </SectionShell>
          )
        : null}

      <SectionShell colors={colors}>
        <SectionHeader colors={colors} title="历史播放" hint="最近 10 首" />
        {playedList.length
          ? playedList.map((item, index) => {
              const music = item.musicInfo as LX.Music.MusicInfoOnline
              return (
                <TrackRow
                  key={`${item.listId}_${music.id}_${index}`}
                  colors={colors}
                  index={index}
                  musicInfo={music}
                  isTablet={isTablet}
                  isCompact={isCompact}
                  onPress={() => { handlePlay(music); onPlaySong() }}
                />
              )
            })
          : <Empty colors={colors} text="还没有播放记录" />}
      </SectionShell>
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
