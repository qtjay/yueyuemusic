import settingState from '@/store/setting/state'
import { setApiSource } from '@/core/apiSource'
import { getUserApiList } from '@/utils/data'
import { getData, saveData } from '@/plugins/storage'
import { toast } from '@/utils/tools'

/**
 * 音源按音质分组，每组是一个有序队列（队首优先）。
 * 播放成功 → 提队首；播放失败 → 列队尾；冷启动/需要换源时从组首前三随机选。
 * 选定后保持粘性，只有播放源出问题才换。
 */
const GROUPS_KEY = '@source_quality_groups'
const DEFAULT_GROUP = 'default'
const QUALITY_KEYS = ['flac24bit', 'flac', 'wav', 'ape', '320k', '192k', '128k'] as const
const QUALITY_RANK: Record<string, number> = { flac24bit: 5, flac: 4, wav: 4, ape: 4, '320k': 2, '192k': 1, '128k': 0 }
/** 前三候选数量 */
const TOP_N = 3
const INIT_TIMEOUT = 10_000

export type SourceFailReason = 'init' | 'url' | 'load' | 'limit'

interface GroupState {
  /** 组名 -> 音源 id 有序队列 */
  groups: Record<string, string[]>
  /** 音源 id -> 所属组 */
  groupOf: Record<string, string>
}

let groups: Record<string, string[]> = {}
let groupOf: Record<string, string> = {}
/** 会话内当前选定的音源，冷启动重新选，选定后不轻易换 */
let activeSourceId: string | null = null
let loadPromise: Promise<void> | null = null

let saveTimer: ReturnType<typeof setTimeout> | null = null
const saveGroups = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveData(GROUPS_KEY, { groups, groupOf } satisfies GroupState)
  }, 1_000)
}

const loadGroups = () => {
  if (loadPromise) return loadPromise
  loadPromise = getData<GroupState>(GROUPS_KEY)
    .then(saved => {
      groups = saved?.groups && typeof saved.groups == 'object' ? saved.groups : {}
      groupOf = saved?.groupOf && typeof saved.groupOf == 'object' ? saved.groupOf : {}
      for (const key of Object.keys(groups)) {
        if (!Array.isArray(groups[key])) delete groups[key]
      }
    })
    .catch(() => { groups = {}; groupOf = {} })
  return loadPromise
}
void loadGroups()

const groupList = (key: string): string[] => groups[key] ?? (groups[key] = [])

/** 把音源从所有组里摘出 */
const removeFromGroups = (id: string) => {
  for (const key of Object.keys(groups)) {
    const arr = groups[key]
    const i = arr.indexOf(id)
    if (i >= 0) arr.splice(i, 1)
  }
}

/** 播放成功提队首 / 播放失败列队尾 */
const moveInGroup = (id: string, toFront: boolean) => {
  const key = groupOf[id] ?? DEFAULT_GROUP
  const arr = groupList(key)
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  if (toFront) arr.unshift(id)
  else arr.push(id)
  groupOf[id] = key
  saveGroups()
}

/** 同步音源列表：新音源进默认组队尾，已删除的清掉 */
const syncGroups = (ids: string[]) => {
  const alive = new Set(ids)
  for (const id of ids) {
    const key = groupOf[id]
    if (key && groups[key]?.includes(id)) continue
    removeFromGroups(id)
    groupOf[id] = DEFAULT_GROUP
    groupList(DEFAULT_GROUP).push(id)
  }
  for (const id of Object.keys({ ...groupOf })) {
    if (alive.has(id)) continue
    removeFromGroups(id)
    delete groupOf[id]
  }
  saveGroups()
}

/** 没有音质信息时归到默认组；有信息时按最高音质归组 */
const regroupSource = (id: string, qualitys: Record<string, string[] | undefined>) => {
  const declared = new Set<string>()
  for (const list of Object.values(qualitys)) {
    if (!Array.isArray(list)) continue
    for (const q of list) declared.add(String(q))
  }
  let key = DEFAULT_GROUP
  let best = -1
  for (const q of declared) {
    const rank = QUALITY_RANK[q]
    if (rank != null && rank > best) { best = rank; key = q }
  }
  if (groupOf[id] == key && groups[key]?.includes(id)) return
  removeFromGroups(id)
  groupOf[id] = key
  groupList(key).push(id)
  saveGroups()
}

/** 当前播放音质对应的组 */
const currentGroupKey = () => {
  const quality = String(settingState.setting['player.playQuality'] ?? '128k')
  return QUALITY_KEYS.includes(quality as typeof QUALITY_KEYS[number]) ? quality : DEFAULT_GROUP
}

/** 相应音质组优先，默认组作为兜底并入（首次没有音质信息时全在默认组） */
const candidates = async(excludeId?: string): Promise<string[]> => {
  await loadGroups()
  const list = await getUserApiList()
  syncGroups(list.map(api => api.id))
  const key = currentGroupKey()
  const merged: string[] = []
  const seen = new Set<string>()
  for (const k of key == DEFAULT_GROUP ? [DEFAULT_GROUP] : [key, DEFAULT_GROUP]) {
    for (const id of groups[k] ?? []) {
      if (id == excludeId || seen.has(id)) continue
      seen.add(id)
      merged.push(id)
    }
  }
  return merged
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

/** 取链成功不改变队列顺序——只有音频真正播起来才算这个源好 */
export const markSourceSuccess = (_id: string, _ms: number) => {}

/** 音频真正开始播放：提到队首 */
export const markSourcePlaybackSuccess = (id: string, _quality?: string) => {
  if (!id) return
  moveInGroup(id, true)
  activeSourceId = id
}

let lastPlaybackFail = { id: '', at: 0 }
/** 播放失败：列到队尾；同一源 5s 内只处理一次（handleError 会连调两次） */
export const markSourcePlaybackFailed = (id: string) => {
  if (!id) return
  const now = Date.now()
  if (lastPlaybackFail.id == id && now - lastPlaybackFail.at < 5_000) return
  lastPlaybackFail = { id, at: now }
  moveInGroup(id, false)
  activeSourceId = null
}

/** init 成功时按声明音质重新归组 */
export const recordSourceQualitys = (id: string, qualitys: Record<string, string[] | undefined>) => {
  if (!id) return
  regroupSource(id, qualitys)
}

/** 只有脚本 init 失败才降权；限流/单曲取链失败/播放失败都不动队列 */
export const markSourceFailed = (id: string, reason: SourceFailReason = 'init') => {
  if (!id || reason != 'init') return
  moveInGroup(id, false)
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

/** 冷启动首次选源：从相应音质组首前三随机选一个；已是当前源则不重复 loadScript */
export const autoSelectAvailableSource = async(): Promise<string | null> => {
  const list = await candidates()
  const id = pickTop(list, new Set<string>())
  if (!id) return null
  activeSourceId = id
  if (id === getCurrentSourceId()) return id
  setApiSource(id)
  return id
}
