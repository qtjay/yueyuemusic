import musicSdk from '@/utils/musicSdk'
import { setApiSource } from '@/core/apiSource'
import { getData, saveData } from '@/plugins/storage'
import { getUserApiList } from '@/utils/data'
import { toast } from '@/utils/tools'
import { toOldMusicInfo } from '@/utils/index'

/** 记录上次验证可用的音源，下次启动优先沿用 */
const LAST_GOOD_SOURCE_KEY = 'yueyue_last_good_source'
const PROBE_KEYWORD = '爱'
const INIT_TIMEOUT = 12_000
const URL_TIMEOUT = 15_000

const withTimeout = async<T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms)
      }),
    ])
  } finally {
    if (timer != null) clearTimeout(timer)
  }
}

/** 等待音源脚本初始化完成，返回是否成功 */
const waitApiInit = async(): Promise<boolean> => {
  const promise = global.lx.apiInitPromise?.[0] as unknown as Promise<boolean> | undefined
  if (!promise) return false
  return withTimeout(promise, INIT_TIMEOUT).catch(() => false)
}

/** 用内置搜索取一首歌，作为探测音源可用性的样本 */
const fetchProbeMusic = async(): Promise<LX.Music.MusicInfoOnline | null> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await withTimeout((musicSdk as any).kw.musicSearch.search(PROBE_KEYWORD, 1, 5) as Promise<{ list: LX.Music.MusicInfoOnline[] }>, URL_TIMEOUT)
    return result?.list?.length ? result.list[0] : null
  } catch {
    return null
  }
}

/** 用当前启用的音源请求播放链接，能拿到 URL 即视为可用 */
const tryGetMusicUrl = async(musicInfo: LX.Music.MusicInfoOnline): Promise<boolean> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (musicSdk as any)[musicInfo.source]
    if (!api?.getMusicUrl) return false
    const res = await withTimeout(api.getMusicUrl(toOldMusicInfo(musicInfo), '128k').promise as Promise<{ url?: string }>, URL_TIMEOUT)
    return !!res?.url
  } catch {
    return false
  }
}

/** 依次切换音源，找到第一个能取到播放链接的 */
const findAvailableSource = async(musicInfo: LX.Music.MusicInfoOnline | null) => {
  const list = await getUserApiList()
  for (const api of list) {
    setApiSource(api.id)
    if (!await waitApiInit()) continue
    // 拿不到探测歌曲时，退化为"能成功初始化即采用"
    if (!musicInfo || await tryGetMusicUrl(musicInfo)) {
      await saveData(LAST_GOOD_SOURCE_KEY, api.id)
      toast(`已启用音源：${api.name}`)
      return api.id
    }
  }
  return null
}

/** 后台校验当前音源，失效则自动换一个 */
const verifyAndFallback = async(currentId: string) => {
  const musicInfo = await fetchProbeMusic()
  if (!musicInfo) return
  if (await tryGetMusicUrl(musicInfo)) return

  const list = await getUserApiList()
  for (const api of list) {
    if (api.id === currentId) continue
    setApiSource(api.id)
    if (!await waitApiInit()) continue
    if (await tryGetMusicUrl(musicInfo)) {
      await saveData(LAST_GOOD_SOURCE_KEY, api.id)
      toast(`原音源不可用，已切换到：${api.name}`)
      return
    }
  }
}

/**
 * 启动时自动选择可用音源
 * - 有上次验证记录：立即启用（启动快），后台校验，失效自动换
 * - 无记录：逐个探测，选出能取到播放链接的音源
 */
export const autoSelectAvailableSource = async(): Promise<string | null> => {
  const list = await getUserApiList()
  if (!list.length) return null

  const lastId = await getData<string>(LAST_GOOD_SOURCE_KEY)
  if (lastId && list.some(api => api.id === lastId)) {
    setApiSource(lastId)
    await waitApiInit()
    void verifyAndFallback(lastId)
    return lastId
  }

  const musicInfo = await fetchProbeMusic()
  const id = await findAvailableSource(musicInfo)
  if (!id) setApiSource(list[0].id)
  return id
}
