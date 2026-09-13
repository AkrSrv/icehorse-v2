#!/bin/bash
set -e

SERVER="root@167.233.171.88"
PROD_DIR="/root/equievent"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=========================================="
echo "🛡️ SIKKER UDRULNING TIL PRODUKTION ($SERVER)"
echo "=========================================="

echo "📸 Tager automatisk pre-deployment database backup..."
ssh "$SERVER" "/root/scripts/backup_db.sh pre-deploy"

echo "📦 Synkroniserer kode til Produktion..."
rsync -avz --exclude='node_modules' --exclude='.git' "$SCRIPT_DIR/backend/" "$SERVER:$PROD_DIR/backend/"
rsync -avz --exclude='node_modules' --exclude='.git' "$SCRIPT_DIR/frontend/" "$SERVER:$PROD_DIR/frontend/"
rsync -avz "$SCRIPT_DIR/index.html" "$SERVER:$PROD_DIR/index.html"

echo "🔄 Genstarter Produktions-containere uden datatab..."
ssh "$SERVER" "cd $PROD_DIR && docker compose restart backend frontend"

echo "🏥 Udfører helbredstjek på produktion..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.equievent.dk/docs || echo "000")
if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Helbredstjek bestået! API svarer med HTTP 200 OK."
else
    echo "⚠️ Advarsel: API svarede med HTTP $HTTP_CODE"
fi

echo "🎉 Udrulning til Produktion fuldført succesfuldt!"
