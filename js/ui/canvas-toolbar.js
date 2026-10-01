// 畫布區：#scanPaneBox 標題列（復原/重做/全螢幕）與畫布內浮動的「編輯工具」列
// （.canvas-floating-toolbar：新增物件、工具選取、縮放）。

import { store } from '../state.js';
import { announce } from '../a11y.js';
import { el, wireDropdownToggle, bindRangeNumberPair } from './dom-utils.js';

export function addPiece(statusEl) {
    if (!store.activeScanId) return announce(statusEl, '請先匯入圖片');
    store.addPiece(store.activeScanId);
    announce(statusEl, '已新增物件，請框選範圍');
}

// 左側工作區「單獨全螢幕」模式：靠 CSS 讓 #scanPaneBox 本身 position:fixed;inset:0 撐滿畫面，
// 標題列（undo/redo/focus）與畫布浮動列（工具/縮放）都物理上活在 #scanPaneBox 底下，
// 因此會被一起帶進全螢幕，不需要另外搬移或重新綁定事件。
function wireFocusMode(scanView) {
    const btn = el('btnFocusMode');
    const mainEl = document.getElementById('main-content');
    const icon = btn.querySelector('.ts-icon');

    function refit() {
        requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
            scanView.fitToView();
        });
    }

    function setFocusMode(on) {
        mainEl.classList.toggle('is-focus-mode', on);
        btn.setAttribute('aria-pressed', String(on));
        const label = on ? '結束全螢幕工作區' : '切換全螢幕工作區';
        btn.setAttribute('aria-label', label);
        btn.title = label;
        icon.className = `ts-icon ${on ? 'is-compress-icon' : 'is-expand-icon'}`;
        refit();
    }

    btn.addEventListener('click', () => setFocusMode(!mainEl.classList.contains('is-focus-mode')));

    document.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape' && mainEl.classList.contains('is-focus-mode')) setFocusMode(false);
    });
}

// #scanPaneBox 標題列：復原/重做 + 全螢幕工作區切換。
export function wireScanPaneHeader(scanView, statusEl) {
    el('btnUndo').addEventListener('click', () => {
        announce(statusEl, store.undo() ? '已復原' : '沒有可復原的步驟');
    });
    el('btnRedo').addEventListener('click', () => {
        announce(statusEl, store.redo() ? '已重做' : '沒有可重做的步驟');
    });
    const syncHistoryButtons = () => {
        el('btnUndo').disabled = !store.canUndo;
        el('btnRedo').disabled = !store.canRedo;
    };
    store.addEventListener('history-changed', syncHistoryButtons);
    syncHistoryButtons();

    wireFocusMode(scanView);
}

