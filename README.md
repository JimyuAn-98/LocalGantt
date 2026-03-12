# 甘特图项目管理工具

一个基于 Python Flask + HTML/CSS/JS 的单机版甘特图项目管理工具，用于个人或小团队的项目进度可视化与管理。

## 功能特性

### 核心功能
- **甘特图可视化与交互**
  - 以时间轴（日/周/月）展示任务条
  - 支持拖拽任务条调整任务的开始时间与持续时间
  - 支持通过连接线拖拽设置任务间的前后依赖关系
  - 关键路径高亮显示
  - 缩放时间轴（切换日/周/月视图）

- **项目与任务管理**
  - 项目组织：可创建、编辑、删除不同的"项目"，每个项目包含独立的甘特图
  - 任务层级：支持父任务（汇总任务）与子任务
  - 父任务的开始/结束时间自动根据子任务的时间范围计算
  - 子任务进度更新时，父任务进度自动同步计算
  - 任务属性：名称、描述、负责人、开始日期、结束日期、工期、进度百分比
  - 操作：添加、编辑、删除任务（支持双击编辑）

- **数据持久化**
  - 使用 SQLite 数据库存储项目与任务数据
  - 数据存储在服务器本地，页面刷新或重启应用后数据不丢失

### 界面布局
1. **左侧面板**：任务列表树（可折叠展开的父任务/子任务），显示任务名称、负责人、工期、进度等
2. **右侧主区域**：甘特图时间轴，图形化展示任务条与依赖关系
3. **顶部工具栏**：项目选择、视图缩放、导出图片、保存数据等按钮
4. **任务编辑侧边栏**：点击任务时，可编辑其详细信息

## 技术栈

- **后端**：Python Flask + Flask-SQLAlchemy + Flask-CORS
- **前端**：纯 JavaScript + HTML5 + CSS3
- **甘特图库**：Frappe Gantt（支持拖拽、依赖线）

  为避免 CDN 加载延迟或离线使用，项目提供了脚本将库文件下载到 `static/lib` 目录。运行 `python scripts/download_vendor.py` 将把 `frappe-gantt.css`、`frappe-gantt.min.js` 和 FontAwesome 样式保存到本地，并由模板引用。

该脚本还会下载 FontAwesome 所需的字体文件到 `static/webfonts`，确保图标能在本地环境中正常显示而不会出现 404 错误。
- **数据库**：SQLite（轻量、单文件）
- **其他**：html2canvas（导出图片）

## 安装与运行

### 前提条件
- Python 3.7+
- pip（Python包管理器）

### 安装步骤

1. **克隆或下载项目**
   ```bash
   git clone <repository-url>
   cd gantt
   ```

2. **创建虚拟环境（推荐）**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate
   
   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

4. **运行应用**
   ```bash
   python app.py
   ```

5. **访问应用**
   打开浏览器，访问：http://localhost:5000

## 使用指南

### 1. 创建项目
1. 点击顶部工具栏的"新建项目"按钮
2. 输入项目名称
3. 项目创建后会自动选中

### 2. 添加任务
1. 在左侧任务树面板点击"添加任务"按钮
2. 在右侧弹出的编辑侧边栏中填写任务信息：
   - 任务名称（必填）
   - 描述（可选）
   - 负责人（可选）
   - 开始日期和结束日期
   - 进度百分比
   - 父任务（可选，用于创建层级结构）
   - 前置任务（可选，用于设置依赖关系）

### 3. 编辑任务
- **双击任务树中的任务**：打开编辑侧边栏
- **拖拽甘特图中的任务条**：调整开始/结束时间
- **拖拽甘特图中的进度条**：调整任务进度

### 4. 创建依赖关系
1. 点击顶部工具栏的"关键路径"按钮旁边的依赖关系图标（如有）
2. 进入连接线模式
3. 在甘特图上点击一个任务作为前置任务
4. 再点击另一个任务作为后继任务
5. 依赖关系会自动创建并显示为连接线

### 5. 查看关键路径
1. 点击顶部工具栏的"关键路径"按钮
2. 系统会自动计算并高亮显示关键路径上的任务
3. 弹出窗口显示关键路径包含的任务数量和总工期

### 6. 切换视图
- 点击顶部工具栏的"日"、"周"、"月"按钮切换时间轴视图
- 使用甘特图区域的放大/缩小按钮调整时间刻度

