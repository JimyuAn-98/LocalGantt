"""MCP server for LocalGantt -- CRUD project progress via AI agent."""
import sys
import os
from datetime import date, datetime
from typing import Optional

sys.path.insert(0, os.path.dirname(__file__))

from mcp.server.fastmcp import FastMCP
from app import create_app
from models import db, Project, Task, Person, Dependency
from routes.tasks import update_parent_task, validate_dependency

flask_app = create_app()
mcp = FastMCP("LocalGantt")


# ── Project ──────────────────────────────────────────────────────────

@mcp.tool()
def list_projects() -> list[dict]:
    """列出所有项目"""
    with flask_app.app_context():
        return [p.to_dict() for p in Project.query.all()]


@mcp.tool()
def get_project(project_id: int) -> dict:
    """根据 ID 获取项目详情"""
    with flask_app.app_context():
        project = db.session.get(Project, project_id)
        if not project:
            return {"error": f"Project {project_id} not found"}
        return project.to_dict()


@mcp.tool()
def create_project(name: str, description: str = "", color: str = "#3498db") -> dict:
    """创建新项目"""
    with flask_app.app_context():
        project = Project(name=name, description=description, color=color)
        db.session.add(project)
        db.session.commit()
        return project.to_dict()


@mcp.tool()
def update_project(
    project_id: int, name: str = "", description: str = "", color: str = ""
) -> dict:
    """更新项目信息。参数留空则不更新该字段。"""
    with flask_app.app_context():
        project = db.session.get(Project, project_id)
        if not project:
            return {"error": f"Project {project_id} not found"}
        if name:
            project.name = name
        if description:
            project.description = description
        if color:
            project.color = color
        db.session.commit()
        return project.to_dict()


@mcp.tool()
def delete_project(project_id: int) -> dict:
    """删除项目及其所有任务（级联删除）"""
    with flask_app.app_context():
        project = db.session.get(Project, project_id)
        if not project:
            return {"error": f"Project {project_id} not found"}
        db.session.delete(project)
        db.session.commit()
        return {"message": f"Project {project_id} deleted"}


# ── Task ─────────────────────────────────────────────────────────────

@mcp.tool()
def list_tasks(project_id: int) -> list[dict]:
    """列出指定项目的所有任务"""
    with flask_app.app_context():
        return [t.to_dict() for t in Task.query.filter_by(project_id=project_id).all()]


@mcp.tool()
def list_all_tasks() -> list[dict]:
    """列出所有项目的全部任务"""
    with flask_app.app_context():
        return [t.to_dict() for t in Task.query.all()]


@mcp.tool()
def get_task(task_id: int) -> dict:
    """根据 ID 获取任务详情"""
    with flask_app.app_context():
        task = db.session.get(Task, task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}
        return task.to_dict()


@mcp.tool()
def create_task(
    project_id: int,
    name: str,
    start_date: str,
    end_date: str,
    assignee: str = "",
    progress: int = 0,
    parent_id: int = 0,
    is_milestone: bool = False,
    description: str = "",
    color: str = "#3498db",
) -> dict:
    """创建新任务。日期格式: YYYY-MM-DD。parent_id=0 表示无父任务。"""
    with flask_app.app_context():
        sd = date.fromisoformat(start_date)
        ed = date.fromisoformat(end_date)

        if is_milestone:
            duration_val = 0
            ed = sd
        else:
            duration_val = (ed - sd).days + 1

        task = Task(
            project_id=project_id,
            parent_id=parent_id if parent_id else None,
            name=name,
            description=description,
            assignee=assignee,
            color=color,
            is_milestone=is_milestone,
            start_date=sd,
            end_date=ed,
            duration=duration_val,
            progress=max(0, min(100, progress)),
        )
        db.session.add(task)
        db.session.commit()

        if task.parent_id:
            update_parent_task(task)
            db.session.commit()

        return task.to_dict()


