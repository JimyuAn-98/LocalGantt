# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作提供指导。

部署到新电脑的完整步骤见 `docs/DEPLOY.md`。

## 运行与开发

**Conda 环境**：`gantt`（Python 3.11.15）
**Python 路径**：`C:\Users\1\.conda\envs\gantt\python.exe`

```bash
# 首次初始化环境
C:\Users\1\.conda\envs\gantt\python.exe -m pip install -r requirements.txt
C:\Users\1\.conda\envs\gantt\python.exe scripts/download_vendor.py

# 日常启动
C:\Users\1\.conda\envs\gantt\python.exe app.py   # 访问 http://localhost:1258

# 数据库迁移（通常启动时自动完成）
C:\Users\1\.conda\envs\gantt\python.exe migrate_db.py
```

Docker：`docker-compose up --build`

## MCP 服务

`mcp_server.py` — MCP Python SDK (FastMCP)，两种传输模式，供 AI agent CRUD 项目数据。

**stdio 模式**（Claude Desktop 等本地 agent 直接 spawn 子进程，无需手动启动）：
```bash
C:\Users\1\.conda\envs\gantt\python.exe mcp_server.py
```

**HTTP 模式**（Chatbox / 远程 agent 通过 URL 连接）：
```bash
C:\Users\1\.conda\envs\gantt\python.exe mcp_server.py --transport http
# 默认 http://127.0.0.1:1259/mcp
# 自定义: --host 0.0.0.0 --port 1259 --path /mcp
```

**调试**：
```bash
npx @anthropic-ai/mcp-inspector C:\Users\1\.conda\envs\gantt\python.exe mcp_server.py
```

暴露 20 个工具（5 类）：Project / Task / Person CRUD、Dependency 管理、Analytics。复用 `models.py` + `routes/tasks.py` 业务逻辑。详细配置见 `docs/MCP_SETUP.md`。

## 架构

**后端**：Flask 应用工厂模式（`app.py:create_app()`），SQLAlchemy + SQLite。Blueprint 路由注册在 `/api/projects`、`/api/tasks`、`/api/persons`。数据库在启动时通过 `inspect`/`ALTER TABLE` 自动创建表和迁移字段，无需 Alembic。

**前端**：单页原生 JS 应用。三个协作类在 `DOMContentLoaded` 时实例化，通过 `window.*` 全局变量通信：

| 文件 | 类 | 职责 |
|------|------|------|
| `static/js/main.js` | `GanttApp` | 应用主控：项目 CRUD、任务表单管理、API 调用、全局协调 |
| `static/js/gantt.js` | `GanttManager` | 封装 Frappe Gantt 库：初始化、更新、拖拽回调、依赖模式 |
| `static/js/tree.js` | `TaskTreeManager` | 左侧任务树面板：层级渲染、展开折叠、选中同步 |

- `main.js` 持有 `window.ganttApp`
- `gantt.js` 暴露 `window.ganttChart`
- `tree.js` 暴露 `window.taskTreeManager`

三者通过全局变量互相引用，无模块打包工具。

**数据模型**（`models.py`）：
- `Project` — 包含多个 `Task`，有 `color` 字段
- `Task` — 属于某个 `Project`，可选 `parent_id`（自引用层级），有 `color`、`assignee`（自由文本，非外键）。`update_from_children()` 方法将子任务的开始/结束/进度向上传播
- `Dependency` — predecessor → successor（FS 类型），有唯一约束
- `Person` — 具名负责人，带颜色，跨项目共享

**后端关键逻辑**：
- 父任务自动更新：`routes/tasks.py:update_parent_task()` 在子任务变更后向上递归
- 关键路径：拓扑排序（Kahn 算法）→ 最早/最晚开始时间 → 总浮动时间为零的任务（`routes/tasks.py:get_critical_path()`）
- 依赖循环检测：目前仅检查直接自引用和反向对，完整的 DFS 循环检测标记为 TODO
- 数据库迁移：`app.py` 通过 `inspect` 检查缺失列/表，执行 `ALTER TABLE` / `CREATE TABLE`

**前端数据流**：
1. 用户操作 → `GanttApp` 调用 REST API
2. 成功后 → `loadProjectTasks()` / `loadAllTasks()` 重新获取数据，更新 `GanttManager.update()` 和 `TaskTreeManager.update()`
3. 甘特图拖拽回调（`on_date_change`、`on_progress_change`）直接调 API，然后触发 `ganttApp.loadProjectTasks()`

**特殊视图**：项目下拉框有「显示所有项目」选项，加载 `/api/tasks/all`，按项目颜色而非任务颜色渲染甘特条。

## 注意事项

- 本项目无测试套件、无 lint 配置、无 CI 流水线
- 数据存储在 `data/gantt.db`（SQLite 单文件），启动时自动创建目录和文件
- 端口默认 1258
- `html2canvas` 从 CDN 加载（导出图片功能），其余前端库已本地化
- Ctrl+滚轮缩放：调整 Frappe Gantt 内部 `column_width` + 重新渲染，非 CSS transform
- "今天"按钮滚动：用 FG 自带的 `.today-highlight` rect 定位，滚动 FG 内部的 `.gantt-container`
- DOM 结构：`#gantt-chart`（flex:1）→ FG 自动创建 `.gantt-container` → SVG。只有一层，无外层包裹
