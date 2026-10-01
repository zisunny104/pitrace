// 頂部「專案操作」列（#projectToolbar）：新增/開啟/儲存專案、圖片匯入選單、拖放匯入。

import { store, createEmptyProject } from '../state.js';
import { serializeProject, parseProjectZip } from '../pitra-format.js';
import { detectImageDpi } from '../processing/image-metadata.js';
import { renderPdfPages } from '../processing/pdf-import.js';
import { announce } from '../a11y.js';
import { clearSnapshot } from '../autosave.js';
import { el, makeIcon, wireDropdownToggle, downloadBlob, stripExtension } from './dom-utils.js';

async function importImageFiles(files, statusEl) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    // 專案名稱預設為第一次匯入的檔名：只在專案還沒有任何圖片、且名稱還沒被手動改過時才代入，
    // 避免蓋掉使用者已經自己命名（或後續再匯入更多圖片）的專案。
    const isFreshProject = store.project.scans.length === 0 && store.project.name === '未命名專案';
    let first = true;
    for (const file of imageFiles) {
        if (first && isFreshProject) {
            store.project.name = stripExtension(file.name);
            el('projectNameInput').value = store.project.name;
        }
        first = false;
        const buf = await file.arrayBuffer();
        const bitmap = await createImageBitmap(new Blob([buf], { type: file.type }));
        const { width, height } = bitmap;
        bitmap.close();
        const dpi = detectImageDpi(new Uint8Array(buf), file.type);
        await store.addScan({ filename: file.name, mime: file.type, bytes: buf, width, height, dpi });
    }
    if (imageFiles.length) announce(statusEl, `已匯入 ${imageFiles.length} 張圖片`);
    else if (files.length) announce(statusEl, '未找到可匯入的圖片檔案');
    return imageFiles.length;
}

// PDF 匯入：每一頁渲染成一張獨立的掃描圖，落地流程比照 importImageFiles——專案名稱只在
// 「還是全新專案」時代入（這裡用 PDF 檔名），每頁再各自呼叫 store.addScan()，超過
// MAX_SCAN_PIXELS 時會由 state.js 既有的延遲壓縮機制自動轉 webp，這裡不用另外處理。
async function importPdfFiles(files, statusEl) {
    const pdfFiles = files.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (!pdfFiles.length) return 0;
    const isFreshProject = store.project.scans.length === 0 && store.project.name === '未命名專案';
    let first = true;
    let totalPages = 0;
    // addScan() 每次都會把新加入的頁面設為當前掃描圖，逐頁匯入完會停在最後一頁；
    // 記下這批匯入第一份 PDF 的第一頁，全部匯入完再切回去，讓使用者從頭開始看。
    let firstScanId = null;
    for (const file of pdfFiles) {
        const baseName = stripExtension(file.name);
        if (first && isFreshProject) {
            store.project.name = baseName;
            el('projectNameInput').value = store.project.name;
        }
        first = false;
        announce(statusEl, `正在匯入 PDF「${file.name}」…`);
        const buf = await file.arrayBuffer();
        const pages = await renderPdfPages(buf, (page, total) => {
            announce(statusEl, `正在渲染「${file.name}」第 ${page}/${total} 頁…`);
        });
        for (const page of pages) {
            const filename = `${baseName}_頁面_${page.pageNumber}.png`;
            const scan = await store.addScan({ filename, mime: 'image/png', bytes: page.bytes, width: page.width, height: page.height, dpi: page.dpi });
            if (!firstScanId) firstScanId = scan.id;
        }
        totalPages += pages.length;
    }
    if (firstScanId) store.setActiveScan(firstScanId);
    announce(statusEl, `已匯入 ${pdfFiles.length} 份 PDF，共 ${totalPages} 頁`);
    return pdfFiles.length;
}

async function openProjectFile(file, statusEl) {
    announce(statusEl, '開啟專案中…');
    try {
        const buf = await file.arrayBuffer();
        const project = parseProjectZip(buf);
        store.setProject(project);
        el('projectNameInput').value = project.name;
        announce(statusEl, `已開啟專案「${project.name}」`);
    } catch (err) {
        announce(statusEl, `開啟失敗：${err.message}`);
    }
}

