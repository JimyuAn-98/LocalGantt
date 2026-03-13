#!/usr/bin/env python3
"""
数据库迁移脚本：为projects表添加color列
不丢失现有数据
"""

import sqlite3
import os

def migrate_database():
    # 数据库文件路径
    db_path = os.path.join(os.path.dirname(__file__), '.\\data\\gantt.db')
    
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return False
    
    try:
        # 连接数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查projects表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
        if not cursor.fetchone():
            print("projects表不存在，无需迁移")
            conn.close()
            return True
        
        # 检查color列是否已存在
        cursor.execute("PRAGMA table_info(projects)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'color' in columns:
            print("color列已存在，无需迁移")
            conn.close()
            return True
        
        # 添加color列
        print("正在为projects表添加color列...")
        cursor.execute("ALTER TABLE projects ADD COLUMN color VARCHAR(7) DEFAULT '#3498db'")
        
        # 为现有项目设置随机颜色
        import random
        PROJECT_COLORS = [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#e91e63', '#ff5722', '#795548', '#607d8b',
            '#3f51b5', '#009688',
        ]
        
        cursor.execute("SELECT id FROM projects")
        projects = cursor.fetchall()
        
        for project in projects:
            project_id = project[0]
            random_color = random.choice(PROJECT_COLORS)
            cursor.execute(
                "UPDATE projects SET color = ? WHERE id = ?",
                (random_color, project_id)
            )
            print(f"  为项目ID {project_id} 设置颜色: {random_color}")
        
        # 提交更改
        conn.commit()
        print(f"成功迁移！已为 {len(projects)} 个项目添加颜色")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"迁移失败: {e}")
        return False

if __name__ == '__main__':
    success = migrate_database()
    exit(0 if success else 1)
