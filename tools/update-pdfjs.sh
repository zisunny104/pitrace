#!/usr/bin/env bash
# 更新 pitrace 用的 pdf.js 版本:抓新版檔案、算SHA384、自動寫回 pdf-import.js。
# hash依然會寫死存進程式碼(這是故意的,SRI驗證的意義就是要有一個固定答案,
# 不能在瀏覽器執行時才去問CDN拿"正確答案",那樣CDN被攻破時驗證就形同沒做)。
# 用法: ./update-pdfjs.sh 6.4.299
set -euo pipefail

VERSION="${1:?用法: $0 <版本號,例如 6.4.299>}"
FILE="$(dirname "$0")/../js/processing/pdf-import.js"
BASE="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/$VERSION"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "下載 pdf.js $VERSION ..."
curl -sf "$BASE/pdf.min.mjs" -o "$TMPDIR/pdf.min.mjs" || { echo "下載失敗,確認版本號是否正確"; exit 1; }
curl -sf "$BASE/pdf.worker.min.mjs" -o "$TMPDIR/pdf.worker.min.mjs" || { echo "下載失敗,確認版本號是否正確"; exit 1; }

MAIN_HASH=$(openssl dgst -sha384 -binary "$TMPDIR/pdf.min.mjs" | base64)
WORKER_HASH=$(openssl dgst -sha384 -binary "$TMPDIR/pdf.worker.min.mjs" | base64)

echo "main hash:   $MAIN_HASH"
echo "worker hash: $WORKER_HASH"

python3 - "$FILE" "$VERSION" "$MAIN_HASH" "$WORKER_HASH" << 'PYEOF'
import re, sys
file, version, main_hash, worker_hash = sys.argv[1:5]
content = open(file, encoding='utf-8').read()
content = re.sub(r"PDFJS_VERSION = '[^']*'", f"PDFJS_VERSION = '{version}'", content)
content = re.sub(r"PDFJS_MAIN_SHA384 = '[^']*'", f"PDFJS_MAIN_SHA384 = '{main_hash}'", content)
content = re.sub(r"PDFJS_WORKER_SHA384 = '[^']*'", f"PDFJS_WORKER_SHA384 = '{worker_hash}'", content)
open(file, 'w', encoding='utf-8').write(content)
print(f"已更新 {file}")
PYEOF

echo "完成。請記得測試PDF匯入功能,確認正常後再commit。"
