#!/usr/bin/env bash
# ==============================================
# 甘特图项目管理工具 — 一键更新脚本
#
# 用法：
#   ./update.sh              # 拉取最新代码并重启
#   ./update.sh --no-backup  # 跳过备份步骤
#   ./update.sh --dry-run    # 预览将要执行的操作
# ==============================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

DRY_RUN=false
SKIP_BACKUP=false

for arg in "$@"; do
    case "$arg" in
        --dry-run)   DRY_RUN=true ;;
        --no-backup) SKIP_BACKUP=true ;;
        *)           echo "未知参数: $arg"; exit 1 ;;
    esac
done

# ── 0. 当前状态 ──────────────────────────────────
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
OLD_VERSION=$(cat "$SCRIPT_DIR/VERSION" 2>/dev/null || echo "unknown")
echo "=== 甘特图更新工具 ==="
echo "当前版本: $OLD_VERSION ($OLD_COMMIT)"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── 1. 拉取代码 ──────────────────────────────────
echo "[1/5] 拉取最新代码..."
if $DRY_RUN; then
    echo "  (dry-run) git pull"
else
    git pull origin main 2>&1 || {
        echo "  警告: git pull 失败，继续使用当前代码"
    }
fi
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "  新版本: $NEW_COMMIT"

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ] && ! $DRY_RUN; then
    echo "  代码无变化，跳过构建步骤。"
    echo "完成 — 已是最新版本 ($NEW_COMMIT)"
    exit 0
fi

# ── 2. 备份数据 ──────────────────────────────────
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/gantt_$(date '+%Y%m%d_%H%M%S')_${OLD_COMMIT}.db"

if $SKIP_BACKUP; then
    echo "[2/5] 跳过数据备份 (--no-backup)"
else
    echo "[2/5] 备份数据库..."
    if $DRY_RUN; then
        echo "  (dry-run) 将备份到: $BACKUP_FILE"
    else
        mkdir -p "$BACKUP_DIR"
        # Docker volume 数据在 gantt_data 卷中，先用 docker cp 取出来
        if docker ps --format '{{.Names}}' | grep -q 'gantt_app'; then
            docker cp gantt_app:/app/data/gantt.db "$BACKUP_FILE" 2>/dev/null && \
                echo "  备份成功: $BACKUP_FILE" || \
                echo "  警告: 备份失败，继续更新..."
        else
            echo "  容器未运行，跳过备份"
        fi
    fi
fi

# ── 3. 构建镜像 ──────────────────────────────────
echo "[3/5] 构建 Docker 镜像 (版本: $NEW_COMMIT)..."
if $DRY_RUN; then
    echo "  (dry-run) docker compose build --build-arg GIT_COMMIT=$NEW_COMMIT"
else
    docker compose build --build-arg GIT_COMMIT="$NEW_COMMIT"
fi

# ── 4. 重启服务 ──────────────────────────────────
echo "[4/5] 重启服务..."
if $DRY_RUN; then
    echo "  (dry-run) docker compose up -d"
else
    docker compose up -d
fi

# ── 5. 等待健康检查 ──────────────────────────────
echo "[5/5] 等待服务就绪..."
if $DRY_RUN; then
    echo "  (dry-run) 跳过健康检查"
else
    for i in $(seq 1 12); do
        if curl -sf http://localhost:1258/api/version > /dev/null 2>&1; then
            VERSION=$(curl -s http://localhost:1258/api/version | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
            echo "  服务就绪 — 运行版本: $VERSION"
            break
        fi
        echo "  等待中... ($i/12)"
        sleep 3
    done
fi

echo ""
echo "=== 更新完成 ==="
echo "旧版本: $OLD_VERSION ($OLD_COMMIT)"
echo "新版本: $(cat "$SCRIPT_DIR/VERSION" 2>/dev/null || echo 'unknown') ($NEW_COMMIT)"
