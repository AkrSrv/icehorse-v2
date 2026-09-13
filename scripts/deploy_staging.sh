#!/bin/bash
set -e

SERVER="root@167.233.171.88"
STAGING_DIR="/root/equievent-staging"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=========================================="
echo "🚀 Udruller til Staging Miljø ($SERVER)..."
echo "=========================================="

echo "📦 Synkroniserer kode til Staging..."
rsync -avz --exclude='node_modules' --exclude='.git' "$SCRIPT_DIR/backend/" "$SERVER:$STAGING_DIR/backend/"
rsync -avz --exclude='node_modules' --exclude='.git' "$SCRIPT_DIR/frontend/" "$SERVER:$STAGING_DIR/frontend/"
rsync -avz "$SCRIPT_DIR/index.html" "$SERVER:$STAGING_DIR/index.html"

echo "🔄 Genstarter Staging containere..."
ssh "$SERVER" "cd $STAGING_DIR && docker compose restart backend frontend"

echo "✅ Udrulning til Staging gennemført!"
