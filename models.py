from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, default='')
    color = db.Column(db.String(7), default='#3498db')  # hex color for project
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    tasks = db.relationship('Task', backref='project', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'color': self.color or '#3498db',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'task_count': len(self.tasks)
        }

class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    assignee = db.Column(db.String(100), default='')
    color = db.Column(db.String(7), default='#3498db')  # hex color for gantt bar
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    duration = db.Column(db.Integer, default=0)  # in days
    progress = db.Column(db.Integer, default=0)  # percentage 0-100
    
    # Relationships
    children = db.relationship('Task', backref=db.backref('parent', remote_side=[id]), lazy=True)
    dependencies = db.relationship('Dependency', foreign_keys='Dependency.successor_id', backref='successor_task', lazy=True)
    predecessors = db.relationship('Dependency', foreign_keys='Dependency.predecessor_id', backref='predecessor_task', lazy=True)

    def to_dict(self):
        predecessor_ids = [dep.predecessor_id for dep in self.dependencies]
        successor_ids = [dep.successor_id for dep in self.predecessors]
        return {
            'id': self.id,
            'project_id': self.project_id,
            'parent_id': self.parent_id,
            'name': self.name,
            'description': self.description,
            'assignee': self.assignee,
            'color': self.color or '#3498db',
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'duration': self.duration,
            'progress': self.progress,
            'has_children': len(self.children) > 0,
            'dependencies': predecessor_ids,
            'successors': successor_ids
        }
    
    def update_from_children(self):
        if not self.children:
            return
        # Calculate start_date as min of children's start_date
        start_dates = [child.start_date for child in self.children if child.start_date]
        end_dates = [child.end_date for child in self.children if child.end_date]
        if start_dates:
            self.start_date = min(start_dates)
        if end_dates:
            self.end_date = max(end_dates)
        # Update duration
        if self.start_date and self.end_date:
            self.duration = (self.end_date - self.start_date).days + 1
        # Update progress as weighted average of children's progress
        total_weight = sum(child.duration for child in self.children)
        if total_weight > 0:
            weighted_progress = sum(child.progress * child.duration for child in self.children)
            self.progress = round(weighted_progress / total_weight)
        else:
            self.progress = 0

class Dependency(db.Model):
    __tablename__ = 'dependencies'
    id = db.Column(db.Integer, primary_key=True)
    predecessor_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    successor_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False)
    type = db.Column(db.String(20), default='FS')  # FS: Finish-to-Start
    
    __table_args__ = (db.UniqueConstraint('predecessor_id', 'successor_id', name='unique_dependency'),)

class Person(db.Model):
    __tablename__ = 'persons'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    color = db.Column(db.String(7), default='#3498db')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'color': self.color or '#3498db',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }