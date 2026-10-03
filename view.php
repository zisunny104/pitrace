<!DOCTYPE html>
<html lang="zh-tw">

<?php
// 計算此工具展開後的 URL 基準路徑（例： /koilisu/apps/pitrace）
$appBasePath = rtrim(str_replace($_SERVER['DOCUMENT_ROOT'], '', __DIR__), '/\\');
$appBasePath = str_replace('\\', '/', $appBasePath);
$appConfig = require __DIR__ . '/config.php';
$appVersion = $appConfig['version'] ?? '0.0.0';
?>

<head>
    <meta charset="UTF-8">
    <title>Pitrace 拾印 - KoiLiSu | prjToka</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tocas-ui/5.7.0/tocas.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/tocas-ui/5.7.0/tocas.min.js"></script>

    <style type="text/css">
    body {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }

    .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    /* 頁首／內容區共用的排列骨架，間距各自歸屬頁首與內容區自己。 */
    #pageContainer {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    /* 分隔線與內容區包成一組，寬版模式才需要；底部留白歸內容區自己。 */
    #mainAnchor {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        padding-bottom: 1.5rem;
    }

    main#main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    :root {
        --pitrace-dock-width: 380px;
        --pitrace-list-width: 200px;
    }

    /* 編輯器主體：手機/平板單欄堆疊，桌面以上三欄並排。 */
    .editor-shell {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        gap: 1rem;
    }

    #editorDock {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    #scanPaneBox,
    #previewPaneBox,
    #pieceListSidebar {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    /* 手機/平板是單欄堆疊版面，用不到欄寬拖曳；desktop+ 的 media query 會再打開 */
    .col-resizer {
        display: none;
    }

    @media (min-width: 1024px) {
        /* 寬版模式下把 100vh 錨點鎖在這層，讓頁尾可以被捲動到視窗外。 */
        .main-content {
            flex: none;
            height: 100vh;
        }

        /* 寬版模式：100vh 錨點下移一層，讓標題區塊也能被捲動到視窗外。 */
        .main-content.is-fluid {
            flex: 1;
            height: auto;
        }

        .main-content.is-fluid #mainAnchor {
            flex: none;
            height: 100vh;
        }

        /* 寬版模式下捲動吸附，放開後固定落在標題或內容區其中一個起點。 */
        html.is-fluid {
            scroll-snap-type: y mandatory;
        }

        .main-content.is-fluid #pageHeader {
            scroll-snap-align: start;
        }

        .main-content.is-fluid #mainAnchor {
            scroll-snap-align: start;
        }

        .editor-shell {
            flex-direction: row;
            gap: 0;
        }

        #pieceListSidebar {
            flex: 0 0 var(--pitrace-list-width);
            width: var(--pitrace-list-width);
            min-height: 0;
            overflow: hidden;
            order: 1;
        }

        #scanPaneBox {
            min-width: 0;
            order: 3;
        }

        #editorDock {
            flex: 0 0 var(--pitrace-dock-width);
            width: var(--pitrace-dock-width);
            min-height: 0;
            overflow: hidden;
            order: 5;
        }

        /* 三欄之間的可拖曳分隔線，寬版才顯示，支援拖曳與鍵盤調整欄寬。 */
        .col-resizer {
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 1rem;
            width: 1rem;
            order: 2;
            cursor: col-resize;
            color: var(--ts-gray-400, #ccc);
            touch-action: none;
            border-radius: 4px;
        }

        #colResizerRight {
            order: 4;
        }

        .col-resizer:hover,
        .col-resizer.is-dragging {
            background: var(--ts-gray-200, #e5e5e5);
            color: var(--ts-primary-600, #2563eb);
        }

        .col-resizer:focus-visible {
            outline: 2px solid var(--ts-primary-600, #2563eb);
            outline-offset: -2px;
        }

        #previewPaneBox {
            flex: 0 0 auto;
        }

        #previewPaneBox .pane-canvas-wrap {
            flex: none;
            min-height: 0;
            height: 220px;
        }

        /* 左欄面板吃滿整欄高度，內部清單自行捲動。 */
        #pieceListBox {
            flex: 1 1 auto;
            min-height: 140px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* 桌面版欄位較窄，改採單欄直向清單，避免縮圖網格跑版。 */
        #pieceList {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding: 0.5rem;
        }

        #pieceList .piece-thumb {
            width: 100%;
        }

        /* 物件設定改為固定面板並自行捲動，不再用 popover 呈現。 */
        #propertiesPanel {
            flex: 1 1 auto;
            min-height: 160px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        #propertiesPanelBody {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
        }
    }

    /* 無障礙：只在鍵盤聚焦時顯示的跳轉連結 */
    .skip-link {
        position: absolute;
        left: -9999px;
        top: 0;
        z-index: 10000;
        padding: 0.6rem 1rem;
        background: var(--ts-primary-600, #2563eb);
        color: #fff;
        border-radius: 0 0 8px 0;
        text-decoration: none;
    }

    .skip-link:focus {
        left: 0;
    }

    /* 視覺隱藏但螢幕報讀器可讀 */
    .visually-hidden {
        position: absolute !important;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .pane-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        min-height: 1.75rem;
        padding: 0.2rem 0.6rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--ts-gray-600, #666);
        background: var(--ts-gray-100, #f2f2f2);
        border-bottom: 1px solid var(--ts-gray-300, #ddd);
        box-sizing: border-box;
    }

    /* 標題列裡的圖示按鈕沿用 Tocas .is-small（32px）還是偏高，蓋掉 --height 縮到跟標題列文字更貼近。 */
    .pane-card-header .ts-button.is-icon {
        --height: 1.5rem;
        --icon-size: 1rem;
    }

    .pane-card-header-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .pane-canvas-wrap {
        position: relative;
        flex: 1;
        min-height: 340px;
        overflow: hidden;
        background: #2b2b2b;
    }

    /* 預覽底色預設棋盤格，另提供黑／白／灰切換方便檢查去背邊緣。 */
    .pane-canvas-wrap.is-preview.bg-checker {
        background:
            linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%) 0 0/16px 16px,
            linear-gradient(45deg, #d0d0d0 25%, #fff 25%, #fff 75%, #d0d0d0 75%) 8px 8px/16px 16px;
    }

    .pane-canvas-wrap.is-preview.bg-black {
        background: #1a1a1a;
    }

    .pane-canvas-wrap.is-preview.bg-white {
        background: #fff;
    }

    .pane-canvas-wrap.is-preview.bg-gray {
        /* 跟面板標題列用同一組 Tocas 灰階變數，深色主題才會一起跟著變暗。 */
        background: var(--ts-gray-200, #e8e8e8);
    }

    /* 未選取物件時固定灰底，避免棋盤格誤導成有透明內容。 */
    .pane-canvas-wrap.is-preview.is-empty {
        background: var(--ts-gray-200, #e8e8e8);
    }

    /* 不用 Tocas 選取元件樣式，改排緊湊色塊列，選取狀態靠外框表示。 */
    .preview-bg-toggle {
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }

    .preview-bg-toggle-item {
        display: flex;
        cursor: pointer;
    }

    .preview-bg-swatch {
        display: block;
        width: 14px;
        height: 14px;
        border-radius: 3px;
        border: 1px solid var(--ts-gray-400, #bbb);
        box-sizing: border-box;
    }

    .preview-bg-toggle-item input:checked + .preview-bg-swatch {
        outline: 2px solid var(--ts-primary-700, #2563eb);
        outline-offset: 1px;
    }

    .preview-bg-swatch.is-checker {
        background:
            linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%) 0 0/8px 8px,
            linear-gradient(45deg, #d0d0d0 25%, #fff 25%, #fff 75%, #d0d0d0 75%) 4px 4px/8px 8px;
    }

    .preview-bg-swatch.is-black {
        background: #1a1a1a;
    }

    .preview-bg-swatch.is-white {
        background: #fff;
    }

    .preview-bg-swatch.is-gray {
        background: var(--ts-gray-400, #999);
    }

    .pane-canvas-wrap canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        outline-offset: -2px;
    }

    /* 沒有這個，觸控拖曳會被瀏覽器當成頁面捲動／雙指縮放頁面，跟畫布自己的平移/縮放/選取搶手勢 */
    #scanCanvas {
        touch-action: none;
    }

    .pane-canvas-wrap canvas:focus-visible {
        outline: 3px solid var(--ts-primary-500, #3b82f6);
    }

    /* 依目前工具與修飾鍵切換游標樣式（加選／減選／取代／橡皮擦／平移）。 */
    #scanCanvas.cursor-crosshair {
        cursor: crosshair;
    }

    #scanCanvas.cursor-select-add {
        cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg stroke='%23000' stroke-width='3' stroke-linecap='round'%3E%3Cline x1='16' y1='3' x2='16' y2='12'/%3E%3Cline x1='16' y1='20' x2='16' y2='29'/%3E%3Cline x1='3' y1='16' x2='12' y2='16'/%3E%3Cline x1='20' y1='16' x2='29' y2='16'/%3E%3C/g%3E%3Cg stroke='%23fff' stroke-width='1.2' stroke-linecap='round'%3E%3Cline x1='16' y1='3' x2='16' y2='12'/%3E%3Cline x1='16' y1='20' x2='16' y2='29'/%3E%3Cline x1='3' y1='16' x2='12' y2='16'/%3E%3Cline x1='20' y1='16' x2='29' y2='16'/%3E%3C/g%3E%3Ccircle cx='24' cy='24' r='6.5' fill='%233b82f6' stroke='%23fff' stroke-width='1.5'/%3E%3Cline x1='24' y1='21.5' x2='24' y2='26.5' stroke='%23fff' stroke-width='1.6' stroke-linecap='round'/%3E%3Cline x1='21.5' y1='24' x2='26.5' y2='24' stroke='%23fff' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E") 16 16, crosshair;
    }

    #scanCanvas.cursor-select-subtract {
        cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg stroke='%23000' stroke-width='3' stroke-linecap='round'%3E%3Cline x1='16' y1='3' x2='16' y2='12'/%3E%3Cline x1='16' y1='20' x2='16' y2='29'/%3E%3Cline x1='3' y1='16' x2='12' y2='16'/%3E%3Cline x1='20' y1='16' x2='29' y2='16'/%3E%3C/g%3E%3Cg stroke='%23fff' stroke-width='1.2' stroke-linecap='round'%3E%3Cline x1='16' y1='3' x2='16' y2='12'/%3E%3Cline x1='16' y1='20' x2='16' y2='29'/%3E%3Cline x1='3' y1='16' x2='12' y2='16'/%3E%3Cline x1='20' y1='16' x2='29' y2='16'/%3E%3C/g%3E%3Ccircle cx='24' cy='24' r='6.5' fill='%23ef4444' stroke='%23fff' stroke-width='1.5'/%3E%3Cline x1='21.5' y1='24' x2='26.5' y2='24' stroke='%23fff' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E") 16 16, crosshair;
    }

    #scanCanvas.cursor-eraser {
        cursor: none;
    }

    /* 滴管游標：熱點對齊圖示尖端（滴管實際取樣的像素位置），不是圖示中心。 */
    #scanCanvas.cursor-eyedropper {
        cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg stroke='%23000' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='25' y1='7' x2='12' y2='20'/%3E%3Cline x1='12' y1='20' x2='7' y2='25'/%3E%3C/g%3E%3Cg stroke='%23fff' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='25' y1='7' x2='12' y2='20'/%3E%3Cline x1='12' y1='20' x2='7' y2='25'/%3E%3C/g%3E%3Ccircle cx='25' cy='7' r='5' fill='%23f97316' stroke='%23fff' stroke-width='1.5'/%3E%3Ccircle cx='7' cy='25' r='1.8' fill='%23000' stroke='%23fff' stroke-width='1'/%3E%3C/svg%3E") 7 25, crosshair;
    }

    #scanCanvas.cursor-pan,
    #scanCanvas.is-pan-armed {
        cursor: grab;
    }

    #scanCanvas.is-panning {
        cursor: grabbing;
    }

    /* 畫布內下方置中的浮動工具列（工具選取＋縮放）。比照 focus-mode 舊有浮動列的 pill 樣式。 */
    .canvas-floating-toolbar {
        position: absolute;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        max-width: calc(100% - 2rem);
        overflow-x: auto;
        background: var(--ts-gray-100, #f2f2f2);
        border: 1px solid var(--ts-gray-300, #ddd);
        border-radius: 12px;
        padding: 0.35rem 0.4rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    .pane-empty-state,
    .pane-loading-state {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        text-align: center;
        padding: 1rem;
        pointer-events: none;
    }

    /* 底色與漸層沿用 Tocas 灰階變數，深色主題會自動跟著變暗。 */
    .skeleton {
        background-image: linear-gradient(90deg,
            var(--ts-gray-200, #e8e8e8) 0%,
            var(--ts-gray-100, #f2f2f2) 50%,
            var(--ts-gray-200, #e8e8e8) 100%);
        background-size: 200% 100%;
        animation: pitrace-skeleton-shimmer 1.4s ease-in-out infinite;
    }

    @keyframes pitrace-skeleton-shimmer {
        0% {
            background-position: 200% 0;
        }

        100% {
            background-position: -200% 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {

        .skeleton,
        .piece-thumb-progress-bar {
            animation: none !important;
        }
    }

    .pane-toolbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    /* 浮動工具列維持單行，擠不下時交給橫向捲動而非換行。 */
    .canvas-floating-toolbar.pane-toolbar {
        flex-wrap: nowrap;
    }

    /* 工具列子項固定不收縮，擠不下時交給橫向捲動，避免按鈕被壓扁。 */
    .canvas-floating-toolbar.pane-toolbar>* {
        flex-shrink: 0;
    }

    /* 新增物件鈕與分隔線包成一組，收合/還原時一起切換顯示。 */
    .pane-tool-collapsible {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .pane-tool-collapsible>* {
        flex-shrink: 0;
    }

    /* 圖示按鈕改用固定寬高置中，取代文字按鈕預設內距造成的多餘留白。 */
    .canvas-floating-toolbar .ts-selection.is-compact {
        padding-left: 0;
        padding-right: 0;
        gap: 0.3rem;
    }

    .canvas-floating-toolbar .ts-selection.is-compact .item {
        height: 100%;
    }

    .canvas-floating-toolbar .ts-selection.is-compact .item .text {
        width: var(--height);
        height: 100%;
        padding: 0;
        justify-content: center;
    }

    /* 拿掉內距後放大圖示字級，跟按鈕大小更相襯。 */
    .canvas-floating-toolbar .ts-selection.is-compact .item .text .ts-icon {
        font-size: 1.2rem;
    }

    /* 無明確尺寸父層可依附，改走一般文件流置中。 */
    .piece-list-empty-state,
    .pane-empty-state-static {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        text-align: center;
        padding: 1.5rem 1rem;
    }

    /* 空狀態為橫向清單裡的唯一子項，需明講寬度才能置中。 */
    .piece-list-empty-state {
        width: 100%;
    }

    /* 匯入與專案選單語意不同，刻意不黏在一起以免誤認為同一顆按鈕。 */
    .pane-toolbar-buttons {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        /* 按鈕群固定不縮，寬度不夠時改由標題文字先被截斷。 */
        flex-shrink: 0;
    }

    /* 標題列按鈕群之間的細直分隔線，用於同一行內的視覺區隔。 */
    .pane-toolbar-divider {
        width: 1px;
        align-self: stretch;
        margin: 0.25rem 0;
        background: var(--ts-gray-300, #ddd);
    }

    /* 選取工具與其他工具分成兩叢，叢間距比叢內距寬以利區分。 */
    .pane-tool-cluster {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    /* 工具與其模式彈出鈕視覺上同一組，窄間距包成一叢不用分隔線。 */
    .pane-tool-subcluster {
        display: flex;
        align-items: center;
        gap: 0.3rem;
    }

    /* 彈出鈕只是「還有更多選項」的箭頭指示，縮小成窄長條，附屬於旁邊工具而非平行按鈕。 */
    .pane-tool-chevron.ts-button.is-icon {
        --height: 1.6rem;
        min-width: 1.2rem;
        padding-left: 0.15rem;
        padding-right: 0.15rem;
    }

    .pane-tool-chevron .ts-icon {
        font-size: 0.85rem;
    }

    /* 匯出選單改用自訂定位＋切換顯示，而非原生 popover。 */
    .pane-menu-wrap {
        position: relative;
        display: inline-flex;
    }

    /* 彈出鈕附屬於前一顆工具，用負邊距縮小與其間距以跟平行選項區隔。 */
    .ts-selection .pane-menu-wrap {
        margin-left: -3px;
    }

    .pane-menu-wrap[hidden] {
        display: none;
    }

    /* 縮放數值欄位收窄留白並固定寬度，避免數值變動時寬度跳動。 */
    #zoomDisplay,
    #zoomInput {
        min-width: 52px;
        padding-left: 0.3rem;
        padding-right: 0.3rem;
    }

    .pane-dropdown-menu {
        position: absolute;
        top: calc(100% + 0.4rem);
        right: 0;
        z-index: 20;
        min-width: 14rem;
        /* portal 出去的選單用 shrink-to-fit 量寬度，不夾上限的話會被內部不換行的長句撐寬。 */
        max-width: 16rem;
        background: var(--ts-gray-50, #fff);
        border: 1px solid var(--ts-gray-300, #ddd);
        border-radius: var(--ts-border-radius-container, 8px);
        box-shadow: var(--ts-elevated-shadow, 0 8px 24px rgba(0, 0, 0, 0.2));
        padding: 0.25rem;
    }

    .pane-dropdown-menu[hidden] {
        display: none;
    }

    /* 用複合選擇器疊高優先權，蓋過 [hidden] 的預設樣式。 */
    .ts-icon[hidden] {
        display: none;
    }

    /* 選中/密度/字級交給 Tocas 既有修飾 class，這裡只補 nowrap 與 cursor。 */
    .pane-dropdown-menu .item {
        white-space: nowrap;
        cursor: pointer;
    }

    .pane-dropdown-menu .range-row {
        gap: 0.4rem;
    }

    .pane-dropdown-menu .has-top-spaced-small {
        margin-top: 0.35rem;
    }

    .pane-dropdown-menu .ts-text.is-description {
        font-size: 0.78rem;
        line-height: 1.35;
    }

    /* 每列三個獨立可點擊目標（切換／重新命名／刪除），改用橫向排列並排。 */
    .pane-scan-menu-row {
        display: flex;
        align-items: center;
        gap: 0.2rem;
    }

    .pane-scan-menu-row .item {
        flex: 1 1 auto;
        min-width: 0;
    }

    .pane-scan-menu-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* 重新命名時整列換成的輸入框，寬度跟 select 按鈕的可用空間一致，避免切換時選單忽寬忽窄。 */
    .pane-scan-menu-rename-input {
        flex: 1 1 auto;
        min-width: 0;
        width: 100%;
    }

    #btnImportImageLabel {
        max-width: 12rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* 修補原生 radiogroup 無法鍵盤聚焦的問題，套用到所有同類結構。 */
    [role="radiogroup"] input[type="radio"] {
        display: block;
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    [role="radiogroup"] input[type="radio"]:focus-visible + * {
        outline: 2px solid var(--ts-primary-700, #2563eb);
        outline-offset: 2px;
    }

    /* 全螢幕模式下隱藏其餘區塊，避免鍵盤 Tab 誤入不可見控制項。 */
    #main-content.is-focus-mode #projectToolbar,
    #main-content.is-focus-mode > .ts-divider,
    #main-content.is-focus-mode #editorDock,
    #main-content.is-focus-mode #pieceListSidebar,
    #main-content.is-focus-mode .col-resizer {
        display: none !important;
    }

    #main-content.is-focus-mode #scanPaneBox {
        position: fixed;
        inset: 0;
        z-index: 1000;
        margin: 0;
        border-radius: 0;
        display: flex;
        flex-direction: column;
    }

    .piece-thumb-strip {
        display: flex;
        gap: 0.75rem;
        overflow-x: auto;
        padding: 0.25rem 0.25rem 0.75rem;
    }

    .piece-thumb-item {
        position: relative;
        flex-shrink: 0;
    }

    .piece-thumb {
        position: relative;
        width: 120px;
        border: 2px solid transparent;
        border-radius: 8px;
        padding: 0;
        background: var(--ts-gray-100, #f2f2f2);
        cursor: pointer;
        text-align: left;
        overflow: hidden;
    }

    .piece-thumb-delete {
        position: absolute;
        top: 0.3rem;
        right: 0.3rem;
        opacity: 0;
        transition: opacity 0.1s;
    }

    .piece-thumb-item:hover .piece-thumb-delete,
    .piece-thumb-item:focus-within .piece-thumb-delete {
        opacity: 1;
    }

    .piece-thumb[aria-current="true"] {
        border-color: var(--ts-primary-500, #3b82f6);
    }

    .piece-thumb canvas,
    .piece-thumb .thumb-placeholder {
        width: 100%;
        height: 90px;
        object-fit: contain;
        background:
            linear-gradient(45deg, #d0d0d0 25%, transparent 25%, transparent 75%, #d0d0d0 75%) 0 0/12px 12px,
            linear-gradient(45deg, #d0d0d0 25%, #fff 25%, #fff 75%, #d0d0d0 75%) 6px 6px/12px 12px;
    }

    .piece-thumb canvas {
        display: block;
    }

    .piece-thumb .thumb-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* 刻意跟棋盤格規則同層級，靠後到者蓋過前者。 */
    .piece-thumb .thumb-placeholder.skeleton {
        background-image: linear-gradient(90deg,
            var(--ts-gray-200, #e8e8e8) 0%,
            var(--ts-gray-100, #f2f2f2) 50%,
            var(--ts-gray-200, #e8e8e8) 100%);
        background-size: 200% 100%;
        animation: pitrace-skeleton-shimmer 1.4s ease-in-out infinite;
    }

    /* 批次匯出時用 data-export-state 驅動進度顯示狀態。 */
    .piece-thumb-progress {
        position: absolute;
        left: 0.3rem;
        right: 0.3rem;
        bottom: 0.3rem;
        height: 4px;
        border-radius: 2px;
        background: var(--ts-gray-300, #ddd);
        overflow: hidden;
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .piece-thumb[data-export-state] .piece-thumb-progress {
        opacity: 1;
    }

    .piece-thumb-progress-bar {
        position: absolute;
        top: 0;
        left: -30%;
        width: 30%;
        height: 100%;
        border-radius: 2px;
        background: var(--ts-primary-500, #3b82f6);
    }

    /* 處理中：跑馬燈式不定進度動畫。 */
    .piece-thumb[data-export-state="active"] .piece-thumb-progress-bar {
        animation: pitrace-progress-indeterminate 1.1s ease-in-out infinite;
    }

    /* 完成：滿條＋綠色，停留到整批匯出結束後才淡出。 */
    .piece-thumb[data-export-state="done"] .piece-thumb-progress-bar {
        left: 0;
        width: 100%;
        background: var(--ts-positive-500, #22c55e);
        transition: left 0.2s ease, width 0.2s ease;
    }

    /* 跳過：該物件尚未設定選取範圍，這次批次匯出沒有產生任何檔案，滿條但用中性灰區隔於成功。 */
    .piece-thumb[data-export-state="skipped"] .piece-thumb-progress-bar {
        left: 0;
        width: 100%;
        background: var(--ts-gray-500, #999);
        transition: left 0.2s ease, width 0.2s ease;
    }

    @keyframes pitrace-progress-indeterminate {
        0% {
            left: -30%;
        }

        100% {
            left: 100%;
        }
    }

    .piece-thumb .thumb-label {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.5rem;
        font-size: 0.8rem;
    }

    .piece-thumb .thumb-color-dot {
        flex-shrink: 0;
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .piece-thumb .thumb-label-text {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .lasso-loop-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.4rem;
    }

    .range-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    .range-row .ts-range {
        flex: 1;
    }

    .range-row .ts-input {
        width: 4.5rem;
        flex: none;
    }

    /* 欄寬固定較窄，收窄內距避免三位數數值被擠到看起來被裁掉。 */
    .range-row .ts-input input {
        padding-left: 0.3rem;
        padding-right: 0.3rem;
    }

    .rotation-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
    }

    .rotation-row .ts-input {
        flex: 1;
    }

    .name-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
    }

    .name-row .ts-input {
        flex: 1;
        position: relative;
    }

    /* 名稱與已存檔不一致時顯示套用／還原按鈕，輸入框右側留白避免被蓋住。 */
    .name-row .ts-input input {
        padding-right: 3.6rem;
    }

    .name-input-actions {
        position: absolute;
        top: 50%;
        right: 0.3rem;
        transform: translateY(-50%);
        display: flex;
        gap: 0.25rem;
    }

    .name-input-actions[hidden] {
        display: none;
    }

    .name-input-action {
        --height: 1.35rem;
        min-width: 1.35rem;
        padding: 0;
        border-radius: 50%;
    }

    .name-input-action .ts-icon {
        font-size: 0.7rem;
    }

    .rgb-inputs {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
    }

    .rgb-inputs .ts-input {
        width: 5rem;
    }

    .bg-sample-swatch {
        width: 2rem;
        height: 2rem;
        border-radius: 4px;
        border: 1px solid var(--ts-gray-300, #ddd);
        flex: none;
        background: #fff;
    }

    #statusRegion {
        min-height: 1.2em;
    }

    /* 狀態提示固定於畫面下方置中，疊層順序蓋過全螢幕畫布。 */
    .pitrace-snackbar {
        position: fixed;
        left: 50%;
        bottom: 12rem;
        transform: translate(-50%, 0.5rem);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        z-index: 1001;
        max-width: calc(100vw - 2rem);
    }

    .pitrace-snackbar.is-shown {
        opacity: 1;
        transform: translate(-50%, 0);
    }

    /* Tocas 沒有拖放區元件，這裡用最小自訂樣式做拖曳匯入圖片／開啟專案時的視覺回饋。 */
    #main-content.is-drag-target {
        outline: 3px dashed var(--ts-primary-500, #3b82f6);
        outline-offset: -3px;
        border-radius: 8px;
        background: var(--ts-primary-50, rgba(59, 130, 246, 0.06));
    }

    /* 重置 <button class="item"> 的瀏覽器預設外觀，讓 Tocas 的 .item／.is-active 規則生效。 */
    .ts-tab.license-tabs > button.item {
        appearance: none;
        background: none;
        border: 0;
        font: inherit;
        cursor: pointer;
    }

    .ts-tab.license-tabs > button.item:focus-visible {
        outline: 2px solid light-dark(#1d4ed8, #93c5fd);
        outline-offset: -2px;
    }

    .license-dialog-content {
        display: flex;
        flex-direction: column;
        height: min(40rem, calc(100dvh - 3rem));
    }

    .license-body {
        flex: 1 1 auto;
        min-height: 12rem;
        overflow-y: auto;
        overflow-wrap: anywhere;
    }

    /* help-* 為說明內容固定輸出的 class 名稱。 */
    .help-list {
        margin: 0;
        padding-left: 1.25rem;
        line-height: 1.7;
    }

    .license-body > div > * + * {
        margin-top: .75rem;
    }

    .help-list > li + li {
        margin-top: .375rem;
    }

    .help-paragraph {
        margin: 0;
        line-height: 1.7;
    }

    .help-quote {
        margin: 0;
        padding: .5rem .75rem;
        border: 1px solid var(--ts-gray-300, #ddd);
        border-radius: var(--ts-border-radius-container, 8px);
        background: var(--ts-gray-100, #f2f2f2);
    }

    .help-table-wrap {
        overflow-x: auto;
        border: 1px solid var(--ts-gray-300, #ddd);
        border-radius: var(--ts-border-radius-container, 8px);
    }

    .help-table-wrap .ts-table {
        width: 100%;
    }

    .help-table-wrap :is(th, td):first-child {
        white-space: nowrap;
    }

    .help-table-wrap thead tr:first-child :is(th, td):first-child {
        border-top-left-radius: inherit;
    }

    .help-table-wrap thead tr:first-child :is(th, td):last-child {
        border-top-right-radius: inherit;
    }

    .help-table-wrap tbody tr:last-child :is(th, td):first-child {
        border-bottom-left-radius: inherit;
    }

    .help-table-wrap tbody tr:last-child :is(th, td):last-child {
        border-bottom-right-radius: inherit;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
    }

    .footer-plain-link {
        display: inline-block;
        min-height: 24px;
        line-height: 24px;
        color: inherit;
        text-decoration: none;
    }

    .ts-button.footer-action-button {
        --height: 24px;
        min-width: 0;
        padding: 0 .65em;
        border-width: 1px;
        font-size: .8em;
    }

    /* Tocas 的 .ts-selection 無直向堆疊版型，手機寬度下改垂直排列並重設高度/圓角 */
    .ts-selection.theme-switcher-stacked {
        flex-direction: column;
        height: auto;
        align-items: stretch;
        gap: 0.2rem;
        padding: 0.35rem;
        border-radius: var(--ts-border-radius-container, 8px);
    }

    .ts-selection.theme-switcher-stacked .item .text {
        width: 100%;
    }
    </style>
</head>

<body class="is-rounded">
    <a href="#main-content" class="skip-link">跳到主要內容</a>

    <div class="main-content">
        <div class="ts-container" id="pageContainer">

            <!-- 標題：頂部留白歸頁首自己，不再靠 #pageContainer 代勞 -->
            <div class="ts-grid is-middle-aligned has-top-padded" id="pageHeader">
                <div class="column is-fluid">
                    <div class="ts-wrap is-middle-aligned is-compact">
                        <div class="ts-header is-heavy is-large is-start-icon" role="heading" aria-level="1">
                            <span class="ts-icon is-file-image-icon" aria-hidden="true"></span>
                            Pitrace 拾印
                        </div>
                        <span class="ts-text is-description">v<?= htmlspecialchars($appVersion) ?></span>
                    </div>
                    <div class="ts-text is-description mobile:has-hidden">
                        掃描圖片，框選去背、校正，匯出透明圖檔。
                    </div>
                </div>
                <div class="column mobile:has-hidden">
                    <button id="btnToggleWidth" class="ts-button is-icon is-outlined" aria-label="使用完整頁面寬度"
                        title="使用完整頁面寬度" aria-pressed="false">
                        <span class="ts-icon is-arrows-left-right-icon" aria-hidden="true"></span>
                    </button>
                </div>
            </div>

            <div id="mainAnchor">
                <div class="ts-divider has-vertically-spaced"></div>

                <main id="main-content">

                <!-- 專案操作列 -->
                <div class="pane-toolbar" role="toolbar" aria-label="專案操作" id="projectToolbar">
                    <div class="ts-grid is-middle-aligned mobile:is-stacked" style="flex:1 1 100%;">
                        <div class="column is-fluid">
                            <div class="ts-input is-underlined">
                                <input type="text" id="projectNameInput" value="未命名專案" aria-label="專案名稱">
                            </div>
                        </div>
                        <div class="column">
                            <div class="pane-toolbar-buttons">
                                <div class="pane-menu-wrap">
                                    <button id="btnImportImage" class="ts-button is-primary is-start-icon">
                                        <span class="ts-icon is-upload-icon" aria-hidden="true"></span>
                                        <span id="btnImportImageLabel">匯入</span>
                                        <span class="ts-icon is-chevron-down-icon" id="btnImportImageChevron"
                                            aria-hidden="true" hidden></span>
                                    </button>
                                    <!-- 有圖片後「匯入」變下拉選單，常用操作在上、匯入在下。 -->
                                    <div class="ts-menu is-dense is-small is-separated pane-dropdown-menu" id="scanMenu" role="menu"
                                        aria-label="圖片清單" hidden>
                                        <!-- 動態生成 -->
                                    </div>
                                </div>
                                <button class="ts-button is-outlined is-end-icon" data-dropdown="projectMenuDropdown">
                                    專案
                                    <span class="ts-icon is-chevron-down-icon" aria-hidden="true"></span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <input type="file" id="fileOpenProject" accept=".pitra" class="visually-hidden">
                    <input type="file" id="fileImportImage"
                        accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" multiple
                        class="visually-hidden">
                </div>

                <!-- 專案選單下拉（放在 toolbar 外，避免干擾方向鍵巡覽） -->
                <div class="ts-dropdown" id="projectMenuDropdown">
                    <button id="btnNewProject" class="item">
                        <span class="ts-icon is-plus-icon" aria-hidden="true"></span>
                        新增專案
                    </button>
                    <button id="btnOpenProject" class="item">
                        <span class="ts-icon is-folder-open-icon" aria-hidden="true"></span>
                        開啟專案
                    </button>
                    <div class="divider"></div>
                    <button id="btnSaveProject" class="item">
                        <span class="ts-icon is-download-icon" aria-hidden="true"></span>
                        匯出專案
                    </button>
                </div>

                <div aria-live="polite" class="ts-text is-description visually-hidden" id="statusRegion"></div>

                <div class="ts-divider has-vertically-spaced-small"></div>

                <!-- 編輯器主體：左側物件清單 + 中央畫布 + 右側預覽/設定 dock（桌面以上固定側欄；平板/手機退回堆疊） -->
                <div class="editor-shell" id="editorShell">
                    <div class="col-resizer" id="colResizerLeft" role="separator" aria-orientation="vertical"
                        aria-label="調整物件清單欄寬" tabindex="0" data-tooltip="拖曳調整欄寬（方向鍵微調、雙擊重設）"
                        data-position="right">
                        <span class="ts-icon is-grip-lines-vertical-icon" aria-hidden="true"></span>
                    </div>
                    <div class="ts-box is-raised" id="scanPaneBox">
                        <div class="pane-card-header">
                            <span class="pane-card-header-title">
                                <span class="ts-icon is-image-icon" aria-hidden="true"></span>
                                <span>工作區</span>
                            </span>
                            <div class="pane-toolbar-buttons">
                                <div class="ts-buttons">
                                    <button id="btnUndo" class="ts-button is-icon is-small is-ghost" aria-label="復原上一步"
                                        title="復原（Ctrl+Z）" disabled>
                                        <span class="ts-icon is-reply-icon" aria-hidden="true"></span>
                                    </button>
                                    <button id="btnRedo" class="ts-button is-icon is-small is-ghost" aria-label="重做"
                                        title="重做（Ctrl+Shift+Z）" disabled>
                                        <span class="ts-icon is-share-icon" aria-hidden="true"></span>
                                    </button>
                                </div>
                                <button id="btnFocusMode" class="ts-button is-icon is-small is-ghost" aria-label="切換全螢幕工作區"
                                    title="切換全螢幕工作區" aria-pressed="false">
                                    <span class="ts-icon is-expand-icon" aria-hidden="true"></span>
                                </button>
                            </div>
                        </div>
                        <div class="pane-canvas-wrap">
                            <canvas id="scanCanvas" tabindex="0" aria-label="工作區畫布，方向鍵平移、+/− 縮放、0 符合視窗"></canvas>
                            <div class="pane-empty-state" id="scanEmptyState">
                                <span class="ts-icon is-images-icon is-heading" aria-hidden="true"></span>
                                <div class="ts-text is-description">還沒有匯入圖片</div>
                                <div class="ts-text is-description">點擊上方「匯入」，或將圖片／PDF／.pitra 專案檔拖曳到此區域</div>
                            </div>
                            <div class="pane-loading-state skeleton" id="scanLoadingState" style="display:none">
                                <div class="ts-text is-description">圖片載入中…</div>
                            </div>
                            <div class="canvas-floating-toolbar pane-toolbar" role="toolbar" aria-label="編輯工具">
                                <div class="pane-tool-collapsible" data-collapse-priority="1">
                                    <button id="btnAddPieceFloating" class="ts-button is-icon" aria-label="新增物件"
                                        data-tooltip="新增物件">
                                        <span class="ts-icon is-plus-icon" aria-hidden="true"></span>
                                    </button>
                                    <div class="pane-toolbar-divider" aria-hidden="true"></div>
                                </div>
                                <div class="pane-tool-cluster">
                                    <div class="pane-tool-subcluster">
                                        <div class="ts-selection is-compact" role="radiogroup" aria-label="選取工具">
                                            <label class="item" data-tooltip="矩形選取（M）">
                                                <input type="radio" name="tool" value="rect" id="tool-rect" checked aria-label="矩形選取">
                                                <div class="text"><span class="ts-icon is-crop-simple-icon" aria-hidden="true"></span>
                                                    <span class="has-hidden">矩形</span></div>
                                            </label>
                                            <label class="item" data-tooltip="套索選取（L）">
                                                <input type="radio" name="tool" value="lasso" id="tool-lasso" aria-label="套索選取">
                                                <div class="text"><span class="ts-icon is-draw-polygon-icon" aria-hidden="true"></span>
                                                    <span class="has-hidden">套索</span></div>
                                            </label>
                                        </div>

                                        <div class="pane-menu-wrap" id="selectionModeMenuWrap">
                                            <button id="btnSelectionModeMenu" class="ts-button is-icon is-ghost pane-tool-chevron"
                                                aria-label="選取模式：加選" aria-haspopup="menu" aria-expanded="false"
                                                data-tooltip="選取模式（目前：加選）">
                                                <span class="ts-icon is-chevron-down-icon" aria-hidden="true"></span>
                                            </button>
                                            <div class="ts-menu is-dense is-small is-separated pane-dropdown-menu" id="selectionModeMenu" role="menu"
                                                aria-label="選取模式" hidden>
                                                <button type="button" class="item is-selected" role="menuitemradio" aria-checked="true" data-mode="add">加選（＋）</button>
                                                <button type="button" class="item" role="menuitemradio" aria-checked="false" data-mode="subtract">減選（－）</button>
                                                <button type="button" class="item" role="menuitemradio" aria-checked="false" data-mode="new">取代全部</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="pane-tool-subcluster" data-collapse-priority="3">
                                        <div class="ts-selection is-compact" role="radiogroup" aria-label="其他工具">
                                            <label class="item" data-tooltip="平移（H）">
                                                <input type="radio" name="tool" value="pan" id="tool-pan" aria-label="平移">
                                                <div class="text"><span class="ts-icon is-hand-icon" aria-hidden="true"></span> <span
                                                        class="has-hidden">平移</span></div>
                                            </label>
                                            <label class="item" data-tooltip="取樣背景色（I）">
                                                <input type="radio" name="tool" value="eyedropper" id="tool-eyedropper" aria-label="取樣背景色">
                                                <div class="text"><span class="ts-icon is-eye-dropper-icon" aria-hidden="true"></span>
                                                    <span class="has-hidden">取樣背景色</span></div>
                                            </label>
                                            <label class="item" data-tooltip="橡皮擦（E）">
                                                <input type="radio" name="tool" value="eraser" id="tool-eraser" aria-label="橡皮擦">
                                                <div class="text"><span class="ts-icon is-eraser-icon" aria-hidden="true"></span>
                                                    <span class="has-hidden">橡皮擦</span></div>
                                            </label>
                                        </div>

                                        <div class="pane-menu-wrap" id="eraserSizeMenuWrap" hidden>
                                            <button id="btnEraserSizeMenu" class="ts-button is-icon is-ghost pane-tool-chevron"
                                                aria-label="橡皮擦筆刷大小" aria-haspopup="menu" aria-expanded="false"
                                                data-tooltip="橡皮擦筆刷大小">
                                                <span class="ts-icon is-chevron-down-icon" aria-hidden="true"></span>
                                            </button>
                                            <div class="ts-menu is-small pane-dropdown-menu" id="eraserSizeMenu" hidden>
                                                <label class="ts-text is-label" for="eraserRadius">筆刷大小</label>
                                                <div class="range-row">
                                                    <div class="ts-range"><input type="range" id="eraserRadius" min="5" max="300" value="40"></div>
                                                    <div class="ts-input"><input type="number" id="eraserRadiusValue" min="5" max="300" value="40" aria-label="橡皮擦筆刷大小數值"></div>
                                                </div>
                                                <div class="has-top-spaced-small ts-text is-description">快捷鍵 [ / ]（Shift 加大步進）也可以調整；按住 Alt 拖曳＝還原（負向筆刷）。</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- 縮放控制群組本身自帶容器邊界，不需要再加分隔線。 -->
                                <div class="ts-buttons">
                                    <button id="btnZoomOut" class="ts-button is-icon" aria-label="縮小畫面" data-tooltip="縮小畫面">
                                        <span class="ts-icon is-magnifying-glass-minus-icon" aria-hidden="true"></span>
                                    </button>
                                    <span id="zoomDisplay" class="ts-button" role="button" tabindex="0"
                                        aria-label="目前縮放 100%，按 Enter 可輸入數值">100%</span>
                                    <input type="text" id="zoomInput" class="ts-button" inputmode="decimal"
                                        aria-label="輸入縮放百分比" style="display:none;">
                                    <button id="btnZoomIn" class="ts-button is-icon" aria-label="放大畫面" data-tooltip="放大畫面" data-collapse-priority="4">
                                        <span class="ts-icon is-magnifying-glass-plus-icon" aria-hidden="true"></span>
                                    </button>
                                    <button id="btnZoomFit" class="ts-button is-icon" aria-label="縮放至符合視窗" data-tooltip="縮放至符合視窗" data-collapse-priority="2">
                                        <span class="ts-icon is-expand-icon" aria-hidden="true"></span>
                                    </button>
                                </div>

                                <!-- 容器寬度不夠同時放下所有按鈕時（例如欄寬被拉桿拖窄），依 data-collapse-priority
                                     由小到大依序把上面標了優先權的按鈕「完整地」收進這個選單，而不是壓縮/裁切
                                     它們——比照 Figma 工具列窄寬度時的做法。JS 邏輯見 canvas-toolbar.js wireToolbarOverflow()。 -->
                                <div class="pane-menu-wrap" id="toolbarOverflowWrap" hidden>
                                    <button id="btnToolbarOverflow" class="ts-button is-icon is-ghost" aria-label="更多工具"
                                        aria-haspopup="menu" aria-expanded="false" data-tooltip="更多工具">
                                        <span class="ts-icon is-ellipsis-vertical-icon" aria-hidden="true"></span>
                                    </button>
                                    <div class="ts-menu is-dense is-small is-separated pane-dropdown-menu" id="toolbarOverflowMenu"
                                        role="menu" aria-label="更多工具" hidden>
                                        <button type="button" class="item" role="menuitem" id="overflowAddPiece" hidden>
                                            <span class="ts-icon is-plus-icon" aria-hidden="true"></span>
                                            <span>新增物件</span>
                                        </button>
                                        <button type="button" class="item" role="menuitem" id="overflowZoomFit" hidden>
                                            <span class="ts-icon is-expand-icon" aria-hidden="true"></span>
                                            <span>縮放至符合視窗</span>
                                        </button>
                                        <button type="button" class="item" role="menuitem" id="overflowPan" hidden>
                                            <span class="ts-icon is-hand-icon" aria-hidden="true"></span>
                                            <span>平移（H）</span>
                                        </button>
                                        <button type="button" class="item" role="menuitem" id="overflowEyedropper" hidden>
                                            <span class="ts-icon is-eye-dropper-icon" aria-hidden="true"></span>
                                            <span>取樣背景色（I）</span>
                                        </button>
                                        <button type="button" class="item" role="menuitem" id="overflowEraser" hidden>
                                            <span class="ts-icon is-eraser-icon" aria-hidden="true"></span>
                                            <span>橡皮擦（E）</span>
                                        </button>
                                        <button type="button" class="item" role="menuitem" id="overflowZoomIn" hidden>
                                            <span class="ts-icon is-magnifying-glass-plus-icon" aria-hidden="true"></span>
                                            <span>放大畫面</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-resizer" id="colResizerRight" role="separator" aria-orientation="vertical"
                        aria-label="調整預覽／設定欄寬" tabindex="0" data-tooltip="拖曳調整欄寬（方向鍵微調、雙擊重設）"
                        data-position="left">
                        <span class="ts-icon is-grip-lines-vertical-icon" aria-hidden="true"></span>
                    </div>

                    <!-- 物件縮圖清單：獨立左欄，桌面版直向排列；不再跟預覽/設定擠在同一個右側 dock。 -->
                    <aside class="editor-list" id="pieceListSidebar" aria-label="物件清單">
                        <div class="ts-box is-raised" id="pieceListBox">
                            <div class="pane-card-header">
                                <span class="pane-card-header-title">
                                    <span class="ts-icon is-layer-group-icon" aria-hidden="true"></span>
                                    <span>物件清單</span>
                                </span>
                                <div class="pane-toolbar-buttons">
                                    <div class="pane-menu-wrap">
                                        <button id="btnExportAll" class="ts-button is-icon is-small is-ghost"
                                            aria-label="匯出全部物件" title="匯出全部物件"
                                            aria-haspopup="menu" aria-expanded="false">
                                            <span class="ts-icon is-file-export-icon" aria-hidden="true"></span>
                                        </button>
                                        <div class="ts-menu is-dense is-small is-separated pane-dropdown-menu" id="exportAllMenu" role="menu"
                                            aria-label="匯出全部物件" hidden>
                                            <button type="button" class="item" role="menuitem" id="btnExportAllPNG">
                                                <span class="ts-icon is-file-image-icon" aria-hidden="true"></span>
                                                <span>PNG</span>
                                            </button>
                                            <button type="button" class="item" role="menuitem" id="btnExportAllSVG">
                                                <span class="ts-icon is-bezier-curve-icon" aria-hidden="true"></span>
                                                <span>SVG</span>
                                            </button>
                                            <button type="button" class="item" role="menuitem" id="btnExportAllZip">
                                                <span class="ts-icon is-file-zipper-icon" aria-hidden="true"></span>
                                                <span>PNG + SVG（ZIP）</span>
                                            </button>
                                        </div>
                                    </div>
                                    <button id="btnAddPiece" class="ts-button is-icon is-small is-ghost"
                                        aria-label="新增物件" title="新增物件">
                                        <span class="ts-icon is-plus-icon" aria-hidden="true"></span>
                                    </button>
                                </div>
                            </div>
                            <div class="piece-thumb-strip" id="pieceList" role="list" aria-label="物件清單">
                                <!-- 動態生成 -->
                            </div>
                        </div>
                    </aside>

                    <aside class="editor-dock" id="editorDock" aria-label="物件預覽與設定">
                        <div class="ts-box is-raised" id="previewPaneBox">
                            <div class="pane-card-header">
                                <span class="pane-card-header-title">
                                    <span class="ts-icon is-wand-magic-sparkles-icon" aria-hidden="true"></span>
                                    <span>物件預覽</span>
                                </span>
                                <div class="pane-toolbar-buttons">
                                    <div class="preview-bg-toggle" role="radiogroup" aria-label="預覽底色">
                                        <label class="preview-bg-toggle-item" data-tooltip="棋盤格底">
                                            <input type="radio" name="previewBg" value="checker" checked aria-label="棋盤格底">
                                            <span class="preview-bg-swatch is-checker" aria-hidden="true"></span>
                                        </label>
                                        <label class="preview-bg-toggle-item" data-tooltip="黑底">
                                            <input type="radio" name="previewBg" value="black" aria-label="黑底">
                                            <span class="preview-bg-swatch is-black" aria-hidden="true"></span>
                                        </label>
                                        <label class="preview-bg-toggle-item" data-tooltip="白底">
                                            <input type="radio" name="previewBg" value="white" aria-label="白底">
                                            <span class="preview-bg-swatch is-white" aria-hidden="true"></span>
                                        </label>
                                        <label class="preview-bg-toggle-item" data-tooltip="灰底">
                                            <input type="radio" name="previewBg" value="gray" aria-label="灰底">
                                            <span class="preview-bg-swatch is-gray" aria-hidden="true"></span>
                                        </label>
                                    </div>
                                    <div class="pane-toolbar-divider" aria-hidden="true"></div>
                                    <div class="pane-menu-wrap">
                                        <button id="btnPreviewMode" class="ts-button is-icon is-small is-ghost"
                                            aria-label="預覽模式：結果" title="預覽模式：結果"
                                            aria-haspopup="menu" aria-expanded="false">
                                            <span class="ts-icon is-check-icon" aria-hidden="true" id="btnPreviewModeIcon"></span>
                                        </button>
                                        <div class="ts-menu is-dense is-small is-separated pane-dropdown-menu" id="previewModeMenu" role="menu"
                                            aria-label="預覽模式" hidden>
                                            <button type="button" class="item" role="menuitemradio" aria-checked="false"
                                                data-mode="original" data-icon="is-image-icon"
                                                title="原始掃描顏色，不套用增強或去背">
                                                <span class="ts-icon is-image-icon" aria-hidden="true"></span>
                                                <span>原始</span>
                                            </button>
                                            <button type="button" class="item" role="menuitemradio" aria-checked="false"
                                                data-mode="mask" data-icon="is-circle-half-stroke-icon"
                                                title="去背遮罩灰階視覺化">
                                                <span class="ts-icon is-circle-half-stroke-icon" aria-hidden="true"></span>
                                                <span>遮罩</span>
                                            </button>
                                            <button type="button" class="item" role="menuitemradio" aria-checked="false"
                                                data-mode="overlay" data-icon="is-layer-group-icon"
                                                title="原圖疊加去背範圍標示">
                                                <span class="ts-icon is-layer-group-icon" aria-hidden="true"></span>
                                                <span>疊加</span>
                                            </button>
                                            <button type="button" class="item" role="menuitemradio" aria-checked="true"
                                                data-mode="result" data-icon="is-check-icon"
                                                title="最終去背合成結果">
                                                <span class="ts-icon is-check-icon" aria-hidden="true"></span>
                                                <span>結果</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="pane-canvas-wrap is-preview bg-checker" id="previewCanvasWrap">
                                <canvas id="previewCanvas" aria-label="目前物件的即時預覽，棋盤格代表透明區域"></canvas>
                                <div class="pane-empty-state" id="previewEmptyState">
                                    <span class="ts-icon is-crop-icon is-heading" aria-hidden="true"></span>
                                    <div class="ts-text is-description">還沒有可以預覽的選區呢</div>
                                    <div class="ts-text is-description">框選一個物件後會顯示在這裡</div>
                                </div>
                                <div class="pane-loading-state skeleton" id="previewLoadingState" style="display:none">
                                </div>
                            </div>
                        </div>

                        <div class="ts-box is-raised" id="propertiesPanel">
                            <div class="pane-card-header">
                                <span class="pane-card-header-title">
                                    <span class="ts-icon is-sliders-icon" aria-hidden="true"></span>
                                    <span>物件設定</span>
                                </span>
                            </div>
                            <div class="ts-content is-padded" id="propertiesPanelBody">
                            <div class="pane-empty-state-static" id="propertiesEmptyState">
                                <span class="ts-icon is-sliders-icon is-heading" aria-hidden="true"></span>
                                <div class="ts-text is-description">尚未選取物件</div>
                                <div class="ts-text is-description">請先在左側清單選取一個物件</div>
                            </div>

                        <div id="propertiesBody" style="display:none;">
                            <label class="ts-text is-label" for="rotationValue">旋轉角度</label>
                            <div class="has-top-spaced-small rotation-row">
                                <button id="btnRotateLeft" class="ts-button is-icon is-small" aria-label="向左旋轉 90 度"
                                    data-tooltip="向左旋轉 90 度">
                                    <span class="ts-icon is-rotate-left-icon" aria-hidden="true"></span>
                                </button>
                                <button id="btnRotateMinus" class="ts-button is-icon is-small" aria-label="微調 -1 度（按住 Shift 為 -15 度）"
                                    data-tooltip="微調 −1°（Shift −15°）">
                                    <span class="ts-icon is-minus-icon" aria-hidden="true"></span>
                                </button>
                                <div class="ts-input">
                                    <input type="number" id="rotationValue" min="-180" max="180" step="any" value="0"
                                        aria-label="旋轉角度數值（度），可在此滾動滑鼠滾輪調整">
                                </div>
                                <button id="btnRotatePlus" class="ts-button is-icon is-small" aria-label="微調 +1 度（按住 Shift 為 +15 度）"
                                    data-tooltip="微調 +1°（Shift +15°）">
                                    <span class="ts-icon is-plus-icon" aria-hidden="true"></span>
                                </button>
                                <button id="btnRotateRight" class="ts-button is-icon is-small" aria-label="向右旋轉 90 度"
                                    data-tooltip="向右旋轉 90 度">
                                    <span class="ts-icon is-rotate-right-icon" aria-hidden="true"></span>
                                </button>
                            </div>

                            <div class="ts-grid has-top-spaced">
                                <div class="column is-16-wide">
                                    <label class="ts-text is-label">物件名稱</label>
                                    <div class="has-top-spaced-small name-row">
                                        <div class="ts-input is-fluid">
                                            <input type="text" id="pieceNameInput" aria-label="物件名稱">
                                            <div class="name-input-actions" id="pieceNameActions" hidden>
                                                <button type="button" id="btnPieceNameApply"
                                                    class="ts-button is-icon is-small is-positive name-input-action"
                                                    aria-label="套用名稱" data-tooltip="套用">
                                                    <span class="ts-icon is-check-icon" aria-hidden="true"></span>
                                                </button>
                                                <button type="button" id="btnPieceNameRevert"
                                                    class="ts-button is-icon is-small name-input-action"
                                                    aria-label="還原名稱" data-tooltip="還原">
                                                    <span class="ts-icon is-arrow-rotate-left-icon" aria-hidden="true"></span>
                                                </button>
                                            </div>
                                        </div>
                                        <button id="btnOcrSuggestName" type="button" class="ts-button is-icon is-small"
                                            aria-label="辨識圖片文字，套用到名稱欄位"
                                            data-tooltip="辨識文字建議名稱（第一次使用需下載 OCR 引擎，較慢）">
                                            <span class="ts-icon is-wand-magic-sparkles-icon" aria-hidden="true"></span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- 矩形精確調整 -->
                            <div id="rectFieldsGroup" class="has-top-spaced">
                                <div class="ts-text is-label">矩形選取（像素）</div>
                                <div class="ts-grid has-top-spaced-small">
                                    <div class="column is-4-wide">
                                        <label class="ts-text is-label" for="selX">X</label>
                                        <div class="ts-input is-fluid"><input type="number" id="selX"></div>
                                    </div>
                                    <div class="column is-4-wide">
                                        <label class="ts-text is-label" for="selY">Y</label>
                                        <div class="ts-input is-fluid"><input type="number" id="selY"></div>
                                    </div>
                                    <div class="column is-4-wide">
                                        <label class="ts-text is-label" for="selW">寬</label>
                                        <div class="ts-input is-fluid"><input type="number" id="selW" min="1"></div>
                                    </div>
                                    <div class="column is-4-wide">
                                        <label class="ts-text is-label" for="selH">高</label>
                                        <div class="ts-input is-fluid"><input type="number" id="selH" min="1"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- 套索區塊清單（無障礙／精確編輯） -->
                            <div id="lassoFieldsGroup" class="has-top-spaced" style="display:none;">
                                <div class="ts-text is-label">套索區塊</div>
                                <div id="lassoLoopList" class="has-top-spaced-small"></div>
                                <div class="ts-wrap has-top-spaced-small">
                                    <button id="btnFlattenLasso" class="ts-button is-small is-outlined is-start-icon">
                                        <span class="ts-icon is-layer-group-icon" aria-hidden="true"></span>
                                        平面化選取
                                    </button>
                                    <button id="btnClearLasso" class="ts-button is-small is-outlined is-negative is-start-icon">
                                        <span class="ts-icon is-trash-icon" aria-hidden="true"></span>
                                        清除套索
                                    </button>
                                </div>
                            </div>

                            <!-- 橡皮擦：所有筆觸自動合併成單一擦除區域，不逐筆列出，只提供整批清除 -->
                            <div class="has-top-spaced">
                                <div class="ts-text is-label">橡皮擦</div>
                                <div id="eraseStrokeStatus" class="ts-text is-description has-top-spaced-small"></div>
                                <div class="ts-wrap has-top-spaced-small">
                                    <button id="btnClearErase" class="ts-button is-small is-outlined is-negative is-start-icon">
                                        <span class="ts-icon is-trash-icon" aria-hidden="true"></span>
                                        清除擦除
                                    </button>
                                </div>
                            </div>

                            <div class="ts-divider has-vertically-spaced"></div>

                            <div class="ts-header is-start-icon">
                                <span class="ts-icon is-palette-icon" aria-hidden="true"></span>
                                去背景
                            </div>

                            <label class="ts-checkbox has-top-spaced-small">
                                <input type="checkbox" id="bgRemovalEnabled" checked>
                                <div class="text">啟用去背景</div>
                            </label>

                            <div class="has-top-spaced-small">
                                <div class="ts-text is-label">背景取樣色（RGB）</div>
                                <div class="rgb-inputs has-top-spaced-small">
                                    <div id="bgSampleSwatch" class="bg-sample-swatch" aria-hidden="true"></div>
                                    <div class="ts-input"><input type="number" id="bgSampleR" min="0" max="255" aria-label="背景色 R"></div>
                                    <div class="ts-input"><input type="number" id="bgSampleG" min="0" max="255" aria-label="背景色 G"></div>
                                    <div class="ts-input"><input type="number" id="bgSampleB" min="0" max="255" aria-label="背景色 B"></div>
                                    <button id="btnAutoSampleBg" class="ts-button is-small is-outlined">自動取樣邊緣</button>
                                </div>
                            </div>

                            <div class="has-top-spaced">
                                <label class="ts-text is-label" for="bgStrength">去背強度</label>
                                <div class="range-row">
                                    <div class="ts-range"><input type="range" id="bgStrength" min="0" max="100" value="50"></div>
                                    <div class="ts-input"><input type="number" id="bgStrengthValue" min="0" max="100" value="50" aria-label="去背強度數值"></div>
                                </div>
                                <div class="has-top-spaced-small ts-text is-description">數值愈高愈積極把接近背景色的區域判定為背景；實心筆跡的顏色跟背景差異遠遠超過安全範圍，不會因為調整這個數值而變透明。</div>
                            </div>

                            <div class="has-top-spaced">
                                <label class="ts-text is-label" for="bgDespeckle">去除雜點</label>
                                <div class="range-row">
                                    <div class="ts-range"><input type="range" id="bgDespeckle" min="0" max="100" value="0"></div>
                                    <div class="ts-input"><input type="number" id="bgDespeckleValue" min="0" max="100" value="0" aria-label="去除雜點數值"></div>
                                </div>
                                <div class="has-top-spaced-small ts-text is-description">把跟主要筆畫不相連、面積很小的獨立雜點視為背景去掉；預設 0（不去除），數值愈高能去掉的雜點愈大，細線本身不會被砍斷。</div>
                            </div>

                            <div class="has-top-spaced">
                                <label class="ts-text is-label" for="bgStrokeEnhance">增強筆畫</label>
                                <div class="range-row">
                                    <div class="ts-range"><input type="range" id="bgStrokeEnhance" min="0" max="100" value="0"></div>
                                    <div class="ts-input"><input type="number" id="bgStrokeEnhanceValue" min="0" max="100" value="0" aria-label="增強筆畫數值"></div>
                                </div>
                                <div class="has-top-spaced-small ts-text is-description">把去背後留下的筆畫往外增厚，讓太細、斷開的線條變粗、重新連起來；預設 0（不調整）。</div>
                            </div>

                            <div class="ts-divider has-vertically-spaced"></div>

                            <div class="ts-header is-start-icon">
                                <span class="ts-icon is-bezier-curve-icon" aria-hidden="true"></span>
                                向量預覽
                            </div>

                            <label class="ts-checkbox has-top-spaced-small">
                                <input type="checkbox" id="svgVectorEnabled">
                                <div class="text">啟用向量預覽（SVG 全黑向量描邊）</div>
                            </label>

                            <div class="has-top-spaced-small">
                                <label class="ts-text is-label" for="svgSimplify">簡化程度</label>
                                <div class="range-row">
                                    <div class="ts-range"><input type="range" id="svgSimplify" min="0" max="3" step="0.1" value="0.75"></div>
                                    <div class="ts-input"><input type="number" id="svgSimplifyValue" min="0" max="3" step="0.1" value="0.75" aria-label="簡化程度數值"></div>
                                </div>
                                <div class="has-top-spaced-small ts-text is-description" id="svgNodeCount"></div>
                            </div>

                            <div class="has-top-spaced-small">
                                <label class="ts-text is-label" for="scanDpiInput">掃描 DPI</label>
                                <div class="ts-input"><input type="number" id="scanDpiInput" min="1" step="1" placeholder="未偵測到"></div>
                                <div class="has-top-spaced-small ts-text is-description">匯入時自動從檔案讀取，讀不到時可以手動填；留空則匯出 SVG 不含實體尺寸單位。</div>
                            </div>

                            <div class="ts-divider has-vertically-spaced"></div>

                            <div class="ts-buttons">
                                <button id="btnExportPNG" class="ts-button is-positive is-start-icon">
                                    <span class="ts-icon is-download-icon" aria-hidden="true"></span>
                                    匯出 PNG
                                </button>
                                <button id="btnExportSVG" class="ts-button is-positive is-start-icon">
                                    <span class="ts-icon is-download-icon" aria-hidden="true"></span>
                                    匯出 SVG
                                </button>
                            </div>
                        </div>
                        </div>
                        </div>
                    </aside>
                </div>

            </main>
            </div>
        </div>
    </div>

    <!-- 內文讀根目錄 LICENSE。 -->
    <dialog id="license-dialog" class="ts-modal is-large" aria-labelledby="license-dialog-title"
        data-license-src="<?= $appBasePath ?>/LICENSE">
        <div class="content license-dialog-content">
            <div class="ts-content">
                <div class="ts-header is-start-icon" id="license-dialog-title">
                    <span class="ts-icon is-copyright-icon" aria-hidden="true"></span>
                    授權 License
                </div>
                <div class="ts-tab is-dense is-pilled is-fluid license-tabs has-top-spaced" role="tablist"></div>
            </div>
            <div class="ts-content">
                <div class="ts-box license-body">
                    <div class="ts-text is-description">載入中…</div>
                </div>
            </div>
            <div class="ts-divider"></div>
            <div class="ts-content">
                <div class="ts-wrap is-end-aligned">
                    <button type="button" class="ts-button" id="btn-license-close">關閉</button>
                </div>
            </div>
        </div>
    </dialog>

    <div id="app-footer" class="ts-content is-secondary is-vertically-padded">
        <div class="ts-container is-fluid">
            <div class="ts-grid">
                <div class="column is-fluid">
                    <div class="ts-wrap is-vertical is-compact">
                        <div class="ts-text is-description">
                            <a href="/koilisu/" class="footer-plain-link">KoiLiSu 開利手</a> -
                            讓工具使用更順手的開放專案 | <a href="https://toka.dev" target="_blank" rel="noopener" class="footer-plain-link">prjToka</a>
                        </div>
                        <div class="ts-wrap is-middle-aligned is-compact">
                            <button type="button" id="btn-license" class="ts-button is-small is-start-icon footer-action-button">
                                <span class="ts-icon is-copyright-icon" aria-hidden="true"></span>
                                License
                            </button>
                            <span class="ts-text is-description">|</span>
                            <a href="https://github.com/zisunny104/pitrace" target="_blank" rel="noopener noreferrer" class="ts-button is-small is-start-icon footer-action-button">
                                <svg class="ts-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                                </svg>
                                View on GitHub<span class="sr-only"> (在新視窗開啟)</span>
                            </a>
                        </div>
                    </div>
                </div>
                <div class="column is-end-aligned">
                    <div class="ts-wrap is-top-aligned" style="height:100%">
                        <div class="ts-selection is-circular is-compact mobile:theme-switcher-stacked">
                            <label class="item">
                                <input type="radio" name="theme" value="light" id="theme-light">
                                <div class="text">淺色</div>
                            </label>
                            <label class="item">
                                <input checked type="radio" name="theme" value="system" id="theme-system">
                                <div class="text">系統</div>
                            </label>
                            <label class="item">
                                <input type="radio" name="theme" value="dark" id="theme-dark">
                                <div class="text">深色</div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script type="module" src="<?= $appBasePath ?>/js/main.js"></script>

    <script>
    // 深淺色模式功能
    function setTheme(theme) {
        document.body.className = theme === 'system' ?
            'is-rounded' :
            `is-rounded is-${theme}`;
        document.cookie = `preferred-theme=${theme}; path=/; max-age=31536000`;
    }

    function getPreferredTheme() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'preferred-theme') {
                return value;
            }
        }
        return 'system';
    }

    document.addEventListener('DOMContentLoaded', function() {
        const preferredTheme = getPreferredTheme();
        const themeRadio = document.getElementById(`theme-${preferredTheme}`);
        if (themeRadio) {
            themeRadio.checked = true;
            setTheme(preferredTheme);
        }
    });

    document.getElementById('theme-light').addEventListener('change', function() {
        if (this.checked) setTheme('light');
    });
    document.getElementById('theme-dark').addEventListener('change', function() {
        if (this.checked) setTheme('dark');
    });
    document.getElementById('theme-system').addEventListener('change', function() {
        if (this.checked) setTheme('system');
    });

    // 大螢幕版面寬度切換（容器寬度 / 滿版寬度）
    function setWidthMode(mode) {
        const container = document.getElementById('pageContainer');
        const btn = document.getElementById('btnToggleWidth');
        const icon = btn.querySelector('.ts-icon');
        const isFluid = mode === 'fluid';
        container.classList.toggle('is-fluid', isFluid);
        document.querySelector('.main-content').classList.toggle('is-fluid', isFluid);
        document.documentElement.classList.toggle('is-fluid', isFluid); // 給桌面寬版的捲動吸附用（CSS scroll-snap-type 掛在 html 上）
        btn.setAttribute('aria-pressed', String(isFluid));
        const label = isFluid ? '維持標準寬度' : '使用完整頁面寬度';
        btn.setAttribute('aria-label', label);
        btn.title = label;
        icon.className = `ts-icon ${isFluid ? 'is-arrows-left-right-to-line-icon' : 'is-arrows-left-right-icon'}`;
        document.cookie = `preferred-width=${mode}; path=/; max-age=31536000`;

        // 只有 ≥1024px（CSS @media 的錨定範圍一致）才需要跟著捲動；手機/平板進這個分支時
        // #btnToggleWidth 本來就被 widescreen-only 的欄位隱藏，不會被使用者手動觸發，
        // 這裡的寬度守衛只是保護 cookie 還原時（上次在桌面設成 fluid、這次用手機開頁面）的邊界情況。
        if (window.innerWidth >= 1024) {
            if (isFluid) {
                document.querySelector('#mainAnchor .ts-divider').scrollIntoView({ block: 'start' });
            } else {
                window.scrollTo({ top: 0 });
            }
        }
    }

    function getPreferredWidth() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'preferred-width') return value;
        }
        return 'contained';
    }

    document.addEventListener('DOMContentLoaded', function() {
        setWidthMode(getPreferredWidth());
        document.getElementById('btnToggleWidth').addEventListener('click', function() {
            const nowFluid = document.getElementById('pageContainer').classList.contains('is-fluid');
            const next = nowFluid ? 'contained' : 'fluid';
            setWidthMode(next);
            // 切成滿版寬度時順便進瀏覽器全螢幕；切回標準寬度時如果還在全螢幕就跟著退出。
            // requestFullscreen 需要使用者手勢才會成功，這裡是在 click handler 內呼叫，符合條件；
            // 部分環境（例如被 iframe 嵌入、使用者已停用權限）仍可能被拒絕，失敗就靜默略過，
            // 不影響寬度切換本身已經生效。
            if (next === 'fluid') {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                }
            } else if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        });
        // 使用者按 Esc 或瀏覽器自己的介面離開全螢幕時，滿版寬度也跟著退回標準寬度，
        // 讓「全寬度」跟「全螢幕」維持同步，不會卡在「已經不是全螢幕、但頁面還滿版」的中間狀態。
        document.addEventListener('fullscreenchange', function() {
            if (!document.fullscreenElement && document.getElementById('pageContainer').classList.contains('is-fluid')) {
                setWidthMode('contained');
            }
        });
    });
    </script>
</body>

</html>