// 浮動工具列在容器變窄時的優先權收合：擠不下就把優先權較低（data-collapse-priority 數字
// 較小）的整顆按鈕完整地收進「更多工具」選單，可見按鈕永遠維持原始大小，不靠壓縮，也
// 不需要橫向捲動工具列才找得到——比照 Figma 窄寬度工具列的做法。用 ResizeObserver 量
// 工具列自己的實際寬度（不是 window 寬度），因為可用寬度還受得到使用者可拖曳的欄寬拉桿
// 影響，CSS viewport breakpoint 沒辦法正確反映。
function wireToolbarOverflow() {
    const bar = document.querySelector('.canvas-floating-toolbar');
    const trigger = el('btnToolbarOverflow');
    const wrap = el('toolbarOverflowWrap');
    const menu = el('toolbarOverflowMenu');
    if (!bar || !trigger || !wrap || !menu) return;

    const units = Array.from(bar.querySelectorAll('[data-collapse-priority]'))
        .sort((a, b) => Number(a.dataset.collapsePriority) - Number(b.dataset.collapsePriority));
    // 優先權 -> 該層對應的選單代理按鈕（一層可以對應多顆，例如「其他工具」整叢一起收合時，
    // 平移／取樣背景色／橡皮擦三顆都要各自在選單裡露出）。代理按鈕直接呼叫真正控制項的
    // .click()，沿用它原本的 disabled 狀態／事件邏輯，不用另外複製一份判斷。
    const proxies = {
        1: [{ menuId: 'overflowAddPiece', targetId: 'btnAddPieceFloating' }],
        2: [{ menuId: 'overflowZoomFit', targetId: 'btnZoomFit' }],
        3: [
            { menuId: 'overflowPan', targetId: 'tool-pan' },
            { menuId: 'overflowEyedropper', targetId: 'tool-eyedropper' },
            { menuId: 'overflowEraser', targetId: 'tool-eraser' },
        ],
        // 前三層在 #scanPaneBox 被拉到最窄（見 resizable-columns.js 的 MIN_SCAN）時，實測還會
        // 差最後一小截才放得下，這層當最後防線確保無論如何都不需要橫向捲動就能用完整按鈕。
        4: [{ menuId: 'overflowZoomIn', targetId: 'btnZoomIn' }],
    };
    const allProxies = Object.values(proxies).flat();

    const { toggle, close } = wireDropdownToggle(trigger, menu, (isOpen) => {
        if (!isOpen) return;
        // 每次開選單都重新同步 disabled 狀態，不管是哪一顆代理鈕——真正控制項是否可用
        // 會隨當下有沒有匯入圖片變動，選單項目要如實反映，不然點了看似可點的項目卻沒反應。
        allProxies.forEach(({ menuId, targetId }) => { el(menuId).disabled = el(targetId).disabled; });
    }, { portal: true });
    trigger.addEventListener('click', toggle);

    for (const { menuId, targetId } of allProxies) {
        el(menuId).addEventListener('click', () => {
            el(targetId).click();
            close();
            trigger.focus();
        });
    }

    // 每次都先全部展開回原始大小再重新量寬度，而不是在既有收合狀態上做增量判斷——
    // 收合層級只有幾層，重算成本很低，換來的是不管容器寬度怎麼變化（拖拉桿、縮視窗）
    // 都能收斂到同一個穩定結果，不用擔心增量邏輯漏判某個中間狀態。
    function applyCollapse() {
        units.forEach((u) => u.style.removeProperty('display'));
        allProxies.forEach(({ menuId }) => { el(menuId).hidden = true; });
        // 先在觸發鈕還藏著的狀態量一次：全部按鈕完整展開、不含「更多工具」鈕本身寬度，
        // 這樣才放得下的話就完全不用收合，觸發鈕也不用出現——不然觸發鈕一開始就佔位量寬度，
        // 會白白少算出可以完整顯示的那 40 幾 px，容器明明夠寬也被誤判成需要收合。
        wrap.hidden = true;
        if (bar.scrollWidth <= bar.clientWidth) {
            if (!menu.hidden) close();
            return;
        }
        // 展開後真的放不下，才需要收合，這種情況下「更多工具」鈕勢必得跟著露出來，
        // 從這裡開始把它的寬度也算進判斷式，收合迴圈才會收到真正夠用為止。
        wrap.hidden = false;

        // units 已依 data-collapse-priority 由小到大排序，數字愈小代表愈該優先被收合，
        // 所以要從陣列開頭（priority 1）往後收，不是從尾端——尾端是數字最大、最後才該收的那層。
        //
        // 量測階段：先把目前的溢出量、每顆候選按鈕的寬度全部讀完（純讀取，中間不穿插任何
        // style 寫入），瀏覽器可以一次算完這些 layout 值；用累加寬度估算要收到第幾顆才夠，
        // 而不是原本「收一顆、量一次 scrollWidth」的寫法——那種讀寫交錯每一顆都會逼出一次
        // 同步 reflow。
        let overflow = bar.scrollWidth - bar.clientWidth;
        const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
        let collapseCount = 0;
        for (let i = 0; i < units.length && overflow > 0; i++) {
            overflow -= units[i].getBoundingClientRect().width + gap;
            collapseCount = i + 1;
        }

        // 寫入階段：一次把估算出需要收合的按鈕全部設成 display:none，中間不再穿插寬度讀取。
        for (let i = 0; i < collapseCount; i++) {
            const priority = units[i].dataset.collapsePriority;
            units[i].style.display = 'none';
            proxies[priority].forEach(({ menuId }) => { el(menuId).hidden = false; });
        }

        // 保險：寬度估算沒算到的邊界效應（subpixel 捨入等）導致還是放不下，才退回逐顆收合＋
        // 重新量測——這是罕見的補漏路徑，不是常態執行路徑，一般情況下面這個迴圈不會跑。
        for (let i = collapseCount; i < units.length && bar.scrollWidth > bar.clientWidth; i++) {
            const priority = units[i].dataset.collapsePriority;
            units[i].style.display = 'none';
            proxies[priority].forEach(({ menuId }) => { el(menuId).hidden = false; });
        }
    }

    // 觀察的不是 bar 自己，是它 position:absolute 定位所依據的父層 .pane-canvas-wrap（bar 的
    // max-width 是 calc(100% - 2rem)，這個 100% 就是量它的寬度）。bar 本身沒有明確 width，收合到
    // 只剩內容需要的寬度後，即使父層之後變寬，bar 自己的 border-box 也不會再變——因為它已經
    // 小於新的 max-width 上限，不再被撐開。只盯著 bar 會導致容器變寬後收合狀態永遠無法還原。
    new ResizeObserver(applyCollapse).observe(bar.parentElement);
    applyCollapse();
}

