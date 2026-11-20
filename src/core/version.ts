/**
 * 更新检查功能已移除：本项目为独立 fork，不检查上游 LX Music 版本、
 * 不弹出更新弹窗、不下载 APK，也不发起任何版本信息请求。
 *
 * 以下导出只是为旧版 VersionModal 保留的同名空实现（该文件仍被注册但无入口触发），
 * 保证编译通过的同时，运行时不再有更新检查行为。
 */
import versionActions from '@/store/version/action'
import type { InitState } from '@/store/version/state'

export const showModal = () => {}

export const hideModal = (_componentId: string) => {}

export const checkUpdate = async() => {
  versionActions.setVersionInfo({ status: 'idle', isLatest: true, isUnknown: false })
}

export const downloadUpdate = () => {}

export const setIgnoreVersion = (_version: InitState['ignoreVersion']) => {}
