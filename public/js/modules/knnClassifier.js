// 🤖 public/js/modules/knnClassifier.js
// KNN 分類器：使用 MobileNet 特徵向量進行商品識別
// 對應 [todo_progress.md F-03](../../todo_progress.md)
// K=5，閾值 0.7，可序列化至 IndexedDB 並還原

'use strict';

const DB_NAME = 'super-tracker-knn';
const STORE_NAME = 'vectors';
const DB_VERSION = 1;

/** K 近鄰數量 */
const K = 5;

/** 信心度閾值（≥ 此值視為命中）*/
const CONFIDENCE_THRESHOLD = 0.7;

/**
 * 開啟 IndexedDB 連線
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('productName', 'productName', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * 從圖片提取 MobileNet 特徵向量
 * @param {HTMLImageElement} img - 圖片元素
 * @param {Object} mobilenetModel - MobileNet 模型實例
 * @returns {Promise<Float32Array>} - 1024 維特徵向量
 */
async function extractFeatures(img, mobilenetModel) {
  //確保 TF.js 已載入
  if (typeof window.tf === 'undefined') {
    throw new Error('TensorFlow.js 未載入，請先呼叫 loadMobileNetWithRetry()');
  }

  //將圖片縮放至 224x224（MobileNet 輸入尺寸）
  const canvas = document.createElement('canvas');
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 224, 224);

  // 轉為 TF.js張量並正規化
  const tensor = window.tf.browser.fromPixels(canvas);
  const normalized = window.tf.cast(
    window.tf.div(window.tf.resizeBilinear(tensor, [224, 224]), 255),
    'float32'
  );

  // 提取特徵向量（不含最後分類層）
  const embeddings = mobilenetModel.model.execute(normalized);
  const values = await embeddings.data();
  const vector = new Float32Array(values);

  // 釋放張量記憶體
  window.tf.dispose([tensor, normalized, embeddings]);

  return vector;
}

/**
 * 儲存特徵向量到 IndexedDB
 * @param {string} productName - 商品名稱
 * @param {Float32Array} vector - 特徵向量
 * @param {Object} [metadata] - 額外資料
 * @returns {Promise<number>} - 新增記錄的 ID
 */
async function saveVector(productName, vector, metadata = {}) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add({
      productName,
      vector: Array.from(vector),
      metadata,
      createdAt: Date.now(),
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 取得所有已儲存的特徵向量
 * @returns {Promise<Array>}
 */
async function getAllVectors() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 計算兩個特徵向量的歐氏距離
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
function euclideanDistance(a, b) {
  if (a.length !== b.length) {
    throw new Error('向量維度不符');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * 計算相似度（0~1，1 為完全相同）
 * @param {number} distance
 * @returns {number}
 */
function distanceToSimilarity(distance) {
  // 使用指數衰減將距離轉為相似度
  // 假設最大距離約30（足夠不同），衰減係數 0.1
  return Math.exp(-distance * 0.1);
}

/**
 * KNN 分類預測
 * @param {Float32Array} queryVector - 查詢向量
 * @param {Array} [candidates] -候選向量（不傳則從 IndexedDB 讀取）
 * @returns {Promise<{name: string, confidence: number, distance: number, isHit: boolean}>}
 */
async function predict(queryVector, candidates = null) {
  const items = candidates ?? (await getAllVectors());

  if (items.length === 0) {
    return { name: null, confidence: 0, distance: Infinity, isHit: false };
  }

  // 計算 query與所有候選的距離
  const scored = items.map((item) => {
    const storedVector = new Float32Array(item.vector);
    const distance = euclideanDistance(queryVector, storedVector);
    const similarity = distanceToSimilarity(distance);
    return {
      name: item.productName,
      distance,
      similarity,
    };
  });

  // 取 K 個最近鄰
  scored.sort((a, b) => a.distance - b.distance);
  const neighbors = scored.slice(0, K);

  // 多數決：統計每個名稱的出現次數
  const voteCount = {};
  let totalSimilarity = 0;
  neighbors.forEach((n) => {
    voteCount[n.name] = (voteCount[n.name] || 0) + 1;
    totalSimilarity += n.similarity;
  });

  //取得票數最多的名稱
  let maxVotes = 0;
  let winnerName = null;
  for (const [name, votes] of Object.entries(voteCount)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      winnerName = name;
    }
  }

  //計算平均信心度
  const avgSimilarity = totalSimilarity / neighbors.length;
  const voteRatio = maxVotes / K;
  const confidence = (avgSimilarity + voteRatio) / 2;

  return {
    name: winnerName,
    confidence,
    distance: neighbors[0]?.distance ?? Infinity,
    isHit: confidence >= CONFIDENCE_THRESHOLD,
  };
}

/**
 * 將新商品加入訓練集
 * @param {string} productName
 * @param {HTMLImageElement} img
 * @param {Object} mobilenetModel
 * @returns {Promise<number>}
 */
async function trainProduct(productName, img, mobilenetModel) {
  const vector = await extractFeatures(img, mobilenetModel);
  return saveVector(productName, vector);
}

/**
 * 清除所有訓練資料
 * @returns {Promise<boolean>}
 */
async function clearTrainingData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => {
      console.log('[KNNClassifier] 訓練資料已清除');
      resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 取得訓練集大小
 * @returns {Promise<number>}
 */
async function getTrainingCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export {
  extractFeatures,
  saveVector,
  getAllVectors,
  predict,
  trainProduct,
  clearTrainingData,
  getTrainingCount,
  K,
  CONFIDENCE_THRESHOLD,
  DB_NAME,
  STORE_NAME,
};
