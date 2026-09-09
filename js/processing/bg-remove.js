// 去背景：用取樣背景色的 RGB 距離估算 alpha，平滑曲線過渡（避免生硬二值化邊緣），
// 藉此保留鉛筆／水彩等半透明筆觸，而非單純把「接近白色」的像素直接清成全透明。
//
// 這裡刻意只用「單一全域取樣色＋RGB 距離」這種最簡單的算法，不做 LAB 色差、不做逐像素的
// 局部背景估算（box blur）、不做連通元件孤立度抑制——這幾樣都實際試過，結果對套索選取範圍
// 貼著內容邊界的物件（局部背景估算會被範圍外的黑色透明區域污染）反而更糟：背景該去除的沒去除、
// 淡色筆跡被洗到快看不見。單一全域取樣色沒有「局部」這個概念，不會有邊界污染的問題，
// 效果穩定可預期，是實測下來對真實掃描稿最可靠的做法。
//
// computeMask() 只算 alpha、完全不碰顏色；compositeOriginalWithMask() 只讀原圖合成最終輸出。
//
// 邊緣白邊的成因：半透明的邊緣像素，其 RGB 本身就是「原稿顏色與背景色的混色」
// （掃描器反鋸齒造成），只調 alpha、不動 RGB 的話，那圈混色像素合成到非白色底
// 時仍會透出白色殘影。解法是「色彩去污染」：依 pixel = a·F + (1-a)·B 反推真正的
// 前景色 F，把背景色的成分從 RGB 中減掉。

import { store } from '../state.js';

/**
 * 把單一「去背強度」0-100 換算成內部的 threshold/softness（RGB 歐氏距離尺度，0-441 附近）。
 * strength=50（預設）對應 threshold=40、softness=24，跟這個演算法本身沿用已久、實測有效的
 * 預設值完全一致，確保滑桿停在預設位置時的效果就是原本驗證過的效果。
 * @param {number} strength 0-100
 * @returns {{threshold:number, softness:number}}
 */
export function resolveBgRemovalParams(strength) {
    const s = Math.max(0, Math.min(100, strength ?? 50)) / 100;
    const threshold = 16 + s * 48; // s=0 → 16, s=0.5 → 40, s=1 → 64
    const softness = 8 + s * 32; // s=0 → 8, s=0.5 → 24, s=1 → 40
    return { threshold, softness };
}

/**
 * 計算去背 alpha 遮罩，不改動任何像素顏色。
 * @param {ImageData} analysisImageData
 * @param {{r:number,g:number,b:number}} sampleColorOriginal 背景取樣色
 * @param {{strength:number, threshold?:number, softness?:number}} opts 去背強度 0-100；
 *   threshold/softness 有值時（舊專案保留下來的手動調校值）直接採用，優先於 strength。
 * @returns {Float32Array} 0..1，長度＝width*height
 */
export function computeMask(analysisImageData, sampleColorOriginal, opts) {
    const { data, width, height } = analysisImageData;
    const n = width * height;
    const { r: sr, g: sg, b: sb } = sampleColorOriginal;
    const { threshold, softness } =
        opts.threshold !== undefined && opts.softness !== undefined
            ? { threshold: opts.threshold, softness: opts.softness }
            : resolveBgRemovalParams(opts.strength);
    const lo = Math.max(0, threshold - softness);
    const hi = threshold + softness;
    const span = Math.max(1, hi - lo);
    // 掃描稿背景大面積均勻，多數像素的距離遠低於 lo（背景本身）或遠高於 hi（前景筆畫），
    // 只有邊緣一小圈真的落在門檻帶內才需要平滑過渡的精確距離——那部分才值得開根號。
    // 落在帶外時直接用平方距離跟 lo²/hi² 比較就能判定 smooth 是 0 還是 1，省下逐像素的 sqrt。
    const loSq = lo * lo;
    const hiSq = hi * hi;

    const mask = new Float32Array(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
        const dr = data[p] - sr;
        const dg = data[p + 1] - sg;
        const db = data[p + 2] - sb;
        const distSq = dr * dr + dg * dg + db * db;

        let smooth;
        if (distSq <= loSq) {
            smooth = 0;
        } else if (distSq >= hiSq) {
            smooth = 1;
        } else {
            const dist = Math.sqrt(distSq);
            let t = (dist - lo) / span;
            t = Math.max(0, Math.min(1, t));
            smooth = t * t * (3 - 2 * t); // smoothstep
        }
        const srcAlpha = data[p + 3] / 255;
        mask[i] = Math.min(srcAlpha, smooth);
    }
    return mask;
}

/**
 * 用原圖顏色＋算好的遮罩合成最終輸出。
 * @param {ImageData} originalImageData
 * @param {Float32Array} maskAlpha
 * @param {{r:number,g:number,b:number}} sampleColorOriginal 背景取樣色
 * @returns {ImageData}
 */
export function compositeOriginalWithMask(originalImageData, maskAlpha, sampleColorOriginal) {
    const { data, width, height } = originalImageData;
    const n = width * height;
    const { r: sr, g: sg, b: sb } = sampleColorOriginal;

    const out = new ImageData(width, height);
    const od = out.data;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
        const alpha = Math.max(0, Math.min(1, maskAlpha[i]));
        const a255 = Math.round(alpha * 255);
        if (a255 > 0 && a255 < 255) {
            od[p] = decontaminate(data[p], sr, alpha);
            od[p + 1] = decontaminate(data[p + 1], sg, alpha);
            od[p + 2] = decontaminate(data[p + 2], sb, alpha);
        } else {
            od[p] = data[p];
            od[p + 1] = data[p + 1];
            od[p + 2] = data[p + 2];
        }
        od[p + 3] = a255;
    }
    return out;
}

