#!/usr/bin/env node
/**
 * 内部版本号自增：每轮代码修改后执行一次，抽屉底部「内部版本」与
 * android/app/build.gradle 的 versionCode 都取自 package.json。
 *
 * 用法：npm run bump:version
 */
const fs = require('fs')
const path = require('path')

const file = path.resolve(__dirname, '..', 'package.json')
const src = fs.readFileSync(file, 'utf8')
const matched = /"versionCode"\s*:\s*(\d+)/.exec(src)
if (!matched) {
  console.error('[bump-version] package.json 缺少 versionCode')
  process.exit(1)
}
const current = Number(matched[1])
const next = current + 1
fs.writeFileSync(file, src.replace(/"versionCode"\s*:\s*\d+/, `"versionCode": ${next}`))
console.log(`[bump-version] versionCode ${current} -> ${next}`)
