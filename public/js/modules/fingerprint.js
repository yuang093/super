// 🤖 public/js/modules/fingerprint.js
// 免登入 Fingerprint 產生器
// 對應 [todo_progress.md F-08](../../todo_progress.md)
// 資料來源：Canvas紋理 + UserAgent + 螢幕解析度 + 時區 +語言
// 輸出：穩定的 SHA-256 雜湊（不作法：不同人之間指紋衝突率低）

'use strict';

/**
 * 計算 SHA-256 雜湊
 * @param {string} input
 * @returns {Promise<string>}
 */
async function sha256(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 從 Canvas 2D 上下文取得紋理特徵
 * 使用 Canvas API 渲染漸層與文字，擷取微小的硬體/字型差異
 * @returns {string}
 */
function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');

    // 漸層背景
    const gradient = ctx.createLinearGradient(0, 0, 280, 0);
    gradient.addColorStop(0, '#f0f0f0');
    gradient.addColorStop(1, '#e8e8e8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 280, 60);

    // 測試文字（用以偵測字型）
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial, Helvetica, sans-serif';
    ctx.fillText('Supermarket Tracker', 10, 30);

    // 圓形（圓形邊緣平滑度因 GPU 而異）
    ctx.beginPath();
    ctx.arc(240, 30, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 107, 107, 0.7)';
    ctx.fill();

    //取得資料 URL（內含微小渲染差異）
    const dataUrl = canvas.toDataURL();
    return dataUrl;
  } catch (err) {
    // 無法取得 Canvas 指紋時，回傳空字串
    return '';
  }
}

/**
 * 取得螢幕相關特徵
 * @returns {string}
 */
function getScreenFingerprint() {
  const parts = [
    window.screen?.width ||0,
    window.screen?.height || 0,
    window.screen?.colorDepth || 0,
    window.screen?.pixelDepth || 0,
    window.devicePixelRatio || 1,
    window.innerWidth || 0,
    window.innerHeight || 0,
    window.outerWidth || 0,
    window.outerHeight || 0,
  ];
  return parts.join('x');
}

/**
 * 取得瀏覽器特徵
 * @returns {string}
 */
function getBrowserFingerprint() {
  const ua = navigator.userAgent;
  const lang = navigator.language || navigator.userLanguage || '';
  const platform = navigator.platform || '';
  const hardwareConcurrency = navigator.hardwareConcurrency || 0;
  const deviceMemory = navigator.deviceMemory || 0;

  return [
    ua,
    lang,
    platform,
    hardwareConcurrency,
    deviceMemory,
  ].join('|');
}

/**
 * 取得時區與語言特徵
 * @returns {string}
 */
function getLocaleFingerprint() {
  return [
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    Intl.DateTimeFormat().resolvedOptions().language || '',
    Intl.DateTimeFormat().resolvedOptions().calendar || '',
    Intl.DateTimeFormat().resolvedOptions().numberingSystem || '',
  ].join('|');
}

/**
 * 產生 Fingerprint（雜湊所有特徵）
 * @returns {Promise<string>} - 64 字元 SHA-256 十六進位字串
 */
async function generateFingerprint() {
  const canvasFP = getCanvasFingerprint();
  const screenFP = getScreenFingerprint();
  const browserFP = getBrowserFingerprint();
  const localeFP = getLocaleFingerprint();

  const combined = [
    canvasFP,
    screenFP,
    browserFP,
    localeFP,
  ].join('|||');

  return sha256(combined);
}

/**
 * 取得指紋並快取到 localStorage
 * @returns {Promise<string>}
 */
async function getFingerprint() {
  try {
    let fp = localStorage.getItem('super_fp_v2');
    if (!fp) {
      fp = await generateFingerprint();
      localStorage.setItem('super_fp_v2', fp);
    }
    return fp;
  } catch (err) {
    // localStorage 不可用時，每次重新計算
    return generateFingerprint();
  }
}

/**
 * 清除快取的指紋（下次呼叫時會重新計算）
 */
function clearCache() {
  try {
    localStorage.removeItem('super_fp_v2');
  } catch (_) {
    // 忽略
  }
}

export {
  generateFingerprint,
  getFingerprint,
  clearCache,
  getCanvasFingerprint,
  getScreenFingerprint,
  getBrowserFingerprint,
  getLocaleFingerprint,
};