// 選取模式彈出選單：比照「預覽模式」用 menuitemradio 按鈕 + is-selected，wireDropdownToggle
// 統一開關，選定即關閉選單。觸發鈕圖示固定是 chevron-down，aria-label/tooltip 即時反映目前模式。
const selectionModeLabels = { add: '加選', subtract: '減選', new: '取代全部' };

function wireSelectionModeMenu() {
    const trigger = el('btnSelectionModeMenu');
    const menu = el('selectionModeMenu');
    if (!trigger || !menu) return;
    const items = menu.querySelectorAll('button[data-mode]');

    function syncTrigger() {
        const mode = store.selectionMode;
        const label = `選取模式（目前：${selectionModeLabels[mode] || '加選'}）`;
        trigger.setAttribute('aria-label', label);
        trigger.setAttribute('data-tooltip', label);
        for (const item of items) {
            const checked = item.dataset.mode === mode;
            item.setAttribute('aria-checked', String(checked));
            item.classList.toggle('is-selected', checked);
        }
    }

    const { close, toggle } = wireDropdownToggle(trigger, menu, null, { portal: true });
    trigger.addEventListener('click', toggle);

    for (const item of items) {
        item.addEventListener('click', () => {
            store.setSelectionMode(item.dataset.mode);
            close();
            trigger.focus();
        });
    }

    store.addEventListener('selection-mode-changed', syncTrigger);
    syncTrigger();
}

// 橡皮擦筆刷大小彈出選單：跟 [ / ] 快捷鍵改的是同一個 piece.eraseRadius 欄位，兩種調整方式
// 天生同步——每次選單開啟或 piece 變動都重新從 store 讀值寫回 range/number，不需要另外broadcast。
function wireEraserSizeMenu() {
    const trigger = el('btnEraserSizeMenu');
    const menu = el('eraserSizeMenu');
    if (!trigger || !menu) return;

    function syncFromPiece() {
        const piece = store.getActivePiece();
        const radius = piece?.eraseRadius ?? 40;
        el('eraserRadius').value = radius;
        el('eraserRadiusValue').value = radius;
    }

    const { toggle } = wireDropdownToggle(trigger, menu, (isOpen) => {
        if (isOpen) syncFromPiece();
    }, { portal: true });
    trigger.addEventListener('click', toggle);

    bindRangeNumberPair('eraserRadius', 'eraserRadiusValue', (n) => {
        const piece = store.getActivePiece();
        if (piece) store.updatePiece(piece.id, { eraseRadius: n });
    });

    store.addEventListener('active-piece-changed', syncFromPiece);
    store.addEventListener('piece-changed', syncFromPiece);
    syncFromPiece();
}

// 選取模式／橡皮擦筆刷大小這兩個彈出選單各自只跟一種工具有關，比照 Adobe 選項列「切到哪個
// 工具才顯示哪個工具的設定」慣例，只在對應工具啟用時才顯示觸發鈕：兩個一直露出來的話，
// #scanPaneBox 桌面版寬度通常只有五百多 px，工具列會被擠出水平捲軸、看起來很亂。
function wireToolOptionVisibility() {
    const selWrap = el('selectionModeMenuWrap');
    const eraWrap = el('eraserSizeMenuWrap');
    const selTrigger = el('btnSelectionModeMenu');
    const selMenu = el('selectionModeMenu');
    const eraTrigger = el('btnEraserSizeMenu');
    const eraMenu = el('eraserSizeMenu');
    if (!selWrap || !eraWrap) return;

    function sync() {
        const tool = store.activeTool;
        const showSel = tool === 'rect' || tool === 'lasso';
        const showEra = tool === 'eraser';
        selWrap.hidden = !showSel;
        eraWrap.hidden = !showEra;
        // 觸發鈕連同外層一起被藏起來時，選單本身（可能已被 portal 搬到 body 底下）也要
        // 強制關閉，不然切換工具後選單會孤兒式地繼續浮在畫面上。
        if (!showSel && !selMenu.hidden) { selMenu.hidden = true; selTrigger.setAttribute('aria-expanded', 'false'); }
        if (!showEra && !eraMenu.hidden) { eraMenu.hidden = true; eraTrigger.setAttribute('aria-expanded', 'false'); }

        // 矩形／套索共用同一顆模式彈出鈕，把它移到目前實際使用中的那顆按鈕右邊，
        // 而不是固定黏在整叢的最後面——切矩形時跟著矩形走，切套索時跟著套索走。
        if (showSel) {
            const activeLabel = el(tool === 'rect' ? 'tool-rect' : 'tool-lasso').closest('.item');
            activeLabel.insertAdjacentElement('afterend', selWrap);
        }
        // 橡皮擦彈出鈕原本是 .ts-selection 外面的手足元素，跟灰底膠囊之間隔著一段膠囊
        // 自己的邊框，視覺上比矩形／套索那顆（已被搬進膠囊內共用同一個底色）多一層邊界；
        // 這裡比照矩形／套索的做法搬進膠囊裡、緊跟在橡皮擦那顆後面，去掉這層多餘的視覺間隔。
        if (showEra) {
            const eraserLabel = el('tool-eraser').closest('.item');
            eraserLabel.insertAdjacentElement('afterend', eraWrap);
        }
    }

    store.addEventListener('tool-changed', sync);
    sync();
}

