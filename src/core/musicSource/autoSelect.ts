import settingState from '@/store/setting/state'
import { setApiSource } from '@/core/apiSource'
import { getUserApiList } from '@/utils/data'
import { toast } from '@/utils/tools'

/**
 * 本次会话中已知不可用的音源（重启后清零，源可能自行恢复）
 */
const failedSources = new Set<string>()

export const isUserApiMode = (): boolean =>
  /^user_api/.test(settingState.setting['common.apiSource'])

export const getCurrentSourceId = (): string =>
  settingState.setting['common.apiSource']

export const markSourceFailed = (id: string) => {
  failedSources.add(id)
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
 * 随机切换到一个音源（跳过已标记失败的；init 失败自动再随机换，最多试 4 个）
 * @returns 成功启用的音源 id，全部失败返回 null
 */
export const switchToRandomSource = async(silent = false): Promise<string | null> => {
  const list = await getUserApiList()
  if (!list.length) return null

  let candidates = list.filter(api => !failedSources.has(api.id))
  // 所有源都被标记过时放宽限制，避免无源可用
  if (!candidates.length) candidates = list

  const tried = new Set<string>()
  const maxTries = Math.min(4, candidates.length)
  for (let i = 0; i < maxTries; i++) {
    const rest = candidates.filter(api => !tried.has(api.id))
    if (!rest.length) break
    const api = pickRandom(rest)
    tried.add(api.id)

    setApiSource(api.id)
    if (await waitApiInit()) {
      if (!silent) toast(`已启用音源：${api.name}`)
      return api.id
    }
    failedSources.add(api.id)
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
