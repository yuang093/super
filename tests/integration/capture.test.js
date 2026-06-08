// 🤖 tests/integration/capture.test.js
// 拍照上傳 → Sharp 壓縮 → VLM 辨識 → 三層 Fallback 解析 → 寫入資料庫
// 跑法：node --test tests/integration/capture.test.js

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// 測試用的最小 JPEG（1x1 像素）
const MINIMAL_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A//2Q==',
  'base64'
);

const { CaptureService } = require('../../src/services/captureService');

// ============================================================================
// CaptureService 整合測試（使用 mock VLM）
// ============================================================================
test('CaptureService.processCapture：成功流程（VLM 200 + JSON 解析）', async () => {
  // mock VLM
  const mockVLM = {
    recognize: async () => ({
      success: true,
      content: '{"name":"Fuji Apple","price":45,"currency":"TWD","confidence":0.92}',
      raw: {},
      attempts: 1,
      latencyMs: 1500,
    }),
  };

  const service = new CaptureService({ vlmClient: mockVLM });
  const result = await service.processCapture({
    fileBuffer: MINIMAL_JPEG,
    mimetype: 'image/jpeg',
  });

  assert.equal(result.success, true);
  assert.equal(result.parse.name, 'Fuji Apple');
  assert.equal(result.parse.price, 45);
  assert.equal(result.parse.currency, 'TWD');
  assert.equal(result.parse.parseMethod, 'json');
  assert.equal(result.vlm.attempts, 1);
  assert.ok(result.image.path);
  assert.ok(result.image.size > 0);
  assert.ok(result.image.size < MINIMAL_JPEG.length); // 壓縮後更小
});

test('CaptureService.processCapture：VLM 失敗應返回 VLM 錯誤碼', async () => {
  const mockVLM = {
    recognize: async () => ({
      success: false,
      content: null,
      errorCode: 'VLM_AUTH_ERROR',
      errorMessage: 'Invalid API key',
      attempts: 1,
      latencyMs: 100,
    }),
  };

  const service = new CaptureService({ vlmClient: mockVLM });
  const result = await service.processCapture({
    fileBuffer: MINIMAL_JPEG,
    mimetype: 'image/jpeg',
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, 'VLM_AUTH_ERROR');
  assert.equal(result.parse, null);
  // 圖片仍應被壓縮（即使 VLM 失敗）
  assert.ok(result.image);
});

test('CaptureService.processCapture：VLM 200 但 content 是純文字（啟發式）', async () => {
  const mockVLM = {
    recognize: async () => ({
      success: true,
      content: 'This is a banana, costs about 30 dollars',
      raw: {},
      attempts: 1,
      latencyMs: 800,
    }),
  };

  const service = new CaptureService({ vlmClient: mockVLM });
  const result = await service.processCapture({
    fileBuffer: MINIMAL_JPEG,
    mimetype: 'image/jpeg',
  });

  // 純文字會進到啟發式解析
  assert.equal(result.success, true);
  assert.equal(result.parse.parseMethod, 'heuristic');
  assert.equal(result.parse.price, 30);
});

test('CaptureService.processCapture：圖片壓縮後應小於原始', async () => {
  const mockVLM = { recognize: async () => ({ success: true, content: '{}', raw: {}, attempts: 1, latencyMs: 1 }) };
  const service = new CaptureService({ vlmClient: mockVLM });

  const result = await service.processCapture({
    fileBuffer: MINIMAL_JPEG,
    mimetype: 'image/jpeg',
  });

  assert.ok(result.image.size < MINIMAL_JPEG.length);
  // 圖片應被寫入磁碟
  assert.ok(fs.existsSync(result.image.path));
  // 清理
  fs.unlinkSync(result.image.path);
});

test('CaptureService.processCapture：接受所有支援的 MIME 類型', async () => {
  const mockVLM = { recognize: async () => ({ success: true, content: '{}', raw: {}, attempts: 1, latencyMs: 1 }) };
  const service = new CaptureService({ vlmClient: mockVLM });

  for (const mimetype of ['image/jpeg', 'image/png', 'image/webp']) {
    const result = await service.processCapture({
      fileBuffer: MINIMAL_JPEG,
      mimetype,
    });
    assert.equal(result.success, true, `${mimetype} 應成功`);
    fs.unlinkSync(result.image.path);
  }
});

test('CaptureService 構造時需要 vlmClient', () => {
  assert.throws(() => new CaptureService({}), /需要 vlmClient/);
  assert.throws(() => new CaptureService({ vlmClient: null }), /需要 vlmClient/);
});

// ============================================================================
// 整合：multer 中介層測試
// ============================================================================
test('createUploadMiddleware：正確配置 multer', () => {
  const { createUploadMiddleware, ALLOWED_MIME_TYPES } = require('../../src/middleware/upload');
  const middleware = createUploadMiddleware({ env: {}, maxSizeMB: 5 });
  // multer 會回傳 function（不是物件）
  assert.equal(typeof middleware, 'function');
  assert.ok(ALLOWED_MIME_TYPES.includes('image/jpeg'));
  assert.ok(ALLOWED_MIME_TYPES.includes('image/png'));
  assert.ok(ALLOWED_MIME_TYPES.includes('image/webp'));
});

test('createUploadMiddleware：不支援的 MIME 應被拒絕', () => {
  const { createUploadMiddleware } = require('../../src/middleware/upload');
  const middleware = createUploadMiddleware({ env: {} });

  let fileFilterCalled = false;
  let cbError = null;
  const mockFile = { mimetype: 'application/pdf' };
  middleware.fileFilter({}, mockFile, (err, accept) => {
    fileFilterCalled = true;
    cbError = err;
  });

  assert.equal(fileFilterCalled, true);
  assert.ok(cbError);
  assert.equal(cbError.code, 'UNSUPPORTED_MIME');
  assert.equal(cbError.status, 415);
});

test('createUploadMiddleware：支援的 MIME 應被接受', () => {
  const { createUploadMiddleware } = require('../../src/middleware/upload');
  const middleware = createUploadMiddleware({ env: {} });

  let cbError = null;
  let cbAccept = null;
  const mockFile = { mimetype: 'image/jpeg' };
  middleware.fileFilter({}, mockFile, (err, accept) => {
    cbError = err;
    cbAccept = accept;
  });

  assert.equal(cbError, null);
  assert.equal(cbAccept, true);
});
