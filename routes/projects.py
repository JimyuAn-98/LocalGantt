from flask import Blueprint, request, jsonify
import random
from models import db, Project

projects_bp = Blueprint('projects', __name__)

# 预定义的项目颜色列表
PROJECT_COLORS = [
    '#3498db',  # 蓝色
    '#e74c3c',  # 红色
    '#2ecc71',  # 绿色
    '#f39c12',  # 橙色
    '#9b59b6',  # 紫色
    '#1abc9c',  # 青色
    '#e91e63',  # 粉色
    '#ff5722',  # 深橙色
    '#795548',  # 棕色
    '#607d8b',  # 蓝灰色
    '#3f51b5',  # 靛蓝色
    '#009688',  # 蓝绿色
]

def get_random_color():
    """获取随机项目颜色"""
    return random.choice(PROJECT_COLORS)

@projects_bp.route('/', methods=['GET'])
def get_projects():
    projects = Project.query.all()
    return jsonify([project.to_dict() for project in projects])

@projects_bp.route('/', methods=['POST'])
def create_project():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Missing project name'}), 400
    
    project = Project(
        name=data['name'],
        description=data.get('description', ''),
        color=data.get('color', get_random_color())
    )
    db.session.add(project)
    db.session.commit()
    return jsonify(project.to_dict()), 201

@projects_bp.route('/<int:project_id>', methods=['GET'])
def get_project(project_id):
    project = Project.query.get_or_404(project_id)
    return jsonify(project.to_dict())

@projects_bp.route('/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    if 'name' in data:
        project.name = data['name']
    if 'description' in data:
        project.description = data.get('description', '')
    db.session.commit()
    return jsonify(project.to_dict())

@projects_bp.route('/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Project deleted'}), 200