import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native'
import { setApiSource } from '@/core/apiSource'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import settingState from '@/store/setting/state'
import themeState from '@/store/theme/state'
import { getUserApiList } from '@/utils/data'
import { Chip, MiniPlayer, SideNav, type NavItem } from './components'
import { SIDEBAR_W, SPACE, useLayoutMode, useSquareColors } from './tokens'
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
  const [apis, setApis] = useState<LX.UserApi.UserApiInfo[]>([])

  useEffect(() => {
    setComponentId(COMPONENT_IDS.home, componentId)
    void getUserApiList().then(setApis)
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

  const sourceChips = apis.length
    ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ paddingHorizontal: SPACE.lg, alignItems: 'center' }}>
          {apis.slice(0, 8).map(api => (
            <Chip
              key={api.id}
              colors={colors}
              label={api.name}
              active={settingState.setting['common.apiSource'] == api.id}
              onPress={() => setApiSource(api.id)}
            />
          ))}
        </ScrollView>
      )
    : null

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={themeState.theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.header} />
      {isTablet ? <View style={{ width: SIDEBAR_W }}>{sideNav}</View> : null}

      <View style={styles.main}>
        {!isTablet ? sourceChips : null}

        <View style={styles.content}>
          {nowPlaying
            ? <NowPlayingView colors={colors} isTablet={isTablet} onBack={() => setNowPlaying(false)} />
            : renderView()}
        </View>

        <MiniPlayer colors={colors} isTablet={isTablet} onOpen={() => setNowPlaying(true)} />
      </View>

      {!isTablet && drawerOpen
        ? (
            <View style={styles.drawerOverlay}>
              <TouchableOpacity style={styles.drawerMask} onPress={() => setDrawerOpen(false)} />
              <View style={[styles.drawerPanel, { width: Math.min(SIDEBAR_W, 300) }]}>{sideNav}</View>
            </View>
          )
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  main: { flex: 1 },
  chipsRow: { height: 48, flexGrow: 0, flexShrink: 0, paddingVertical: SPACE.sm, borderBottomWidth: 0 },
  content: { flex: 1, minHeight: 0 },
  drawerOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', zIndex: 10 },
  drawerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  drawerPanel: { backgroundColor: 'transparent' },
})