### 7. 导出图片
1. 点击顶部工具栏的"导出图片"按钮
2. 系统会将当前甘特图导出为PNG图片
3. 图片会自动下载到本地

## 项目结构

```
gantt/
├── app.py                 # Flask 主应用
├── requirements.txt       # Python 依赖
├── config.py             # 配置（数据库路径等）
├── models.py             # SQLAlchemy 数据模型
├── routes/               # API 路由模块
│   ├── __init__.py
│   ├── projects.py       # 项目相关API
│   └── tasks.py          # 任务相关API
├── static/
│   ├── css/
│   │   └── style.css     # 样式文件
│   ├── js/
│   │   ├── main.js       # 主应用控制器
│   │   ├── gantt.js      # 甘特图封装
│   │   └── tree.js       # 任务树组件
│   └── lib/              # 第三方库（CDN引入）
├── templates/
│   └── index.html        # 主页面
├── data/
│   └── gantt.db          # SQLite 数据库文件（自动创建）
└── README.md             # 本文档
```

## API 接口

### 项目相关
- `GET /api/projects/` - 获取所有项目
- `POST /api/projects/` - 创建新项目
- `GET /api/projects/<id>` - 获取单个项目
- `PUT /api/projects/<id>` - 更新项目
- `DELETE /api/projects/<id>` - 删除项目

### 任务相关
- `GET /api/tasks/project/<project_id>` - 获取项目的所有任务
- `GET /api/tasks/<task_id>` - 获取单个任务
- `POST /api/tasks/` - 创建新任务
- `PUT /api/tasks/<task_id>` - 更新任务
- `DELETE /api/tasks/<task_id>` - 删除任务

### 依赖关系
- `GET /api/tasks/<task_id>/dependencies` - 获取任务的前置依赖
- `POST /api/tasks/<task_id>/dependencies` - 添加依赖关系
- `DELETE /api/tasks/<task_id>/dependencies/<predecessor_id>` - 删除依赖关系

### 关键路径计算
- `GET /api/tasks/project/<project_id>/critical-path` - 计算项目的关键路径

## 开发说明

### 数据库模型
- **Project**：项目表，包含名称、描述、创建时间
- **Task**：任务表，包含名称、描述、负责人、开始/结束日期、工期、进度、父子关系
- **Dependency**：依赖关系表，记录任务间的先后关系

### 父子任务逻辑
- 父任务的开始日期 = 所有子任务开始日期的最小值
- 父任务的结束日期 = 所有子任务结束日期的最大值
- 父任务的进度 = 子任务进度的加权平均值（按工期加权）

### 关键路径算法
- 使用拓扑排序（Kahn算法）处理任务依赖
- 计算最早开始时间（ES）和最晚开始时间（LS）
- 关键任务 = 总浮动时间（LS - ES）为0的任务

## 注意事项

1. **数据安全**：应用使用本地SQLite数据库，数据存储在`data/gantt.db`文件中，请定期备份
2. **浏览器兼容**：建议使用 Chrome、Firefox、Edge 等现代浏览器
3. **性能考虑**：任务数量较多时（>100），建议使用分页或虚拟滚动
4. **依赖关系验证**：系统会检查循环依赖，但复杂的依赖网络可能需要手动验证

## 故障排除

### 常见问题

1. **应用无法启动**
   - 检查Python版本（需要3.7+）
   - 检查依赖是否安装完整：`pip install -r requirements.txt`
   - 检查端口5000是否被占用

2. **数据库问题**
   - 删除`data/gantt.db`文件重新启动应用
   - 检查文件读写权限

3. **前端功能异常**
   - 检查浏览器控制台是否有JavaScript错误
   - 清除浏览器缓存后重试
   - 确保网络连接正常（CDN资源加载）

### 日志查看
应用运行时会输出日志到控制台，包含：
- 服务器启动信息
- API请求记录
- 数据库操作日志
- 错误信息

## 未来扩展方向

1. **数据导入/导出**：支持JSON/Excel格式的项目数据导入导出
2. **任务模板**：预定义的任务模板库
3. **资源管理**：人员、设备等资源分配与冲突检测
4. **报表生成**：项目进度报告、资源利用率统计
5. **离线支持**：使用IndexedDB或LocalStorage实现离线编辑

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 贡献指南

欢迎提交Issue和Pull Request来改进本项目。

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送到分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至 [your-email@example.com]

---

**开始使用**：安装依赖后运行 `python app.py`，打开浏览器访问 http://localhost:5000