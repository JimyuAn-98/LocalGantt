import os

from flask import Flask, render_template
from flask_cors import CORS
from config import Config
from models import db

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Enable CORS for all routes (useful if frontend is served from different port)
    CORS(app)
    
    # Initialize database
    db.init_app(app)

    if not os.path.exists('.\\data'):
        os.makedirs('.\\data')
    
    # Create tables if they don't exist
    with app.app_context():
        db.create_all()
        # ensure color column exists on tasks and projects tables (simple migration)
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        
        # Check tasks table
        if inspector.has_table('tasks'):
            task_cols = [c['name'] for c in inspector.get_columns('tasks')]
            if 'color' not in task_cols:
                try:
                    db.engine.execute(text("ALTER TABLE tasks ADD COLUMN color VARCHAR(7) DEFAULT '#3498db'"))
                    print('Added color column to tasks table')
                except Exception as e:
                    print('Failed to alter tasks table to add color column:', e)
        
        # Check projects table
        if inspector.has_table('projects'):
            project_cols = [c['name'] for c in inspector.get_columns('projects')]
            if 'color' not in project_cols:
                try:
                    db.engine.execute(text("ALTER TABLE projects ADD COLUMN color VARCHAR(7) DEFAULT '#3498db'"))
                    print('Added color column to projects table')
                except Exception as e:
                    print('Failed to alter projects table to add color column:', e)
        
        # Check persons table (new for this feature)
        if not inspector.has_table('persons'):
            try:
                db.engine.execute(text("""
                    CREATE TABLE persons (
                        id INTEGER PRIMARY KEY,
                        name VARCHAR(100) NOT NULL UNIQUE,
                        color VARCHAR(7) DEFAULT '#3498db',
                        created_at TIMESTAMP
                    )
                """))
                print('Created persons table')
            except Exception as e:
                print('Failed to create persons table:', e)
        else:
            person_cols = [c['name'] for c in inspector.get_columns('persons')]
            if 'color' not in person_cols:
                try:
                    db.engine.execute(text("ALTER TABLE persons ADD COLUMN color VARCHAR(7) DEFAULT '#3498db'"))
                    print('Added color column to persons table')
                except Exception as e:
                    print('Failed to alter persons table to add color column:', e)
    
    # Register blueprints (API routes)
    from routes.projects import projects_bp
    from routes.tasks import tasks_bp
    from routes.persons import persons_bp
    app.register_blueprint(projects_bp, url_prefix='/api/projects')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    app.register_blueprint(persons_bp, url_prefix='/api/persons')
    
    # Serve main page
    @app.route('/')
    def index():
        return render_template('index.html')
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=1258)