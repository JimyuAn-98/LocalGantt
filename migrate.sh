#!/usr/bin/env bash
# ==============================================
# 甘特图 — 旧数据迁移脚本
#
# 场景 A：同一台服务器，旧 docker-compose 升到新版
# 场景 B：从另一台服务器迁移数据库过来
# ==============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== 甘特图数据迁移工具 ==="
echo ""

# ── 检查数据文件来源 ────────────────────────────
DB_FILE=""

# 1) 旧版 bind-mount 遗留的本地文件
if [ -f "$SCRIPT_DIR/data/gantt.db" ]; then
    DB_FILE="$SCRIPT_DIR/data/gantt.db"
    echo "发现本地数据库: data/gantt.db"
# 2) 旧版容器还在运行，从容器里拷
elif docker ps --format '{{.Names}}' | grep -q 'gantt_app'; then
    echo "从运行中的旧容器导出数据库..."
    docker cp gantt_app:/app/data/gantt.db "$SCRIPT_DIR/data/gantt.db" 2>/dev/null || true
    if [ -f "$SCRIPT_DIR/data/gantt.db" ]; then
        DB_FILE="$SCRIPT_DIR/data/gantt.db"
        echo "导出成功: data/gantt.db"
    fi
fi

# 3) 用户手动指定
if [ -z "$DB_FILE" ] && [ -n "${1:-}" ] && [ -f "$1" ]; then
    DB_FILE="$1"
    echo "使用指定文件: $DB_FILE"
fi

if [ -z "$DB_FILE" ]; then
    echo "错误: 找不到数据库文件。"
    echo ""
    echo "请通过以下方式之一提供旧数据库："
    echo "  1. 把旧 gantt.db 放到项目的 data/ 目录下"
    echo "  2. 如果旧容器还在运行，先 docker cp gantt_app:/app/data/gantt.db ./data/"
    echo "  3. 手动指定: ./migrate.sh /path/to/gantt.db"
    exit 1
fi

echo "数据库大小: $(wc -c < "$DB_FILE") bytes"
echo ""

# ── 确认 ────────────────────────────────────────
echo "即将把以上数据库导入新的 Docker volume 'gantt_data'。"
echo "如果 volume 中已有数据，将被覆盖。"
read -rp "确认继续? [y/N] " yn
if [ "$yn" != "y" ] && [ "$yn" != "Y" ]; then
    echo "取消。"
    exit 0
fi

# ── 先做一份带时间戳的备份 ──────────────────────
mkdir -p "$SCRIPT_DIR/backups"
BACKUP_FILE="$SCRIPT_DIR/backups/pre_migrate_$(date '+%Y%m%d_%H%M%S').db"
cp "$DB_FILE" "$BACKUP_FILE"
echo "已创建迁移前备份: $BACKUP_FILE"

# ── 停掉现有容器 ────────────────────────────────
echo "停止现有容器..."
docker compose down 2>/dev/null || true

# ── 把数据库写入 named volume ────────────────────
# 先确保 volume 存在
docker volume create gantt_data 2>/dev/null || true

# 用临时 alpine 容器把 db 文件拷进去
echo "写入 Docker volume..."
docker run --rm \
    -v gantt_data:/target \
    -v "$(dirname "$DB_FILE"):/source:ro" \
    alpine \
    cp "/source/$(basename "$DB_FILE")" /target/gantt.db

echo "数据已写入 volume 'gantt_data'"

# ── 启动新容器 ──────────────────────────────────
echo "启动新版本..."
docker compose up -d

# ── 等待就绪 ────────────────────────────────────
echo "等待服务就绪..."
for i in $(seq 1 10); do
    if curl -sf http://localhost:1258/api/version > /dev/null 2>&1; then
        echo "服务已启动"
        break
    fi
    echo "  等待中... ($i/10)"
    sleep 2
done

echo ""
echo "=== 迁移完成 ==="
echo "访问 http://<服务器IP>:1258 验证数据是否正常。"
