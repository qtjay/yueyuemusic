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
// init 是加载音源脚本（部分混淆脚本 600KB+），太短会误杀一批源导致 global.lx.apis 始终不就绪
const INIT_TIMEOUT = 10_000
/** 连续失败 1 / 2 / 3 / ≥4 次的冷却时长 */
const COOLDOWN = [0, 60_000, 5 * 60_000, 30 * 60_000, 24 * 60 * 60 * 1000]
/** 单曲取链失败的短冷却：只移出候选，不升级连败 */
const URL_FAIL_COOLDOWN = 20_000
/** 播放层连续失败分级冷却：失败源要在最低档待够久，避免不停重试 */
const PLAYBACK_COOLDOWN = [60_000, 10 * 60_000, 60 * 60_000, 24 * 60 * 60 * 1000]
/** 音质由高到低，用于把「声明支持的音质」转成可比分数 */
const QUALITY_RANK: Record<string, number> = { flac24bit: 5, flac: 4, wav: 4, ape: 4, '320k': 2, '192k': 1, '128k': 0 }

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
  /** 播放层失败（音频源站不可用）的过期时间，独立于取链评分 */
  playbackFailUntil: number
  /** 播放层连续失败次数，只有「真正开始播放」才清零 */
  playbackStreak: number
  /** 音频真正播放成功的次数：三档优先级的最高档依据 */
  playSuccess: number
  /** 曾成功播放过的音质 */
  okQualitys: string[]
  /** init 时声明支持的音质（合并各平台），未 init 过的源为空 */
  qualitys: string[]
}

let stats: Record<string, SourceStat> = {}
let lastGood: string | null = null
let loadPromise: Promise<void> | null = null

const freshStat = (): SourceStat => ({ ok: 0, fail: 0, emaMs: 0, streak: 0, cooldownUntil: 0, lastOkAt: 0, playbackFailUntil: 0, playbackStreak: 0, playSuccess: 0, okQualitys: [], qualitys: [] })
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
      if (s && typeof s == 'object') {
        const merged = { ...freshStat(), ...s }
        if (!Array.isArray(merged.okQualitys)) merged.okQualitys = []
        if (!Array.isArray(merged.qualitys)) merged.qualitys = []
        loaded[id] = merged
      }
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

let lastPlaybackFail = { id: '', at: 0 }

/**
 * 播放层失败上报：分级加重，同一源 5s 内只记一次（handleError 会连调两次）。
 * 取链成功不清零，只有音频真正开始播放才清零，避免偶发缓冲慢误伤好源。
 */
export const markSourcePlaybackFailed = (id: string) => {
  if (!id) return
  const now = Date.now()
  if (lastPlaybackFail.id == id && now - lastPlaybackFail.at < 5_000) return
  lastPlaybackFail = { id, at: now }
  const s = getStat(id)
  s.playbackStreak++
  s.playbackFailUntil = now + PLAYBACK_COOLDOWN[Math.min(s.playbackStreak, PLAYBACK_COOLDOWN.length - 1)]
  persistStats()
}

/** 音频真正开始播放：记为最高优先级，清零全部失败标记并记录成功音质 */
export const markSourcePlaybackSuccess = (id: string, quality?: string) => {
  if (!id) return
  const s = getStat(id)
  s.playSuccess++
  s.playbackStreak = 0
  s.playbackFailUntil = 0
  s.cooldownUntil = 0
  s.streak = 0
  s.lastOkAt = Date.now()
  if (quality && !s.okQualitys.includes(quality)) s.okQualitys.push(quality)
  lastGood = id
  persistStats()
}

/** init 成功时记录该音源声明支持的音质（合并各平台），供选源时做音质匹配 */
export const recordSourceQualitys = (id: string, qualitys: Record<string, string[] | undefined>) => {
  if (!id) return
  const s = getStat(id)
  const set = new Set(s.qualitys)
  for (const list of Object.values(qualitys)) {
    if (!Array.isArray(list)) continue
    for (const q of list) set.add(String(q))
  }
  const next = [...set]
  if (next.length == s.qualitys.length && next.every(q => s.qualitys.includes(q))) return
  s.qualitys = next
  persistStats()
}

