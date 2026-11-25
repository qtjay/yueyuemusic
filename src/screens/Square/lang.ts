import settingState from '@/store/setting/state'
import { useSettingValue } from '@/store/setting/hook'

/**
 * Square 自绘界面文案（简体 / 繁体 / English）。
 * Square 原先全是硬编码中文，导致「设置 → 语言」切换后主界面毫无变化。
 * 这里独立维护一份字典，语言源与旧 i18n 一致：settingState.setting['common.langId']。
 */
type Lang = 'zh_cn' | 'zh_tw' | 'en_us'
type Entry = [string, string, string] // [zh_cn, zh_tw, en_us]

const D: Record<string, Entry> = {
  // 导航 / 通用
  nav_discover: ['发现音乐', '發現音樂', 'Discover'],
  nav_playing: ['正在播放', '正在播放', 'Now Playing'],
  nav_songlist: ['热门歌单', '熱門歌單', 'Playlists'],
  nav_leaderboard: ['排行榜', '排行榜', 'Charts'],
  nav_mylist: ['我的歌单', '我的歌單', 'My Playlists'],
  nav_cache: ['缓存管理', '快取管理', 'Cache Manager'],
  nav_setting: ['设置', '設定', 'Settings'],
  music_group: ['音乐', '音樂', 'Music'],
  app_name: ['悦悦哄睡', '悅悅哄睡', 'Yueyue Sleep'],
  internal_version: ['内部版本', '內部版本', 'Build'],
  hot_words_fallback: [
    '周杰伦|林俊杰|陈奕迅|邓紫棋|毛不易|轻音乐|摇篮曲|白噪音',
    '周杰倫|林俊傑|陳奕迅|鄧紫棋|毛不易|輕音樂|搖籃曲|白噪音',
    'Jay Chou|JJ Lin|Eason Chan|G.E.M.|Mao Buyi|Light Music|Lullaby|White Noise',
  ],
  search_placeholder: ['输入歌名 / 歌手，回车搜索…', '輸入歌名 / 歌手，按 Enter 搜尋…', 'Search songs or artists…'],
  search_in_playlist: ['在歌单内搜索…', '在歌單內搜尋…', 'Search in playlist…'],
  search_in_leaderboard: ['在排行榜内搜索…', '在排行榜內搜尋…', 'Search in chart…'],
  search: ['搜索', '搜尋', 'Search'],
  back: ['返回', '返回', 'Back'],
  back_to_settings: ['‹ 返回设置', '‹ 返回設定', '‹ Back to Settings'],
  cancel: ['取消', '取消', 'Cancel'],
  confirm: ['确定', '確定', 'OK'],
  save: ['保存', '儲存', 'Save'],
  delete: ['删除', '刪除', 'Delete'],
  rename: ['改名', '重新命名', 'Rename'],
  create: ['新建', '新增', 'New'],
  cache: ['缓存', '快取', 'Cache'],
  select_all: ['全选', '全選', 'Select All'],
  deselect_all: ['取消全选', '取消全選', 'Deselect All'],
  filter_all: ['全部', '全部', 'All'],
  other: ['其他', '其他', 'Other'],
  remove: ['移除', '移除', 'Remove'],
  clear: ['清空', '清空', 'Clear'],
  clear_all: ['清空全部', '清空全部', 'Clear All'],
  resume: ['继续', '繼續', 'Resume'],
  pause: ['暂停', '暫停', 'Pause'],
  collapse: ['‹ 收起', '‹ 收起', '‹ Collapse'],
  batch_edit: ['批量编辑', '批次編輯', 'Batch Edit'],

  // 发现音乐 / 搜索
  discover: ['发现音乐', '發現音樂', 'Discover'],
  hot_loading: ['热搜加载中…', '熱搜載入中…', 'Loading trends…'],
  hot_live: ['实时热搜', '即時熱搜', 'Trending'],
  recommended: ['推荐词', '推薦詞', 'Suggested'],
  shuffle: ['换一批', '換一批', 'Shuffle'],
  search_history: ['搜索记录', '搜尋記錄', 'Recent Searches'],
  no_search_history: ['还没有搜索记录', '還沒有搜尋記錄', 'No recent searches'],
  search_results: ['搜索结果', '搜尋結果', 'Results'],
  platform: ['平台', '平台', 'Source'],
  quality: ['音质', '音質', 'Quality'],
  quality_standard: ['标准', '標準', 'Standard'],
  start_listening: ['开始聆听', '開始聆聽', 'Start Listening'],
  usage_tip: ['使用提示', '使用提示', 'Tips'],
  intro: ['点上方实时热搜词（可点「换一批」），或在搜索框输入歌名 / 歌手开始找歌。结果可播放全部、缓存全部、加入歌单；底部播放条可拖动进度、收藏到我的收藏。', '點上方即時熱搜詞（可點「換一批」），或在搜尋框輸入歌名 / 歌手開始找歌。結果可播放全部、快取全部、加入歌單；底部播放條可拖動進度、收藏到我的收藏。', 'Tap a trending word above (or Shuffle), or search by song / artist. You can play all, cache all, or add results to a playlist; use the mini player to seek and favorite.'],

  // 歌曲列表 / 歌单弹窗
  play_all: ['播放全部', '播放全部', 'Play All'],
  songs_count: ['{n} 首', '{n} 首', '{n} songs'],
  songs_duration: ['{n} 首 · {d}', '{n} 首 · {d}', '{n} songs · {d}'],
  duration_hours: ['{h} 小时 {m} 分钟', '{h} 小時 {m} 分鐘', '{h}h {m}m'],
  duration_minutes: ['{m} 分钟', '{m} 分鐘', '{m}m'],
  load_more: ['加载更多（还有 {n} 首）', '載入更多（還有 {n} 首）', 'Load more ({n} left)'],
  no_songs_found: ['没有找到歌曲', '沒有找到歌曲', 'No songs found'],
  add_to_playlist: ['加入到歌单', '加入到歌單', 'Add to Playlist'],
  add_to_list_n: ['加入歌单 ({n})', '加入歌單 ({n})', 'Add to List ({n})'],
  play_later_n: ['稍后播放 ({n})', '稍後播放 ({n})', 'Play Later ({n})'],
  delete_n: ['删除 ({n})', '刪除 ({n})', 'Delete ({n})'],
  new_playlist_and_add: ['＋ 新建歌单并加入', '＋ 新增歌單並加入', '＋ New Playlist & Add'],
  create_and_add: ['创建并加入', '建立並加入', 'Create & Add'],
  new_playlist_name: ['新歌单名称', '新歌單名稱', 'New playlist name'],
  enter_playlist_name: ['请输入歌单名称', '請輸入歌單名稱', 'Please enter a playlist name'],
  created_playlist_added: ['已新建「{name}」并加入 {n} 首', '已新增「{name}」並加入 {n} 首', 'Created "{name}" and added {n} songs'],
  added_to: ['已加入「{name}」', '已加入「{name}」', 'Added to "{name}"'],
  please_select_songs: ['请先选中歌曲', '請先選中歌曲', 'Please select songs first'],
  added_play_later_n: ['已添加 {n} 首到稍后播放', '已加入 {n} 首到稍後播放', 'Added {n} songs to Play Later'],
  added_to_playlist_acc: ['添加到歌单', '添加到歌單', 'Add to Playlist'],
  playback_history: ['播放历史', '播放歷史', 'Play History'],
  my_favorite: ['我的收藏', '我的收藏', 'My Favorites'],
  add_songs_hint: ['搜索歌曲后，用歌曲菜单的「添加到」加入当前歌单', '搜尋歌曲後，用歌曲選單的「加入到」加入目前歌單', 'Search for songs, then use "Add to" in the song menu'],

  // 播放器
  mode_list_loop: ['顺序循环', '順序循環', 'List Loop'],
  mode_random: ['随机循环', '隨機循環', 'Shuffle'],
  mode_single_loop: ['单曲循环', '單曲循環', 'Single Loop'],
  no_playing: ['暂无播放', '暫無播放', 'Nothing playing'],
  tap_to_play: ['点一下开始听歌', '點一下開始聽歌', 'Tap to start listening'],
  play_mode: ['播放模式：{name}', '播放模式：{name}', 'Play mode: {name}'],
  cancel_collect: ['取消收藏', '取消收藏', 'Remove Favorite'],
  collect: ['收藏到我的收藏', '收藏到我的收藏', 'Add to Favorites'],
  no_lyrics: ['暂无歌词，换一首支持歌词的歌曲试试。', '暫無歌詞，換一首支援歌詞的歌曲試試。', 'No lyrics. Try a song with lyrics.'],

  // 我的歌单
  my_playlists: ['我的歌单', '我的歌單', 'My Playlists'],
  lists_count: ['{n} 个', '{n} 個', '{n} lists'],
  empty_playlist: ['这个歌单还没有歌曲，点「＋添加」去搜索添加', '這個歌單還沒有歌曲，點「＋加入」去搜尋加入', 'This playlist is empty. Use "+ Add" to search for songs.'],
  new_playlist: ['新建歌单', '新增歌單', 'New Playlist'],
  rename_playlist: ['改名', '重新命名', 'Rename'],
  input_name: ['输入名称', '輸入名稱', 'Enter name'],
  builtin_cannot_delete: ['内置歌单不能删除', '內建歌單不能刪除', 'Built-in playlists cannot be deleted'],
  builtin_cannot_rename: ['内置歌单不能改名', '內建歌單不能重新命名', 'Built-in playlists cannot be renamed'],
  builtin_cannot_reorder: ['内置歌单不能调整顺序', '內建歌單不能調整順序', 'Built-in playlists cannot be reordered'],
  select_one_to_rename: ['请选中一项再改名', '請選中一項再重新命名', 'Select one item to rename'],
  select_items_to_delete: ['请先选中要删除的项', '請先選中要刪除的項目', 'Select items to delete first'],
  select_playlists_first: ['请先选中歌单', '請先選中歌單', 'Select playlists first'],
  confirm_delete_n: ['确定删除选中的 {n} 项？', '確定刪除選中的 {n} 項？', 'Delete {n} selected items?'],
  confirm_remove_n: ['从歌单移除选中的 {n} 首？', '從歌單移除選中的 {n} 首？', 'Remove {n} songs from this playlist?'],
  queue_empty: ['正在播放列表是空的，去点一首歌吧', '正在播放清單是空的，去點一首歌吧', 'The queue is empty. Pick a song!'],
  now_playing: ['正在播放', '正在播放', 'Now Playing'],
  confirm_remove_queue_n: ['从播放队列移除选中的 {n} 首？', '從播放佇列移除選中的 {n} 首？', 'Remove {n} songs from the queue?'],

  // 缓存管理
  cache_manager: ['缓存管理', '快取管理', 'Cache Manager'],
  auto_cache: ['播放自动缓存', '播放自動快取', 'Auto-cache on play'],
  capacity_limit: ['容量上限', '容量上限', 'Storage Limit'],
  custom_mb: ['自定义（MB）', '自訂（MB）', 'Custom (MB)'],
  cache_tip: ['超过上限自动淘汰最旧的缓存', '超過上限自動淘汰最舊的快取', 'Oldest cache is removed when the limit is exceeded'],
  cache_limit_title: ['缓存容量上限', '快取容量上限', 'Cache Storage Limit'],
  other_manual_mb: ['其他（手填 MB）', '其他（手填 MB）', 'Other (manual MB)'],
  other_custom: ['其他（手填）', '其他（手填）', 'Other (manual)'],
  caching: ['正在缓存', '正在快取', 'Caching'],
  cache_pending: ['等待中', '等待中', 'Pending'],
  cache_running: ['缓存中', '快取中', 'Caching'],
  cache_done: ['已完成', '已完成', 'Done'],
  cache_skipped: ['已缓存', '已快取', 'Already cached'],
  cache_failed: ['失败', '失敗', 'Failed'],
  cache_paused: [' · 已暂停', ' · 已暫停', ' · Paused'],
  clear_completed: ['清除已完成', '清除已完成', 'Clear Completed'],
  no_cache_tasks: ['暂无缓存任务', '暫無快取任務', 'No cache tasks'],
  by_playlist: ['按歌单管理', '按歌單管理', 'By Playlist'],
  clear_all_confirm: ['清空全部缓存歌曲？', '清空全部快取歌曲？', 'Clear all cached songs?'],
  no_cache_songs: ['暂无缓存歌曲', '暫無快取歌曲', 'No cached songs'],
  invalid_mb: ['请输入 16 ~ 102400 之间的 MB 数', '請輸入 16 ~ 102400 之間的 MB 數', 'Enter a value between 16 and 102400 MB'],
  cache_limit_set: ['缓存上限已设为 {size}', '快取上限已設為 {size}', 'Cache limit set to {size}'],
  cache_queued_n: ['已加入缓存队列 {n} 首', '已加入快取佇列 {n} 首', 'Queued {n} songs for caching'],
  cache_queued_hint: ['已加入缓存队列 {n} 首，可在缓存管理页查看', '已加入快取佇列 {n} 首，可在快取管理頁查看', 'Queued {n} songs. Check Cache Manager.'],
  no_cacheable: ['没有可缓存的歌曲', '沒有可快取的歌曲', 'No songs to cache'],

  // 设置
  custom_source: ['自定义音源', '自訂音源', 'Music API'],
  import_manage: ['导入 / 管理', '匯入 / 管理', 'Import / Manage'],
  source_hint: ['音源由应用自动选择，播放失败时自动切换，无需手动干预', '音源由應用程式自動選擇，播放失敗時自動切換，無需手動干預', 'Sources are selected automatically and switched on failure. No manual action needed.'],
  appearance: ['外观', '外觀', 'Appearance'],
  light: ['浅色', '淺色', 'Light'],
  dark: ['深色', '深色', 'Dark'],
  more: ['更多', '更多', 'More'],
  advanced_settings: ['高级设置（完整选项）', '進階設定（完整選項）', 'Advanced Settings'],

  // 排行榜 / 歌单详情
  leaderboard: ['排行榜', '排行榜', 'Charts'],
  playlist: ['歌单', '歌單', 'Playlist'],
  load_failed: ['加载失败，请稍后重试', '載入失敗，請稍後重試', 'Failed to load. Please try again.'],
}

const normalize = (id: unknown): Lang => {
  if (id == 'zh_tw') return 'zh_tw'
  if (id == 'en_us') return 'en_us'
  return 'zh_cn'
}

const indexOf = (lang: Lang) => lang == 'zh_tw' ? 1 : lang == 'en_us' ? 2 : 0

/** 同步取文案：模块级常量、回调、toast 等非组件位置也能用 */
export const sq = (key: string, vars?: Record<string, string | number>): string => {
  let text = D[key]?.[indexOf(normalize(settingState.setting['common.langId']))] ?? D[key]?.[0] ?? key
  if (vars) {
    // 不用 replaceAll：旧版 JSC / Hermes 未必实现，split+join 全平台通用
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v))
  }
  return text
}

/** 组件内订阅语言变化：调用它会随 langId 更新而重渲染 */
export const useSquareLang = (): typeof sq => {
  useSettingValue('common.langId')
  return sq
}
