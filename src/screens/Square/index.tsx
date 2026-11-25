import { useCallback, useEffect, useRef, useState } from 'react'
import { StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { MiniPlayer, SearchBox, SideNav, type NavItem } from './components'
import { SIDEBAR_W, SPACE, useColorMode, useLayoutMode, useSquareColors } from './tokens'
import { trackPageEnd, trackPageStart } from '@/utils/umeng'
import { DiscoverSearchView, type SearchQuery } from './views/MainViews'
import { LeaderboardView, OnlineDetailView, SonglistView } from './views/OnlineViews'
import { setSquareDetailHandler, type SquareDetailPayload } from '@/core/squareBridge'
import { addSquareHistoryWord } from '@/core/search/search'
import { AdvancedView, CacheView, MyListView, NowPlayingView, PlayingQueueView, SettingView } from './views/LibraryViews'
import { sq } from './lang'
import { useSettingValue } from '@/store/setting/hook'

// Square 全站是固定 dp 布局；系统「字体大小/显示大小」放大（部分设备 font_scale=1.5）
// 会把固定高度的搜索框、按钮文字撑到变形，这里统一关闭 RN 文本的系统字体缩放
for (const comp of [Text, TextInput] as any[]) {
  comp.defaultProps = { ...(comp.defaultProps ?? {}), allowFontScaling: false }
}

/** 导航文案随语言实时生成，不能写成模块级常量 */
const getNavItems = (): NavItem[] => [
  { id: 'discover', label: sq('nav_discover'), icon: 'search-2' },
  { id: 'playing', label: sq('nav_playing'), icon: 'play' },
  { id: 'songlist', label: sq('nav_songlist'), icon: 'album' },
  { id: 'leaderboard', label: sq('nav_leaderboard'), icon: 'leaderboard' },
  { id: 'mylist', label: sq('nav_mylist'), icon: 'love' },
  { id: 'cache', label: sq('nav_cache'), icon: 'download-2' },
  { id: 'setting', label: sq('nav_setting'), icon: 'setting' },
]

/** musicsquare 风格主界面：平板常驻侧栏 / 手机抽屉，600dp 实时响应 */
export default ({ componentId }: { componentId: string }) => {
  const colors = useSquareColors()
  const isDarkMode = useColorMode()
  // 订阅语言变化：langId 改变时重渲染，下面 key 会强制重建视图树刷新所有文案
  const langId = useSettingValue('common.langId')
  const { isTablet, isCompact } = useLayoutMode()
  const [activeView, setActiveView] = useState('discover')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [nowPlaying, setNowPlaying] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState<SearchQuery>({ text: '', seq: 0 })
  const [browseDetail, setBrowseDetail] = useState<SquareDetailPayload | null>(null)
  const [filterText, setFilterText] = useState('')
  const [prevView, setPrevView] = useState('discover')
  const [myListLevel, setMyListLevel] = useState<'lists' | 'songs'>('lists')
  const myListBackRef = useRef<(() => void) | null>(null)
  const registerMyListBack = useCallback((fn: (() => void) | null) => { myListBackRef.current = fn }, [])
  const currentPageRef = useRef(activeView)
  // 仅「具体歌单的歌曲列表」保留左上角 ‹；歌单/榜单歌曲列表改用 ☰ + 标题右侧「返回」
  const showHeaderBack = activeView == 'mylist' && myListLevel == 'songs'

  // 友盟页面统计：RN 单 Activity，按 Square 视图手动埋点
  useEffect(() => {
    trackPageStart(`square_${currentPageRef.current}`)
    return () => { trackPageEnd(`square_${currentPageRef.current}`) }
  }, [])
  useEffect(() => {
    const prev = currentPageRef.current
    if (prev == activeView) return
    trackPageEnd(`square_${prev}`)
    trackPageStart(`square_${activeView}`)
    currentPageRef.current = activeView
  }, [activeView])

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

  const doSearch = useCallback(async() => {
    const text = searchText.trim()
    if (!text) return
    await addSquareHistoryWord(text)
    setQuery({ text, seq: Date.now() })
    setActiveView('discover')
    setNowPlaying(false)
  }, [searchText])

  const handleHotWord = useCallback(async(word: string) => {
    await addSquareHistoryWord(word)
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
    setMyListLevel('lists')
  }, [activeView])

  const scoped = !!browseDetail
  const detailProps = {
    colors,
    isTablet,
    isCompact,
    payload: browseDetail!,
    filterText,
    onPlaySong: handlePlaySong,
    onBack: () => { setBrowseDetail(null); setFilterText('') },
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
          onLevelChange={setMyListLevel}
          registerBack={registerMyListBack}
        />
      )
      case 'playing': return <PlayingQueueView colors={colors} />
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
      items={getNavItems()}
      activeId={activeView}
      onSelect={handleSelect}
      isTablet={isTablet}
    />
  )

  return (
    <View key={String(langId)} style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.header} />
      {isTablet ? <View style={{ width: SIDEBAR_W }}>{sideNav}</View> : null}

      <View style={styles.main}>
        {activeView != 'setting' && activeView != 'advanced' && !nowPlaying
          ? (
              <View style={[styles.header, { backgroundColor: colors.header, borderBottomColor: colors.line }]}>
                {(!isTablet || showHeaderBack)
                  ? <TouchableOpacity onPress={() => {
                      if (activeView == 'mylist' && myListLevel == 'songs') {
                        myListBackRef.current?.()
                        setMyListLevel('lists')
                      } else setDrawerOpen(true)
                    }} style={styles.headerMenu}>
                      <Text style={[styles.headerMenuText, { color: colors.text }]}>{showHeaderBack ? '‹' : '☰'}</Text>
                    </TouchableOpacity>
                  : null}
                <SearchBox
                  colors={colors}
                  value={scoped ? filterText : searchText}
                  onChangeText={scoped ? setFilterText : setSearchText}
                  onSubmit={scoped ? () => {} : doSearch}
                  placeholder={browseDetail
                    ? (browseDetail.mode == 'songlist' ? sq('search_in_playlist') : sq('search_in_leaderboard'))
                    : sq('search_placeholder')}
                />
              </View>
            )
          : null}

        <View style={styles.content}>
          {nowPlaying
            ? <NowPlayingView colors={colors} onBack={() => setNowPlaying(false)} />
            : renderView()}
        </View>

        <MiniPlayer colors={colors} isTablet={isTablet} onOpen={() => setNowPlaying(v => !v)} />
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
