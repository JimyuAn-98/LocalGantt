# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作提供指导。

## 运行与开发

```bash
pip install -r requirements.txt
python app.py                      # 启动服务，访问 http://localhost:1258
python scripts/download_vendor.py  # 首次运行：下载 frappe-gantt + FontAwesome 到本地
python migrate_db.py               # 手动数据库迁移（通常启动时自动完成）
```

Docker：`docker-compose up --build`

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

## 已知难题

### "今天"按钮滚动跳转无效

**当前状态**：
- ✅ 日视图日期渲染范围已修复 — `_extendGanttToToday()` 扩展 `gantt_end` 到 today+7d，甘特图能渲染到6月的列
- ✅ 今日红线 `updateTodayLine()` 位置正确（日视图）
- ❌ `scrollToToday()` 调用 `#gantt-chart.scrollTo()` 不生效，点击「今天」按钮无法跳转

**已确认无效**：`#gantt-chart.scrollTo({ left: px, behavior: 'smooth' })` 不执行滚动，可能 Frappe Gantt 内部有独立的滚动管理或事件拦截。

**涉及文件**：
- `static/js/gantt.js` — `scrollToToday()`、`_getTodayPixelOffset()`、`updateTodayLine()`、`_extendGanttToToday()`
- `static/css/style.css` — `#gantt-chart`（已有 `position: relative`）、`.today-line`
- `static/lib/frappe-gantt.min.js` — 版本 0.6.0，无 `scroll_to_date` / `change_options` API
