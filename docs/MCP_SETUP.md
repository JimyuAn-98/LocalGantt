# MCP 服务连接指南

## URL 格式

HTTP 模式启动后，MCP 服务地址为：

```
http://<host>:<port><path>
```

默认值（不传参数）：

```
http://127.0.0.1:1259/mcp
```

## 启动 HTTP 模式

```bash
# 默认 host=127.0.0.1 port=1259 path=/mcp
C:\Users\1\.conda\envs\gantt\python.exe mcp_server.py --transport http

# 自定义端口
C:\Users\1\.conda\envs\gantt\python.exe mcp_server.py --transport http --port 9090

# 局域网部署（允许其他电脑访问）
C:\Users\1\.conda\envs\gantt\python.exe mcp_server.py --transport http --host 0.0.0.0 --port 1259
```

启动后终端会打印实际 URL。

## Chatbox 配置

### 新版本 Chatbox（v1.10+，支持 MCP）

1. 打开 Chatbox → **设置** → **MCP 服务**
2. 点击 **添加 MCP 服务**
3. 填写：
   - **名称**：`LocalGantt`（随意）
   - **URL**：`http://127.0.0.1:1259/mcp`（和启动参数一致）
4. 点击保存，Chatbox 会自动连接并发现所有工具

### 旧版本 Chatbox / 其他客户端

如果不支持 MCP，可以用 **自定义 API 端点** 模式，填 Flask 的 REST API：

```
http://127.0.0.1:1258/api/projects/
http://127.0.0.1:1258/api/tasks/all
http://127.0.0.1:1258/api/persons/
```

但这种方式没有 MCP 的工具描述，体验不如 MCP。

## Claude Desktop 配置

Claude Desktop 用 stdio 模式（非 HTTP），不需要先启动服务器：

编辑 `%APPDATA%\Claude\claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "localgantt": {
      "command": "C:\\Users\\1\\.conda\\envs\\gantt\\python.exe",
      "args": ["D:\\HJY\\OneDrive\\学习\\LocalGantt-main\\mcp_server.py"]
    }
  }
}
```

Claude Desktop 启动时自动 spawn MCP 子进程，不需要手动启动。

## 可用工具列表

| 分类 | 工具名 | 说明 |
|------|--------|------|
| 项目 | `list_projects` | 列出所有项目 |
| | `get_project` | 获取项目详情 |
| | `create_project` | 创建项目 |
| | `update_project` | 更新项目 |
| | `delete_project` | 删除项目 |
| 任务 | `list_tasks` | 列出项目任务 |
| | `list_all_tasks` | 列出全部任务 |
| | `get_task` | 获取任务详情 |
| | `create_task` | 创建任务 |
| | `update_task` | 更新任务 |
| | `update_task_progress` | 快捷更新进度 |
| | `delete_task` | 删除任务 |
| 负责人 | `list_persons` | 列出负责人 |
| | `create_person` | 创建负责人 |
| | `update_person` | 更新负责人 |
| | `delete_person` | 删除负责人 |
| 依赖 | `add_dependency` | 添加依赖 |
| | `remove_dependency` | 移除依赖 |
| 分析 | `get_critical_path` | 关键路径 |
| | `get_project_overview` | 项目概览 |
