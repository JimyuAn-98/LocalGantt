#!/usr/bin/env bash
# ==============================================
# 甘特图项目管理工具 — 手动备份脚本
#
# 用法：
#   ./backup.sh              # 备份到默认目录
#   ./backup.sh /some/path   # 备份到指定目录
# ==============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${1:-$SCRIPT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/gantt_${TIMESTAMP}.db"

echo "备份甘特图数据库..."

# 方式 1: 容器运行中 — docker cp
if docker ps --format '{{.Names}}' | grep -q 'gantt_app'; then
    docker cp gantt_app:/app/data/gantt.db "$BACKUP_FILE" && \
        echo "备份成功: $BACKUP_FILE ($(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null) bytes)"
    exit 0
fi

# 方式 2: Docker volume 存在但容器未运行
if docker volume ls | grep -q 'gantt_data'; then
    docker run --rm -v gantt_data:/data -v "$BACKUP_DIR":/backup alpine \
        cp /data/gantt.db "/backup/$(basename "$BACKUP_FILE")" 2>/dev/null && \
        echo "备份成功 (via volume): $BACKUP_FILE" && exit 0
fi

# 方式 3: 本地文件直接复制
if [ -f "$SCRIPT_DIR/data/gantt.db" ]; then
    cp "$SCRIPT_DIR/data/gantt.db" "$BACKUP_FILE" && \
        echo "备份成功 (本地): $BACKUP_FILE" && exit 0
fi

echo "错误: 找不到数据库文件"
exit 1
