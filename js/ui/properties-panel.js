// 右側「屬性面板」：旋轉、矩形/套索選取範圍、去背參數、SVG 輸出設定、OCR 名稱建議、單一物件輸出。

import { store } from '../state.js';
import { rotatePieceBy, selectionBounds } from '../tools/transform.js';
import { exportPiecePNG, exportPieceSVG, renderOriginalPreview } from '../canvas/preview-pane.js';
import { sampleBorderColor } from '../processing/bg-remove.js';
import { announce } from '../a11y.js';
import { loopsFromSelection } from '../canvas/selection-geometry.js';
import { flattenLoopsAsync } from '../workers/selection-worker-client.js';
import { el, bindRangeNumberPair, downloadBlob } from './dom-utils.js';

// OCR 辨識文字建議物件名稱：故意不當常駐依賴，只在使用者按下辨識鈕時才動態載入 Tesseract.js
// （純瀏覽器端 WASM 執行、不上傳圖片），避免拖慢一般使用者用不到這個功能時的啟動速度。
let tesseractLoadPromise = null;
function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (!tesseractLoadPromise) {
        tesseractLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
            script.integrity = 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F';
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = () => {
                tesseractLoadPromise = null;
                reject(new Error('OCR 引擎載入失敗，請檢查網路連線'));
            };
            document.head.appendChild(script);
        });
    }
    return tesseractLoadPromise;
}

// 名稱欄位目前顯示值跟已存檔的 piece.name 不一致時（手動輸入中，或 OCR 剛帶入建議），
// 顯示右側內嵌的套用／還原鈕；一致時（含還沒選取物件）就隱藏。OCR 建議、手動輸入、
// 套用、還原、切換物件五個路徑都要呼叫這個函式保持按鈕可見性同步。
function updateNameInputActions() {
    const piece = store.getActivePiece();
    const input = el('pieceNameInput');
    const actions = el('pieceNameActions');
    actions.hidden = !piece || input.value.trim() === piece.name;
}