function wireZoomControl(scanView) {
    const zoomDisplay = el('zoomDisplay');
    const zoomInput = el('zoomInput');
    let applying = false;
    let enabled = false;

    scanView.onZoomChange = (scale) => {
        const pct = Math.round(scale * 100);
        zoomDisplay.textContent = `${pct}%`;
        zoomDisplay.setAttribute('aria-label', `目前縮放 ${pct}%，按 Enter 可輸入數值`);
    };

    function setEnabled(next) {
        enabled = next;
        zoomDisplay.classList.toggle('is-disabled', !enabled);
        zoomDisplay.setAttribute('aria-disabled', String(!enabled));
        if (enabled) zoomDisplay.setAttribute('tabindex', '0');
        else zoomDisplay.removeAttribute('tabindex');
        zoomInput.disabled = !enabled;
    }
    setEnabled(false);

    function enterEdit() {
        if (!enabled) return;
        zoomInput.value = zoomDisplay.textContent.replace('%', '');
        zoomDisplay.style.display = 'none';
        zoomInput.style.display = '';
        zoomInput.focus();
        zoomInput.select();
    }

    function exitEdit(apply) {
        if (applying) return;
        applying = true;
        if (apply) {
            const val = Number(zoomInput.value.replace('%', '').trim());
            if (Number.isFinite(val) && val > 0) scanView.zoomTo(val / 100);
        }
        zoomInput.style.display = 'none';
        zoomDisplay.style.display = '';
        applying = false;
    }

    zoomDisplay.addEventListener('click', enterEdit);
    zoomDisplay.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            enterEdit();
        }
    });
    zoomInput.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter') {
            evt.preventDefault();
            exitEdit(true);
        } else if (evt.key === 'Escape') {
            evt.preventDefault();
            exitEdit(false);
        }
    });
    zoomInput.addEventListener('blur', () => exitEdit(true));

    return { setEnabled };
}

// 畫布內下方置中的浮動工具列：新增物件 + 工具選取 + 縮放。
// 全螢幕工作區時只有這個工具列還看得到（見 wireFocusMode 註解），所以「新增物件」也放一份在這裡。
export function wireCanvasFloatingToolbar(scanView, statusEl) {
    el('btnAddPieceFloating').addEventListener('click', () => addPiece(statusEl));

    document.querySelectorAll('input[name="tool"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            if (radio.checked) store.setActiveTool(radio.value);
        });
    });

    wireSelectionModeMenu();
    wireEraserSizeMenu();
    wireToolOptionVisibility();
    wireToolbarOverflow();

    const zoomControl = wireZoomControl(scanView);
    el('btnZoomOut').addEventListener('click', () => scanView.zoomBy(1 / 1.2));
    el('btnZoomIn').addEventListener('click', () => scanView.zoomBy(1.2));
    el('btnZoomFit').addEventListener('click', () => scanView.fitToView());
    const syncCanvasControls = () => {
        const hasScan = !!store.getActiveScan();
        el('btnAddPieceFloating').disabled = !hasScan;
        el('btnZoomOut').disabled = !hasScan;
        el('btnZoomIn').disabled = !hasScan;
        el('btnZoomFit').disabled = !hasScan;
        zoomControl.setEnabled(hasScan);
    };
    store.addEventListener('scan-changed', syncCanvasControls);
    syncCanvasControls();
}
