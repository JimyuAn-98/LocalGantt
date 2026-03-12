// 甘特图封装模块
class GanttManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.gantt = null;
        this.tasks = [];
        this.criticalTaskIds = new Set();
        this.dependencyMode = false;
        this.dependencySourceTaskId = null;
        
        // defer actual instantiation until we have some tasks or when update is called
        // so empty projects won't trigger library errors
    }
    
    init(tasks = []) {
        // 防止传入空数组导致内部计算出 null 日期的问题
        const initialTasks = tasks.length ? tasks : [{
            id: '0',
            name: '',
            start: new Date().toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0],
            progress: 0
        }];

        // 初始化甘特图
        this.gantt = new Gantt(this.container, initialTasks, {
            header_height: 50,
            column_width: 30,
            step: 24,
            view_modes: ['Day', 'Week', 'Month'],
            view_mode: 'Week',
            date_format: 'YYYY-MM-DD',
            language: 'zh',
            custom_popup_html: null,
            on_date_change: (task, start, end) => this.onDateChange(task, start, end),
            on_progress_change: (task, progress) => this.onProgressChange(task, progress),
            on_view_change: (mode) => this.onViewChange(mode)
        });
        
        // 保存到全局变量
        window.ganttChart = this;
    }
    
    // 更新甘特图数据
    update(tasks) {
        this.tasks = tasks;
        if (!this.gantt) {
            // first creation happens when we have task data (could still be empty)
            this.init(tasks);
        } else {
            this.gantt.refresh(tasks.length ? tasks : []);
        }
        this.applyCriticalPathHighlight();
    }
    
    // 日期变化回调（拖拽任务条）
    async onDateChange(task, start, end) {
        console.log('任务日期变化:', task.id, start, end);
        
        // 更新任务数据
        const taskId = parseInt(task.id);
        const taskData = {
            start_date: start.toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0],
            duration: Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1)
        };
        
        try {
            // 调用API更新任务
            await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });
            
            // 刷新应用数据
            if (window.ganttApp && window.ganttApp.currentProjectId) {
                await window.ganttApp.loadProjectTasks();
            }
        } catch (error) {
            console.error('更新任务日期失败:', error);
            // 恢复原状
            this.gantt.refresh(this.tasks);
        }
    }
    
    // 进度变化回调（拖拽进度条）
    async onProgressChange(task, progress) {
        console.log('任务进度变化:', task.id, progress);
        
        const taskId = parseInt(task.id);
        const taskData = {
            progress: Math.round(progress * 100)
        };
        
        try {
            await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });
            
            if (window.ganttApp && window.ganttApp.currentProjectId) {
                await window.ganttApp.loadProjectTasks();
            }
        } catch (error) {
            console.error('更新任务进度失败:', error);
            this.gantt.refresh(this.tasks);
        }
    }
    
    // 视图变化回调
    onViewChange(mode) {
        console.log('视图模式改变为:', mode);
        // 更新顶部工具栏的激活状态
        const buttons = document.querySelectorAll('.view-controls .btn-icon');
        buttons.forEach(btn => {
            const view = btn.dataset.view;
            if ((view === 'day' && mode === 'Day') ||
                (view === 'week' && mode === 'Week') ||
                (view === 'month' && mode === 'Month')) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // 改变视图模式
    change_view_mode(mode) {
        let ganttMode;
        switch (mode) {
            case 'day':
                ganttMode = 'Day';
                break;
            case 'week':
                ganttMode = 'Week';
                break;
            case 'month':
                ganttMode = 'Month';
                break;
            default:
                ganttMode = 'Week';
        }
        this.gantt.change_view_mode(ganttMode);
    }
    
    // 高亮关键路径
    highlightCriticalPath(taskIds) {
        this.criticalTaskIds = new Set(taskIds);
        this.applyCriticalPathHighlight();
    }
    
    applyCriticalPathHighlight() {
        // 移除之前的高亮
        document.querySelectorAll('.bar-critical').forEach(el => {
            el.classList.remove('bar-critical');
        });
        
        // 添加新的高亮
        this.criticalTaskIds.forEach(taskId => {
            const bar = document.querySelector(`.bar-wrapper[data-id="${taskId}"] .bar`);
            if (bar) {
                bar.classList.add('bar-critical');
            }
        });
    }
    
    // 进入依赖关系创建模式
    enterDependencyMode() {
        this.dependencyMode = true;
        this.dependencySourceTaskId = null;
        
        // 添加任务条点击监听
        this.container.addEventListener('click', this.handleDependencyClick.bind(this));
        
        // 修改鼠标样式
        this.container.style.cursor = 'crosshair';
        
        console.log('进入依赖关系创建模式');
    }
    
    // 退出依赖关系创建模式
    exitDependencyMode() {
        this.dependencyMode = false;
        this.dependencySourceTaskId = null;
        
        // 移除点击监听
        this.container.removeEventListener('click', this.handleDependencyClick.bind(this));
        
        // 恢复鼠标样式
        this.container.style.cursor = '';
        
        console.log('退出依赖关系创建模式');
    }
    
    // 处理依赖关系点击
    handleDependencyClick(event) {
        if (!this.dependencyMode) return;
        
        // 找到被点击的任务条
        let target = event.target;
        while (target && !target.classList.contains('bar-wrapper')) {
            target = target.parentElement;
        }
        
        if (!target) return;
        
        const taskId = parseInt(target.dataset.id);
        if (!taskId) return;
        
        if (this.dependencySourceTaskId === null) {
            // 选择第一个任务（前置任务）
            this.dependencySourceTaskId = taskId;
            this.highlightTaskForDependency(taskId, true);
            console.log('选择前置任务:', taskId);
        } else {
            // 选择第二个任务（后继任务）
            const predecessorId = this.dependencySourceTaskId;
            const successorId = taskId;
            
            // 检查是否选择相同的任务
            if (predecessorId === successorId) {
                alert('不能选择相同的任务作为依赖');
                this.clearDependencySelection();
                return;
            }
            
            console.log('创建依赖关系:', predecessorId, '->', successorId);
            this.createDependency(predecessorId, successorId);
            this.clearDependencySelection();
        }
    }
    
    // 高亮任务用于依赖选择
    highlightTaskForDependency(taskId, isSource) {
        const bar = document.querySelector(`.bar-wrapper[data-id="${taskId}"] .bar`);
        if (bar) {
            bar.style.stroke = isSource ? '#3498db' : '#e74c3c';
            bar.style.strokeWidth = '3px';
        }
    }
    
    // 清除依赖选择高亮
    clearDependencySelection() {
        document.querySelectorAll('.bar').forEach(bar => {
            bar.style.stroke = '';
            bar.style.strokeWidth = '';
        });
        this.dependencySourceTaskId = null;
    }
    
    // 创建依赖关系
    async createDependency(predecessorId, successorId) {
        try {
            const response = await fetch(`/api/tasks/${successorId}/dependencies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    predecessor_id: predecessorId
                })
            });
            
            if (response.ok) {
                alert('依赖关系创建成功！');
                
                // 刷新甘特图
                if (window.ganttApp && window.ganttApp.currentProjectId) {
                    await window.ganttApp.loadProjectTasks();
                }
            } else {
                const error = await response.json();
                alert(`创建依赖关系失败: ${error.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('创建依赖关系失败:', error);
            alert('创建依赖关系失败，请检查网络连接');
        }
    }
    
    // 跳转到今天
    scrollToToday() {
        if (!this.gantt) return;
        const today = new Date();
        this.gantt.scroll_to_date(today);
    }
    
    // 放大
    zoomIn() {
        if (!this.gantt) return;
        const currentWidth = this.gantt.options.column_width;
        if (currentWidth < 60) {
            this.gantt.change_options({
                column_width: currentWidth + 5
            });
        }
    }
    
    // 缩小
    zoomOut() {
        if (!this.gantt) return;
        const currentWidth = this.gantt.options.column_width;
        if (currentWidth > 15) {
            this.gantt.change_options({
                column_width: currentWidth - 5
            });
        }
    }
}

// note: initialization now happens in main.js when DOMContentLoaded fires
// class GanttManager remains a standalone module that can be instantiated
// by the main application.  controls for zoom/today are wired up there as well.