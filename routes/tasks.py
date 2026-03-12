from flask import Blueprint, request, jsonify
from datetime import datetime, date
from collections import defaultdict, deque
from models import db, Task, Project, Dependency

tasks_bp = Blueprint('tasks', __name__)

# Helper function to update parent task times and progress
def update_parent_task(task):
    if task.parent_id:
        parent = Task.query.get(task.parent_id)
        if parent:
            parent.update_from_children()
            db.session.add(parent)
            update_parent_task(parent)  # recursively update ancestors

# Validate no circular dependencies
def validate_dependency(predecessor_id, successor_id):
    # Basic check: cannot depend on itself
    if predecessor_id == successor_id:
        return False
    # Check for existing reverse dependency (if A->B exists, cannot add B->A)
    existing = Dependency.query.filter_by(predecessor_id=successor_id, successor_id=predecessor_id).first()
    if existing:
        return False
    # TODO: More sophisticated cycle detection (could use DFS)
    return True

# Get all tasks for a project (with optional hierarchy)
@tasks_bp.route('/project/<int:project_id>', methods=['GET'])
def get_project_tasks(project_id):
    tasks = Task.query.filter_by(project_id=project_id).all()
    # Return flat list of tasks with dependencies
    return jsonify([task.to_dict() for task in tasks])

# Get all tasks from all projects
@tasks_bp.route('/all', methods=['GET'])
def get_all_tasks():
    tasks = Task.query.all()
    # Return flat list of tasks with dependencies
    return jsonify([task.to_dict() for task in tasks])

# Get a single task
@tasks_bp.route('/<int:task_id>', methods=['GET'])
def get_task(task_id):
    task = Task.query.get_or_404(task_id)
    return jsonify(task.to_dict())

# Create a new task
@tasks_bp.route('/', methods=['POST'])
def create_task():
    data = request.get_json()
    if not data or 'name' not in data or 'project_id' not in data:
        return jsonify({'error': 'Missing required fields (name, project_id)'}), 400
    
    # Parse dates
    start_date = date.fromisoformat(data['start_date']) if 'start_date' in data else date.today()
    end_date = date.fromisoformat(data['end_date']) if 'end_date' in data else start_date
    
    task = Task(
        project_id=data['project_id'],
        parent_id=data.get('parent_id'),
        name=data['name'],
        description=data.get('description', ''),
        assignee=data.get('assignee', ''),
        color=data.get('color', '#3498db'),
        start_date=start_date,
        end_date=end_date,
        duration=data.get('duration', (end_date - start_date).days + 1),
        progress=data.get('progress', 0)
    )
    db.session.add(task)
    db.session.commit()
    
    # If parent exists, update parent times
    if task.parent_id:
        update_parent_task(task)
        db.session.commit()
    
    return jsonify(task.to_dict()), 201