export function wireDragDropImport(statusEl) {
    const target = document.getElementById('main-content');
    if (!target) return;

    function hasFiles(evt) {
        return Array.from(evt.dataTransfer?.types || []).includes('Files');
    }

    // 防止瀏覽器預設把拖入的檔案直接開啟導覽走，即使沒有落在拖放區內也要攔截。
    window.addEventListener('dragover', (evt) => {
        if (hasFiles(evt)) evt.preventDefault();
    });
    window.addEventListener('drop', (evt) => {
        if (hasFiles(evt)) evt.preventDefault();
    });

    let dragDepth = 0;
    target.addEventListener('dragenter', (evt) => {
        if (!hasFiles(evt)) return;
        evt.preventDefault();
        dragDepth += 1;
        target.classList.add('is-drag-target');
    });
    target.addEventListener('dragover', (evt) => {
        if (!hasFiles(evt)) return;
        evt.preventDefault();
    });
    target.addEventListener('dragleave', () => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) target.classList.remove('is-drag-target');
    });
    target.addEventListener('drop', async (evt) => {
        if (!hasFiles(evt)) return;
        evt.preventDefault();
        dragDepth = 0;
        target.classList.remove('is-drag-target');
        const files = Array.from(evt.dataTransfer?.files || []);
        const projectFile = files.find((f) => f.name.toLowerCase().endsWith('.pitra'));
        if (projectFile) await openProjectFile(projectFile, statusEl);
        else if (files.length) {
            await importImageFiles(files, statusEl);
            await importPdfFiles(files, statusEl);
        }
    });
}

