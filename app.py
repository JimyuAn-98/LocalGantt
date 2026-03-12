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
    
    # Create tables if they don't exist
    with app.app_context():
        db.create_all()
        # ensure color column exists on tasks table (simple migration)
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        cols = [c['name'] for c in inspector.get_columns('tasks')] if inspector.has_table('tasks') else []
        if 'color' not in cols:
            try:
                db.engine.execute(text("ALTER TABLE tasks ADD COLUMN color VARCHAR(7) DEFAULT '#3498db'"))
                print('Added color column to tasks table')
            except Exception as e:
                print('Failed to alter tasks table to add color column:', e)
    
    # Register blueprints (API routes)
    from routes.projects import projects_bp
    from routes.tasks import tasks_bp
    app.register_blueprint(projects_bp, url_prefix='/api/projects')
    app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
    
    # Serve main page
    @app.route('/')
    def index():
        return render_template('index.html')
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)