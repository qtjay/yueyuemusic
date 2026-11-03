import { useCallback, useEffect, useState } from 'react'
import { StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import themeState from '@/store/theme/state'
import { MiniPlayer, SideNav, type NavItem } from './components'
import { SIDEBAR_W, useLayoutMode, useSquareColors } from './tokens'
import { DiscoverSearchView, LeaderboardView, SonglistView, type SearchQuery } from './views/MainViews'
import { AdvancedView, CacheView, MyListView, NowPlayingView, SettingView } from './views/LibraryViews'

const NAV_ITEMS: NavItem[] = [
  { id: 'discover', label: '发现音乐', icon: 'search-2' },
  { id: 'songlist', label: '热门歌单', icon: 'album' },
  { id: 'leaderboard', label: '排行榜', icon: 'leaderboard' },
  { id: 'mylist', label: '我的歌单', icon: 'love' },
  { id: 'cache', label: '缓存管理', icon: 'download-2' },
  { id: 'setting', label: '设置', icon: 'setting' },
]

/** musicsquare 风格主界面：平板常驻侧栏 / 手机抽屉，600dp 实时响应 */
export default ({ componentId }: { componentId: string }) => {
  const colors = useSquareColors()
  const { isTablet, isCompact } = useLayoutMode()
  const [activeView, setActiveView] = useState('discover')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [nowPlaying, setNowPlaying] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState<SearchQuery>({ text: '', seq: 0 })

  useEffect(() => {
    setComponentId(COMPONENT_IDS.home, componentId)
  }, [componentId])

  const doSearch = useCallback(() => {
    const text = searchText.trim()
    if (!text) return
    setQuery({ text, seq: Date.now() })
    setActiveView('discover')
    setNowPlaying(false)
  }, [searchText])

  const handleHotWord = useCallback((word: string) => {
    setSearchText(word)
    setQuery({ text: word, seq: Date.now() })
    setActiveView('discover')
    setNowPlaying(false)
  }, [])

  const handlePlaySong = useCallback(() => {
    // 小屏点歌自动进入正在播放页（musicsquare ≤900px 行为）
    if (!isTablet) setNowPlaying(true)
  }, [isTablet])

  const handleSelect = useCallback((id: string) => {
    setActiveView(id)
    setNowPlaying(false)
  }, [])

  const renderView = () => {
    switch (activeView) {
      case 'songlist': return <SonglistView colors={colors} />
      case 'leaderboard': return <LeaderboardView colors={colors} />
      case 'mylist': return <MyListView colors={colors} isTablet={isTablet} isCompact={isCompact} onPlaySong={handlePlaySong} />
      case 'cache': return <CacheView colors={colors} />
      case 'setting': return <SettingView colors={colors} onOpenAdvanced={() => setActiveView('advanced')} />
      case 'advanced': return <AdvancedView />
      default: return (
        <DiscoverSearchView
          colors={colors}
          isTablet={isTablet}
          isCompact={isCompact}
          query={query}
          onHotWord={handleHotWord}
          onPlaySong={handlePlaySong}
          searchText={searchText}
          onChangeSearchText={setSearchText}
          onSearch={doSearch}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
      )
    }
  }

  const sideNav = (
    <SideNav
      colors={colors}
      items={NAV_ITEMS}
      activeId={activeView}
      onSelect={handleSelect}
      isTablet={isTablet}
      onClose={() => setDrawerOpen(false)}
    />
  )

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={themeState.theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.header} />
      {isTablet ? <View style={{ width: SIDEBAR_W }}>{sideNav}</View> : null}

      <View style={styles.main}>
        <View style={styles.content}>
          {nowPlaying
            ? <NowPlayingView colors={colors} isTablet={isTablet} onBack={() => setNowPlaying(false)} />
            : renderView()}
        </View>

        <MiniPlayer colors={colors} isTablet={isTablet} onOpen={() => setNowPlaying(true)} onOpenMenu={() => setDrawerOpen(true)} />
      </View>

      {!isTablet && drawerOpen
        ? (
            <>
              <TouchableOpacity style={styles.drawerMask} onPress={() => setDrawerOpen(false)} />
              <View style={[styles.drawerPanel, { width: Math.min(SIDEBAR_W, 300), backgroundColor: colors.header }]}>{sideNav}</View>
            </>
          )
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', paddingTop: StatusBar.currentHeight ?? 0 },
  main: { flex: 1 },
  content: { flex: 1, minHeight: 0 },
  drawerMask: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 10, elevation: 10 },
  drawerPanel: { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 11, elevation: 11 },
})