function decontaminate(channel, bg, alpha) {
    const f = (channel - (1 - alpha) * bg) / alpha;
    return f < 0 ? 0 : f > 255 ? 255 : Math.round(f);
}

/** 以選取範圍四周邊緣一圈像素的平均色，作為背景色的自動初始猜測。 */
export function sampleBorderColor(imageData) {
    const { data, width, height } = imageData;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    const step = Math.max(1, Math.floor(Math.min(width, height) / 200));

    const add = (x, y) => {
        const i = (y * width + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
    };

    for (let x = 0; x < width; x += step) {
        add(x, 0);
        add(x, height - 1);
    }
    for (let y = 0; y < height; y += step) {
        add(0, y);
        add(width - 1, y);
    }

    if (n === 0) return { r: 255, g: 255, b: 255 };
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/** 取樣背景色工具：在原始掃描畫布上點一下，把該像素顏色設為目前作品的背景取樣色。 */
export class EyedropperTool {
    constructor() {
        this.hoverColor = null; // { r, g, b }，滑鼠底下目前的顏色，還沒點下去前的即時預覽
        this.hoverClient = null; // { x, y }，相對畫布左上角的 CSS px 座標，drawOverlay 用螢幕座標畫色塊
        this._sampleCtx = null; // 重複使用同一個 1x1 canvas context，pointermove 頻率高不能每次都新配置
    }

    async onPointerDown(imgPt, evt, view) {
        const piece = store.getActivePiece();
        if (!piece) return view.announce('請先選取物件');
        const bitmap = await store.getScanBitmap(piece.scanId);
        if (!bitmap) return;
        const x = Math.round(imgPt.x);
        const y = Math.round(imgPt.y);
        if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return;

        const sampleCanvas = new OffscreenCanvas(1, 1);
        const ctx = sampleCanvas.getContext('2d');
        ctx.drawImage(bitmap, x, y, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

        store.updatePiece(piece.id, {
            bgRemoval: { ...piece.bgRemoval, sampleColor: { r, g, b } },
        });
        view.announce(`背景取樣色已設定為 RGB ${r}, ${g}, ${b}`);
    }

    // 即時預覽（還沒點下去）：直接用 view.bitmap（畫面上正顯示的掃描圖，一定是已經 decode 好、
    // 同步可用的），不再另外呼叫 store.getScanBitmap() ——那個是 async，pointermove 這麼高頻的
    // 事件每次都 await 一次沒有必要，也會讓預覽色塊比游標慢半拍才更新。
    onPointerMove(imgPt, evt, view) {
        const bitmap = view.bitmap;
        const x = Math.round(imgPt.x);
        const y = Math.round(imgPt.y);
        if (!bitmap || bitmap.width === 0 || x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) {
            this.hoverColor = null;
            this.hoverClient = null;
            view.requestDraw();
            return;
        }

        this._sampleCtx ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
        this._sampleCtx.clearRect(0, 0, 1, 1);
        this._sampleCtx.drawImage(bitmap, x, y, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = this._sampleCtx.getImageData(0, 0, 1, 1).data;
        this.hoverColor = { r, g, b };
        const rect = view.canvas.getBoundingClientRect();
        this.hoverClient = { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
        view.requestDraw();
    }

    // 螢幕空間畫一個跟著游標走的顏色色塊＋RGB 數值：drawOverlay 拿到的 ctx 在呼叫當下已經是
    // CSS px 座標系（scan-view.js 的 draw() 在呼叫這裡之前只設定 dpr 縮放，沒有套用平移/縮放），
    // 跟 hoverClient（同樣用 getBoundingClientRect 換算）單位一致，不用再疊加 view.tx/scale。
    drawOverlay(ctx, view) {
        if (!this.hoverColor || !this.hoverClient) return;
        const { r, g, b } = this.hoverColor;
        const swatchSize = 20;
        const gap = 16;
        const padding = 6;
        const rgbText = `${r}, ${g}, ${b}`;

        ctx.save();
        ctx.font = '12px system-ui, sans-serif';
        const textWidth = ctx.measureText(rgbText).width;
        const boxW = padding * 3 + swatchSize + textWidth;
        const boxH = padding * 2 + swatchSize;
        let boxX = this.hoverClient.x + gap;
        let boxY = this.hoverClient.y + gap;
        const rect = view.canvas.getBoundingClientRect();
        if (boxX + boxW > rect.width) boxX = this.hoverClient.x - gap - boxW;
        if (boxY + boxH > rect.height) boxY = this.hoverClient.y - gap - boxH;

        ctx.fillStyle = 'rgba(17, 17, 17, 0.85)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();

        const swatchX = boxX + padding;
        const swatchY = boxY + padding;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.roundRect(swatchX, swatchY, swatchSize, swatchSize, 4);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.fillText(rgbText, swatchX + swatchSize + padding, boxY + boxH / 2);
        ctx.restore();
    }

    onPointerLeave(view) {
        this.hoverColor = null;
        this.hoverClient = null;
        view.draw();
    }

    onCancel(view) {
        this.hoverColor = null;
        this.hoverClient = null;
    }
}
