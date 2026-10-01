// 左側「作品清單」面板（#pieceListBox）：新增物件鈕、批次匯出全部。

import { store } from '../state.js';
import { exportPiecePNG, exportPieceSVG } from '../canvas/preview-pane.js';
import { zipWrite } from '../pitra-zip.js';
import { announce } from '../a11y.js';
import { el, wireDropdownToggle, downloadBlob } from './dom-utils.js';
import { addPiece } from './canvas-toolbar.js';

export function wirePieceList(statusEl) {
    el('btnAddPiece').addEventListener('click', () => addPiece(statusEl));
}

// 同一個檔名底(不含副檔名)在批次匯出時可能撞名（例如多個「未命名物件」），加流水號避免互相覆蓋。
function uniqueBaseNameFactory() {
    const used = new Set();
    return function uniqueBaseName(base) {
        let name = base;
        let i = 2;
        while (used.has(name)) {
            name = `${base}-${i}`;
            i += 1;
        }
        used.add(name);
        return name;
    };
}

function setThumbExportState(pieceId, state) {
    const thumb = document.querySelector(`.piece-thumb[data-piece-id="${CSS.escape(pieceId)}"]`);
    if (!thumb) return;
    if (state) thumb.dataset.exportState = state;
    else delete thumb.dataset.exportState;
}

// 批次匯出全部物件：PNG、SVG 或兩者一起，一律打包成單一 ZIP 再下載——
// 物件一多的話逐檔跳出下載對話框既擾人、也容易被瀏覽器的多重下載限制擋掉。
async function exportAllBundle(kinds, statusEl, triggerBtn) {
    const pieces = store.project.pieces;
    if (!pieces.length) return announce(statusEl, '目前沒有任何物件可以匯出');

    triggerBtn.disabled = true;
    triggerBtn.classList.add('is-loading');
    const uniqueBaseName = uniqueBaseNameFactory();
    const entries = [];
    let skipped = 0;
    try {
        for (const piece of pieces) {
            setThumbExportState(piece.id, 'active');
            const base = uniqueBaseName((piece.name || 'piece').trim() || 'piece');
            let pieceOk = false;
            if (kinds.includes('png')) {
                const blob = await exportPiecePNG(piece);
                if (blob) {
                    entries.push({ name: `${base}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
                    pieceOk = true;
                }
            }
            if (kinds.includes('svg')) {
                const blob = await exportPieceSVG(piece);
                if (blob) {
                    entries.push({ name: `${base}.svg`, data: new Uint8Array(await blob.arrayBuffer()) });
                    pieceOk = true;
                }
            }
            if (!pieceOk) skipped += 1;
            setThumbExportState(piece.id, pieceOk ? 'done' : 'skipped');
            // 每個物件的匯出運算是同步整塊執行，沒有這個 yield 畫面會整個卡住到全部跑完，進度條也畫不出來。
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    } finally {
        triggerBtn.disabled = false;
        triggerBtn.classList.remove('is-loading');
        // 停留一下再清空狀態，讓使用者看得到「完成」的滿條，不是一閃即逝。
        setTimeout(() => {
            for (const piece of pieces) setThumbExportState(piece.id, null);
        }, 600);
    }

    if (!entries.length) return announce(statusEl, '沒有可匯出的物件（尚未設定選取範圍）');

    const zipBytes = zipWrite(entries);
    const blob = new Blob([zipBytes], { type: 'application/zip' });
    const suffix = kinds.length > 1 ? 'png-svg' : kinds[0];
    downloadBlob(blob, `${store.project.name || 'pitrace'}-${suffix}.zip`);
    const skipNote = skipped ? `，${skipped} 個物件因尚未設定選取範圍被跳過` : '';
    announce(statusEl, `已匯出 ${entries.length} 個檔案的 ZIP${skipNote}`);
}

// 物件清單標題列的「匯出全部」下拉選單：純 CSS 絕對定位 + hidden 屬性切換，不用原生 popover。
export function wireExportAllMenu(statusEl) {
    const trigger = el('btnExportAll');
    const menu = el('exportAllMenu');
    if (!trigger || !menu) return;

    // #pieceListBox 在桌面版有 overflow:hidden（用來讓內部清單自己捲動、不撐爆版面），
    // 選單原本用 position:absolute 往下彈會被這層裁掉，跟浮動工具列那個 overflow 裁切
    // 是同一種病灶，所以同樣需要 portal:true。
    const { close, toggle } = wireDropdownToggle(trigger, menu, null, { portal: true });
    trigger.addEventListener('click', toggle);

    async function runAndClose(kinds) {
        close();
        await exportAllBundle(kinds, statusEl, trigger);
    }
    el('btnExportAllPNG').addEventListener('click', () => runAndClose(['png']));
    el('btnExportAllSVG').addEventListener('click', () => runAndClose(['svg']));
    el('btnExportAllZip').addEventListener('click', () => runAndClose(['png', 'svg']));

    function syncEnabled() {
        trigger.disabled = store.project.pieces.length === 0;
    }
    store.addEventListener('project-changed', syncEnabled);
    syncEnabled();
}
