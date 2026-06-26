# 甘特图项目管理工具

基于 Python Flask + HTML/CSS/JS 的单机版甘特图项目管理工具，支持 MCP 协议供 AI agent 自动操作。

## 功能特性

### 核心功能
- **甘特图可视化与交互**
  - 日/周/月时间轴视图，支持缩放
  - 拖拽调整任务时间与进度
  - 任务依赖关系线与连接模式
  - 关键路径高亮
  - 今日红线标记
- **项目与任务管理**
  - 多项目管理（创建、编辑、删除）
  - 任务层级：父任务自动汇总子任务时间/进度
  - 里程碑支持
  - 负责人管理（跨项目共享）
- **MCP 服务**（新增）
  - 20 个 MCP 工具，覆盖 Project / Task / Person / Dependency / Analytics 全量 CRUD
  - 支持 stdio（Claude Desktop）和 HTTP（Chatbox / 远程 agent）两种传输
  - 可直接用 AI agent 查询进度、创建任务、添加依赖、生成报告
- **数据持久化**：SQLite 单文件存储，Docker volume 持久化

## 快速开始

### Docker（推荐）

```bash
docker compose up -d --build
```

启动后：Web UI `http://localhost:1258`，MCP `http://localhost:1259/mcp`

### 本地开发

```bash
pip install -r requirements.txt
python scripts/download_vendor.py   # 首次运行
python app.py                       # Web UI → http://localhost:1258
python mcp_server.py --transport http  # MCP → http://localhost:1259/mcp
```

详细部署与迁移指南见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## MCP 服务

供 AI agent 用自然语言操作项目数据。例如：
- "列出所有项目"
- "创建一个任务，6月1日到6月15日，张三负责"
- "项目 A 的进度怎么样了？有哪些逾期任务？"

Chatbox / Claude Desktop 配置方法见 [docs/MCP_SETUP.md](docs/MCP_SETUP.md)。

## 项目结构

```
├── app.py                 # Flask 主应用
├── mcp_server.py          # MCP 服务入口
├── requirements.txt       # Python 依赖
├── config.py              # 配置
├── models.py              # SQLAlchemy 数据模型
├── routes/
│   ├── projects.py        # 项目 API
│   ├── tasks.py           # 任务/依赖/关键路径 API
│   └── persons.py         # 负责人 API
├── static/
│   ├── css/style.css
│   ├── js/
│   │   ├── main.js        # 主应用控制器
│   │   ├── gantt.js       # 甘特图封装
│   │   └── tree.js        # 任务树组件
│   └── lib/               # 第三方库（本地化）
├── templates/index.html
├── data/gantt.db          # SQLite 数据库（自动创建）
├── scripts/download_vendor.py
├── backup.sh              # 手动备份脚本
├── migrate.sh             # 数据迁移脚本
├── update.sh              # 一键更新脚本
├── Dockerfile
├── docker-compose.yml
├── docker-entrypoint.sh
└── docs/
    ├── DEPLOY.md
    └── MCP_SETUP.md
```

## API

### REST 接口（Flask）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/projects/` | 列出/创建项目 |
| GET/PUT/DELETE | `/api/projects/<id>` | 项目 CRUD |
| GET/POST | `/api/tasks/` | 列出/创建任务 |
| GET/PUT/DELETE | `/api/tasks/<id>` | 任务 CRUD |
| GET | `/api/tasks/project/<id>` | 项目任务列表 |
| GET | `/api/tasks/all` | 全部任务 |
| POST/DELETE | `/api/tasks/<id>/dependencies` | 添加/移除依赖 |
| GET | `/api/tasks/project/<id>/critical-path` | 关键路径 |
| GET/POST | `/api/persons/` | 列出/创建负责人 |
| PUT/DELETE | `/api/persons/<id>` | 负责人 CRUD |
| GET | `/api/version` | 服务版本 |

### MCP 工具（20 个）

| 分类 | 工具 |
|------|------|
| Project | `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project` |
| Task | `list_tasks`, `list_all_tasks`, `get_task`, `create_task`, `update_task`, `update_task_progress`, `delete_task` |
| Person | `list_persons`, `create_person`, `update_person`, `delete_person` |
| Dependency | `add_dependency`, `remove_dependency` |
| Analytics | `get_critical_path`, `get_project_overview` |

## 维护脚本

| 脚本 | 用途 |
|------|------|
| `backup.sh` | 手动备份数据库（容器/volume/本地文件） |
| `migrate.sh` | 跨电脑数据迁移到 Docker volume |
| `update.sh` | 一键更新：备份 → git pull → 重新构建 → 重启 |

## 注意事项

- 数据库文件 `data/gantt.db`（Docker 中在 volume `gantt_data`），定期备份
- 端口：Flask 1258，MCP 1259
- 浏览器推荐 Chrome / Firefox / Edge