@mcp.tool()
def update_task(
    task_id: int,
    name: str = "",
    start_date: str = "",
    end_date: str = "",
    assignee: str = "",
    progress: int = -1,
    duration: int = -1,
    is_milestone: bool = False,
    description: str = "",
    color: str = "",
) -> dict:
    """更新任务。参数留空/-1 表示不更新该字段。is_milestone=True 时强制 duration=0。"""
    with flask_app.app_context():
        task = db.session.get(Task, task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}

        if name:
            task.name = name
        if description:
            task.description = description
        if assignee:
            task.assignee = assignee
        if progress >= 0:
            task.progress = max(0, min(100, progress))
        if color:
            task.color = color
        if start_date:
            task.start_date = date.fromisoformat(start_date)
        if end_date:
            task.end_date = date.fromisoformat(end_date)
        if duration >= 0:
            task.duration = duration
        if is_milestone:
            task.is_milestone = True
            task.duration = 0
            if task.start_date:
                task.end_date = task.start_date

        # recalc duration from dates if both set and not milestone
        if start_date and end_date and not task.is_milestone and duration < 0:
            task.duration = (task.end_date - task.start_date).days + 1

        db.session.commit()

        if task.parent_id:
            update_parent_task(task)
            db.session.commit()

        return task.to_dict()


@mcp.tool()
def update_task_progress(task_id: int, progress: int) -> dict:
    """快捷更新任务进度（0-100）。自动更新父任务进度。"""
    with flask_app.app_context():
        task = db.session.get(Task, task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}
        task.progress = max(0, min(100, progress))
        db.session.commit()

        if task.parent_id:
            update_parent_task(task)
            db.session.commit()

        return task.to_dict()


@mcp.tool()
def delete_task(task_id: int) -> dict:
    """删除任务。自动更新父任务时间范围。"""
    with flask_app.app_context():
        task = db.session.get(Task, task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}
        parent_id = task.parent_id
        db.session.delete(task)
        db.session.commit()

        if parent_id:
            parent = db.session.get(Task, parent_id)
            if parent:
                parent.update_from_children()
                db.session.commit()

        return {"message": f"Task {task_id} deleted"}


# ── Person ────────────────────────────────────────────────────────────

@mcp.tool()
def list_persons() -> list[dict]:
    """列出所有负责人"""
    with flask_app.app_context():
        return [p.to_dict() for p in Person.query.all()]


@mcp.tool()
def create_person(name: str, color: str = "#3498db") -> dict:
    """创建新负责人"""
    with flask_app.app_context():
        existing = Person.query.filter_by(name=name).first()
        if existing:
            return {"error": f"Person '{name}' already exists"}
        person = Person(name=name, color=color)
        db.session.add(person)
        db.session.commit()
        return person.to_dict()


@mcp.tool()
def update_person(person_id: int, name: str = "", color: str = "") -> dict:
    """更新负责人信息"""
    with flask_app.app_context():
        person = db.session.get(Person, person_id)
        if not person:
            return {"error": f"Person {person_id} not found"}
        if name:
            person.name = name
        if color:
            person.color = color
        db.session.commit()
        return person.to_dict()


@mcp.tool()
def delete_person(person_id: int) -> dict:
    """删除负责人"""
    with flask_app.app_context():
        person = db.session.get(Person, person_id)
        if not person:
            return {"error": f"Person {person_id} not found"}
        db.session.delete(person)
        db.session.commit()
        return {"message": f"Person {person_id} deleted"}


# ── Dependency ────────────────────────────────────────────────────────

@mcp.tool()
def add_dependency(predecessor_id: int, successor_id: int) -> dict:
    """添加任务依赖（predecessor → successor，FS 类型）"""
    with flask_app.app_context():
        if not validate_dependency(predecessor_id, successor_id):
            return {"error": "Invalid dependency (circular or self-dependency)"}

        existing = Dependency.query.filter_by(
            predecessor_id=predecessor_id, successor_id=successor_id
        ).first()
        if existing:
            return {"error": "Dependency already exists"}

        dep = Dependency(predecessor_id=predecessor_id, successor_id=successor_id)
        db.session.add(dep)
        db.session.commit()
        return {"message": f"Dependency {predecessor_id} -> {successor_id} added"}


@mcp.tool()
def remove_dependency(predecessor_id: int, successor_id: int) -> dict:
    """移除任务依赖"""
    with flask_app.app_context():
        dep = Dependency.query.filter_by(
            predecessor_id=predecessor_id, successor_id=successor_id
        ).first()
        if not dep:
            return {"error": "Dependency not found"}
        db.session.delete(dep)
        db.session.commit()
        return {"message": f"Dependency {predecessor_id} -> {successor_id} removed"}


# ── Analytics ─────────────────────────────────────────────────────────

