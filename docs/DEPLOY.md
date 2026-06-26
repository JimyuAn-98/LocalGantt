# 部署指南（Docker）

## 场景一：全新部署

```bash
git clone <仓库地址> LocalGantt-main
cd LocalGantt-main
docker compose up -d --build
```

启动后：Web UI `http://<IP>:1258`，MCP `http://<IP>:1259/mcp`

## 场景二：旧版本升级

使用 `update.sh` 一键完成：备份 → 拉代码 → 构建 → 重启。

```bash
./update.sh
```

跳过备份：`./update.sh --no-backup`，预览操作：`./update.sh --dry-run`

## 场景三：跨电脑迁移数据

使用 `migrate.sh`，自动检测旧数据库来源（本地文件 / 运行中容器），写入新 Docker volume，然后启动服务。

```bash
# 方式 1：旧数据库文件已在 data/ 目录下
./migrate.sh

# 方式 2：手动指定旧数据库路径
./migrate.sh /path/to/old/gantt.db
```

脚本会：
1. 自动找到旧数据库
2. 创建迁移前备份
3. 停止旧容器
4. 写入新 Docker volume
5. 启动新版本

## 日常维护

### 备份

```bash
./backup.sh                # 默认备份到 backups/ 目录
./backup.sh /mnt/nas       # 备份到指定目录
```

### 更新

```bash
./update.sh
```

## 连接 AI 客户端

### Chatbox

设置 → MCP 服务 → 添加 → URL：`http://<IP>:1259/mcp`

### Claude Desktop

编辑 `%APPDATA%\Claude\claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "localgantt": {
      "command": "docker",
      "args": ["exec", "-i", "gantt_app", "python", "mcp_server.py"]
    }
  }
}
```

## 验证

```bash
curl http://localhost:1258/api/version
curl http://localhost:1259/mcp -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
