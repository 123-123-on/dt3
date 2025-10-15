import sqlite3
import json
from datetime import datetime, date

def init_database():
    """初始化SQLite数据库"""
    conn = sqlite3.connect('settings.db')
    cursor = conn.cursor()
    
    # 删除旧表（如果存在）
    cursor.execute('DROP TABLE IF EXISTS settings')
    cursor.execute('DROP TABLE IF EXISTS system_info')
    
    # 创建任务表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            completed BOOLEAN DEFAULT 0,
            priority TEXT DEFAULT 'medium',
            due_date DATE,
            list_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            is_important BOOLEAN DEFAULT 0,
            FOREIGN KEY (list_id) REFERENCES task_lists (id)
        )
    ''')
    
    # 创建任务列表表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS task_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            icon TEXT DEFAULT '📋',
            color TEXT DEFAULT '#0078d4',
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 创建用户偏好表（保留原有结构，添加任务相关设置）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            theme TEXT DEFAULT 'light',
            language TEXT DEFAULT 'zh-CN',
            accent_color TEXT DEFAULT '#0078d4',
            font_size TEXT DEFAULT 'medium',
            animations_enabled BOOLEAN DEFAULT 1,
            transparency_enabled BOOLEAN DEFAULT 1,
            view_mode TEXT DEFAULT 'list',
            show_completed BOOLEAN DEFAULT 1,
            default_list_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def get_default_task_lists():
    """获取默认任务列表数据"""
    return [
        ('我的一天', '☀️', '#0078d4', 0),
        ('重要', '⭐', '#ff6b35', 1),
        ('已计划', '📅', '#107c10', 2),
        ('任务', '📋', '#5c2d91', 3),
        ('购物', '🛒', '#ff8c00', 4),
        ('工作', '💼', '#0078d4', 5),
        ('个人', '👤', '#107c10', 6)
    ]

def get_default_tasks():
    """获取默认任务数据"""
    today = date.today().isoformat()
    tomorrow = date.fromordinal(date.today().toordinal() + 1).isoformat()
    next_week = date.fromordinal(date.today().toordinal() + 7).isoformat()
    
    return [
        # 我的一天 (list_id=1)
        ('完成项目报告', '整理本周工作进展并提交报告', 0, 'high', today, 1, 1),
        ('团队会议', '下午3点的产品讨论会议', 0, 'medium', today, 1, 0),
        ('回复邮件', '处理客户咨询邮件', 0, 'medium', today, 1, 0),
        
        # 重要 (list_id=2)
        ('项目截止日期', '完成最终版本的项目交付', 0, 'high', next_week, 2, 1),
        ('客户演示', '准备下周一的产品演示', 0, 'high', next_week, 2, 1),
        
        # 已计划 (list_id=3)
        ('生日聚会', '朋友的生日庆祝活动', 0, 'low', next_week, 3, 0),
        ('体检预约', '年度健康检查', 0, 'medium', next_week, 3, 0),
        
        # 任务 (list_id=4) - 添加一些通用任务
        ('学习新技术', '学习Python和Web开发', 0, 'medium', tomorrow, 4, 0),
        ('整理房间', '周末大扫除', 0, 'low', tomorrow, 4, 0),
        
        # 购物 (list_id=5)
        ('牛奶和面包', '日常食品采购', 0, 'medium', today, 5, 0),
        ('办公文具', '购买笔记本和笔', 0, 'low', tomorrow, 5, 0),
        
        # 工作 (list_id=6)
        ('代码审查', '审查团队成员的代码提交', 0, 'medium', today, 6, 0),
        ('更新文档', '更新API接口文档', 0, 'low', tomorrow, 6, 0),
        
        # 个人 (list_id=7)
        ('健身计划', '晚上7点健身房锻炼', 0, 'medium', today, 7, 0),
        ('阅读新书', '完成第三章的阅读', 0, 'low', tomorrow, 7, 0)
    ]

def insert_default_data():
    """插入默认数据"""
    conn = sqlite3.connect('settings.db')
    cursor = conn.cursor()
    
    # 检查是否已经有数据
    cursor.execute('SELECT COUNT(*) FROM task_lists')
    if cursor.fetchone()[0] > 0:
        print("数据库已有数据，跳过初始化")
        conn.close()
        return
    
    # 插入默认用户偏好
    cursor.execute('''
        INSERT INTO user_preferences (id, theme, language, accent_color, default_list_id)
        VALUES (1, 'light', 'zh-CN', '#0078d4', 4)
    ''')
    
    # 插入默认任务列表
    default_lists = get_default_task_lists()
    for task_list in default_lists:
        cursor.execute('''
            INSERT INTO task_lists (name, icon, color, sort_order)
            VALUES (?, ?, ?, ?)
        ''', task_list)
    
    # 插入默认任务
    default_tasks = get_default_tasks()
    for task in default_tasks:
        cursor.execute('''
            INSERT INTO tasks (title, description, completed, priority, due_date, list_id, is_important)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', task)
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_database()
    insert_default_data()
    print("任务清单数据库初始化完成！")
