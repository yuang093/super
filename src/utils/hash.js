// 🤖 src/utils/hash.js
// 內容雜湊工具（用於檔案去重、簽章、指紋）
// 對應 [CLAUDE.md §1.1](../../CLAUDE.md) 共用工具模組

'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')

/**
 * 計算字串的 SHA-256 雜湊（hex 格式）
 * @param {string} input
 * @returns {string} 64 字元 hex
 */
function sha256(input) {
  if (typeof input !== 'string') {
    throw new TypeError('sha256 輸入必須是字串')
  }
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * 計算 Buffer 的 SHA-256 雜湊
 * @param {Buffer} buffer
 * @returns {string} 64 字元 hex
 */
function hashBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('hashBuffer 輸入必須是 Buffer')
  }
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * 計算檔案的 SHA-256 雜湊（串流讀取，避免大檔占用記憶體）
 * @param {string} filePath
 * @returns {Promise<string>} 64 字元 hex
 */
async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * 從 SHA-256 雜湊產生簡短檔名前綴（16 字元）
 * @param {string} hash
 * @returns {string}
 */
function shortHash(hash) {
  if (!hash || hash.length < 16) {
    throw new Error('hash 長度不足')
  }
  return hash.substring(0, 16)
}

module.exports = {
  sha256,
  hashBuffer,
  hashFile,
  shortHash,
}
