import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native'
import PageContent from '@/components/PageContent'
import { useTheme } from '@/store/theme/hook'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { getUserLists } from '@/utils/data'
import {
  UNGROUPED_ID,
  clearCache,
  getCacheGroups,
  getCacheList,
  getCacheMaxSize,
  getCacheStats,
  pruneInvalidCache,
  removeCache,
  removeCacheByGroup,
  setCacheMaxSize,
  type CacheGroup,
  type MusicCacheItem,
} from '@/core/musicCache'

const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

const BUILTIN_LIST_NAMES: Record<string, string> = {
  default: '默认列表',
  love: '我的收藏',
}

export default () => {
  const theme = useTheme()
  const autoCache = useSettingValue('cache.auto')
  const [groups, setGroups] = useState<CacheGroup[]>([])
  const [stats, setStats] = useState({ count: 0, totalSize: 0 })
  const [maxSize, setMaxSize] = useState('1024')
  const [maxSizeDraft, setMaxSizeDraft] = useState('1024')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [items, setItems] = useState<MusicCacheItem[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>(BUILTIN_LIST_NAMES)

  const loadData = useCallback(async() => {
    await pruneInvalidCache()
    const [g, s, m, lists] = await Promise.all([
      getCacheGroups(),
      getCacheStats(),
      getCacheMaxSize(),
      getUserLists(),
    ])
    const names: Record<string, string> = { ...BUILTIN_LIST_NAMES }
    for (const list of lists) names[list.id] = list.name
    setNameMap(names)
    setGroups(g)
    setStats(s)
    setMaxSize(String(m))
    setMaxSizeDraft(String(m))
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const groupName = useCallback((id: string) =>
    id == UNGROUPED_ID ? '其他' : (nameMap[id] ?? id), [nameMap])

  const handleToggleGroup = useCallback(async(id: string) => {
    if (expandedId == id) {
      setExpandedId(null)
      setItems([])
      return
    }
    const list = await getCacheList()
    setItems(list.filter(item => (item.listId ?? UNGROUPED_ID) == id))
    setExpandedId(id)
  }, [expandedId])

  const handleSaveMaxSize = useCallback(() => {
    const mb = parseInt(maxSizeDraft)
    if (Number.isNaN(mb) || mb < 16 || mb > 10240) {
      toast('请输入 16 ~ 10240 之间的 MB 数')
      setMaxSizeDraft(maxSize)
      return
    }
    void setCacheMaxSize(mb).then(() => {
      setMaxSize(String(mb))
      toast(`缓存上限已设为 ${mb} MB`)
      void loadData()
    })
  }, [loadData, maxSize, maxSizeDraft])

  const handleRemoveGroup = useCallback((group: CacheGroup) => {
    void confirmDialog({ message: `清空「${groupName(group.id)}」的 ${group.count} 首缓存歌曲？` }).then(ok => {
      if (!ok) return
      void removeCacheByGroup(group.id).then(() => { void loadData() })
    })
  }, [groupName, loadData])

  const handleRemoveItem = useCallback((item: MusicCacheItem) => {
    void removeCache([item.key]).then(() => { void loadData() })
  }, [loadData])

  const handleClearAll = useCallback(() => {
    void confirmDialog({ message: '清空全部缓存歌曲？该操作不可恢复。' }).then(ok => {
      if (!ok) return
      void clearCache().then(() => { void loadData() })
    })
  }, [loadData])

  const progress = useMemo(() =>
    stats.totalSize / (parseInt(maxSize) * 1024 * 1024 || 1), [maxSize, stats.totalSize])

  const renderGroup = useCallback(({ item }: { item: CacheGroup }) => (
    <View>
      <TouchableOpacity style={[styles.groupRow, { borderBottomColor: theme['c-list-header-border-bottom'] }]} onPress={() => { void handleToggleGroup(item.id) }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.groupName, { color: theme['c-font'] }]}>{groupName(item.id)}</Text>
          <Text style={[styles.groupSub, { color: theme['c-font-label'] }]}>
            {item.count} 首 · {formatSize(item.size)} {expandedId == item.id ? '（点击收起）' : '（点击查看）'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleRemoveGroup(item)} style={styles.actionBtn}>
          <Text style={[styles.actionText, { color: theme['c-primary-font'] }]}>清空</Text>
        </TouchableOpacity>
      </TouchableOpacity>
      {expandedId == item.id
        ? items.map(song => (
            <View key={song.key} style={styles.songRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.songName, { color: theme['c-font'] }]} numberOfLines={1}>{song.name}</Text>
                <Text style={[styles.groupSub, { color: theme['c-font-label'] }]} numberOfLines={1}>
                  {song.singer} · {song.quality} · {formatSize(song.size)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveItem(song)} style={styles.actionBtn}>
                <Text style={[styles.actionText, { color: theme['c-primary-font'] }]}>删除</Text>
              </TouchableOpacity>
            </View>
          ))
        : null}
    </View>
  ), [expandedId, groupName, handleRemoveGroup, handleRemoveItem, handleToggleGroup, items, theme])

  return (
    <PageContent>
      <View style={styles.container}>
        <View style={[styles.card, { backgroundColor: theme['c-content-background'] }]}>
          <Text style={[styles.cardTitle, { color: theme['c-font'] }]}>
            已缓存 {stats.count} 首 · {formatSize(stats.totalSize)}
          </Text>
          <View style={[styles.progressBg, { backgroundColor: theme['c-border-background'] }]}>
            <View style={[styles.progressBar, { width: `${Math.min(100, progress * 100)}%` }]} />
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme['c-font'] }]}>容量上限（MB）</Text>
            <TextInput
              style={[styles.input, { color: theme['c-font'], borderColor: theme['c-border-background'] }]}
              value={maxSizeDraft}
              onChangeText={setMaxSizeDraft}
              onBlur={handleSaveMaxSize}
              keyboardType="numeric"
              maxLength={5}
            />
            <TouchableOpacity onPress={handleSaveMaxSize} style={styles.actionBtn}>
              <Text style={[styles.actionText, { color: theme['c-primary-font'] }]}>保存</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme['c-font'] }]}>播放自动缓存</Text>
            <Switch value={autoCache} onValueChange={(v) => updateSetting({ 'cache.auto': v })} />
          </View>
          <Text style={[styles.tip, { color: theme['c-font-label'] }]}>
            超过上限会自动淘汰最旧的缓存；按歌单分类可单独清空
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.cardTitle, { color: theme['c-font'] }]}>按歌单管理</Text>
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={[styles.actionText, { color: theme['c-primary-font'] }]}>清空全部</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={groups}
          keyExtractor={item => item.id}
          renderItem={renderGroup}
          ListEmptyComponent={<Text style={[styles.tip, { color: theme['c-font-label'], textAlign: 'center', marginTop: 24 }]}>暂无缓存歌曲</Text>}
          style={styles.list}
        />
      </View>
    </PageContent>
  )
}

const styles = createStyle({
  container: { flex: 1, paddingHorizontal: 12 },
  card: { borderRadius: 14, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 15, fontWeight: '500' },
  progressBg: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: '#31c27c' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  label: { fontSize: 14, flex: 1 },
  input: { borderWidth: 1, borderRadius: 8, width: 90, paddingHorizontal: 8, paddingVertical: 4, fontSize: 14, marginRight: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  actionText: { fontSize: 14 },
  tip: { fontSize: 12, marginTop: 10, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 6 },
  list: { flex: 1 },
  groupRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  groupName: { fontSize: 15 },
  groupSub: { fontSize: 12, marginTop: 3 },
  songRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingVertical: 8 },
  songName: { fontSize: 14 },
})