export function wirePropertiesPanel(statusEl) {
    el('btnRotateLeft').addEventListener('click', () => {
        const piece = store.getActivePiece();
        if (!piece) return announce(statusEl, '請先選取物件');
        rotatePieceBy(piece.id, -90);
        announce(statusEl, `已向左旋轉，目前角度 ${piece.rotation}°`);
    });
    el('btnRotateRight').addEventListener('click', () => {
        const piece = store.getActivePiece();
        if (!piece) return announce(statusEl, '請先選取物件');
        rotatePieceBy(piece.id, 90);
        announce(statusEl, `已向右旋轉，目前角度 ${piece.rotation}°`);
    });
    const syncRotateButtons = () => {
        const hasPiece = !!store.getActivePiece();
        el('btnRotateLeft').disabled = !hasPiece;
        el('btnRotateRight').disabled = !hasPiece;
    };
    store.addEventListener('active-piece-changed', syncRotateButtons);
    syncRotateButtons();

    // 旋轉角度輸入框：直接輸入變更沿用既有的正規化寫法（-180~180 顯示值換算成 0~360 儲存值）；
    // ±1°/±15° 微調鈕與滾輪（見下方）共用同一個 applyRotation，全部改的是同一個 piece.rotation 欄位。
    function applyRotation(v) {
        const piece = store.getActivePiece();
        if (!piece) return;
        store.updatePiece(piece.id, { rotation: ((v % 360) + 360) % 360 });
    }
    el('rotationValue').addEventListener('change', (evt) => {
        const n = Number(evt.target.value);
        if (!Number.isNaN(n)) applyRotation(n);
    });
    function nudgeRotation(delta, evt) {
        const piece = store.getActivePiece();
        if (!piece) return;
        const step = evt.shiftKey ? 15 : 1;
        const dispRotation = piece.rotation > 180 ? piece.rotation - 360 : piece.rotation;
        applyRotation(dispRotation + delta * step);
    }
    el('btnRotateMinus').addEventListener('click', (evt) => nudgeRotation(-1, evt));
    el('btnRotatePlus').addEventListener('click', (evt) => nudgeRotation(1, evt));
    // passive:false 是能呼叫 preventDefault() 阻止頁面隨滾輪捲動的必要條件。
    // 觸控板／高輪詢率滑鼠的 wheel 事件觸發頻率遠高於畫面更新頻率，比照 bindRangeNumberPair
    // 用 rAF 節流：同一畫格內的多次滾動先加總角度，到了才套用一次 updatePiece，
    // 不要每個 wheel 事件都各自觸發一次重繪／自動儲存排程。
    let rotationWheelRaf = null;
    let rotationWheelAccum = 0;
    let rotationWheelPieceId = null;
    el('rotationValue').addEventListener('wheel', (evt) => {
        evt.preventDefault();
        const activePiece = store.getActivePiece();
        if (!activePiece) return;
        // 累積尚未套用時若切到別的物件（例如觸控板慣性捲動尾段事件還在到達，使用者已經
        // 點了別的縮圖），之前累積的角度屬於前一個物件，直接歸零重新起算，避免套到新物件上。
        if (rotationWheelPieceId !== null && rotationWheelPieceId !== activePiece.id) {
            rotationWheelAccum = 0;
        }
        rotationWheelPieceId = activePiece.id;
        const step = evt.shiftKey ? 15 : 1;
        rotationWheelAccum += evt.deltaY < 0 ? step : -step;
        if (rotationWheelRaf != null) return;
        rotationWheelRaf = requestAnimationFrame(() => {
            rotationWheelRaf = null;
            const delta = rotationWheelAccum;
            const targetPieceId = rotationWheelPieceId;
            rotationWheelAccum = 0;
            rotationWheelPieceId = null;
            const piece = store.getActivePiece();
            // flush 當下作用中物件已經跟累積角度時不是同一個，這批角度作廢，不套用到別的物件上。
            if (!piece || piece.id !== targetPieceId) return;
            const dispRotation = piece.rotation > 180 ? piece.rotation - 360 : piece.rotation;
            applyRotation(dispRotation + delta);
        });
    }, { passive: false });

    function commitPieceName(rawValue) {
        const piece = store.getActivePiece();
        if (!piece) return;
        store.updatePiece(piece.id, { name: rawValue.trim() || '未命名物件' });
    }
    el('pieceNameInput').addEventListener('change', (evt) => commitPieceName(evt.target.value));
    el('pieceNameInput').addEventListener('input', updateNameInputActions);
    // 按套用／還原鈕會先讓輸入框失焦，原生 change 事件搶在 click 之前觸發，等於先把
    // 未確認的內容存檔，「還原」就會變成還原到剛剛才被存檔的同一個值、等於沒作用。
    // mousedown 階段 preventDefault 讓輸入框不失焦，change 不會被提前觸發。
    el('pieceNameActions').addEventListener('mousedown', (evt) => evt.preventDefault());
    el('btnPieceNameApply').addEventListener('click', () => commitPieceName(el('pieceNameInput').value));
    el('btnPieceNameRevert').addEventListener('click', () => {
        const piece = store.getActivePiece();
        if (!piece) return;
        el('pieceNameInput').value = piece.name;
        updateNameInputActions();
    });

    ['selX', 'selY', 'selW', 'selH'].forEach((id) => {
        el(id).addEventListener('change', () => {
            const piece = store.getActivePiece();
            if (!piece) return;
            const rect = {
                x: Number(el('selX').value) || 0,
                y: Number(el('selY').value) || 0,
                w: Math.max(1, Number(el('selW').value) || 1),
                h: Math.max(1, Number(el('selH').value) || 1),
            };
            store.updatePiece(piece.id, { selection: { type: 'rect', rect } });
        });
    });

    el('btnFlattenLasso').addEventListener('click', async () => {
        const piece = store.getActivePiece();
        if (!piece) return;
        const loops = loopsFromSelection(piece.selection);
        if (loops.length <= 1) return;
        const btn = el('btnFlattenLasso');
        // 平面化的點陣化＋描邊＋巢狀深度比對搬到 Worker 執行（見 selection-worker.js），
        // 這裡先切成忙碌狀態，避免使用者以為點擊沒反應；失敗時才需要手動還原 disabled，
        // 成功時交給 store 的 piece-changed → syncPropertiesPanel 依新的區塊數重新判斷。
        btn.disabled = true;
        btn.classList.add('is-loading');
        try {
            const flattened = await flattenLoopsAsync(loops);
            store.updatePiece(piece.id, { selection: { type: 'lasso', loops: flattened } });
            announce(statusEl, `已平面化選取，合併為 ${flattened.length} 個區塊`);
        } catch (err) {
            btn.disabled = false;
            announce(statusEl, '平面化失敗，請稍後再試');
        } finally {
            btn.classList.remove('is-loading');
        }
    });

    el('btnClearLasso').addEventListener('click', () => {
        const piece = store.getActivePiece();
        if (!piece || piece.selection.type !== 'lasso' || !piece.selection.loops?.length) return;
        store.updatePiece(piece.id, { selection: { type: 'lasso', loops: [] } });
        announce(statusEl, '已清除所有套索區塊');
    });

    el('btnClearErase').addEventListener('click', () => {
        const piece = store.getActivePiece();
        if (!piece || !piece.eraseStrokes?.length) return;
        store.updatePiece(piece.id, { eraseStrokes: [] });
        announce(statusEl, '已清除所有橡皮擦筆觸');
    });

    el('bgRemovalEnabled').addEventListener('change', (evt) => {
        const piece = store.getActivePiece();
        if (!piece) return;
        store.updatePiece(piece.id, { bgRemoval: { ...piece.bgRemoval, enabled: evt.target.checked } });
        syncBgStrengthDisabledState(evt.target.checked);
    });

    ['bgSampleR', 'bgSampleG', 'bgSampleB'].forEach((id) => {
        el(id).addEventListener('change', () => {
            const piece = store.getActivePiece();
            if (!piece) return;
            const sampleColor = {
                r: Math.min(255, Math.max(0, Number(el('bgSampleR').value) || 0)),
                g: Math.min(255, Math.max(0, Number(el('bgSampleG').value) || 0)),
                b: Math.min(255, Math.max(0, Number(el('bgSampleB').value) || 0)),
            };
            store.updatePiece(piece.id, { bgRemoval: { ...piece.bgRemoval, sampleColor } });
        });
    });

    el('btnAutoSampleBg').addEventListener('click', async () => {
        const piece = store.getActivePiece();
        if (!piece) return announce(statusEl, '請先選取物件');
        const bitmap = await store.getScanBitmap(piece.scanId);
        const bounds = selectionBounds(piece);
        if (!bitmap || !bounds || bounds.w <= 0 || bounds.h <= 0) {
            return announce(statusEl, '請先設定選取範圍');
        }
        const x = Math.max(0, Math.round(bounds.x));
        const y = Math.max(0, Math.round(bounds.y));
        const w = Math.min(bitmap.width - x, Math.round(bounds.w));
        const h = Math.min(bitmap.height - y, Math.round(bounds.h));
        const c = new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
        const cctx = c.getContext('2d');
        cctx.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
        const color = sampleBorderColor(cctx.getImageData(0, 0, w, h));
        store.updatePiece(piece.id, { bgRemoval: { ...piece.bgRemoval, sampleColor: color } });
        announce(statusEl, `已自動取樣背景色 RGB ${color.r}, ${color.g}, ${color.b}`);
    });

    bindRangeNumberPair('bgStrength', 'bgStrengthValue', (n) => {
        const piece = store.getActivePiece();
        if (!piece) return;
        // 手動拉動滑桿代表使用者要用新的單一強度模型取代舊專案帶進來的 threshold/softness
        // 手動調校值——不清掉的話 computeMask() 會繼續優先採用舊值，滑桿會變得像沒作用一樣。
        const bgRemoval = { ...piece.bgRemoval, strength: n };
        delete bgRemoval.threshold;
        delete bgRemoval.softness;
        store.updatePiece(piece.id, { bgRemoval });
    });

    bindRangeNumberPair('bgDespeckle', 'bgDespeckleValue', (n) => {
        const piece = store.getActivePiece();
        if (!piece) return;
        store.updatePiece(piece.id, { bgRemoval: { ...piece.bgRemoval, despeckle: n } });
    });

    bindRangeNumberPair('bgStrokeEnhance', 'bgStrokeEnhanceValue', (n) => {
        const piece = store.getActivePiece();
        if (!piece) return;
        store.updatePiece(piece.id, { bgRemoval: { ...piece.bgRemoval, strokeEnhance: n } });
    });

    el('svgVectorEnabled').addEventListener('change', (evt) => {
        const piece = store.getActivePiece();
        if (!piece) return;
        store.updatePiece(piece.id, { svgExport: { ...piece.svgExport, enabled: evt.target.checked } });
    });

    bindRangeNumberPair('svgSimplify', 'svgSimplifyValue', (n) => {
        const piece = store.getActivePiece();
        if (!piece) return;
        store.updatePiece(piece.id, { svgExport: { ...piece.svgExport, simplifyTolerance: n } });
    });

    el('scanDpiInput').addEventListener('change', (evt) => {
        const piece = store.getActivePiece();
        if (!piece) return;
        const raw = evt.target.value;
        store.setScanDpi(piece.scanId, raw ? Number(raw) : null);
    });

    el('btnExportPNG').addEventListener('click', async () => {
        const piece = store.getActivePiece();
        if (!piece) return announce(statusEl, '請先選取物件');
        const btnExportPNG = el('btnExportPNG');
        btnExportPNG.disabled = true;
        btnExportPNG.classList.add('is-loading');
        let blob;
        try {
            blob = await exportPiecePNG(piece);
        } finally {
            btnExportPNG.disabled = false;
            btnExportPNG.classList.remove('is-loading');
        }
        if (!blob) return announce(statusEl, '尚未設定選取範圍，無法匯出');
        const filename = `${(piece.name || 'piece').trim()}.png`;
        downloadBlob(blob, filename);
        announce(statusEl, `已匯出 ${filename}`);
    });

    el('btnExportSVG').addEventListener('click', async () => {
        const piece = store.getActivePiece();
        if (!piece) return announce(statusEl, '請先選取物件');
        const btnExportSVG = el('btnExportSVG');
        btnExportSVG.disabled = true;
        btnExportSVG.classList.add('is-loading');
        let blob;
        try {
            blob = await exportPieceSVG(piece);
        } finally {
            btnExportSVG.disabled = false;
            btnExportSVG.classList.remove('is-loading');
        }
        if (!blob) return announce(statusEl, '尚未設定選取範圍，無法匯出');
        const filename = `${(piece.name || 'piece').trim()}.svg`;
        downloadBlob(blob, filename);
        announce(statusEl, `已匯出 ${filename}`);
    });
}

