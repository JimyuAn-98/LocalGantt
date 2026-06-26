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
        # Simple migrations — SQLAlchemy 2.x compatible
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)

        def run_sql(sql, desc):
            try:
                with db.engine.connect() as conn:
                    conn.execute(text(sql))
                    conn.commit()
                print(desc)
            except Exception as e:
                print(f'Migration skipped ({desc}): {e}')

        # Check tasks table
        if inspector.has_table('tasks'):
            task_cols = [c['name'] for c in inspector.get_columns('tasks')]
            if 'color' not in task_cols:
                run_sql("ALTER TABLE tasks ADD COLUMN color VARCHAR(7) DEFAULT '#3498db'",
                        'Added color column to tasks table')
            if 'is_milestone' not in task_cols:
                run_sql("ALTER TABLE tasks ADD COLUMN is_milestone BOOLEAN DEFAULT 0",
                        'Added is_milestone column to tasks table')

        # Check projects table
        if inspector.has_table('projects'):
            project_cols = [c['name'] for c in inspector.get_columns('projects')]
            if 'color' not in project_cols:
                run_sql("ALTER TABLE projects ADD COLUMN color VARCHAR(7) DEFAULT '#3498db'",
                        'Added color column to projects table')

        # Check persons table
        if not inspector.has_table('persons'):
            run_sql("""
                CREATE TABLE persons (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    color VARCHAR(7) DEFAULT '#3498db',
                    created_at TIMESTAMP
                )
            """, 'Created persons table')
        else:
            person_cols = [c['name'] for c in inspector.get_columns('persons')]
            if 'color' not in person_cols:
                run_sql("ALTER TABLE persons ADD COLUMN color VARCHAR(7) DEFAULT '#3498db'",
                        'Added color column to persons table')
    
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

    # Version / health check endpoint
    @app.route('/api/version')
    def version():
        ver = 'unknown'
        vfile = os.path.join(os.path.dirname(__file__), 'VERSION')
        if os.path.exists(vfile):
            with open(vfile) as f:
                ver = f.read().strip()
        return {'version': ver, 'status': 'ok'}

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=1258)