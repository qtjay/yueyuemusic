import settingState from '@/store/setting/state'
import { setApiSource } from '@/core/apiSource'
import { getUserApiList } from '@/utils/data'
import { getData, saveData } from '@/plugins/storage'
import { toast } from '@/utils/tools'

/** 失败音源记忆 24 小时：id -> 过期时间戳。持久化到 storage，重启不清零 */
const FAILED_SOURCES_KEY = '@failed_sources_24h'
const FAILED_TTL = 24 * 60 * 60 * 1000
let failedMap: Record<string, number> = {}
let loadPromise: Promise<void> | null = null

const loadFailedSources = () => {
  if (loadPromise) return loadPromise
  loadPromise = getData<Record<string, number>>(FAILED_SOURCES_KEY)
    .then(data => {
      const now = Date.now()
      const raw = data ?? {}
      const fresh = Object.fromEntries(Object.entries(raw).filter(([, expireAt]) => expireAt > now))
      // 保留加载期间新标记的失败源，避免被异步读回的旧数据覆盖
      failedMap = { ...fresh, ...failedMap }
      if (Object.keys(fresh).length != Object.keys(raw).length) void saveData(FAILED_SOURCES_KEY, failedMap)
    })
    .catch(() => { failedMap = {} })
  return loadPromise
}
void loadFailedSources()

const isSourceFailed = (id: string) => (failedMap[id] ?? 0) > Date.now()

export const isUserApiMode = (): boolean =>
  /^user_api/.test(settingState.setting['common.apiSource'])

export const getCurrentSourceId = (): string =>
  settingState.setting['common.apiSource']

export const markSourceFailed = (id: string) => {
  failedMap[id] = Date.now() + FAILED_TTL
  void saveData(FAILED_SOURCES_KEY, failedMap)
}

/** 等待音源脚本初始化完成，超时视为失败 */
const waitApiInit = async(timeout = 12_000): Promise<boolean> => {
  const promise = global.lx.apiInitPromise?.[0] as unknown as Promise<boolean> | undefined
  if (!promise) return false
  return await Promise.race([
    promise,
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), timeout)),
  ])
}

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

/**
 * 随机切换到一个音源（跳过 24h 内已知失败的；init 失败继续换下一个，遍历全部候选）
 * 尝试超过 4 个仍没找到时提示「正在查找可用音源」，而不是直接放弃。
 * @returns 成功启用的音源 id，全部失败返回 null
 */
export const switchToRandomSource = async(silent = false): Promise<string | null> => {
  await loadFailedSources()
  const list = await getUserApiList()
  if (!list.length) return null

  let candidates = list.filter(api => !isSourceFailed(api.id))
  // 所有源都在失败记忆里时放宽限制，避免彻底无源可用
  if (!candidates.length) candidates = list

  const tried = new Set<string>()
  let notified = false
  for (let i = 0; i < candidates.length; i++) {
    if (i >= 4 && !notified) {
      notified = true
      toast('正在查找可用音源')
    }
    const rest = candidates.filter(api => !tried.has(api.id))
    if (!rest.length) break
    const api = pickRandom(rest)
    tried.add(api.id)

    setApiSource(api.id)
    if (await waitApiInit()) {
      if (!silent) toast(`已启用音源：${api.name}`)
      return api.id
    }
    markSourceFailed(api.id)
  }
  return null
}

/**
 * 启动时随机选择一个音源（init 失败自动换下一个）
 */
export const autoSelectAvailableSource = async(): Promise<string | null> => {
  const list = await getUserApiList()
  if (!list.length) return null
  return switchToRandomSource(true)
}
