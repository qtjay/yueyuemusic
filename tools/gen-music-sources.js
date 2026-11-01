#!/usr/bin/env node
/**
 * 内置音源生成器
 *
 * 从本地参考仓库 .ref/lx-music-source 读取各音源的 latest.js，
 * 复制为 Android assets（android/app/src/main/assets/musicSources/<key>.js），
 * 并生成清单文件 src/core/musicSource/builtin.ts 供运行时读取。
 *
 * 用法：npm run gen:sources
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, '.ref', 'lx-music-source')
const ASSETS_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'musicSources')
const OUT_FILE = path.join(ROOT, 'src', 'core', 'musicSource', 'builtin.ts')

/** 从脚本头部注释块解析元信息 */
const parseMeta = (script) => {
  const matched = /^\/\*[\s\S]+?\*\//.exec(script)
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

const main = () => {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`[gen-sources] 未找到参考仓库：${SRC_DIR}`)
    console.error('请先执行：git clone --depth 1 https://github.com/pdone/lx-music-source.git .ref/lx-music-source')
    process.exit(1)
  }

  fs.mkdirSync(ASSETS_DIR, { recursive: true })
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })

  const dirs = fs.readdirSync(SRC_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name)
    .sort()

  const list = []
  for (const dir of dirs) {
    const latest = path.join(SRC_DIR, dir, 'latest.js')
    if (!fs.existsSync(latest)) continue
    const script = fs.readFileSync(latest, 'utf8')
    const meta = parseMeta(script)
    if (!meta) {
      console.warn(`[gen-sources] 跳过（缺少 @name 元信息）：${dir}`)
      continue
    }
    const file = `${dir}.js`
    fs.writeFileSync(path.join(ASSETS_DIR, file), script)
    list.push({
      key: dir,
      file,
      name: meta.name,
      version: meta.version,
      description: meta.description,
      author: meta.author,
      homepage: meta.homepage,
      size: Buffer.byteLength(script, 'utf8'),
    })
    console.log(`[gen-sources] ${dir.padEnd(12)} ${meta.name} ${meta.version} (${(Buffer.byteLength(script) / 1024).toFixed(1)} KB)`)
  }

  if (!list.length) {
    console.error('[gen-sources] 没有生成任何音源')
    process.exit(1)
  }

  const escape = (str) => str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

  const content = `/* eslint-disable */
// 该文件由 tools/gen-music-sources.js 自动生成，请勿手动修改
// 音源来源：https://github.com/pdone/lx-music-source

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
    size: ${item.size},
  },`).join('\n')}
]
`

  fs.writeFileSync(OUT_FILE, content)
  console.log(`[gen-sources] 共生成 ${list.length} 个音源，清单：src/core/musicSource/builtin.ts`)
}

main()
