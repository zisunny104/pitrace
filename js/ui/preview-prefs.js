// 右側「即時預覽」窗格的顯示偏好（底色／預覽模式）：純顯示設定，不寫進 .pitra 專案檔，
// 用 localStorage 記住上次選擇。

import { setPreviewMode } from './preview-mode.js';
import { el, wireDropdownToggle } from './dom-utils.js';

const previewBgStorageKey = 'pitrace.previewBg';
const previewBgClasses = ['bg-checker', 'bg-black', 'bg-white', 'bg-gray'];

export function wirePreviewBackground() {
    const wrap = el('previewCanvasWrap');
    if (!wrap) return;
    const radios = document.querySelectorAll('input[name="previewBg"]');
    if (!radios.length) return;

    function apply(mode) {
        wrap.classList.remove(...previewBgClasses);
        wrap.classList.add(`bg-${mode}`);
        try {
            localStorage.setItem(previewBgStorageKey, mode);
        } catch { /* 私密瀏覽模式等情況下 localStorage 可能無法使用，忽略即可 */ }
    }

    let stored = 'checker';
    try {
        stored = localStorage.getItem(previewBgStorageKey) || 'checker';
    } catch { /* 同上 */ }

    let matched = false;
    for (const radio of radios) {
        if (radio.value === stored) {
            radio.checked = true;
            matched = true;
        }
        radio.addEventListener('change', () => {
            if (radio.checked) apply(radio.value);
        });
    }
    apply(matched ? stored : 'checker');
}

const previewModeStorageKey = 'pitrace.previewMode';
const previewModeLabels = { original: '原始', mask: '遮罩', overlay: '疊加', result: '結果' };

// 標題列小按鈕＋下拉選單，比照「匯出全部」的 wireDropdownToggle 用法；觸發鈕的圖示/文字
// 即時反映目前選中的模式，選單裡用 aria-checked 標示目前項目（menuitemradio 慣例）。
export function wirePreviewMode() {
    const trigger = el('btnPreviewMode');
    const triggerIcon = el('btnPreviewModeIcon');
    const menu = el('previewModeMenu');
    if (!trigger || !menu) return;
    const items = menu.querySelectorAll('button[data-mode]');

    const { close, toggle } = wireDropdownToggle(trigger, menu);
    trigger.addEventListener('click', toggle);

    function applyMode(mode) {
        for (const item of items) {
            const checked = item.dataset.mode === mode;
            item.setAttribute('aria-checked', String(checked));
            item.classList.toggle('is-selected', checked);
        }
        const active = menu.querySelector(`button[data-mode="${mode}"]`);
        const label = previewModeLabels[mode] ?? previewModeLabels.result;
        triggerIcon.className = `ts-icon ${active?.dataset.icon ?? 'is-check-icon'}`;
        trigger.setAttribute('aria-label', `預覽模式：${label}`);
        trigger.title = `預覽模式：${label}`;
        setPreviewMode(mode);
    }

    let stored = 'result';
    try {
        stored = localStorage.getItem(previewModeStorageKey) || 'result';
    } catch { /* 同上 */ }
    const matched = [...items].some((item) => item.dataset.mode === stored);

    for (const item of items) {
        item.addEventListener('click', () => {
            applyMode(item.dataset.mode);
            try {
                localStorage.setItem(previewModeStorageKey, item.dataset.mode);
            } catch { /* 同上 */ }
            close();
            trigger.focus();
        });
    }
    applyMode(matched ? stored : 'result');
}
