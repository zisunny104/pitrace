// 作品縮圖清單：依 store.project.pieces 動態產生可點擊、可鍵盤操作（Tab 逐一移動）的縮圖按鈕。

import { store, getPieceColor } from '../state.js';
import { renderPiece } from '../canvas/preview-pane.js';
import { announce } from '../a11y.js';

const thumbMaxDim = 160;

export class ThumbnailStrip {
    constructor(listEl, statusEl) {
        this.listEl = listEl;
        this.statusEl = statusEl;
        this._lastPieceIds = null;

        store.addEventListener('project-changed', () => this._onProjectChanged());
        store.addEventListener('active-piece-changed', () => this.syncActive());
        store.addEventListener('piece-changed', (e) => this.refreshOne(e.detail.pieceId));

        this.refresh();
    }

    // project-changed 不是只有新增/刪除物件才會觸發——重新命名掃描圖、校正 DPI、匯入新掃描圖
    // （state.js 的 renameScan／setScanDpi／addScan）都跟現有物件清單完全無關，卻也會 emit
    // 這個事件。只有物件的 id 或順序真的變了才需要整批重建 DOM，其餘情況略過，
    // 避免物件一多時，改個檔名就讓所有縮圖重新跑一次去背運算。
    _onProjectChanged() {
        const ids = store.project.pieces.map((p) => p.id).join(',');
        if (ids === this._lastPieceIds) return;
        this.refresh();
    }

    // 只切換 aria-current，不重建 DOM：避免點擊當下整批重建（innerHTML = ''）
    // 造成縮圖閃爍、並讓剛點擊的按鈕失去焦點。
    // 新增物件／刪除後遞補／undo-redo 都會改變 activePieceId 並觸發這裡，順便把該縮圖捲入可視
    // 範圍——用 offsetParent 檢查清單是否可見（例如單獨全螢幕模式會把整個側欄 display:none），
    // 不可見時捲動沒有意義，也不該打斷使用者當下的版面。
    syncActive() {
        const buttons = this.listEl.querySelectorAll('.piece-thumb');
        const isVisible = this.listEl.offsetParent !== null;
        for (const btn of buttons) {
            const isActive = btn.dataset.pieceId === store.activePieceId;
            btn.setAttribute('aria-current', isActive ? 'true' : 'false');
            if (isActive && isVisible) btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }

    // 單一物件變動（拖曳選取、旋轉、去背參數…）只重繪那一個縮圖，
    // 不整批 innerHTML = '' 重建：物件數量多時，避免一次編輯觸發 N 個物件全部重新跑一次去背運算。
    refreshOne(pieceId) {
        const piece = store.project.pieces.find((p) => p.id === pieceId);
        const btn = this.listEl.querySelector(`.piece-thumb[data-piece-id="${pieceId}"]`);
        if (!piece || !btn) {
            this.refresh();
            return;
        }

        btn.setAttribute('aria-label', `物件：${piece.name}`);
        const labelText = btn.querySelector('.thumb-label-text');
        if (labelText) labelText.textContent = piece.name;
        const dot = btn.querySelector('.thumb-color-dot');
        if (dot) dot.style.backgroundColor = getPieceColor(piece);

        const deleteBtn = btn.closest('.piece-thumb-item')?.querySelector('.piece-thumb-delete');
        if (deleteBtn) {
            deleteBtn.setAttribute('aria-label', `刪除物件 ${piece.name}`);
            deleteBtn.title = '刪除物件';
        }

        const placeholder = document.createElement('div');
        placeholder.className = 'thumb-placeholder skeleton';
        const oldVisual = btn.querySelector('canvas, .thumb-placeholder');
        if (oldVisual) oldVisual.replaceWith(placeholder);
        else btn.insertBefore(placeholder, btn.firstChild);

        renderPiece(piece, { maxDim: thumbMaxDim }).then((rendered) => {
            if (!placeholder.isConnected) return;
            if (!rendered) {
                placeholder.classList.remove('skeleton');
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = rendered.width;
            canvas.height = rendered.height;
            canvas.getContext('2d').drawImage(rendered, 0, 0);
            placeholder.replaceWith(canvas);
        });
    }

    refresh() {
        const pieces = store.project.pieces;
        this._lastPieceIds = pieces.map((p) => p.id).join(',');
        this.listEl.innerHTML = '';

        if (!pieces.length) {
            const empty = document.createElement('div');
            empty.className = 'piece-list-empty-state';
            empty.innerHTML = `
                <span class="ts-icon is-layer-group-icon is-heading" aria-hidden="true"></span>
                <div class="ts-text is-description">還沒有任何物件</div>
                <div class="ts-text is-description">請先按「新增物件」，再框選範圍</div>
            `;
            this.listEl.appendChild(empty);
            return;
        }

        for (const piece of pieces) {
            const item = document.createElement('div');
            item.className = 'piece-thumb-item';
            item.setAttribute('role', 'listitem');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'piece-thumb';
            btn.dataset.pieceId = piece.id;
            btn.setAttribute('aria-current', piece.id === store.activePieceId ? 'true' : 'false');
            btn.setAttribute('aria-label', `物件：${piece.name}`);
            btn.addEventListener('click', () => {
                store.setActivePiece(piece.id);
                announce(this.statusEl, `已選取物件 ${piece.name}`);
            });

            const placeholder = document.createElement('div');
            placeholder.className = 'thumb-placeholder skeleton';
            btn.appendChild(placeholder);

            const label = document.createElement('span');
            label.className = 'thumb-label';

            const dot = document.createElement('span');
            dot.className = 'thumb-color-dot';
            dot.style.backgroundColor = getPieceColor(piece);
            dot.setAttribute('aria-hidden', 'true');
            label.appendChild(dot);

            const labelText = document.createElement('span');
            labelText.className = 'thumb-label-text';
            labelText.textContent = piece.name;
            label.appendChild(labelText);

            btn.appendChild(label);

            const progress = document.createElement('div');
            progress.className = 'piece-thumb-progress';
            const progressBar = document.createElement('div');
            progressBar.className = 'piece-thumb-progress-bar';
            progress.appendChild(progressBar);
            btn.appendChild(progress);

            item.appendChild(btn);

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'ts-button is-icon is-small is-negative piece-thumb-delete';
            deleteBtn.setAttribute('aria-label', `刪除物件 ${piece.name}`);
            deleteBtn.title = '刪除物件';
            deleteBtn.innerHTML = '<span class="ts-icon is-xmark-icon" aria-hidden="true"></span>';
            deleteBtn.addEventListener('click', (evt) => {
                evt.stopPropagation();
                if (!window.confirm(`確定要刪除物件「${piece.name}」？`)) return;
                store.deletePiece(piece.id);
                announce(this.statusEl, `已刪除物件 ${piece.name}`);
            });
            item.appendChild(deleteBtn);

            this.listEl.appendChild(item);

            renderPiece(piece, { maxDim: thumbMaxDim }).then((rendered) => {
                if (!placeholder.isConnected) return;
                if (!rendered) {
                    placeholder.classList.remove('skeleton');
                    return;
                }
                const canvas = document.createElement('canvas');
                canvas.width = rendered.width;
                canvas.height = rendered.height;
                canvas.getContext('2d').drawImage(rendered, 0, 0);
                placeholder.replaceWith(canvas);
            });
        }
    }
}
