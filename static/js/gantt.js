// 甘特图封装模块
class GanttManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.gantt = null;
        this.tasks = [];
        this.criticalTaskIds = new Set();
        this.dependencyMode = false;
        this.dependencySourceTaskId = null;
        this.selectedTaskId = null;

        this.viewMode = 'Week';
    }

    setSelectedTask(taskId) {
        this.selectedTaskId = taskId;
        this._applySelectionCSS();
    }

    // CSS-based highlight — uses !important to beat Frappe Gantt inline styles
    _applySelectionCSS() {
        const styleId = 'gantt-selection-style';
        let style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement('style');
            style.id = styleId;
            document.head.appendChild(style);
        }
        if (this.selectedTaskId) {
            style.innerHTML = `
                .bar-wrapper[data-id="${this.selectedTaskId}"] .bar {
                    stroke: #1a5276 !important;
                    stroke-width: 2.5 !important;
                    filter: drop-shadow(0 0 5px rgba(26,82,118,0.7)) !important;
                }
                .bar-wrapper[data-id="${this.selectedTaskId}"] .bar-label {
                    font-weight: 700 !important;
                }
            `;
        } else {
            style.innerHTML = '';
        }
    }

    _createGantt(tasks) {
        const initialTasks = tasks.length ? tasks : [{
            id: '0', name: '',
            start: new Date().toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0],
            progress: 0
        }];
        this.gantt = new Gantt(this.container, initialTasks, {
            header_height: 50,
            column_width: 30,
            step: 24,
            view_modes: ['Day', 'Week', 'Month'],
            view_mode: this.viewMode,
            date_format: 'YYYY-MM-DD',
            language: 'zh',
            custom_popup_html: null,
            on_date_change: (task, start, end) => this.onDateChange(task, start, end),
            on_progress_change: (task, progress) => this.onProgressChange(task, progress),
            on_view_change: (mode) => this.onViewChange(mode),
            on_click: (task) => this.onTaskClick(task)
        });
    }

    init(tasks = []) {
        this._createGantt(tasks);
        window.ganttChart = this;
    }

    update(tasks) {
        this.tasks = tasks;
        if (!this.gantt) {
            this._createGantt(tasks);
            window.ganttChart = this;
            setTimeout(() => this._extendGanttToToday(), 100);
        } else {
            this.gantt.refresh(tasks.length ? tasks : []);
            this._extendGanttToToday();
        }
        this.applyCriticalPathHighlight();
        this._applySelectionCSS();
        setTimeout(() => {
            this.applyWeekendHighlight();
            this.updateTodayLine();
            this.renderMilestones(tasks);
        }, 200);
    }

    // 确保甘特图渲染范围覆盖今天（Frappe Gantt 默认只渲染到任务结束日期附近）
    _extendGanttToToday() {
        const ganttInternal = this.gantt;
        if (!ganttInternal.gantt_end) return;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (ganttInternal.gantt_end >= today) return;
        const newEnd = new Date();
        newEnd.setDate(newEnd.getDate() + 7);
        ganttInternal.gantt_end = newEnd;
        ganttInternal.setup_date_values();
        ganttInternal.render();
    }

    // ── 计算今天在甘特图中的像素偏移 ──────────────
    _getTodayPixelOffset() {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const ganttStart = this.gantt && this.gantt.gantt_start;
        if (!ganttStart || today < ganttStart) return -1;
        const step = this.gantt.options.step;
        const colW = this.gantt.options.column_width;
        const hoursDiff = (today - ganttStart) / (1000 * 60 * 60);
        return Math.max(0, (hoursDiff / step) * colW + 260);
    }

    // ── 今日红线 ──────────────────────────────────
    updateTodayLine() {
        const todayLine = document.getElementById('today-line');
        if (!todayLine) return;

        const px = this._getTodayPixelOffset();
        if (px < 0) { todayLine.style.display = 'none'; return; }

        // 确保 today-line 在 scrollable 容器 (#gantt-chart) 内部
        const chart = document.getElementById('gantt-chart');
        if (chart && todayLine.parentElement !== chart) {
            chart.appendChild(todayLine);
        }

        todayLine.style.display = 'block';
        todayLine.style.left = px + 'px';
        todayLine.style.top = '50px';
        todayLine.style.bottom = '0';
        todayLine.style.height = 'auto';
    }

    // ── 滚动到今天 ─────────────────────────────────
    scrollToToday() {
        const chart = document.getElementById('gantt-chart');
        if (!chart) return;
        const px = this._getTodayPixelOffset();
        if (px < 0) return;
        chart.scrollTo({ left: Math.max(0, px - 300), behavior: 'smooth' });
    }

    // Ctrl+滚轮缩放
    handleWheelZoom(e) {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const container = document.querySelector('.gantt-container');
        if (!container) return;
        // 简单调整 container 的缩放
        const currentScale = parseFloat(container.style.transform?.match(/scale\(([\d.]+)\)/)?.[1] || '1');
        let newScale = e.deltaY < 0 ? currentScale * 1.1 : currentScale / 1.1;
        newScale = Math.max(0.5, Math.min(2, newScale));
        container.style.transform = `scale(${newScale})`;
        container.style.transformOrigin = 'top left';
    }

    // ── 视图模式 ──────────────────────────────────
    change_view_mode(mode) {
        const ganttMode = { day: 'Day', week: 'Week', month: 'Month' }[mode] || 'Day';
        this.viewMode = ganttMode;
        this.gantt.change_view_mode(ganttMode);
        this._extendGanttToToday();
        setTimeout(() => this.updateTodayLine(), 200);
    }

    onViewChange(mode) {
        this.viewMode = mode;
        document.querySelectorAll('.view-controls .btn-icon').forEach(btn => {
            const v = btn.dataset.view;
            const match = (v === 'day' && mode === 'Day') || (v === 'week' && mode === 'Week') || (v === 'month' && mode === 'Month');
            btn.classList.toggle('active', match);
        });
        setTimeout(() => this.updateTodayLine(), 200);
    }

    // ── 任务点击 ──────────────────────────────────
    onTaskClick(task) {
        const taskId = parseInt(task.id);
        if (window.taskTreeManager) window.taskTreeManager.selectTask(taskId);
        this.selectedTaskId = taskId;
        this._applySelectionCSS();
        if (window.ganttApp) window.ganttApp.editTask(taskId);
    }

    // ── 关键路径 ──────────────────────────────────
    highlightCriticalPath(taskIds) {
        this.criticalTaskIds = new Set(taskIds);
        this.applyCriticalPathHighlight();
    }

    applyCriticalPathHighlight() {
        document.querySelectorAll('.bar-critical').forEach(el => el.classList.remove('bar-critical'));
        this.criticalTaskIds.forEach(taskId => {
            const bar = document.querySelector(`.bar-wrapper[data-id="${taskId}"] .bar`);
            if (bar) bar.classList.add('bar-critical');
        });
    }

    // ── 周末高亮 ──────────────────────────────────
    applyWeekendHighlight() {
        const svg = document.querySelector('.gantt svg');
        if (!svg) return;
        svg.querySelectorAll('rect').forEach(rect => {
            const dateStr = rect.getAttribute('data-date');
            if (dateStr && [0, 6].includes(new Date(dateStr).getDay())) {
                rect.setAttribute('fill', 'rgba(0,0,0,0.04)');
            }
        });
    }

    // ── 里程碑菱形 ────────────────────────────────
    renderMilestones(tasks) {
        document.querySelectorAll('.milestone-marker').forEach(el => el.remove());
        const milestoneTasks = tasks.filter(t => t.is_milestone);
        const svg = document.querySelector('.gantt svg');
        if (!svg || !milestoneTasks.length) return;

        milestoneTasks.forEach(task => {
            const wrapper = document.querySelector(`.bar-wrapper[data-id="${task.id}"]`);
            if (!wrapper) return;
            const bar = wrapper.querySelector('.bar');
            const barGroup = wrapper.querySelector('.bar-group');
            if (!bar || !barGroup) return;

            const x = parseFloat(bar.getAttribute('x') || '0');
            const y = parseFloat(bar.getAttribute('y') || '0');
            const h = parseFloat(bar.getAttribute('height') || '20');
            const cx = x + 6, cy = y + h / 2, s = 8;

            const ns = 'http://www.w3.org/2000/svg';
            const diamond = document.createElementNS(ns, 'polygon');
            diamond.setAttribute('points', `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`);
            diamond.setAttribute('class', 'milestone-marker');
            diamond.setAttribute('fill', task.color || '#f39c12');
            diamond.setAttribute('stroke', '#333');
            diamond.setAttribute('stroke-width', '1');
            barGroup.appendChild(diamond);
            // 只隐藏传统 bar label，保留菱形
            const label = wrapper.querySelector('.bar-label');
            if (label) {
                label.setAttribute('x', cx + s + 4);
                label.setAttribute('y', cy + 4);
            }
        });
    }

    // ── 拖拽回调 ──────────────────────────────────
    async onDateChange(task, start, end) {
        const taskId = parseInt(task.id);
        try {
            await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: start.toISOString().split('T')[0],
                    end_date: end.toISOString().split('T')[0],
                    duration: Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1)
                })
            });
            if (window.ganttApp && window.ganttApp.currentProjectId) await window.ganttApp.loadProjectTasks();
        } catch (e) {
            console.error('更新日期失败:', e);
            this.gantt.refresh(this.tasks);
        }
    }

    async onProgressChange(task, progress) {
        const taskId = parseInt(task.id);
        try {
            await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ progress: Math.round(progress * 100) })
            });
            if (window.ganttApp && window.ganttApp.currentProjectId) await window.ganttApp.loadProjectTasks();
        } catch (e) {
            console.error('更新进度失败:', e);
            this.gantt.refresh(this.tasks);
        }
    }

    // ── 依赖模式 ──────────────────────────────────
    enterDependencyMode() {
        this.dependencyMode = true; this.dependencySourceTaskId = null;
        this.container.addEventListener('click', this._handleDepClick);
        this.container.style.cursor = 'crosshair';
    }

    exitDependencyMode() {
        this.dependencyMode = false; this.dependencySourceTaskId = null;
        this.container.removeEventListener('click', this._handleDepClick);
        this.container.style.cursor = '';
        document.querySelectorAll('.bar').forEach(b => { b.style.stroke = ''; b.style.strokeWidth = ''; });
    }

    _handleDepClick = (event) => {
        if (!this.dependencyMode) return;
        let target = event.target;
        while (target && !target.classList.contains('bar-wrapper')) target = target.parentElement;
        if (!target) return;
        const taskId = parseInt(target.dataset.id);
        if (!taskId) return;

        if (this.dependencySourceTaskId === null) {
            this.dependencySourceTaskId = taskId;
            const bar = document.querySelector(`.bar-wrapper[data-id="${taskId}"] .bar`);
            if (bar) { bar.style.stroke = '#3498db'; bar.style.strokeWidth = '3px'; }
        } else {
            if (this.dependencySourceTaskId === taskId) { alert('不能选择相同的任务'); this.exitDependencyMode(); return; }
            this._createDependency(this.dependencySourceTaskId, taskId);
            this.exitDependencyMode();
        }
    }

    async _createDependency(predecessorId, successorId) {
        try {
            const r = await fetch(`/api/tasks/${successorId}/dependencies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ predecessor_id: predecessorId })
            });
            if (r.ok) {
                if (window.ganttApp && window.ganttApp.currentProjectId) await window.ganttApp.loadProjectTasks();
            } else {
                const e = await r.json();
                alert(`创建依赖失败: ${e.error || '未知错误'}`);
            }
        } catch (e) {
            console.error('创建依赖失败:', e);
        }
    }
}

// 初始化由 main.js DOMContentLoaded 触发
