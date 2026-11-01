import { useCallback, useEffect, useState } from 'react'
import { FlatList, Switch, Text, TouchableOpacity, View } from 'react-native'
import PageContent from '@/components/PageContent'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { addTempPlayList } from '@/core/player/tempPlayList'
import {
  clearCache,
  getCacheList,
  getCacheStats,
  pruneInvalidCache,
  removeCache,
  type MusicCacheItem,
} from '@/core/musicCache'

const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

const formatTime = (time: number) => {
  const date = new Date(time)
  const pad = (num: number) => num.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 用缓存记录还原出可播放的歌曲信息 */
const buildMusicInfo = (item: MusicCacheItem): LX.Music.MusicInfoOnline => ({
  id: item.musicId,
  name: item.name,
  singer: item.singer,
  source: item.source,
  interval: null,
  meta: {
    albumName: '',
    picUrl: '',
    qualitys: [{ type: item.quality, size: '' }],
    _qualitys: {},
  },
} as unknown as LX.Music.MusicInfoOnline)

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const autoCache = useSettingValue('player.autoCache')
  const [list, setList] = useState<MusicCacheItem[]>([])
  const [totalSize, setTotalSize] = useState(0)

  const loadData = useCallback(async() => {
    await pruneInvalidCache()
    const [items, stats] = await Promise.all([getCacheList(), getCacheStats()])
    setList(items)
    setTotalSize(stats.totalSize)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handlePlay = useCallback((item: MusicCacheItem) => {
    addTempPlayList([{ listId: null, musicInfo: buildMusicInfo(item) }])
  }, [])

  const handleRemove = useCallback((item: MusicCacheItem) => {
    void removeCache([item.key]).then(() => {
      toast(t('cache_deleted'))
      void loadData()
    })
  }, [loadData, t])

  const handleClear = useCallback(() => {
    void confirmDialog({ message: t('cache_clear_confirm') }).then(confirmed => {
      if (!confirmed) return
      toast(t('cache_deleting'))
      return clearCache().then(() => {
        void loadData()
      })
    })
  }, [loadData, t])

  const handleToggleAutoCache = useCallback((value: boolean) => {
    updateSetting({ 'player.autoCache': value })
  }, [])

  const renderItem = useCallback(({ item }: { item: MusicCacheItem }) => (
    <View style={[styles.item, { borderBottomColor: theme['c-list-header-border-bottom'] }]}>
      <TouchableOpacity style={styles.itemMain} onPress={() => handlePlay(item)}>
        <Text style={[styles.name, { color: theme['c-font'] }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.sub, { color: theme['c-font-label'] }]} numberOfLines={1}>
          {item.singer || '—'} · {item.quality} · {formatSize(item.size)}
        </Text>
        <Text style={[styles.time, { color: theme['c-font-label'] }]}>{formatTime(item.createdAt)}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item)}>
        <Text style={{ color: theme['c-primary-font'], fontSize: 14 }}>{t('delete')}</Text>
      </TouchableOpacity>
    </View>
  ), [handlePlay, handleRemove, t, theme])

  return (
    <PageContent>
      <View style={styles.container}>
        <View style={[styles.header, { borderBottomColor: theme['c-list-header-border-bottom'] }]}>
          <Text style={[styles.stats, { color: theme['c-font'] }]}>
            {t('cache_stats', { count: String(list.length), size: formatSize(totalSize) })}
          </Text>
          <TouchableOpacity onPress={handleClear} disabled={!list.length}>
            <Text style={[styles.clearText, { color: list.length ? theme['c-primary-font'] : theme['c-font-label'] }]}>
              {t('cache_clear')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: theme['c-font'] }]}>{t('cache_auto_cache')}</Text>
          <Switch value={autoCache} onValueChange={handleToggleAutoCache} />
        </View>

        {list.length
          ? (
              <FlatList
                data={list}
                keyExtractor={item => item.key}
                renderItem={renderItem}
                style={styles.list}
              />
            )
          : (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: theme['c-font-label'] }]}>{t('cache_empty')}</Text>
              </View>
            )}
      </View>
    </PageContent>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stats: {
    fontSize: 15,
    flexShrink: 1,
  },
  clearText: {
    fontSize: 14,
    paddingLeft: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  switchLabel: {
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemMain: {
    flex: 1,
  },
  name: {
    fontSize: 15,
  },
  sub: {
    fontSize: 12,
    marginTop: 3,
  },
  time: {
    fontSize: 11,
    marginTop: 3,
  },
  removeBtn: {
    paddingLeft: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
})
