## 第三方元件

本專案的影像處理、選取、去背、`.pitra` 讀寫等核心邏輯皆為原生實作；PDF 匯入與 OCR 名稱建議
則於使用時才動態載入下列第三方函式庫，僅在瀏覽器端執行，不隨本專案原始碼散布。

#### 由瀏覽器自 CDN 載入 · Loaded at runtime from a CDN

| 元件 Component | 用途 Purpose | 授權 License |
|---|---|---|
| Tocas UI | 介面框架 UI shell | MIT |
| pdf.js | PDF 匯入 PDF import | Apache-2.0 |
| Tesseract.js | OCR 名稱建議 OCR suggestions | Apache-2.0 |

Tocas UI 內含 Font Awesome Free 圖示（Icons CC BY 4.0 / Fonts SIL OFL 1.1 / Code MIT）。