function renderLassoLoopList(container, piece, statusEl) {
    container.innerHTML = '';
    const loops = piece.selection.loops || [];
    if (!loops.length) {
        const empty = document.createElement('div');
        empty.className = 'ts-text is-description';
        empty.textContent = '尚未繪製任何套索區塊，請在工作區拖曳滑鼠圈選';
        container.appendChild(empty);
        return;
    }
    loops.forEach((loop, i) => {
        const row = document.createElement('div');
        row.className = 'lasso-loop-row';

        const label = document.createElement('span');
        label.className = 'ts-text';
        const modeLabel = loop.mode === 'subtract' ? '減選' : '加選';
        label.textContent = `區塊 ${i + 1}（${modeLabel}・${loop.path.length} 個節點）`;
        row.appendChild(label);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'ts-button is-icon is-small';
        delBtn.setAttribute('aria-label', `刪除套索區塊 ${i + 1}`);
        delBtn.innerHTML = '<span class="ts-icon is-xmark-icon" aria-hidden="true"></span>';
        delBtn.addEventListener('click', () => {
            const next = loops.slice();
            next.splice(i, 1);
            store.updatePiece(piece.id, { selection: { type: 'lasso', loops: next } });
            announce(statusEl, `已刪除套索區塊 ${i + 1}`);
        });
        row.appendChild(delBtn);

        container.appendChild(row);
    });
}