@mcp.tool()
def get_critical_path(project_id: int) -> dict:
    """计算项目关键路径（CPM 算法）"""
    from collections import defaultdict, deque

    with flask_app.app_context():
        tasks = Task.query.filter_by(project_id=project_id).all()
        if not tasks:
            return {"critical_path": [], "total_duration": 0}

        adj = defaultdict(list)
        rev_adj = defaultdict(list)
        indegree = defaultdict(int)
        task_map = {t.id: t for t in tasks}

        task_ids = [t.id for t in tasks]
        deps = Dependency.query.filter(
            Dependency.predecessor_id.in_(task_ids)
        ).all()
        for dep in deps:
            p, s = dep.predecessor_id, dep.successor_id
            if p in task_map and s in task_map:
                adj[p].append(s)
                rev_adj[s].append(p)
                indegree[s] += 1

        # Kahn topological sort
        queue = deque([tid for tid in task_map if indegree[tid] == 0])
        topo = []
        while queue:
            node = queue.popleft()
            topo.append(node)
            for neighbor in adj[node]:
                indegree[neighbor] -= 1
                if indegree[neighbor] == 0:
                    queue.append(neighbor)

        if len(topo) != len(task_map):
            return {"error": "Cycle detected in dependencies"}

        es = defaultdict(int)
        ef = defaultdict(int)
        for tid in topo:
            t = task_map[tid]
            max_pred = max((ef[p] for p in rev_adj[tid]), default=0)
            es[tid] = max_pred
            ef[tid] = es[tid] + t.duration

        project_duration = max(ef.values()) if ef else 0

        lf = defaultdict(lambda: project_duration)
        ls = defaultdict(int)
        for tid in reversed(topo):
            t = task_map[tid]
            if adj[tid]:
                lf[tid] = min(ls[s] for s in adj[tid])
            ls[tid] = lf[tid] - t.duration

        critical = sorted(
            [tid for tid in task_map if ls[tid] - es[tid] == 0],
            key=lambda tid: es[tid],
        )

        return {
            "critical_path": critical,
            "total_duration": project_duration,
            "earliest_start": {tid: es[tid] for tid in task_map},
            "latest_start": {tid: ls[tid] for tid in task_map},
        }


@mcp.tool()
def get_project_overview(project_id: int) -> dict:
    """项目概览：任务统计、负责人分布、逾期任务"""
    from collections import defaultdict as ddict

    with flask_app.app_context():
        project = db.session.get(Project, project_id)
        if not project:
            return {"error": f"Project {project_id} not found"}

        tasks = Task.query.filter_by(project_id=project_id).all()
        today = date.today()
        assignee_stats = ddict(lambda: {"count": 0, "completed": 0, "in_progress": 0})
        milestones = []
        overdue = []
        completed = 0
        in_progress = 0
        pending = 0

        for t in tasks:
            # categorize
            if t.progress >= 100:
                completed += 1
            elif t.progress > 0:
                in_progress += 1
            else:
                pending += 1

            # milestones
            if t.is_milestone:
                milestones.append(t.to_dict())

            # assignee stats
            a = t.assignee or "(unassigned)"
            assignee_stats[a]["count"] += 1
            if t.progress >= 100:
                assignee_stats[a]["completed"] += 1
            elif t.progress > 0:
                assignee_stats[a]["in_progress"] += 1

            # overdue
            if t.end_date and t.end_date < today and t.progress < 100:
                overdue.append(t.to_dict())

        return {
            "project": project.to_dict(),
            "total_tasks": len(tasks),
            "completed_tasks": completed,
            "in_progress_tasks": in_progress,
            "pending_tasks": pending,
            "milestones": milestones,
            "assignees": dict(assignee_stats),
            "overdue_tasks": overdue,
        }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="LocalGantt MCP Server")
    parser.add_argument(
        "--transport",
        default="stdio",
        choices=["stdio", "http"],
        help="Transport: stdio for local agent, http for remote/Chatbox (default: stdio)",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Host for HTTP mode (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=1259, help="Port for HTTP mode (default: 1259)")
    parser.add_argument("--path", default="/mcp", help="URL path for HTTP mode (default: /mcp)")
    args = parser.parse_args()

    if args.transport == "http":
        print(f"MCP Server starting at: http://{args.host}:{args.port}{args.path}")
        # Override settings via constructor params — re-create mcp with custom host/port
        mcp.settings.host = args.host
        mcp.settings.port = args.port
        mcp.settings.streamable_http_path = args.path
        mcp.run(transport="streamable-http")
    else:
        mcp.run(transport="stdio")
