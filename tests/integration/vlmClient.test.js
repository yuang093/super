// 🤖 tests/integration/vlmClient.test.js
// VLM Client 整合測試（使用 mock fetch）
// 跑法：node --test tests/integration/vlmClient.test.js

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { VLMClient, ERROR_CODES } = require('../../src/ai/vlmClient');

/**
 * 建立可控制的 mock fetch
 * @param {Function} responder - (url, options) => { ok, status, statusText, json }
 */
function makeMockFetch(responder) {
  let callCount = 0;
  const calls = [];
  const fn = async (url, options) => {
    callCount++;
    calls.push({ url, options });
    return responder(url, options, callCount);
  };
  fn.callCount = () => callCount;
  fn.calls = () => calls;
  fn.reset = () => {
    callCount = 0;
    calls.length = 0;
  };
  return fn;
}

// ============================================================================
// 成功場景
// ============================================================================
test('成功 200 + 有效 content 應返回 success: true', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      choices: [{ message: { content: '{"name":"Apple","price":45}' } }],
    }),
  }));

  const client = new VLMClient({
    apiKey: 'test-key',
    endpoint: 'https://mock.api',
    model: 'MiniMax-M3',
    timeoutMs: 5000,
    maxRetries: 0,
    fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('fake-image'));

  assert.equal(result.success, true);
  assert.equal(result.content, '{"name":"Apple","price":45}');
  assert.equal(result.attempts, 1);
  assert.equal(result.errorCode, null);
  assert.equal(mockFetch.callCount(), 1);
});

test('content 應包含 Authorization Bearer header', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      choices: [{ message: { content: '{}' } }],
    }),
  }));

  const client = new VLMClient({
    apiKey: 'my-secret-key',
    endpoint: 'https://mock.api',
    model: 'MiniMax-M3',
    fetch: mockFetch,
  });

  await client.recognize(Buffer.from('image'));

  const call = mockFetch.calls()[0];
  assert.match(call.options.headers.Authorization, /^Bearer /);
  assert.equal(call.options.headers.Authorization, 'Bearer my-secret-key');
});

test('image 應以 base64 data URL 傳送', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ choices: [{ message: { content: '{}' } }] }),
  }));

  const client = new VLMClient({
    apiKey: 'k',
    endpoint: 'https://mock.api',
    model: 'm',
    fetch: mockFetch,
  });

  const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic number
  await client.recognize(imageBytes);

  const body = JSON.parse(mockFetch.calls()[0].options.body);
  const imageUrl = body.messages[0].content[1].image_url.url;
  assert.ok(imageUrl.startsWith('data:image/jpeg;base64,'));
  assert.ok(imageUrl.length > 50);
});

// ============================================================================
// 4xx 錯誤（不重試）
// ============================================================================
test('401 應返回 VLM_AUTH_ERROR 且不重試', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({ error: 'invalid api key' }),
  }));

  const client = new VLMClient({
    apiKey: 'bad-key',
    endpoint: 'https://mock.api',
    model: 'm',
    maxRetries: 3,
    fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.VLM_AUTH_ERROR);
  assert.equal(result.attempts, 1); // 不重試
  assert.equal(mockFetch.callCount(), 1);
});

test('400 應返回 VLM_INVALID_RESPONSE 且不重試', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: false,
    status: 400,
    statusText: 'Bad Request',
    json: async () => ({ error: 'invalid request' }),
  }));

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm', maxRetries: 3, fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.VLM_INVALID_RESPONSE);
  assert.equal(mockFetch.callCount(), 1);
});

// ============================================================================
// 5xx 錯誤（重試）
// ============================================================================
test('500 應自動重試 3 次（1 初始 + 2 重試）', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: async () => ({ error: 'server' }),
  }));

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    maxRetries: 2, retryBaseMs: 1, fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.VLM_SERVER_ERROR);
  assert.equal(result.attempts, 3);
  assert.equal(mockFetch.callCount(), 3);
});

test('首次 500 第二次 200 應成功（重試機制有效）', async () => {
  let callCount = 0;
  const mockFetch = makeMockFetch(() => {
    callCount++;
    if (callCount === 1) {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'temporary' }),
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ choices: [{ message: { content: '{"name":"Apple"}' } }] }),
    };
  });

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    maxRetries: 2, retryBaseMs: 1, fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.content, '{"name":"Apple"}');
});