// 「匯入」按鈕：還沒有圖片時是單純的匯入按鈕；有圖片後變成下拉選單（觸發鈕顯示目前
// 使用中的圖片檔名），選單裡每張圖片一列（點列＝切換使用中圖片，鉛筆＝重新命名，垃圾桶＝刪除），
// 最下面用分隔線隔開放「匯入」——清單（切換圖片）是較常用的操作放上面，新增放最後，
// 跟大多數檔案選單「先看現有項目、新增放最後」的慣例一致。
// 原本是「匯入圖片」按鈕 + 獨立的圖片下拉選單/移除鈕兩組並排，有圖片後兩組同時顯示，
// 在 .pane-toolbar-buttons 裡疊成兩行擠壓版面；合併成一顆下拉選單後版面固定只有一行。
function wireScanMenu(statusEl) {
    const btnImportImage = el('btnImportImage');
    const btnImportImageLabel = el('btnImportImageLabel');
    const btnImportImageChevron = el('btnImportImageChevron');
    const scanMenu = el('scanMenu');
    const fileImportImage = el('fileImportImage');

    // chevron 只在選單實際展開時才顯示，收合狀態一律隱藏（呼應 syncTrigger 內的初始/重同步狀態）。
    const menuToggle = wireDropdownToggle(btnImportImage, scanMenu, (isOpen) => {
        btnImportImageChevron.hidden = !isOpen;
    });
    let renamingScanId = null; // 正在編輯檔名的圖片；渲染時該列換成輸入框，其餘照舊

    function removeScanWithConfirm(scan) {
        const affected = store.project.pieces.filter((p) => p.scanId === scan.id).length;
        const warning = affected > 0
            ? `確定要移除圖片「${scan.filename}」？將一併刪除 ${affected} 個引用此圖片的物件，此操作無法復原。`
            : `確定要移除圖片「${scan.filename}」？此操作無法復原。`;
        if (!window.confirm(warning)) return;
        store.removeScan(scan.id);
        announce(statusEl, `已移除圖片 ${scan.filename}`);
    }

    function renderScanMenu() {
        const scans = store.project.scans;
        scanMenu.innerHTML = '';
        for (const scan of scans) {
            const row = document.createElement('div');
            row.className = 'pane-scan-menu-row';

            if (renamingScanId === scan.id) {
                // 輸入框不能長在 selectBtn（<button>）裡面——button 的內容模型不允許互動元素巢狀，
                // 所以編輯中整列直接換成獨立的輸入框，不重用 selectBtn 結構。
                // Tocas 的 .ts-input 是外層 wrapper div、實際 <input> 不帶 class，跟 projectNameInput/
                // pieceNameInput 兩處既有寫法一致。
                const inputWrap = document.createElement('div');
                inputWrap.className = 'ts-input is-fluid pane-scan-menu-rename-input';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = scan.filename;
                input.setAttribute('aria-label', `重新命名圖片「${scan.filename}」`);
                let escaped = false;
                function commit() {
                    if (escaped) return;
                    const trimmed = input.value.trim();
                    renamingScanId = null;
                    if (trimmed && trimmed !== scan.filename) {
                        store.renameScan(scan.id, trimmed);
                        announce(statusEl, `已將圖片重新命名為「${trimmed}」`);
                    } else {
                        renderScanMenu();
                    }
                }
                input.addEventListener('keydown', (evt) => {
                    if (evt.key === 'Enter') {
                        evt.preventDefault();
                        input.blur();
                    } else if (evt.key === 'Escape') {
                        evt.preventDefault();
                        evt.stopPropagation();
                        escaped = true;
                        renamingScanId = null;
                        renderScanMenu();
                    }
                });
                input.addEventListener('blur', commit);
                input.addEventListener('click', (evt) => evt.stopPropagation());
                inputWrap.appendChild(input);
                row.appendChild(inputWrap);
                scanMenu.appendChild(row);
                requestAnimationFrame(() => {
                    input.focus();
                    input.select();
                });
                continue;
            }

            const isActive = scan.id === store.activeScanId;
            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.className = 'item';
            selectBtn.setAttribute('role', 'menuitemradio');
            selectBtn.setAttribute('aria-checked', String(isActive));
            selectBtn.title = scan.filename;
            selectBtn.appendChild(makeIcon(isActive ? 'is-check-icon' : 'is-image-icon'));
            const nameSpan = document.createElement('span');
            nameSpan.className = 'pane-scan-menu-name';
            nameSpan.textContent = scan.filename;
            selectBtn.appendChild(nameSpan);
            selectBtn.addEventListener('click', () => {
                store.setActiveScan(scan.id);
                menuToggle.close();
            });

            const renameBtn = document.createElement('button');
            renameBtn.type = 'button';
            renameBtn.className = 'ts-button is-icon is-small is-ghost';
            renameBtn.setAttribute('aria-label', `重新命名「${scan.filename}」`);
            renameBtn.title = '重新命名';
            renameBtn.appendChild(makeIcon('is-edit-icon'));
            renameBtn.addEventListener('click', (evt) => {
                evt.stopPropagation();
                renamingScanId = scan.id;
                renderScanMenu();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'ts-button is-icon is-small is-negative is-ghost';
            deleteBtn.setAttribute('aria-label', `移除「${scan.filename}」`);
            deleteBtn.title = '移除圖片';
            deleteBtn.appendChild(makeIcon('is-trash-icon'));
            deleteBtn.addEventListener('click', (evt) => {
                evt.stopPropagation();
                removeScanWithConfirm(scan);
            });

            row.append(selectBtn, renameBtn, deleteBtn);
            scanMenu.appendChild(row);
        }

        if (scans.length > 0) {
            const divider = document.createElement('div');
            divider.className = 'divider';
            scanMenu.appendChild(divider);
        }

        const importItem = document.createElement('button');
        importItem.type = 'button';
        importItem.className = 'item';
        importItem.setAttribute('role', 'menuitem');
        importItem.appendChild(makeIcon('is-upload-icon'));
        const importLabel = document.createElement('span');
        importLabel.textContent = '匯入';
        importItem.appendChild(importLabel);
        importItem.addEventListener('click', () => {
            menuToggle.close();
            fileImportImage.click();
        });
        scanMenu.appendChild(importItem);
    }

    function syncTrigger() {
        const scans = store.project.scans;
        if (scans.length === 0) {
            btnImportImageLabel.textContent = '匯入';
            btnImportImageChevron.hidden = true;
            btnImportImage.removeAttribute('title');
            // 沒有圖片時點下去是直接開檔案選擇窗，不是開選單，aria-haspopup/aria-expanded
            // 這兩個「這顆按鈕會開選單」的語意屬性拿掉，螢幕報讀器才不會報成選單按鈕。
            btnImportImage.removeAttribute('aria-haspopup');
            btnImportImage.removeAttribute('aria-expanded');
        } else {
            const active = store.getActiveScan();
            btnImportImageLabel.textContent = active ? active.filename : `${scans.length} 張圖片`;
            btnImportImageChevron.hidden = scanMenu.hidden;
            btnImportImage.title = active ? active.filename : '';
            btnImportImage.setAttribute('aria-haspopup', 'menu');
            btnImportImage.setAttribute('aria-expanded', String(!scanMenu.hidden));
        }
    }

    function syncScanUI() {
        syncTrigger();
        renderScanMenu();
    }

    btnImportImage.addEventListener('click', () => {
        if (store.project.scans.length === 0) {
            fileImportImage.click();
            return;
        }
        menuToggle.toggle();
    });

    store.addEventListener('project-changed', syncScanUI);
    store.addEventListener('scan-changed', syncScanUI);
    syncScanUI();
}

export function wireProjectToolbar(statusEl) {
    const projectNameInput = el('projectNameInput');

    projectNameInput.addEventListener('change', () => {
        store.project.name = projectNameInput.value.trim() || '未命名專案';
    });

    wireScanMenu(statusEl);

    el('btnNewProject').addEventListener('click', () => {
        const hasContent = store.project.scans.length > 0 || store.project.pieces.length > 0;
        if (hasContent && !window.confirm('目前的專案尚未匯出，確定要新增專案並捨棄目前內容？')) return;
        store.setProject(createEmptyProject());
        clearSnapshot(); // 使用者已經明確同意捨棄，連同自動儲存的快照一起清掉，避免下次重新整理又被問一次要不要復原舊內容
        projectNameInput.value = '未命名專案';
        announce(statusEl, '已新增專案');
    });

    const fileOpenProject = el('fileOpenProject');
    el('btnOpenProject').addEventListener('click', () => fileOpenProject.click());
    fileOpenProject.addEventListener('change', async (evt) => {
        const file = evt.target.files?.[0];
        evt.target.value = '';
        if (!file) return;
        await openProjectFile(file, statusEl);
    });

    const btnSaveProject = el('btnSaveProject');
    btnSaveProject.addEventListener('click', () => {
        const bytes = serializeProject(store.project);
        const blob = new Blob([bytes], { type: 'application/zip' });
        downloadBlob(blob, `${store.project.name || 'pitrace-project'}.pitra`);
        announce(statusEl, '已匯出 .pitra 專案檔');
    });

    // 空專案（尚未匯入圖片、也沒有任何物件）沒有內容可匯出，停用避免產生空白 .pitra 檔。
    function syncSaveProjectEnabled() {
        const hasContent = store.project.scans.length > 0 || store.project.pieces.length > 0;
        btnSaveProject.disabled = !hasContent;
    }
    store.addEventListener('project-changed', syncSaveProjectEnabled);
    store.addEventListener('scan-changed', syncSaveProjectEnabled);
    syncSaveProjectEnabled();

    const fileImportImage = el('fileImportImage');
    const btnImportImage = el('btnImportImage');
    // btnImportImage 的 click 監聽已經在 wireScanMenu 裡處理（沒圖片直接開檔案選擇窗、
    // 有圖片改開下拉選單）；這裡不能再重複掛一個無條件開檔案選擇窗的 click，
    // 不然有圖片時點下去選單跟檔案選擇窗會同時彈出。
    fileImportImage.addEventListener('change', async (evt) => {
        const files = Array.from(evt.target.files || []);
        evt.target.value = '';
        if (!files.length) return;
        btnImportImage.disabled = true;
        btnImportImage.classList.add('is-loading');
        try {
            await importImageFiles(files, statusEl);
            await importPdfFiles(files, statusEl);
        } finally {
            btnImportImage.disabled = false;
            btnImportImage.classList.remove('is-loading');
        }
    });
}
