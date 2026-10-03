// 進入點：把各 UI 區塊的事件綁定模組組裝起來。實際邏輯分散在同資料夾底下依畫面區塊命名的
// 檔案：project-toolbar（頂部專案操作列）、canvas-toolbar（畫布標題列＋浮動編輯工具列）、
// piece-list（左側物件清單）、properties-panel（右側屬性面板＋OCR）、preview-prefs（預覽底色／模式）。

import { store } from '../state.js';
import { wireProjectToolbar, wireDragDropImport } from './project-toolbar.js';
import { wireScanPaneHeader, wireCanvasFloatingToolbar } from './canvas-toolbar.js';
import { wirePieceList, wireExportAllMenu } from './piece-list.js';
import { wirePropertiesPanel, wireOcrNameSuggestion, syncPropertiesPanel } from './properties-panel.js';
import { wirePreviewBackground, wirePreviewMode } from './preview-prefs.js';

export function wireUI({ scanView, statusEl }) {
    wireProjectToolbar(statusEl);
    wireScanPaneHeader(scanView, statusEl);
    wireCanvasFloatingToolbar(scanView, statusEl);
    wirePieceList(statusEl);
    wireExportAllMenu(statusEl);
    wirePropertiesPanel(statusEl);
    wireOcrNameSuggestion(statusEl);
    wireDragDropImport(statusEl);
    wirePreviewBackground();
    wirePreviewMode();

    store.addEventListener('active-piece-changed', () => syncPropertiesPanel(statusEl));
    store.addEventListener('piece-changed', (e) => syncPropertiesPanel(statusEl, e.detail?.fields));
    syncPropertiesPanel(statusEl);
}
