#!/usr/bin/env node
/**
 * 内置音源生成器
 *
 * 从两个本地参考仓库读取音源脚本：
 *   .ref/lx-music-source/<name>/latest.js   https://github.com/pdone/lx-music-source
 *   .ref/lxmusic-/V260907/*.js              https://github.com/guoyue2010/lxmusic-
 * 复制为 Android assets（android/app/src/main/assets/musicSources/<key>.js），
 * 并生成清单文件 src/core/musicSource/builtin.ts 供运行时读取。
 *
 * 去重：按 @name（忽略空白/大小写）+ 脚本内容 hash；pdone 优先（版本通常更新）。
 * 安全：排除「独家音源」——上游已确认其含 child_process / shutdown 强制关机的恶意逻辑。
 *
 * 用法：npm run gen:sources
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const PDONE_DIR = path.join(ROOT, '.ref', 'lx-music-source')
const GUOYUE_DIR = path.join(ROOT, '.ref', 'lxmusic-', 'V260907')
const ASSETS_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'musicSources')
const OUT_FILE = path.join(ROOT, 'src', 'core', 'musicSource', 'builtin.ts')

/** 上游已下架的恶意音源（含强制关机逻辑），任何来源都不得内置 */
const BLOCKED_NAMES = new Set(['独家音源'])
const BLOCKED_FILE = /独家音源|lx.*独家/

/** 从脚本头部注释块解析元信息 */
const parseMeta = (script) => {
  const matched = /\/\*[\s\S]{0,2000}?\*\//.exec(script)
  if (!matched) return null
  const block = matched[0]
  const field = (name) => {
    const m = new RegExp(`@${name}\\s+([^\\n\\r]*)`).exec(block)
    return m ? m[1].trim() : ''
  }
  const name = field('name')
  if (!name) return null
  return {
    name,
    version: field('version'),
    description: field('description'),
    author: field('author'),
    homepage: field('homepage'),
  }
}

const normName = (name) => name.replace(/\s+/g, '').toLowerCase()
const md5 = (text) => crypto.createHash('md5').update(text).digest('hex')

const main = () => {
  if (!fs.existsSync(PDONE_DIR)) {
    console.error(`[gen-sources] 未找到参考仓库：${PDONE_DIR}`)
    console.error('请先执行：git clone --depth 1 https://github.com/pdone/lx-music-source.git .ref/lx-music-source')
    process.exit(1)
  }

  fs.mkdirSync(ASSETS_DIR, { recursive: true })
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })

  const list = []
  const seenNames = new Set()
  const seenHashes = new Set()

  const add = (script, key, label, origin) => {
    const meta = parseMeta(script)
    if (!meta) {
      console.warn(`[gen-sources] 跳过（缺少 @name）：${origin}/${label}`)
      return
    }
    if (BLOCKED_NAMES.has(meta.name) || BLOCKED_FILE.test(label) || BLOCKED_FILE.test(meta.name)) {
      console.warn(`[gen-sources] 安全排除：${origin}/${label}`)
      return
    }
    const hash = md5(script)
    const nk = normName(meta.name)
    if (seenNames.has(nk) || seenHashes.has(hash)) {
      console.warn(`[gen-sources] 去重跳过：${origin}/${label} -> ${meta.name}`)
      return
    }
    seenNames.add(nk)
    seenHashes.add(hash)
    list.push({
      key,
      file: `${key}.js`,
      name: meta.name,
      version: meta.version,
      description: meta.description,
      author: meta.author,
      homepage: meta.homepage,
      origin,
      size: Buffer.byteLength(script, 'utf8'),
      script,
    })
    console.log(`[gen-sources] ${origin.padEnd(7)} ${key.padEnd(14)} ${meta.name} ${meta.version}`)
  }

  // pdone 优先：各目录的 latest.js 即为最新版本
  const dirs = fs.readdirSync(PDONE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name)
    .sort()
  for (const dir of dirs) {
    const latest = path.join(PDONE_DIR, dir, 'latest.js')
    if (!fs.existsSync(latest)) continue
    add(fs.readFileSync(latest, 'utf8'), dir, `${dir}/latest.js`, 'pdone')
  }

  // guoyue：只取最新版本目录，避免把历史版本快照重复打包
  if (fs.existsSync(GUOYUE_DIR)) {
    const files = fs.readdirSync(GUOYUE_DIR).filter(f => f.endsWith('.js')).sort()
    for (const f of files) {
      const script = fs.readFileSync(path.join(GUOYUE_DIR, f), 'utf8')
      const meta = parseMeta(script)
      const key = `gy_${md5(meta ? meta.name : f).slice(0, 8)}`
      add(script, key, f, 'guoyue')
    }
  } else {
    console.warn(`[gen-sources] 未找到 guoyue 参考目录：${GUOYUE_DIR}（仅使用 pdone）`)
  }

  if (!list.length) {
    console.error('[gen-sources] 没有生成任何音源')
    process.exit(1)
  }

  // 同步 assets：写入新清单并删除不再需要的旧文件（如已下架的 lx.js）
  const keep = new Set(list.map(item => item.file))
  for (const f of fs.readdirSync(ASSETS_DIR)) {
    if (!keep.has(f)) {
      fs.unlinkSync(path.join(ASSETS_DIR, f))
      console.warn(`[gen-sources] 删除旧资产：${f}`)
    }
  }
  for (const item of list) {
    fs.writeFileSync(path.join(ASSETS_DIR, item.file), item.script)
  }

  const escape = (str) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  const content = `/* eslint-disable */
// 该文件由 tools/gen-music-sources.js 自动生成，请勿手动修改
// 音源来源：https://github.com/pdone/lx-music-source 、https://github.com/guoyue2010/lxmusic-
// 已按 @name + 内容 hash 去重（pdone 优先），并排除被上游下架的恶意「独家音源」

export interface BuiltinMusicSource {
  /** 音源目录名，同时作为 assets 文件名前缀 */
  key: string
  /** assets/musicSources 下的文件名 */
  file: string
  name: string
  version: string
  description: string
  author: string
  homepage: string
  /** 来源仓库 */
  origin: string
  /** 脚本字节大小 */
  size: number
}

export const builtinMusicSources: BuiltinMusicSource[] = [
${list.map(item => `  {
    key: '${escape(item.key)}',
    file: '${escape(item.file)}',
    name: '${escape(item.name)}',
    version: '${escape(item.version)}',
    description: '${escape(item.description)}',
    author: '${escape(item.author)}',
    homepage: '${escape(item.homepage)}',
    origin: '${escape(item.origin)}',
    size: ${item.size},
  },`).join('\n')}
]
`

  fs.writeFileSync(OUT_FILE, content)
  console.log(`[gen-sources] 共生成 ${list.length} 个音源（pdone ${list.filter(i => i.origin == 'pdone').length} / guoyue ${list.filter(i => i.origin == 'guoyue').length}），清单：src/core/musicSource/builtin.ts`)
}

main()
