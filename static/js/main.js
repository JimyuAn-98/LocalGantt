// 甘特图项目管理工具 - 主应用控制器

class GanttApp {
    constructor() {
        this.currentProjectId = null;
        this.currentProject = null;
        this.tasks = [];
        this.projects = [];
        this.selectedTaskId = null;
        this.dependencyMode = false;
        this.dependencySourceTaskId = null;

        // ganttManager will be assigned after DOM is ready; see bottom of file
        this.ganttManager = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadProjects();
    }
    
    initializeElements() {
        // 项目选择相关
        this.projectSelect = document.getElementById('project-select');
        this.newProjectBtn = document.getElementById('new-project-btn');
        
        // 任务树相关
        this.taskTree = document.getElementById('task-tree');
        this.addTaskBtn = document.getElementById('add-task-btn');
        
        // 甘特图相关
        this.ganttChart = document.getElementById('gantt-chart');
        this.zoomInBtn = document.getElementById('zoom-in-btn');
        this.zoomOutBtn = document.getElementById('zoom-out-btn');
        this.todayBtn = document.getElementById('today-btn');
        
        // 视图控制
        this.viewControls = document.querySelectorAll('.view-controls .btn-icon');
        
        // 操作按钮
        this.exportBtn = document.getElementById('export-btn');
        this.saveBtn = document.getElementById('save-btn');
        this.criticalPathBtn = document.getElementById('critical-path-btn');
        
        // 任务编辑侧边栏
        this.editSidebar = document.getElementById('edit-sidebar');
        this.taskForm = document.getElementById('task-form');
        this.taskIdInput = document.getElementById('task-id');
        this.taskProjectIdInput = document.getElementById('task-project-id');
        this.taskNameInput = document.getElementById('task-name');
        this.taskDescriptionInput = document.getElementById('task-description');
        this.taskAssigneeInput = document.getElementById('task-assignee');
        this.taskColorInput = document.getElementById('task-color');
        this.taskStartDateInput = document.getElementById('task-start-date');
        this.taskEndDateInput = document.getElementById('task-end-date');
        this.taskDurationInput = document.getElementById('task-duration');
        this.taskProgressInput = document.getElementById('task-progress');
        this.taskProgressValue = document.getElementById('progress-value');
        this.taskParentSelect = document.getElementById('task-parent');
        this.taskDependenciesSelect = document.getElementById('task-dependencies');
        this.deleteTaskBtn = document.getElementById('delete-task-btn');
        this.closeSidebarBtns = document.querySelectorAll('.close-sidebar');
        
        // 依赖关系创建
        this.dependencyModeIndicator = document.getElementById('dependency-mode');
        this.cancelDependencyBtn = document.getElementById('cancel-dependency-btn');
        
        // 加载遮罩
        this.loadingOverlay = document.getElementById('loading-overlay');
    }
    