/** 失败上报：分级冷却；限流不罚，单曲取链失败只降排名不升级冷却 */
export const markSourceFailed = (id: string, reason: SourceFailReason = 'init') => {
  if (!id || reason == 'limit') return
  const s = getStat(id)
  s.fail += reason == 'url' ? 0.5 : 1
  if (reason == 'url') {
    // 单曲取链失败不升级连败，但要短暂移出候选，否则换源会立刻选回自己
    s.cooldownUntil = Math.max(s.cooldownUntil, Date.now() + URL_FAIL_COOLDOWN)
  } else if (reason != 'load') {
    // 播放层失败由 markSourcePlaybackFailed 独立分级，不占用取链层 streak，
    // 否则下一次「取链成功」会把这份惩罚清零，坏源又被排到前面
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

/**
 * 三档优先级：0=播放成功过（最高）、1=完全未试过、2=失败过（最低）。
 * 档内：当前音质匹配 > 曾成功的最高音质 > 期望耗时 > 播放成功次数。
 */
const rankSources = async() => {
  await loadStats()
  const list = await getUserApiList()
  const now = Date.now()
  const wantQuality = String(settingState.setting['player.playQuality'] ?? '128k')
  const wantRank = QUALITY_RANK[wantQuality] ?? 0

  const scored = list.map(api => {
    const s = stats[api.id]
    const cooling = isCooling(s) || (s?.playbackFailUntil ?? 0) > now
    const failed = !!s && (s.playbackStreak > 0 || s.fail > 0 || s.streak > 0)
    const tier = !s || (!failed && s.playSuccess == 0 && !s.qualitys.length) ? 1
      : s.playSuccess > 0 && !cooling ? 0 : 2
    // 声明支持的音质里没有当前音质 → 降权；曾以不低于当前音质播成功 → 优先
    const proven = s ? Math.max(-1, ...s.okQualitys.map(q => QUALITY_RANK[q] ?? 0)) : -1
    const declared = s ? Math.max(-1, ...s.qualitys.map(q => QUALITY_RANK[q] ?? 0)) : -1
    const qualityScore = s && s.qualitys.length && declared < wantRank ? 2
      : proven >= wantRank ? 0 : 1
    return { api, cooling, tier, qualityScore, proven, score: expectedMs(s), playSuccess: s?.playSuccess ?? 0 }
  })
  const usable = scored.filter(x => !x.cooling)
  return (usable.length ? usable : scored).sort((a, b) =>
    a.tier - b.tier ||
    a.qualityScore - b.qualityScore ||
    b.proven - a.proven ||
    a.score - b.score ||
    b.playSuccess - a.playSuccess
  )
}

/**
 * 按三档优先级顺序切换音源（保留旧函数名供现有调用点使用）。
 * init 超时 10s，失败即按原因惩罚并换下一个；第 2 次换源就提示用户。
 * @returns 成功启用的音源 id，全部失败返回 null
 */
export const switchToRandomSource = async(silent = false, excludeId?: string): Promise<string | null> => {
  let ranked = await rankSources()
  // 取链失败时必须排除当前源，避免评分仍把它排第一而原地打转
  if (excludeId) {
    const rest = ranked.filter(x => x.api.id != excludeId)
    if (rest.length) ranked = rest
  }
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

/** 启动时按三档优先级选 Top1，不做串行探测；已是当前源则不重复 loadScript */
export const autoSelectAvailableSource = async(): Promise<string | null> => {
  // 不再无条件直连 current / lastGood：按评分选 Top1，坏源（含播放失败冷却）自然被排除。
  // 若 Top1 恰好是当前源则不重复 setApiSource，避免二次 loadScript 让 init 回调错配。
  const ranked = await rankSources()
  if (!ranked.length) return null
  const best = ranked[0].api.id
  const current = getCurrentSourceId()
  if (best === current) return current
  setApiSource(best)
  return best
}
