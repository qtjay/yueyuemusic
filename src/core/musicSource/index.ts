import { Platform } from 'react-native'
import RNFS from 'react-native-fs'
import { getData, saveData } from '@/plugins/storage'
import { addUserApi, getUserApiList } from '@/utils/data'
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
 * 首次启动时把内置音源注入到自定义音源列表
 * 之后由用户自行管理（删除后不会被重新注入）
 */
export const initBuiltinMusicSources = async(): Promise<LX.UserApi.UserApiInfo[]> => {
  if (await getData<boolean>(BUILTIN_INITED_KEY)) return []

  let list: LX.UserApi.UserApiInfo[] = []
  try {
    list = await getUserApiList()
  } catch { /* 首次启动可能为空 */ }

  const existing = new Set(list.map(api => `${api.name}__${api.version ?? ''}`))
  const imported: LX.UserApi.UserApiInfo[] = []

  for (const source of builtinMusicSources) {
    if (existing.has(`${source.name}__${source.version}`)) continue
    try {
      imported.push(await importBuiltinSource(source))
    } catch (err) {
      console.warn('[builtin-source] import failed', source.key, err)
    }
  }

  await saveData(BUILTIN_INITED_KEY, true)
  return imported
}