# Update a task
@tasks_bp.route('/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json()
    
    if 'name' in data:
        task.name = data['name']
    if 'description' in data:
        task.description = data.get('description', '')
    if 'assignee' in data:
        task.assignee = data['assignee']
    if 'start_date' in data:
        task.start_date = date.fromisoformat(data['start_date'])
    if 'end_date' in data:
        task.end_date = date.fromisoformat(data['end_date'])
    if 'duration' in data:
        task.duration = data['duration']
    if 'progress' in data:
        task.progress = data['progress']
    if 'color' in data:
        task.color = data['color']
    
    db.session.commit()
    
    # Update parent if needed
    if task.parent_id:
        update_parent_task(task)
        db.session.commit()
    
    return jsonify(task.to_dict())

# Delete a task
@tasks_bp.route('/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    parent_id = task.parent_id
    db.session.delete(task)
    db.session.commit()
    
    # Update parent after deletion
    if parent_id:
        parent = Task.query.get(parent_id)
        if parent:
            parent.update_from_children()
            db.session.commit()
    
    return jsonify({'message': 'Task deleted'}), 200

# Dependency endpoints
@tasks_bp.route('/<int:task_id>/dependencies', methods=['GET'])
def get_task_dependencies(task_id):
    dependencies = Dependency.query.filter_by(successor_id=task_id).all()
    predecessor_ids = [dep.predecessor_id for dep in dependencies]
    return jsonify({'predecessors': predecessor_ids})

@tasks_bp.route('/<int:task_id>/dependencies', methods=['POST'])
def add_dependency(task_id):
    data = request.get_json()
    predecessor_id = data.get('predecessor_id')
    if not predecessor_id:
        return jsonify({'error': 'Missing predecessor_id'}), 400
    
    if not validate_dependency(predecessor_id, task_id):
        return jsonify({'error': 'Invalid dependency (circular or self-dependency)'}), 400
    
    dependency = Dependency(predecessor_id=predecessor_id, successor_id=task_id)
    db.session.add(dependency)
    db.session.commit()
    return jsonify({'message': 'Dependency added'}), 201

@tasks_bp.route('/<int:task_id>/dependencies/<int:predecessor_id>', methods=['DELETE'])
def remove_dependency(task_id, predecessor_id):
    dependency = Dependency.query.filter_by(predecessor_id=predecessor_id, successor_id=task_id).first()
    if not dependency:
        return jsonify({'error': 'Dependency not found'}), 404
    db.session.delete(dependency)
    db.session.commit()
    return jsonify({'message': 'Dependency removed'}), 200

# Critical path calculation
@tasks_bp.route('/project/<int:project_id>/critical-path', methods=['GET'])
def get_critical_path(project_id):
    # Get all tasks for the project
    tasks = Task.query.filter_by(project_id=project_id).all()
    if not tasks:
        return jsonify({'critical_path': [], 'total_duration': 0})
    
    # Build adjacency list and reverse adjacency list
    adj = defaultdict(list)
    rev_adj = defaultdict(list)
    indegree = defaultdict(int)
    task_map = {task.id: task for task in tasks}
    
    # Get all dependencies
    dependencies = Dependency.query.filter(Dependency.predecessor_id.in_([t.id for t in tasks])).all()
    for dep in dependencies:
        pred_id = dep.predecessor_id
        succ_id = dep.successor_id
        if pred_id in task_map and succ_id in task_map:
            adj[pred_id].append(succ_id)
            rev_adj[succ_id].append(pred_id)
            indegree[succ_id] += 1
    
    # Topological sort (Kahn's algorithm)
    queue = deque([task_id for task_id in task_map if indegree[task_id] == 0])
    topo_order = []
    
    while queue:
        node = queue.popleft()
        topo_order.append(node)
        for neighbor in adj[node]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)
    
    # If not all tasks are in topo_order, there's a cycle (shouldn't happen with validation)
    if len(topo_order) != len(task_map):
        return jsonify({'error': 'Cycle detected in dependencies'}), 400
    
    # Calculate earliest start (ES) and earliest finish (EF)
    es = defaultdict(int)  # ES in days from project start (relative)
    ef = defaultdict(int)
    
    for task_id in topo_order:
        task = task_map[task_id]
        # ES = max(EF of predecessors)
        max_pred_ef = 0
        for pred_id in rev_adj[task_id]:
            max_pred_ef = max(max_pred_ef, ef[pred_id])
        es[task_id] = max_pred_ef
        ef[task_id] = es[task_id] + task.duration
    
    # Project completion time
    project_duration = max(ef.values()) if ef else 0
    
    # Calculate latest start (LS) and latest finish (LF)
    lf = defaultdict(lambda: project_duration)
    ls = defaultdict(int)
    
    for task_id in reversed(topo_order):
        task = task_map[task_id]
        # LF = min(LS of successors)
        min_succ_ls = project_duration
        for succ_id in adj[task_id]:
            min_succ_ls = min(min_succ_ls, ls[succ_id])
        if adj[task_id]:  # has successors
            lf[task_id] = min_succ_ls
        ls[task_id] = lf[task_id] - task.duration
    
    # Identify critical tasks (zero total float)
    critical_tasks = []
    for task_id in task_map:
        total_float = ls[task_id] - es[task_id]
        if total_float == 0:
            critical_tasks.append(task_id)
    
    # Sort critical tasks by ES
    critical_tasks.sort(key=lambda tid: es[tid])
    
    return jsonify({
        'critical_path': critical_tasks,
        'total_duration': project_duration,
        'earliest_start': {tid: es[tid] for tid in task_map},
        'latest_start': {tid: ls[tid] for tid in task_map}
    })