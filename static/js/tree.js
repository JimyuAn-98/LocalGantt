// 任务树组件
class TaskTreeManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.tasks = [];
        this.taskMap = new Map(); // id -> task
        this.childrenMap = new Map(); // parent_id -> [child_tasks]
        this.expandedNodes = new Set();
        this.selectedTaskId = null;
        
        // 初始化空状态
        this.renderEmptyState();
        
        // 保存到全局变量
        window.taskTreeManager = this;
    }
    
    // 更新任务树数据
    update(tasks) {
        this.tasks = tasks;
        
        if (tasks.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        // 构建数据结构
        this.buildTaskMaps(tasks);
        
        // 自动展开所有有子任务的节点，方便查看
        this.expandedNodes.clear();
        this.childrenMap.forEach((children, parentId) => {
            if (children.length > 0) {
                this.expandedNodes.add(parentId);
            }
        });
        
        // 渲染任务树
        this.renderTaskTree();
    }
    
    // 构建任务映射和子任务映射
    buildTaskMaps(tasks) {
        this.taskMap.clear();
        this.childrenMap.clear();
        
        // 初始化所有任务的子任务列表
        tasks.forEach(task => {
            this.taskMap.set(task.id, task);
            this.childrenMap.set(task.id, []);
        });
        
        // 构建父子关系
        tasks.forEach(task => {
            if (task.parent_id) {
                const children = this.childrenMap.get(task.parent_id) || [];
                children.push(task);
                this.childrenMap.set(task.parent_id, children);
            }
        });
        
        // 按开始日期排序子任务
        this.childrenMap.forEach(children => {
            children.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        });
    }
    
    // 渲染空状态
    renderEmptyState() {
        this.container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <p>暂无任务，请先创建项目或添加任务</p>
            </div>
        `;
    }
    
    // 渲染任务树
    renderTaskTree() {
        // 获取根任务（没有父任务的任务）
        const rootTasks = this.tasks.filter(task => !task.parent_id);
        
        // 按开始日期排序根任务
        rootTasks.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        
        // 生成HTML
        let html = '';
        rootTasks.forEach(task => {
            html += this.renderTaskNode(task, 0);
        });
        
        this.container.innerHTML = html;
        
        // 绑定事件
        this.bindEvents();
    }
    
    // 渲染单个任务节点
    renderTaskNode(task, level) {
        const taskId = task.id;
        const hasChildren = this.childrenMap.get(taskId)?.length > 0;
        const isExpanded = this.expandedNodes.has(taskId);
        const isSelected = this.selectedTaskId === taskId;
        
        // 缩进
        const indent = level * 24;
        
        // 进度条颜色
        let progressColor = '#27ae60'; // 绿色
        if (task.progress < 30) progressColor = '#e74c3c'; // 红色
        else if (task.progress < 70) progressColor = '#f39c12'; // 黄色
        
        // 构建HTML
        let html = `
            <div class="task-node ${isSelected ? 'selected' : ''}" data-task-id="${taskId}" style="margin-left: ${indent}px">
                <div class="task-node-header">
                    <div class="task-node-title" title="${task.description || task.name}">
                        ${hasChildren ? `
                            <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'} expand-icon" style="margin-right: 6px; cursor: pointer; font-size: 12px;"></i>
                        ` : '<span style="display: inline-block; width: 18px;"></span>'}
                        <span class="task-name">${task.name}</span>
                        ${task.assignee ? `<span class="task-assignee" style="font-size: 11px; color: #7f8c8d; margin-left: 8px;">(${task.assignee})</span>` : ''}
                    </div>
                    <div class="task-node-progress" style="color: ${progressColor}">
                        ${task.progress}%
                    </div>
                </div>
                <div class="task-node-meta" style="font-size: 11px; color: #7f8c8d; margin-top: 4px;">
                    ${task.start_date} - ${task.end_date} (${task.duration}天)
                </div>
            </div>
        `;
        
        // 如果有子任务且已展开，渲染子任务
        if (hasChildren && isExpanded) {
            const children = this.childrenMap.get(taskId);
            html += `<div class="task-node-children">`;
            children.forEach(child => {
                html += this.renderTaskNode(child, level + 1);
            });
            html += `</div>`;
        }
        
        return html;
    }
    
    // 绑定事件
    bindEvents() {
        // 任务节点点击（选择任务）
        this.container.querySelectorAll('.task-node').forEach(node => {
            node.addEventListener('click', (e) => {
                // 如果点击的是展开/折叠图标，不触发选择
                if (e.target.classList.contains('expand-icon')) {
                    return;
                }
                
                const taskId = parseInt(node.dataset.taskId);
                this.selectTask(taskId);
            });
        });
        
        // 展开/折叠图标点击
        this.container.querySelectorAll('.expand-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = parseInt(icon.closest('.task-node').dataset.taskId);
                this.toggleExpand(taskId);
            });
        });
        
        // 任务节点双击（编辑任务）
        this.container.querySelectorAll('.task-node').forEach(node => {
            node.addEventListener('dblclick', (e) => {
                const taskId = parseInt(node.dataset.taskId);
                this.editTask(taskId);
            });
        });
    }
    
    // 选择任务
    selectTask(taskId) {
        // 更新选中状态
        this.selectedTaskId = taskId;
        
        // 更新UI
        this.container.querySelectorAll('.task-node').forEach(node => {
            node.classList.remove('selected');
        });
        
        const selectedNode = this.container.querySelector(`.task-node[data-task-id="${taskId}"]`);
        if (selectedNode) {
            selectedNode.classList.add('selected');
        }
        
        // 通知主应用
        if (window.ganttApp) {
            window.ganttApp.selectedTaskId = taskId;
        }
        
        // 在甘特图上高亮对应任务
        this.highlightGanttTask(taskId);
    }
    
    // 高亮甘特图中的任务
    highlightGanttTask(taskId) {
        // 调用甘特图管理器的setSelectedTask方法
        if (window.ganttChart) {
            window.ganttChart.setSelectedTask(taskId);
        }
    }
    
    // 编辑任务
    editTask(taskId) {
        if (window.ganttApp) {
            window.ganttApp.editTask(taskId);
        }
    }
    
    // 切换展开/折叠
    toggleExpand(taskId) {
        if (this.expandedNodes.has(taskId)) {
            this.expandedNodes.delete(taskId);
        } else {
            this.expandedNodes.add(taskId);
        }
        
        // 重新渲染任务树
        this.renderTaskTree();
        
        // 恢复选中状态
        if (this.selectedTaskId) {
            this.selectTask(this.selectedTaskId);
        }
    }
    
    // 展开所有节点
    expandAll() {
        this.taskMap.forEach((task, taskId) => {
            if (this.childrenMap.get(taskId)?.length > 0) {
                this.expandedNodes.add(taskId);
            }
        });
        this.renderTaskTree();
    }
    
    // 折叠所有节点
    collapseAll() {
        this.expandedNodes.clear();
        this.renderTaskTree();
    }
    
    // 获取选中的任务
    getSelectedTask() {
        if (this.selectedTaskId) {
            return this.taskMap.get(this.selectedTaskId);
        }
        return null;
    }
    
    // 根据任务ID获取任务
    getTaskById(taskId) {
        return this.taskMap.get(taskId);
    }
    
    // 获取任务的所有子任务（递归）
    getAllChildren(taskId) {
        const result = [];
        const children = this.childrenMap.get(taskId) || [];
        
        children.forEach(child => {
            result.push(child);
            result.push(...this.getAllChildren(child.id));
        });
        
        return result;
    }
    
    // 获取任务的所有父任务（递归）
    getAllParents(taskId) {
        const result = [];
        const task = this.taskMap.get(taskId);
        
        if (task && task.parent_id) {
            const parent = this.taskMap.get(task.parent_id);
            if (parent) {
                result.push(parent);
                result.push(...this.getAllParents(parent.id));
            }
        }
        
        return result;
    }
}

// 初始化任务树
document.addEventListener('DOMContentLoaded', () => {
    window.taskTreeManager = new TaskTreeManager('task-tree');
});