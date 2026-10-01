// 共用 UI 小工具：DOM 存取、圖示、下拉選單開關、滑桿數字框同步、檔案下載。
// 被 project-toolbar.js / canvas-toolbar.js / piece-list.js / properties-panel.js / preview-prefs.js 共用。

export function el(id) {
    return document.getElementById(id);
}

export function makeIcon(cls) {
    const span = document.createElement('span');
    span.className = `ts-icon ${cls}`;
    span.setAttribute('aria-hidden', 'true');
    return span;
}

// 共用下拉選單開關邏輯（觸發鈕 + 選單容器）：點外面關閉、Esc 關閉並把焦點還給觸發鈕。
// 觸發鈕本身的 click 行為由呼叫端自訂（例如圖片清單鈕在還沒有圖片時要直接開檔案選取器）。
//
// opts.portal＝true 時，開啟時把選單節點搬到 document.body、改用 position:fixed 由 JS 算座標，
// 避開畫布浮動工具列 overflow-x:auto 連帶把 overflow-y 也裁成 auto、蓋掉往下彈出內容的問題。
export function wireDropdownToggle(trigger, menu, onToggle, opts = {}) {
    const portal = opts.portal;

    // collision flip：下面空間不夠、上面夠的話翻到觸發鈕上方展開。觸發鈕若身處
    // .canvas-floating-toolbar，翻轉/間距以整顆浮動藥丸的外緣為準（而非觸發鈕自身邊界），
    // 選單才不會貼到甚至蓋住浮動工具列本體。
    function position() {
        const rect = trigger.getBoundingClientRect();
        const shell = trigger.closest('.canvas-floating-toolbar');
        const shellRect = shell ? shell.getBoundingClientRect() : rect;
        const gap = 10;
        menu.style.position = 'fixed';
        menu.style.visibility = 'hidden';
        menu.style.top = '0px';
        const menuHeight = menu.offsetHeight;
        const menuWidth = menu.offsetWidth;
        const fitsBelow = shellRect.bottom + gap + menuHeight <= window.innerHeight - 8;
        const top = fitsBelow ? shellRect.bottom + gap : Math.max(8, shellRect.top - gap - menuHeight);
        const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.visibility = '';
    }

    function close() {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        onToggle?.(false);
    }
    function open() {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        if (portal) {
            document.body.appendChild(menu);
            position();
        }
        onToggle?.(true);
    }
    function toggle() {
        if (menu.hidden) open(); else close();
    }
    document.addEventListener('click', (evt) => {
        if (!menu.hidden && evt.target !== trigger && !menu.contains(evt.target) && !trigger.contains(evt.target)) {
            close();
        }
    });
    document.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape' && !menu.hidden) {
            close();
            trigger.focus();
        }
    });
    return { open, close, toggle };
}

// 讓 range 滑桿與旁邊的數字輸入框互相同步：拖曳滑桿即時反映到數字框，同時以
// requestAnimationFrame 節流寫回 store（去背分析非同步、無 Worker，若每個 input 事件都
// 直接寫回會在拖曳時瘋狂疊加運算）——同一時間最多只有一次排隊中的套用，拖到哪就吃到哪，
// 不用放開滑桿才看得到結果；放開/變更時再保證套用一次最終值。打數字框則反過來即時同步
// 滑桿，blur/Enter 時夾在 min~max 內寫回 store。
export function bindRangeNumberPair(rangeId, numberId, apply) {
    const range = el(rangeId);
    const number = el(numberId);
    const min = Number(range.min);
    const max = Number(range.max);

    let rafPending = false;
    const scheduleLiveApply = () => {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            apply(Number(range.value));
        });
    };

    range.addEventListener('input', () => {
        number.value = range.value;
        scheduleLiveApply();
    });
    range.addEventListener('change', () => apply(Number(range.value)));

    number.addEventListener('input', () => {
        const n = Number(number.value);
        if (number.value !== '' && !Number.isNaN(n) && n >= min && n <= max) {
            range.value = String(n);
        }
    });
    number.addEventListener('change', () => {
        let n = Number(number.value);
        if (Number.isNaN(n)) n = Number(range.value);
        n = Math.min(max, Math.max(min, n));
        number.value = String(n);
        range.value = String(n);
        apply(n);
    });
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function stripExtension(filename) {
    return filename.replace(/\.[^.]+$/, '');
}