// 去背關閉時去背強度／去除雜點／增強筆畫都完全沒有可見效果，一併停用避免使用者疑惑。
function syncBgStrengthDisabledState(bgRemovalEnabled) {
    const disabled = !bgRemovalEnabled;
    el('bgStrength').disabled = disabled;
    el('bgStrengthValue').disabled = disabled;
    el('bgDespeckle').disabled = disabled;
    el('bgDespeckleValue').disabled = disabled;
    el('bgStrokeEnhance').disabled = disabled;
    el('bgStrokeEnhanceValue').disabled = disabled;
}

export function syncPropertiesPanel(statusEl, fields) {
    const piece = store.getActivePiece();
    const emptyEl = el('propertiesEmptyState');
    if (!piece) {
        if (emptyEl) emptyEl.style.display = '';
        el('propertiesBody').style.display = 'none';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    el('propertiesBody').style.display = '';

    const nameInput = el('pieceNameInput');
    if (document.activeElement !== nameInput) {
        nameInput.value = piece.name;
    }
    updateNameInputActions();
    const dispRotation = Math.round((piece.rotation > 180 ? piece.rotation - 360 : piece.rotation) * 10) / 10;
    el('rotationValue').value = String(dispRotation);

    const isRect = piece.selection.type === 'rect';
    el('rectFieldsGroup').style.display = isRect ? '' : 'none';
    el('lassoFieldsGroup').style.display = isRect ? 'none' : '';

    if (isRect) {
        const r = piece.selection.rect;
        el('selX').value = r ? Math.round(r.x) : '';
        el('selY').value = r ? Math.round(r.y) : '';
        el('selW').value = r ? Math.round(r.w) : '';
        el('selH').value = r ? Math.round(r.h) : '';
    } else {
        // renderLassoLoopList 會整批 innerHTML='' 重建清單 DOM。piece-changed 不是只有選取範圍變動
        // 才會觸發（拖動去背強度／旋轉數值等滑桿也會經由 updatePiece 一路發到這裡），
        // fields 未提供時（active-piece-changed／初次渲染）視為「什麼都可能變了」整批重建，
        // 其餘情況只有 fields 真的包含 selection 才需要重建，避免跟選取範圍無關的欄位變動
        // 也把整份套索清單砍掉重蓋一次。
        if (!fields || fields.includes('selection')) {
            renderLassoLoopList(el('lassoLoopList'), piece, statusEl);
        }
        el('btnClearLasso').disabled = !piece.selection.loops?.length;
        el('btnFlattenLasso').disabled = (piece.selection.loops?.length ?? 0) <= 1;
    }

    el('eraseStrokeStatus').textContent = piece.eraseStrokes?.length ? '已標記擦除區域' : '尚未使用橡皮擦';
    el('btnClearErase').disabled = !piece.eraseStrokes?.length;

    el('bgRemovalEnabled').checked = piece.bgRemoval.enabled;
    syncBgStrengthDisabledState(piece.bgRemoval.enabled);
    el('bgSampleR').value = piece.bgRemoval.sampleColor.r;
    el('bgSampleG').value = piece.bgRemoval.sampleColor.g;
    el('bgSampleB').value = piece.bgRemoval.sampleColor.b;
    el('bgSampleSwatch').style.backgroundColor = `rgb(${piece.bgRemoval.sampleColor.r}, ${piece.bgRemoval.sampleColor.g}, ${piece.bgRemoval.sampleColor.b})`;
    el('bgStrength').value = piece.bgRemoval.strength ?? 50;
    el('bgStrengthValue').value = piece.bgRemoval.strength ?? 50;
    el('bgDespeckle').value = piece.bgRemoval.despeckle ?? 0;
    el('bgDespeckleValue').value = piece.bgRemoval.despeckle ?? 0;
    el('bgStrokeEnhance').value = piece.bgRemoval.strokeEnhance ?? 0;
    el('bgStrokeEnhanceValue').value = piece.bgRemoval.strokeEnhance ?? 0;

    el('svgVectorEnabled').checked = piece.svgExport?.enabled ?? false;
    el('svgSimplify').value = piece.svgExport?.simplifyTolerance ?? 0.75;
    el('svgSimplifyValue').value = piece.svgExport?.simplifyTolerance ?? 0.75;

    const scan = store.project.scans.find((s) => s.id === piece.scanId);
    el('scanDpiInput').value = scan?.dpi ?? '';
}

// 辨識目前物件裁切後的內容文字，直接填進名稱欄位當作預覽建議；輸入框右側會冒出套用／
// 還原鈕，使用者可以明確選擇，也可以直接按 Enter 套用；不理會（離開欄位或切換物件）
// 就視為放棄，還原成原本名稱。
export function wireOcrNameSuggestion(statusEl) {
    const btn = el('btnOcrSuggestName');
    btn.addEventListener('click', async () => {
        const piece = store.getActivePiece();
        if (!piece) return announce(statusEl, '請先選取物件');
        btn.disabled = true;
        btn.classList.add('is-loading');
        announce(statusEl, '辨識中，第一次使用需要先下載 OCR 引擎…');
        try {
            const [canvas] = await Promise.all([
                renderOriginalPreview(piece, { maxDim: 0 }),
                loadTesseract(),
            ]);
            if (!canvas) throw new Error('沒有可辨識的內容');
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            const { data: { text } } = await Tesseract.recognize(blob, 'chi_tra+eng');
            const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, 40);
            if (!cleaned) {
                announce(statusEl, '沒有辨識到文字');
                return;
            }
            el('pieceNameInput').value = cleaned;
            updateNameInputActions();
            announce(statusEl, `辨識結果：「${cleaned}」，可按輸入框內的套用／還原鈕決定，或按 Enter 套用；不理會（離開或切換物件）就等於放棄`);
        } catch (err) {
            announce(statusEl, `辨識失敗：${err.message}`);
        } finally {
            btn.disabled = false;
            btn.classList.remove('is-loading');
        }
    });
}
