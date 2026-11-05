import { useCallback, useEffect, useState } from 'react'
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import themeState from '@/store/theme/state'
import { MiniPlayer, SearchBox, SideNav, type NavItem } from './components'
import { SIDEBAR_W, SPACE, useLayoutMode, useSquareColors } from './tokens'
import { DiscoverSearchView, type SearchQuery } from './views/MainViews'
import { LeaderboardView, OnlineDetailView, SonglistView } from './views/OnlineViews'
import { setSquareDetailHandler, type SquareDetailPayload } from '@/core/squareBridge'
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
  const [browseDetail, setBrowseDetail] = useState<SquareDetailPayload | null>(null)
  const [filterText, setFilterText] = useState('')
  const [prevView, setPrevView] = useState('discover')

  useEffect(() => {
    setComponentId(COMPONENT_IDS.home, componentId)
  }, [componentId])

  // 内嵌旧页面点击歌单/榜单时，交给 Square 自绘详情
  useEffect(() => {
    setSquareDetailHandler(payload => {
      setBrowseDetail(payload)
      setFilterText('')
      setNowPlaying(false)
    })
    return () => setSquareDetailHandler(null)
  }, [])

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
    // 设置页无顶栏，记录来源供内嵌返回按钮使用
    if (id == 'setting' || id == 'advanced') setPrevView(activeView)
    setActiveView(id)
    setNowPlaying(false)
    setDrawerOpen(false)
    setBrowseDetail(null)
    setFilterText('')
  }, [activeView])

  const scoped = !!browseDetail
  const detailProps = {
    colors,
    isTablet,
    isCompact,
    payload: browseDetail!,
    filterText,
    onPlaySong: handlePlaySong,
  }

  const renderView = () => {
    switch (activeView) {
      case 'songlist': return browseDetail ? <OnlineDetailView {...detailProps} /> : <SonglistView colors={colors} />
      case 'leaderboard': return browseDetail ? <OnlineDetailView {...detailProps} /> : <LeaderboardView colors={colors} />
      case 'mylist': return (
        <MyListView
          colors={colors}
          isTablet={isTablet}
          isCompact={isCompact}
          onPlaySong={handlePlaySong}
          onGoDiscover={() => { setActiveView('discover'); setNowPlaying(false) }}
        />
      )
      case 'cache': return <CacheView colors={colors} />
      case 'setting': return (
        <SettingView
          colors={colors}
          onOpenAdvanced={() => { setPrevView('setting'); setActiveView('advanced') }}
          onBack={() => setActiveView(prevView == 'setting' || prevView == 'advanced' ? 'discover' : prevView)}
        />
      )
      case 'advanced': return <AdvancedView colors={colors} onBack={() => setActiveView('setting')} />
      default: return (
        <DiscoverSearchView
          colors={colors}
          isTablet={isTablet}
          isCompact={isCompact}
          query={query}
          onHotWord={handleHotWord}
          onPlaySong={handlePlaySong}
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
    />
  )

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={themeState.theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.header} />
      {isTablet ? <View style={{ width: SIDEBAR_W }}>{sideNav}</View> : null}

      <View style={styles.main}>
        {activeView != 'setting' && activeView != 'advanced' && !nowPlaying
          ? (
              <View style={[styles.header, { backgroundColor: colors.header, borderBottomColor: colors.line }]}>
                {(!isTablet || browseDetail)
                  ? <TouchableOpacity onPress={() => {
                      if (browseDetail) {
                        setBrowseDetail(null)
                        setFilterText('')
                      } else setDrawerOpen(true)
                    }} style={styles.headerMenu}>
                      <Text style={[styles.headerMenuText, { color: colors.text }]}>{browseDetail ? '‹' : '☰'}</Text>
                    </TouchableOpacity>
                  : null}
                <SearchBox
                  colors={colors}
                  value={scoped ? filterText : searchText}
                  onChangeText={scoped ? setFilterText : setSearchText}
                  onSubmit={scoped ? () => {} : doSearch}
                  placeholder={browseDetail
                    ? (browseDetail.mode == 'songlist' ? '在歌单内搜索…' : '在排行榜内搜索…')
                    : '输入歌名 / 歌手，回车搜索…'}
                />
              </View>
            )
          : null}

        <View style={styles.content}>
          {nowPlaying
            ? <NowPlayingView colors={colors} onBack={() => setNowPlaying(false)} />
            : renderView()}
        </View>

        <MiniPlayer colors={colors} isTablet={isTablet} onOpen={() => setNowPlaying(true)} />
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
  header: { flexDirection: 'row', alignItems: 'center', width: '100%', height: 56, minHeight: 56, flexShrink: 0, paddingHorizontal: SPACE.lg, borderBottomWidth: 1 },
  headerMenu: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.sm, flexShrink: 0 },
  headerMenuText: { fontSize: 22 },
  content: { flex: 1, minHeight: 0 },
  drawerMask: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 10, elevation: 10 },
  drawerPanel: { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 11, elevation: 11, paddingTop: StatusBar.currentHeight ?? 0 },
})