test('429 Rate Limit 應重試', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    json: async () => ({ error: 'rate limit' }),
  }));

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    maxRetries: 2, retryBaseMs: 1, fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.VLM_RATE_LIMIT);
  assert.equal(mockFetch.callCount(), 3);
});

// ============================================================================
// 逾時處理
// ============================================================================
test('逾時應重試', async () => {
  const mockFetch = makeMockFetch(() => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  });

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    maxRetries: 2, retryBaseMs: 1, fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.VLM_TIMEOUT);
  assert.equal(mockFetch.callCount(), 3);
});

test('最終逾時應返回 VLM_TIMEOUT', async () => {
  const mockFetch = makeMockFetch(() => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  });

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    maxRetries: 0, fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.VLM_TIMEOUT);
});

// ============================================================================
// 網路錯誤
// ============================================================================
test('ECONNREFUSED 應重試', async () => {
  const mockFetch = makeMockFetch(() => {
    const err = new Error('connect ECONNREFUSED');
    err.code = 'ECONNREFUSED';
    throw err;
  });

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    maxRetries: 2, retryBaseMs: 1, fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.VLM_NETWORK_ERROR);
  assert.equal(mockFetch.callCount(), 3);
});

// ============================================================================
// 無效 content
// ============================================================================
test('200 但 content 為空應視為失敗', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ choices: [{ message: { content: '' } }] }),
  }));

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    maxRetries: 0, fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, false);
});

test('200 但 content 為 null 應視為失敗', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ choices: [{ message: { content: null } }] }),
  }));

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    maxRetries: 0, fetch: mockFetch,
  });

  const result = await client.recognize(Buffer.from('image'));

  assert.equal(result.success, false);
});

// ============================================================================
// 輸入驗證
// ============================================================================
test('imageBuffer 必須是 Buffer，否則返回 VLM_BAD_REQUEST', async () => {
  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
  });

  const result = await client.recognize('not a buffer');

  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.VLM_BAD_REQUEST);
  assert.equal(result.attempts, 0);
});

test('null 輸入應返回 VLM_BAD_REQUEST', async () => {
  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
  });

  const result = await client.recognize(null);

  assert.equal(result.success, false);
  assert.equal(result.errorCode, ERROR_CODES.VLM_BAD_REQUEST);
});

// ============================================================================
// Backoff 邏輯
// ============================================================================
test('backoffMs 應為指數退避：1s, 2s, 4s', () => {
  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    retryBaseMs: 1000,
  });

  assert.equal(client.backoffMs(1), 1000);
  assert.equal(client.backoffMs(2), 2000);
  assert.equal(client.backoffMs(3), 4000);
  assert.equal(client.backoffMs(4), 8000);
});

test('自訂 retryBaseMs 應生效', () => {
  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    retryBaseMs: 100,
  });

  assert.equal(client.backoffMs(1), 100);
  assert.equal(client.backoffMs(3), 400);
});

// ============================================================================
// 整合：完整鏈路（VLM + Fallback Parser）
// ============================================================================
test('整合：VLM 200 + 三層解析應正確解析 JSON content', async () => {
  const mockFetch = makeMockFetch(() => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      choices: [{ message: { content: '{"name":"Fuji Apple","price":45,"currency":"TWD","confidence":0.92}' } }],
    }),
  }));

  const { parseVLMResponse } = require('../../src/ai/fallbackParser');

  const client = new VLMClient({
    apiKey: 'k', endpoint: 'https://mock.api', model: 'm',
    fetch: mockFetch,
  });

  const vlmResult = await client.recognize(Buffer.from('image'));
  assert.equal(vlmResult.success, true);

  const parseResult = parseVLMResponse(vlmResult.content);
  assert.equal(parseResult.success, true);
  assert.equal(parseResult.parseMethod, 'json');
  assert.equal(parseResult.name, 'Fuji Apple');
  assert.equal(parseResult.price, 45);
  assert.equal(parseResult.currency, 'TWD');
  assert.equal(parseResult.confidence, 0.92);
});
