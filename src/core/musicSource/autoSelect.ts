import settingState from '@/store/setting/state'
import { setApiSource } from '@/core/apiSource'
import { getUserApiList } from '@/utils/data'
import { getData, saveData } from '@/plugins/storage'
import { toast } from '@/utils/tools'

/** 音源表现统计，按「期望等待时间」择优 */
const STATS_KEY = '@source_latency_stats'
const LAST_GOOD_KEY = '@last_good_source'
/** 旧版 24h 失败记忆，启动时迁移为分级冷却 */
const FAILED_SOURCES_KEY = '@failed_sources_24h'

const DEFAULT_MS = 1500
const INIT_TIMEOUT = 3_000
/** 连续失败 1 / 2 / 3 / ≥4 次的冷却时长 */
const COOLDOWN = [0, 60_000, 5 * 60_000, 30 * 60_000, 24 * 60 * 60 * 1000]

export type SourceFailReason = 'init' | 'url' | 'load' | 'limit'

interface SourceStat {
  ok: number
  fail: number
  /** 取链耗时的指数移动平均 */
  emaMs: number
  /** 连续失败次数（取链失败不计入，避免单曲无版权误杀好源） */
  streak: number
  cooldownUntil: number
  lastOkAt: number
}

let stats: Record<string, SourceStat> = {}
let lastGood: string | null = null
let loadPromise: Promise<void> | null = null

const freshStat = (): SourceStat => ({ ok: 0, fail: 0, emaMs: 0, streak: 0, cooldownUntil: 0, lastOkAt: 0 })
const getStat = (id: string) => stats[id] ?? (stats[id] = freshStat())

/** 统计落盘节流：每首歌都写两次 storage 会拖慢首播，1s 内合并一次 */
let persistTimer: ReturnType<typeof setTimeout> | null = null
const persistStats = () => {
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    void saveData(STATS_KEY, stats)
    if (lastGood) void saveData(LAST_GOOD_KEY, lastGood)
  }, 1_000)
}

const loadStats = () => {
  if (loadPromise) return loadPromise
  loadPromise = Promise.all([
    getData<Record<string, SourceStat>>(STATS_KEY).catch((): Record<string, SourceStat> => ({})),
    getData<string>(LAST_GOOD_KEY).catch(() => null),
    getData<Record<string, number>>(FAILED_SOURCES_KEY).catch((): Record<string, number> => ({})),
  ]).then(([saved, good, legacy]) => {
    const now = Date.now()
    const loaded: Record<string, SourceStat> = {}
    for (const [id, s] of Object.entries(saved ?? {})) {
      if (s && typeof s == 'object') loaded[id] = { ...freshStat(), ...s }
    }
    // 旧版 24h 拉黑迁移为最高级冷却，避免升级后坏源突然全量放行
    for (const [id, expireAt] of Object.entries(legacy ?? {})) {
      if (expireAt <= now) continue
      const s = loaded[id] ?? freshStat()
      s.streak = Math.max(s.streak, 4)
      s.cooldownUntil = Math.max(s.cooldownUntil, expireAt)
      loaded[id] = s
    }
    // 保留加载期间新写入的统计，避免被异步读回的旧数据覆盖
    stats = { ...loaded, ...stats }
    lastGood = good ?? null
    void saveData(FAILED_SOURCES_KEY, {})
  }).catch(() => { stats = {} })
  return loadPromise
}
void loadStats()

/** 期望等待时间 = 单次耗时 / 平滑成功率。越小越优先 */
const expectedMs = (s?: SourceStat) => {
  if (!s) return DEFAULT_MS * 2
  const ema = s.emaMs || DEFAULT_MS
  return ema * (s.ok + s.fail + 2) / (s.ok + 1)
}
const isCooling = (s?: SourceStat) => (s?.cooldownUntil ?? 0) > Date.now()

export const isUserApiMode = (): boolean =>
  /^user_api/.test(settingState.setting['common.apiSource'])

export const getCurrentSourceId = (): string =>
  settingState.setting['common.apiSource']

/** 取链成功才上报：更新耗时 EMA、清空冷却、记为 lastGood */
export const markSourceSuccess = (id: string, ms: number) => {
  if (!id) return
  const s = getStat(id)
  s.ok++
  s.streak = 0
  s.cooldownUntil = 0
  s.lastOkAt = Date.now()
  const sample = Math.min(Math.max(ms, 50), 30_000)
  s.emaMs = s.emaMs ? s.emaMs * 0.7 + sample * 0.3 : sample
  lastGood = id
  persistStats()
}

/** 失败上报：分级冷却；限流不罚，单曲取链失败只降排名不升级冷却 */
export const markSourceFailed = (id: string, reason: SourceFailReason = 'init') => {
  if (!id || reason == 'limit') return
  const s = getStat(id)
  s.fail += reason == 'url' ? 0.5 : 1
  if (reason != 'url') {
    s.streak++
    s.cooldownUntil = Date.now() + COOLDOWN[Math.min(s.streak, COOLDOWN.length - 1)]
  }
  persistStats()
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

/** 按期望等待时间排序，跳过冷却中的源；全冷却时按评分兜底 */
const rankSources = async() => {
  await loadStats()
  const list = await getUserApiList()
  const scored = list.map(api => {
    const s = stats[api.id]
    return { api, cooling: isCooling(s), score: expectedMs(s) }
  })
  const usable = scored.filter(x => !x.cooling)
  return (usable.length ? usable : scored).sort((a, b) => a.score - b.score)
}

/**
 * 按评分顺序切换音源（保留旧函数名供现有调用点使用）。
 * init 短超时 3s，失败即按原因惩罚并换下一个；第 2 次换源就提示用户。
 * @returns 成功启用的音源 id，全部失败返回 null
 */
export const switchToRandomSource = async(silent = false): Promise<string | null> => {
  const ranked = await rankSources()
  if (!ranked.length) return null

  let notified = false
  for (let i = 0; i < ranked.length; i++) {
    if (i >= 2 && !notified) {
      notified = true
      toast('正在查找可用音源')
    }
    const { api } = ranked[i]
    setApiSource(api.id)
    if (await waitApiInit()) {
      if (!silent) toast(`已启用音源：${api.name}`)
      return api.id
    }
    markSourceFailed(api.id, 'init')
  }
  return null
}

/** 语义化别名，供新代码使用 */
export const switchToBestSource = switchToRandomSource

/**
 * 启动时直接启用上次成功的音源，不做串行探测（探测交给后续真实播放）。
 * lastGood 失效或在冷却中时才回退到按评分选源。
 */
export const autoSelectAvailableSource = async(): Promise<string | null> => {
  await loadStats()
  const list = await getUserApiList()
  if (!list.length) return null
  if (lastGood && list.some(api => api.id == lastGood) && !isCooling(stats[lastGood])) {
    setApiSource(lastGood)
    return lastGood
  }
  return switchToRandomSource(true)
}
