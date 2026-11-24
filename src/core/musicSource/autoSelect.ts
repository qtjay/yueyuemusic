import settingState from '@/store/setting/state'
import { setApiSource } from '@/core/apiSource'
import { getUserApiList } from '@/utils/data'
import { getData, saveData } from '@/plugins/storage'
import { toast } from '@/utils/tools'

/**
 * 每个音质组都装入全部音源，各组独立维护一份有序队列（队首优先）。
 * 播放相应音质成功 → 该组队首，失败 → 该组队尾；新音源进所有组队首。
 * 冷启动/需要换源时从当前音质组首前三随机选，选定后保持粘性。
 */
const GROUPS_KEY = '@source_quality_groups'
const DEFAULT_GROUP = 'default'
const QUALITY_KEYS = ['flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k'] as const
const ALL_GROUPS: string[] = [...QUALITY_KEYS, DEFAULT_GROUP]
const TOP_N = 3
const INIT_TIMEOUT = 10_000

export type SourceFailReason = 'init' | 'url' | 'load' | 'limit'

interface GroupState {
  /** 组名 -> 全部音源 id 的有序队列 */
  groups: Record<string, string[]>
}

let groups: Record<string, string[]> = {}
/** 会话内当前选定的音源，冷启动重新选，选定后不轻易换 */
let activeSourceId: string | null = null
let loadPromise: Promise<void> | null = null

let saveTimer: ReturnType<typeof setTimeout> | null = null
const saveGroups = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveData(GROUPS_KEY, { groups } satisfies GroupState)
  }, 1_000)
}

const loadGroups = () => {
  if (loadPromise) return loadPromise
  loadPromise = getData<GroupState>(GROUPS_KEY)
    .then(saved => {
      groups = saved?.groups && typeof saved.groups == 'object' ? saved.groups : {}
      for (const key of Object.keys(groups)) {
        if (!Array.isArray(groups[key])) delete groups[key]
      }
    })
    .catch(() => { groups = {} })
  return loadPromise
}
void loadGroups()

const groupList = (key: string): string[] => groups[key] ?? (groups[key] = [])

/** 播放音质 -> 组名；未知音质归默认组 */
const groupKeyOf = (quality?: string) => {
  const q = String(quality ?? settingState.setting['player.playQuality'] ?? '128k')
  return QUALITY_KEYS.includes(q as typeof QUALITY_KEYS[number]) ? q : DEFAULT_GROUP
}

/** 新音源加入所有组队首，已删除的从所有组移除 */
const syncGroups = (ids: string[]) => {
  const alive = new Set(ids)
  let changed = false
  for (const key of ALL_GROUPS) {
    const arr = groupList(key)
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!alive.has(arr[i])) { arr.splice(i, 1); changed = true }
    }
    const missing = ids.filter(id => !arr.includes(id))
    if (missing.length) { arr.unshift(...missing); changed = true }
  }
  if (changed) saveGroups()
}

/** 只调整「该音质组」自己的队列顺序 */
const moveInGroup = (id: string, key: string, toFront: boolean) => {
  const arr = groupList(key)
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  if (toFront) arr.unshift(id)
  else arr.push(id)
  saveGroups()
}

const candidates = async(excludeId?: string): Promise<string[]> => {
  await loadGroups()
  const list = await getUserApiList()
  syncGroups(list.map(api => api.id))
  return groupList(groupKeyOf()).filter(id => id != excludeId)
}

/** 从组首前三随机选一个 */
const pickTop = (list: string[], tried: Set<string>): string | null => {
  const pool = list.slice(0, TOP_N).filter(id => !tried.has(id))
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 等待音源脚本初始化完成，超时视为失败 */
const waitApiInit = async(timeout = INIT_TIMEOUT): Promise<boolean> => {
  const promise = global.lx.apiInitPromise?.[0] as unknown as Promise<boolean> | undefined
  if (!promise) return false
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), timeout) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const isUserApiMode = (): boolean =>
  /^user_api/.test(settingState.setting['common.apiSource'])

export const getCurrentSourceId = (): string =>
  settingState.setting['common.apiSource']

/** 取链成功不改变任何队列顺序——只有音频真正播起来才算成功 */
export const markSourceSuccess = (_id: string, _ms: number) => {}

/** 音频真正开始播放：提到该音质组队首 */
export const markSourcePlaybackSuccess = (id: string, quality?: string) => {
  if (!id) return
  moveInGroup(id, groupKeyOf(quality), true)
  activeSourceId = id
}

let lastPlaybackFail = { id: '', at: 0 }
/** 播放不成功：排到该音质组队尾；同一源 5s 内只处理一次 */
export const markSourcePlaybackFailed = (id: string, quality?: string) => {
  if (!id) return
  const now = Date.now()
  if (lastPlaybackFail.id == id && now - lastPlaybackFail.at < 5_000) return
  lastPlaybackFail = { id, at: now }
  moveInGroup(id, groupKeyOf(quality), false)
  activeSourceId = null
}

/** 只有脚本 init 失败才把该源排到当前组队尾；限流/单曲取链失败不动队列 */
export const markSourceFailed = (id: string, reason: SourceFailReason = 'init') => {
  if (!id || reason != 'init') return
  moveInGroup(id, groupKeyOf(), false)
}

/**
 * 需要换源时调用：从当前音质组首前三随机选（排除刚失败的），最多试 3 个。
 * 保留旧函数名供现有调用点使用。
 */
export const switchToRandomSource = async(silent = false, excludeId?: string): Promise<string | null> => {
  const list = await candidates(excludeId)
  if (!list.length) return null
  const tried = new Set<string>()
  for (let i = 0; i < TOP_N; i++) {
    const id = pickTop(list, tried)
    if (!id) break
    tried.add(id)
    setApiSource(id)
    if (await waitApiInit()) {
      activeSourceId = id
      if (!silent) toast(`已启用音源：${id}`)
      return id
    }
    markSourceFailed(id, 'init')
  }
  return null
}

/** 语义化别名，供新代码使用 */
export const switchToBestSource = switchToRandomSource

/** 冷启动首次选源：从当前音质组首前三随机选一个；已是当前源则不重复 loadScript */
export const autoSelectAvailableSource = async(): Promise<string | null> => {
  const list = await candidates()
  const id = pickTop(list, new Set<string>())
  if (!id) return null
  activeSourceId = id
  if (id === getCurrentSourceId()) return id
  setApiSource(id)
  return id
}
