// PDF 匯入：把 PDF 每一頁渲染成點陣圖，回傳跟一般圖片匯入相同形狀的頁面描述，
// 不碰 store——落地（決定專案命名、逐頁呼叫 store.addScan()）由呼叫端（toolbar.js）負責，
// 跟一般圖片匯入共用同一套流程；超過 MAX_SCAN_PIXELS 時也會透過 state.js 既有的
// getScanBitmap()/_downscaleScan() 延遲壓縮成 webp，PDF 匯入不需要另外處理。
//
// pdf.js 是這個專案唯一的外部函式庫依賴，透過 cdnjs 以原生 ES module 動態載入——目前 cdnjs
// 上 pdf.js 的建置只提供 .mjs（ESM），沒有 UMD 版本，所以用 import() 而不是掛 <script> 全域，
// 跟專案本身全 ES6 module 的架構一致。

const PDFJS_VERSION = '6.3.289';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/`;

// dynamic import() 沒有原生的 integrity 屬性可用（跟 <script> 標籤不同），這裡手動做等效的
// 完整性校驗：fetch→算 SHA-384→比對已鎖定的雜湊值→包成 blob: URL 再 import，防止 CDN
// 內容被竄改。兩個檔案都是單一檔案 bundle（沒有對其他檔案的 relative import），改從 blob: URL
// 載入不會破壞內部路徑解析。
const PDFJS_MAIN_SHA384 = 'z3N/QnTq7KUG0r5jEmpE9EQ2Yw9XQxeHTtq/XWs9uR7UDmdiZAI2xGZ7t151ou8z';
const PDFJS_WORKER_SHA384 = 'ZsWbdAW9R0tLHblpnT9OlTG0oDnOBndXJiKFJnsmzR2TXBm7oh5eDqIyTrxseosS';

async function verifiedBlobUrl(url, expectedSha384Base64) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下載失敗（${res.status}）：${url}`);
    const buf = await res.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-384', buf);
    const actual = btoa(String.fromCharCode(...new Uint8Array(digest)));
    if (actual !== expectedSha384Base64) {
        throw new Error(`完整性校驗失敗，CDN 內容與預期不符：${url}`);
    }
    return URL.createObjectURL(new Blob([buf], { type: 'text/javascript' }));
}

// 印表機掃描件通常是灰階/彩色點陣影像重新編碼進 PDF，固定 600 DPI 對應一般掃描器常見輸出
// 解析度即可，不需要使用者逐頁調整；DPI 是渲染時我們自己選定的已知值，不是從檔案偵測，
// 比一般點陣圖的 metadata 偵測更可靠，SVG 匯出的 mm 換算也因此更準確。
export const PDF_RENDER_DPI = 600;

let pdfjsLibPromise = null;
function loadPdfjsLib() {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = (async () => {
            const [mainUrl, workerUrl] = await Promise.all([
                verifiedBlobUrl(`${PDFJS_BASE}pdf.min.mjs`, PDFJS_MAIN_SHA384),
                verifiedBlobUrl(`${PDFJS_BASE}pdf.worker.min.mjs`, PDFJS_WORKER_SHA384),
            ]);
            const lib = await import(mainUrl);
            lib.GlobalWorkerOptions.workerSrc = workerUrl;
            return lib;
        })().catch((err) => {
            pdfjsLibPromise = null;
            throw err;
        });
    }
    return pdfjsLibPromise;
}

async function renderPageToPng(page, dpi) {
    const viewport = page.getViewport({ scale: dpi / 72 });
    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const bytes = await blob.arrayBuffer();
    return { bytes, width, height };
}

/**
 * @param {ArrayBuffer} bytes PDF 檔案位元組
 * @param {(page: number, total: number) => void} [onProgress]
 * @returns {Promise<{pageNumber: number, bytes: ArrayBuffer, width: number, height: number, dpi: number}[]>}
 */
export async function renderPdfPages(bytes, onProgress) {
    const pdfjsLib = await loadPdfjsLib();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const rendered = await renderPageToPng(page, PDF_RENDER_DPI);
        pages.push({ pageNumber: i, ...rendered, dpi: PDF_RENDER_DPI });
        onProgress?.(i, pdf.numPages);
    }
    return pages;
}
