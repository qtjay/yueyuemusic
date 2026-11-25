#!/usr/bin/env node
/**
 * 用 CI 构建号生成 src/config/buildInfo.json（内部版本号来源）。
 *
 * 今后内部版本号 = GitHub Actions 的 GITHUB_RUN_NUMBER，与 APK 文件名里的 b<num> 一致，
 * 不再手工维护 package.json.versionCode。
 *
 * 本地构建（无 GITHUB_RUN_NUMBER）时保留文件里已有的构建号，不会回退成 0，
 * 避免本地调试包显示「内部版本 0」。
 */
const fs = require('fs')
const path = require('path')

const file = path.resolve(__dirname, '..', 'src', 'config', 'buildInfo.json')
const raw = process.env.GITHUB_RUN_NUMBER ?? process.env.BUILD_NUMBER ?? ''

if (!/^\d+$/.test(raw)) {
  let current = 0
  try { current = JSON.parse(fs.readFileSync(file, 'utf8')).buildNumber ?? 0 } catch {}
  console.log(`[build-info] 非 CI 构建，保留本地构建号 ${current}`)
  process.exit(0)
}

const buildNumber = Number(raw)
fs.writeFileSync(file, `${JSON.stringify({ buildNumber }, null, 2)}\n`)
console.log(`[build-info] buildNumber -> ${buildNumber}`)
