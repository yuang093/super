// 🤖 tests/integration/items.test.js
// 購物車 CRUD 整合測試（使用 in-memory SQLite）
// 跑法：node --test tests/integration/items.test.js

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { installTestEnv, restoreEnv } = require('../helpers/test-env');
const { createDatabase, getDatabase, closeDatabase } = require('../../src/db/database');
const ItemRepository = require('../../src/db/repositories/itemRepository');
const FingerprintRepository = require('../../src/db/repositories/fingerprintRepository');

let originalEnv;
let testDbPath;
let itemRepo;
let fpRepo;

test.before(async () => {
  // 安裝測試環境（取代 process.env）
  originalEnv = installTestEnv();

  // 在 temp 目錄建立測試資料庫
  testDbPath = path.join(os.tmpdir(), `super-test-${Date.now()}.db`);
  process.env.DATABASE_PATH = testDbPath;

  // 重新 require 以讓 env 變更生效
  delete require.cache[require.resolve('../../src/config/env')];
  delete require.cache[require.resolve('../../src/db/database')];
  createDatabase();
  itemRepo = new ItemRepository(getDatabase());
  fpRepo = new FingerprintRepository(getDatabase());
});

test.after(async () => {
  closeDatabase();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
  if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
  // 恢復原始環境
  restoreEnv(originalEnv);
});

// ============================================================================
// ItemRepository 整合測試
// ============================================================================
test('ItemRepository.create：新增商品', () => {
  const result = itemRepo.create({
    fingerprint: 'fp-alice',
    name: 'Apple',
    price: 45,
    currency: 'TWD',
  });
  assert.ok(result.lastInsertRowid > 0);
});

test('ItemRepository.findByFingerprint：依 fingerprint 查詢商品（依時間倒序）', async () => {
  // 新增三筆（使用不同 fingerprint 避免與前面測試衝突）
  itemRepo.create({ fingerprint: 'fp-time', name: 'Milk', price: 95, currency: 'TWD' });
  await new Promise((r) => setTimeout(r, 10)); // 確保不同時間戳
  itemRepo.create({ fingerprint: 'fp-time', name: 'Bread', price: 65, currency: 'TWD' });
  await new Promise((r) => setTimeout(r, 10));
  itemRepo.create({ fingerprint: 'fp-time', name: 'Cheese', price: 120, currency: 'TWD' });

  const items = itemRepo.findByFingerprint('fp-time');
  assert.equal(items.length, 3);
  // 依時間倒序（最新在前）
  assert.equal(items[0].name, 'Cheese');
  assert.equal(items[1].name, 'Bread');
  assert.equal(items[2].name, 'Milk');
});

test('ItemRepository.findByFingerprint：分頁測試', () => {
  const items = itemRepo.findByFingerprint('fp-time', { limit: 2, offset: 0 });
  assert.equal(items.length, 2);
  assert.equal(items[0].name, 'Cheese');
  assert.equal(items[1].name, 'Bread');

  const items2 = itemRepo.findByFingerprint('fp-time', { limit: 2, offset: 2 });
  assert.equal(items2.length, 1);
  assert.equal(items2[0].name, 'Milk');
});

test('ItemRepository.sumByFingerprint：依幣別分組加總', () => {
  itemRepo.create({ fingerprint: 'fp-charlie', name: 'Item1', price: 100, currency: 'TWD' });
  itemRepo.create({ fingerprint: 'fp-charlie', name: 'Item2', price: 200, currency: 'TWD' });
  itemRepo.create({ fingerprint: 'fp-charlie', name: 'Item3', price: 5, currency: 'USD' });

  const sums = itemRepo.sumByFingerprint('fp-charlie');
  assert.equal(sums.length, 2);

  const twd = sums.find((s) => s.currency === 'TWD');
  const usd = sums.find((s) => s.currency === 'USD');
  assert.equal(twd.total, 300);
  assert.equal(twd.count, 2);
  assert.equal(usd.total, 5);
  assert.equal(usd.count, 1);
});

test('ItemRepository.deleteById：依 ID 刪除', () => {
  const result = itemRepo.create({ fingerprint: 'fp-delete', name: 'ToDelete', price: 10, currency: 'TWD' });
  const id = result.lastInsertRowid;

  const before = itemRepo.findByFingerprint('fp-delete');
  assert.equal(before.length, 1);

  itemRepo.deleteById(id);

  const after = itemRepo.findByFingerprint('fp-delete');
  assert.equal(after.length, 0);
});

test('ItemRepository.deleteAllByFingerprint：清空購物車', () => {
  itemRepo.create({ fingerprint: 'fp-clear', name: 'A', price: 10, currency: 'TWD' });
  itemRepo.create({ fingerprint: 'fp-clear', name: 'B', price: 20, currency: 'TWD' });
  itemRepo.create({ fingerprint: 'fp-clear', name: 'C', price: 30, currency: 'TWD' });

  const before = itemRepo.findByFingerprint('fp-clear');
  assert.equal(before.length, 3);

  const result = itemRepo.deleteAllByFingerprint('fp-clear');
  assert.equal(result.changes, 3);

  const after = itemRepo.findByFingerprint('fp-clear');
  assert.equal(after.length, 0);
});

test('ItemRepository.deleteAllByFingerprint：刪除不存在的 fingerprint 不應出錯', () => {
  const result = itemRepo.deleteAllByFingerprint('fp-nonexistent');
  assert.equal(result.changes, 0);
});

test('ItemRepository.updateById：更新商品（部分欄位）', () => {
  const result = itemRepo.create({ fingerprint: 'fp-update', name: 'Old', price: 10, currency: 'TWD' });
  const id = result.lastInsertRowid;

  itemRepo.updateById(id, { name: 'New', price: 20 });
  const item = itemRepo.findById(id);
  assert.equal(item.name, 'New');
  assert.equal(item.price, 20);
  assert.equal(item.currency, 'TWD'); // 未更新保持原值
});

test('ItemRepository.create：拒絕無效輸入', () => {
  assert.throws(() => itemRepo.create({}), /fingerprint 不可為空/);
  assert.throws(() => itemRepo.create({ fingerprint: 'x' }), /name 不可為空/);
  assert.throws(
    () => itemRepo.create({ fingerprint: 'x', name: 'y', price: -1 }),
    /price 必須為非負數/
  );
});

// ============================================================================
// FingerprintRepository 整合測試
// ============================================================================
test('FingerprintRepository.upsert：首次新增', () => {
  const id = fpRepo.upsert('fp-new-user');
  assert.ok(id > 0);
});

test('FingerprintRepository.upsert：重複 fingerprint 應更新 last_seen_at + 增加 total_items', () => {
  fpRepo.upsert('fp-repeat');
  fpRepo.upsert('fp-repeat');
  fpRepo.upsert('fp-repeat');

  const record = fpRepo.findByHash('fp-repeat');
  assert.ok(record);
  assert.equal(record.total_items, 3);
});

test('FingerprintRepository.findByHash：依 hash 查詢', () => {
  fpRepo.upsert('fp-find');
  const found = fpRepo.findByHash('fp-find');
  assert.ok(found);
  assert.equal(found.fingerprint_hash, 'fp-find');
});
