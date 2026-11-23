import { Platform } from 'react-native'
import RNFS from 'react-native-fs'
import { getData, saveData } from '@/plugins/storage'
import { addUserApi, getUserApiList, removeUserApi as removeUserApiFromStore } from '@/utils/data'
import { builtinMusicSources, type BuiltinMusicSource } from './builtin'

/** assets 下存放内置音源脚本的目录 */
const ASSET_DIR = 'musicSources'
/** 记录内置音源是否已随首次启动注入，避免重复注入或被用户删除后又复活 */
const BUILTIN_INITED_KEY = 'yueyue_builtin_sources_inited'

export const builtinSources: BuiltinMusicSource[] = builtinMusicSources

/**
 * 读取内置音源脚本内容
 * Android 从 apk assets 读取，iOS 从 main bundle 读取
 */
export const readBuiltinScript = async(file: string): Promise<string> => {
  if (Platform.OS === 'android') {
    return RNFS.readFileAssets(`${ASSET_DIR}/${file}`)
  }
  const filePath = `${RNFS.MainBundlePath}/${ASSET_DIR}/${file}`
  if (!await RNFS.exists(filePath)) throw new Error(`内置音源文件缺失：${file}`)
  return RNFS.readFile(filePath)
}

/** 导入单个内置音源 */
export const importBuiltinSource = async(source: BuiltinMusicSource): Promise<LX.UserApi.UserApiInfo> => {
  const script = await readBuiltinScript(source.file)
  return addUserApi(script)
}

/** 判断某个内置音源是否已被导入（按名称 + 版本比对） */
export const isBuiltinSourceImported = async(source: BuiltinMusicSource) => {
  const list = await getUserApiList()
  return list.some(api => api.name === source.name && api.version === source.version)
}

/**
 * 把内置音源补齐到自定义音源列表：
 * 按 key 记录已注入项，后续版本新增的音源会自动补齐，用户主动删除的不会复活。
 * 同时清掉被上游判定为恶意的「独家音源」和内置音源的同名旧版本。
 */
export const initBuiltinMusicSources = async(): Promise<LX.UserApi.UserApiInfo[]> => {
  let list: LX.UserApi.UserApiInfo[] = []
  try {
    list = await getUserApiList()
  } catch { /* 首次启动可能为空 */ }

  const builtinByName = new Map(builtinMusicSources.map(s => [s.name, s.version]))
  const toRemove = [...new Set(list
    .filter(api => api.name === '独家音源' || (builtinByName.has(api.name) && builtinByName.get(api.name) !== api.version))
    .map(api => api.id))]
  if (toRemove.length) {
    try {
      await removeUserApiFromStore(toRemove)
      list = list.filter(api => !toRemove.includes(api.id))
    } catch (err) {
      console.warn('[builtin-source] cleanup failed', err)
    }
  }

  // 兼容旧版本：曾存的是 boolean true，视为未记录任何 key
  const raw = await getData<unknown>(BUILTIN_INITED_KEY)
  const inited = new Set<string>(Array.isArray(raw) ? raw as string[] : [])
  const existing = new Set(list.map(api => `${api.name}__${api.version ?? ''}`))
  const imported: LX.UserApi.UserApiInfo[] = []

  for (const source of builtinMusicSources) {
    if (inited.has(source.key)) continue
    if (!existing.has(`${source.name}__${source.version}`)) {
      try {
        imported.push(await importBuiltinSource(source))
      } catch (err) {
        console.warn('[builtin-source] import failed', source.key, err)
        continue
      }
    }
    inited.add(source.key)
  }

  await saveData(BUILTIN_INITED_KEY, [...inited])
  return imported
}