    bindEvents() {
        // 项目选择
        this.projectSelect.addEventListener('change', (e) => this.onProjectSelect(e));
        this.newProjectBtn.addEventListener('click', () => this.createNewProject());
        
        // 任务操作
        this.addTaskBtn.addEventListener('click', () => this.addNewTask());
        
        // 视图控制
        this.viewControls.forEach(btn => {
            btn.addEventListener('click', (e) => this.changeView(e.target));
        });
        
        // 操作按钮
        this.saveBtn.addEventListener('click', () => this.saveAllChanges());
        this.exportBtn.addEventListener('click', () => this.exportAsImage());
        this.criticalPathBtn.addEventListener('click', () => this.showCriticalPath());
        
        // 任务编辑表单
        this.taskForm.addEventListener('submit', (e) => this.saveTask(e));
        this.taskProgressInput.addEventListener('input', (e) => {
            this.taskProgressValue.textContent = `${e.target.value}%`;
        });
        this.deleteTaskBtn.addEventListener('click', () => this.deleteCurrentTask());
        this.closeSidebarBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeEditSidebar());
        });
        
        // 日期变化时更新工期
        this.taskStartDateInput.addEventListener('change', () => this.updateDuration());
        this.taskEndDateInput.addEventListener('change', () => this.updateDuration());
        
        // 依赖关系创建
        this.cancelDependencyBtn.addEventListener('click', () => this.cancelDependencyMode());
    }
    
    // API 调用辅助函数
    async apiRequest(url, method = 'GET', data = null) {
        this.showLoading();
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            if (data) {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API请求错误:', error);
            alert(`操作失败: ${error.message}`);
            throw error;
        } finally {
            this.hideLoading();
        }
    }
    
    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }
    
    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }
    
    // 项目相关方法
    async loadProjects() {
        try {
            const projects = await this.apiRequest('/api/projects/');
            this.projects = projects;
            this.updateProjectDropdown();
            
            // 如果有项目，默认选择第一个
            if (projects.length > 0 && !this.currentProjectId) {
                this.currentProjectId = projects[0].id;
                this.projectSelect.value = this.currentProjectId;
                await this.loadProjectTasks();
            }
        } catch (error) {
            console.error('加载项目失败:', error);
        }
    }
    
    updateProjectDropdown() {
        this.projectSelect.innerHTML = '<option value="">选择项目...</option>';
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `${project.name} (${project.task_count || 0}个任务)`;
            this.projectSelect.appendChild(option);
        });
    }
    
    async onProjectSelect(event) {
        const projectId = event.target.value;
        if (projectId) {
            this.currentProjectId = parseInt(projectId);
            await this.loadProjectTasks();
        } else {
            this.currentProjectId = null;
            this.tasks = [];
            this.updateTaskTree([]);
            if (window.ganttChart) {
                window.ganttChart.update([]);
            }
        }
    }
    
    async createNewProject() {
        const projectName = prompt('请输入新项目名称:');
        if (!projectName) return;
        
        try {
            const project = await this.apiRequest('/api/projects/', 'POST', {
                name: projectName,
                description: ''
            });
            
            this.projects.push(project);
            this.updateProjectDropdown();
            this.projectSelect.value = project.id;
            await this.onProjectSelect({ target: this.projectSelect });
            
            alert('项目创建成功！');
        } catch (error) {
            console.error('创建项目失败:', error);
        }
    }
    
    // 任务相关方法
    async loadProjectTasks() {
        if (!this.currentProjectId) return;
        
        try {
            const tasks = await this.apiRequest(`/api/tasks/project/${this.currentProjectId}`);
            this.tasks = tasks;
            this.updateTaskTree(tasks);
            
            // 更新甘特图
            if (window.ganttChart) {
                const ganttTasks = this.convertToGanttTasks(tasks);
                window.ganttChart.update(ganttTasks);
            }
            
            // 更新编辑表单中的父任务和依赖选项
            this.updateTaskFormOptions();
        } catch (error) {
            console.error('加载任务失败:', error);
        }
    }
    
    convertToGanttTasks(tasks) {
        // generate style block for custom colors
        this.applyTaskColors(tasks);
        
        // 构建任务映射和父子关系
        const taskMap = new Map();
        const childrenMap = new Map();
        
        tasks.forEach(task => {
            taskMap.set(task.id, task);
            childrenMap.set(task.id, []);
        });
        
        tasks.forEach(task => {
            if (task.parent_id) {
                const children = childrenMap.get(task.parent_id) || [];
                children.push(task);
                childrenMap.set(task.parent_id, children);
            }
        });
        
        // 按父子关系排序任务
        const sortedTasks = [];
        const addTaskAndChildren = (taskId) => {
            const task = taskMap.get(taskId);
            if (task) {
                sortedTasks.push(task);
                // 添加子任务
                const children = childrenMap.get(taskId) || [];
                // 按开始日期排序子任务
                children.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
                children.forEach(child => {
                    addTaskAndChildren(child.id);
                });
            }
        };
        
        // 先添加根任务（没有父任务的任务）
        const rootTasks = tasks.filter(task => !task.parent_id);
        // 按开始日期排序根任务
        rootTasks.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        rootTasks.forEach(task => {
            addTaskAndChildren(task.id);
        });
        
        return sortedTasks.map(task => {
            const cls = task.has_children ? 'summary-task' : '';
            // add color-specific class
            const colorClass = `task-color-${task.id}`;
            return {
                id: task.id.toString(),
                name: task.name,
                start: task.start_date,
                end: task.end_date,
                progress: task.progress / 100,
                dependencies: task.dependencies ? task.dependencies.map(dep => dep.toString()) : [],
                custom_class: `${cls} ${colorClass}`.trim()
            };
        });
    }
    
    updateTaskFormOptions() {
        // 清空选项
        this.taskParentSelect.innerHTML = '<option value="">无（顶级任务）</option>';
        this.taskDependenciesSelect.innerHTML = '';
        
        // 添加选项（排除当前编辑的任务自身）
        const currentTaskId = parseInt(this.taskIdInput.value) || null;
        
        this.tasks.forEach(task => {
            if (task.id === currentTaskId) return;
            
            // 父任务选项（不能选择自己的子任务，这里简化处理）
            const parentOption = document.createElement('option');
            parentOption.value = task.id;
            parentOption.textContent = task.name;
            this.taskParentSelect.appendChild(parentOption.cloneNode(true));
            
            // 依赖任务选项
            const depOption = document.createElement('option');
            depOption.value = task.id;
            depOption.textContent = task.name;
            this.taskDependenciesSelect.appendChild(depOption);
        });
        
        // 设置当前任务的父任务和依赖
        if (currentTaskId) {
            const currentTask = this.tasks.find(t => t.id === currentTaskId);
            if (currentTask) {
                if (currentTask.parent_id) {
                    this.taskParentSelect.value = currentTask.parent_id;
                }
                if (currentTask.dependencies && currentTask.dependencies.length > 0) {
                    currentTask.dependencies.forEach(depId => {
                        const option = this.taskDependenciesSelect.querySelector(`option[value="${depId}"]`);
                        if (option) option.selected = true;
                    });
                }
            }
        }
    }
    
    updateDuration() {
        const startDate = this.taskStartDateInput.value;
        const endDate = this.taskEndDateInput.value;
        
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const duration = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
            this.taskDurationInput.value = duration;
        }
    }
    
    addNewTask() {
        if (!this.currentProjectId) {
            alert('请先选择项目');
            return;
        }
        
        this.taskIdInput.value = '';
        this.taskProjectIdInput.value = this.currentProjectId;
        this.taskNameInput.value = '';
        this.taskDescriptionInput.value = '';
        this.taskAssigneeInput.value = '';
        this.taskColorInput.value = '#3498db';
        
        // 默认日期：明天开始，持续3天
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        this.taskStartDateInput.value = tomorrow.toISOString().split('T')[0];
        
        const endDate = new Date(tomorrow);
        endDate.setDate(endDate.getDate() + 2);
        this.taskEndDateInput.value = endDate.toISOString().split('T')[0];
        
        this.taskDurationInput.value = 3;
        this.taskProgressInput.value = 0;
        this.taskProgressValue.textContent = '0%';
        this.taskParentSelect.value = '';
        
        // 更新选项
        this.updateTaskFormOptions();
        
        this.openEditSidebar();
    }
    
    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        this.taskIdInput.value = task.id;
        this.taskProjectIdInput.value = task.project_id;
        this.taskNameInput.value = task.name;
        this.taskDescriptionInput.value = task.description || '';
        this.taskAssigneeInput.value = task.assignee || '';
        this.taskColorInput.value = task.color || '#3498db';
        this.taskStartDateInput.value = task.start_date;
        this.taskEndDateInput.value = task.end_date;
        this.taskDurationInput.value = task.duration;
        this.taskProgressInput.value = task.progress;
        this.taskProgressValue.textContent = `${task.progress}%`;
        
        // 更新选项
        this.updateTaskFormOptions();
        
        this.openEditSidebar();
    }
    
    async saveTask(event) {
        event.preventDefault();
        
        if (!this.currentProjectId) {
            alert('请先选择项目');
            return;
        }
        
        const taskId = this.taskIdInput.value;
        const taskData = {
            project_id: this.currentProjectId,
            name: this.taskNameInput.value,
            description: this.taskDescriptionInput.value,
            assignee: this.taskAssigneeInput.value,
            color: this.taskColorInput.value,
            start_date: this.taskStartDateInput.value,
            end_date: this.taskEndDateInput.value,
            duration: parseInt(this.taskDurationInput.value),
            progress: parseInt(this.taskProgressInput.value),
            parent_id: this.taskParentSelect.value || null
        };
        
        try {
            if (taskId) {
                // 更新现有任务
                await this.apiRequest(`/api/tasks/${taskId}`, 'PUT', taskData);
                
                // 更新依赖关系
                const selectedDeps = Array.from(this.taskDependenciesSelect.selectedOptions)
                    .map(opt => parseInt(opt.value));
                await this.updateTaskDependencies(taskId, selectedDeps);
            } else {
                // 创建新任务
                const newTask = await this.apiRequest('/api/tasks/', 'POST', taskData);
                
                // 添加依赖关系
                const selectedDeps = Array.from(this.taskDependenciesSelect.selectedOptions)
                    .map(opt => parseInt(opt.value));
                for (const depId of selectedDeps) {
                    await this.apiRequest(`/api/tasks/${newTask.id}/dependencies`, 'POST', {
                        predecessor_id: depId
                    });
                }
            }
            
            await this.loadProjectTasks();
            this.closeEditSidebar();
            alert('任务保存成功！');
        } catch (error) {
            console.error('保存任务失败:', error);
        }
    }
    
    async updateTaskDependencies(taskId, newDependencyIds) {
        // 获取现有依赖
        const currentDeps = await this.apiRequest(`/api/tasks/${taskId}/dependencies`);
        const currentDepIds = currentDeps.predecessors || [];
        
        // 添加新依赖
        for (const depId of newDependencyIds) {
            if (!currentDepIds.includes(depId)) {
                await this.apiRequest(`/api/tasks/${taskId}/dependencies`, 'POST', {
                    predecessor_id: depId
                });
            }
        }
        
        // 删除不再需要的依赖
        for (const depId of currentDepIds) {
            if (!newDependencyIds.includes(depId)) {
                await this.apiRequest(`/api/tasks/${taskId}/dependencies/${depId}`, 'DELETE');
            }
        }
    }
    
    async deleteCurrentTask() {
        const taskId = this.taskIdInput.value;
        if (!taskId) return;
        
        if (!confirm('确定要删除这个任务吗？此操作无法撤销。')) {
            return;
        }
        
        try {
            await this.apiRequest(`/api/tasks/${taskId}`, 'DELETE');
            await this.loadProjectTasks();
            this.closeEditSidebar();
            alert('任务删除成功！');
        } catch (error) {
            console.error('删除任务失败:', error);
        }
    }
    
    openEditSidebar() {
        this.editSidebar.classList.add('open');
    }
    
    closeEditSidebar() {
        this.editSidebar.classList.remove('open');
    }
    
    // 任务树相关方法（将由 tree.js 实现）
    updateTaskTree(tasks) {
        // 这个方法将在 tree.js 中实现
        if (window.taskTreeManager) {
            window.taskTreeManager.update(tasks);
        }
    }
    
    // 甘特图相关方法
    changeView(button) {
        this.viewControls.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        if (window.ganttChart) {
            const view = button.dataset.view;
            window.ganttChart.change_view_mode(view);
        }
    }
    // dynamically create or update style rules for task colors
    applyTaskColors(tasks) {
        let style = document.getElementById('task-color-styles');
        if (!style) {
            style = document.createElement('style');
            style.id = 'task-color-styles';
            document.head.appendChild(style);
        }
        let css = '';
        tasks.forEach(task => {
            const color = task.color || '#3498db';
            const cls = `task-color-${task.id}`;
            css += `.${cls} .bar { fill: ${color}; }\n`;
            css += `.${cls} .bar-label { fill: #fff; }\n`;
        });
        style.innerHTML = css;
    }    
    async saveAllChanges() {
        alert('所有更改已自动保存到数据库。');
    }
    
    async showCriticalPath() {
        if (!this.currentProjectId) {
            alert('请先选择项目');
            return;
        }
        
        try {
            const result = await this.apiRequest(`/api/tasks/project/${this.currentProjectId}/critical-path`);
            const criticalTaskIds = result.critical_path;
            
            // 高亮显示关键路径
            if (window.ganttChart) {
                window.ganttChart.highlightCriticalPath(criticalTaskIds);
            }
            
            alert(`关键路径包含 ${criticalTaskIds.length} 个任务，总工期 ${result.total_duration} 天`);
        } catch (error) {
            console.error('获取关键路径失败:', error);
        }
    }
    
    // 依赖关系创建
    startDependencyMode() {
        this.dependencyMode = true;
        this.dependencySourceTaskId = null;
        this.dependencyModeIndicator.style.display = 'block';
        
        // 在甘特图上添加点击监听
        if (window.ganttChart) {
            window.ganttChart.enterDependencyMode();
        }
    }
    
    cancelDependencyMode() {
        this.dependencyMode = false;
        this.dependencySourceTaskId = null;
        this.dependencyModeIndicator.style.display = 'none';
        
        if (window.ganttChart) {
            window.ganttChart.exitDependencyMode();
        }
    }
    
    // 导出甘特图为图片
    async exportAsImage() {
        if (!this.currentProjectId) {
            alert('请先选择项目');
            return;
        }
        
        this.showLoading();
        try {
            // 获取甘特图容器
            const ganttContainer = document.querySelector('.gantt-container');
            if (!ganttContainer) {
                throw new Error('找不到甘特图容器');
            }
            
            // 使用html2canvas截图
            const canvas = await html2canvas(ganttContainer, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            // 创建下载链接
            const link = document.createElement('a');
            link.download = `甘特图_项目${this.currentProjectId}_${new Date().toISOString().slice(0,10)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            alert('图片导出成功！');
        } catch (error) {
            console.error('导出图片失败:', error);
            alert('导出图片失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
}

// 初始化应用
// DOMContentLoaded 确保所有元素存在后再创建实例
document.addEventListener('DOMContentLoaded', () => {
    // 先创建甘特图管理器，让后续加载任务时可直接使用
    window.ganttManager = new GanttManager('gantt-chart');
    // 建立一个基础图表，这会用到一个占位任务以防库计算出 null
    window.ganttManager.init();

    // 绑定控制按钮给甘特图管理器
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const todayBtn = document.getElementById('today-btn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => window.ganttManager.zoomIn());
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => window.ganttManager.zoomOut());
    if (todayBtn) todayBtn.addEventListener('click', () => window.ganttManager.scrollToToday());

    window.ganttApp = new GanttApp();

    // 把已经创建的 ganttManager 引入应用
    window.ganttApp.ganttManager = window.ganttManager;
});