from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime, date
from database import init_database, insert_default_data

app = Flask(__name__)
CORS(app)

# 初始化数据库
init_database()
insert_default_data()

def get_db_connection():
    """获取数据库连接"""
    conn = sqlite3.connect('settings.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    """主页面"""
    return render_template('index.html')

@app.route('/api/task_lists')
def get_task_lists():
    """获取所有任务列表"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 一次性获取所有任务列表及其统计信息
    cursor.execute('''
        SELECT 
            tl.id, tl.name, tl.icon, tl.color, tl.sort_order,
            COUNT(t.id) as total_tasks,
            COUNT(CASE WHEN t.completed = 1 THEN 1 END) as completed_tasks
        FROM task_lists tl
        LEFT JOIN tasks t ON tl.id = t.list_id
        GROUP BY tl.id, tl.name, tl.icon, tl.color, tl.sort_order
        ORDER BY tl.sort_order
    ''')
    
    lists = cursor.fetchall()
    conn.close()
    
    result = []
    for task_list in lists:
        result.append({
            'id': task_list['id'],
            'name': task_list['name'],
            'icon': task_list['icon'],
            'color': task_list['color'],
            'sort_order': task_list['sort_order'],
            'total_tasks': task_list['total_tasks'] or 0,
            'completed_tasks': task_list['completed_tasks'] or 0
        })
    
    return jsonify(result)

@app.route('/api/tasks')
def get_tasks():
    """获取任务列表"""
    list_id = request.args.get('list_id')
    show_completed = request.args.get('show_completed', 'true').lower() == 'true'
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if list_id:
        # 获取特定列表的任务
        query = '''
            SELECT id, title, description, completed, priority, due_date, 
                   list_id, created_at, updated_at, completed_at, is_important
            FROM tasks 
            WHERE list_id = ?
        '''
        params = [list_id]
    else:
        # 获取所有任务
        query = '''
            SELECT id, title, description, completed, priority, due_date, 
                   list_id, created_at, updated_at, completed_at, is_important
            FROM tasks
        '''
        params = []
    
    if not show_completed:
        query += ' AND completed = 0'
    
    query += ' ORDER BY is_important DESC, due_date ASC, created_at DESC'
    
    cursor.execute(query, params)
    tasks = cursor.fetchall()
    conn.close()
    
    result = []
    for task in tasks:
        result.append({
            'id': task['id'],
            'title': task['title'],
            'description': task['description'],
            'completed': bool(task['completed']),
            'priority': task['priority'],
            'due_date': task['due_date'],
            'list_id': task['list_id'],
            'created_at': task['created_at'],
            'updated_at': task['updated_at'],
            'completed_at': task['completed_at'],
            'is_important': bool(task['is_important'])
        })
    
    return jsonify(result)

@app.route('/api/tasks/<int:task_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_task(task_id):
    """处理单个任务的获取、更新和删除"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        cursor.execute('''
            SELECT id, title, description, completed, priority, due_date, 
                   list_id, created_at, updated_at, completed_at, is_important
            FROM tasks 
            WHERE id = ?
        ''', (task_id,))
        
        task = cursor.fetchone()
        conn.close()
        
        if task:
            return jsonify({
                'id': task['id'],
                'title': task['title'],
                'description': task['description'],
                'completed': bool(task['completed']),
                'priority': task['priority'],
                'due_date': task['due_date'],
                'list_id': task['list_id'],
                'created_at': task['created_at'],
                'updated_at': task['updated_at'],
                'completed_at': task['completed_at'],
                'is_important': bool(task['is_important'])
            })
        else:
            return jsonify({'error': '任务不存在'}), 404
    
    elif request.method == 'PUT':
        data = request.get_json()
        
        # 构建更新语句
        update_fields = []
        update_values = []
        
        for field in ['title', 'description', 'priority', 'due_date', 'list_id', 'is_important']:
            if field in data:
                update_fields.append(f"{field} = ?")
                update_values.append(data[field])
        
        if 'completed' in data:
            update_fields.append("completed = ?")
            update_values.append(data['completed'])
            if data['completed']:
                update_fields.append("completed_at = ?")
                update_values.append(datetime.now().isoformat())
            else:
                update_fields.append("completed_at = ?")
                update_values.append(None)
        
        if not update_fields:
            return jsonify({'error': '没有要更新的字段'}), 400
        
        update_fields.append("updated_at = ?")
        update_values.append(datetime.now().isoformat())
        update_values.append(task_id)
        
        cursor.execute(f'''
            UPDATE tasks 
            SET {', '.join(update_fields)}
            WHERE id = ?
        ''', update_values)
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    
    elif request.method == 'DELETE':
        cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})

@app.route('/api/tasks', methods=['POST'])
def create_task():
    """创建新任务"""
    data = request.get_json()
    
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': '任务标题不能为空'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO tasks (title, description, priority, due_date, list_id, is_important)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        title,
        data.get('description', ''),
        data.get('priority', 'medium'),
        data.get('due_date'),
        data.get('list_id'),
        data.get('is_important', False)
    ))
    
    task_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'id': task_id, 'success': True})

@app.route('/api/task_lists', methods=['POST'])
def create_task_list():
    """创建新任务列表"""
    data = request.get_json()
    
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '列表名称不能为空'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 获取最大的排序顺序
    cursor.execute('SELECT MAX(sort_order) as max_order FROM task_lists')
    max_order = cursor.fetchone()['max_order'] or 0
    
    cursor.execute('''
        INSERT INTO task_lists (name, icon, color, sort_order)
        VALUES (?, ?, ?, ?)
    ''', (
        name,
        data.get('icon', '📋'),
        data.get('color', '#0078d4'),
        max_order + 1
    ))
    
    list_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({'id': list_id, 'success': True})

@app.route('/api/task_lists/<int:list_id>', methods=['PUT', 'DELETE'])
def handle_task_list(list_id):
    """处理任务列表的更新和删除"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'PUT':
        data = request.get_json()
        
        update_fields = []
        update_values = []
        
        for field in ['name', 'icon', 'color']:
            if field in data:
                update_fields.append(f"{field} = ?")
                update_values.append(data[field])
        
        if not update_fields:
            return jsonify({'error': '没有要更新的字段'}), 400
        
        update_values.append(list_id)
        
        cursor.execute(f'''
            UPDATE task_lists 
            SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        ''', update_values)
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    
    elif request.method == 'DELETE':
        # 删除列表及其所有任务
        cursor.execute('DELETE FROM tasks WHERE list_id = ?', (list_id,))
        cursor.execute('DELETE FROM task_lists WHERE id = ?', (list_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})

@app.route('/api/user_preferences', methods=['GET', 'PUT'])
def handle_user_preferences():
    """处理用户偏好设置"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        cursor.execute('SELECT * FROM user_preferences WHERE id = 1')
        prefs = cursor.fetchone()
        conn.close()
        
        if prefs:
            return jsonify({
                'theme': prefs['theme'],
                'language': prefs['language'],
                'accent_color': prefs['accent_color'],
                'font_size': prefs['font_size'],
                'animations_enabled': bool(prefs['animations_enabled']),
                'transparency_enabled': bool(prefs['transparency_enabled']),
                'view_mode': prefs['view_mode'],
                'show_completed': bool(prefs['show_completed']),
                'default_list_id': prefs['default_list_id']
            })
        else:
            return jsonify({'error': '用户偏好不存在'}), 404
    
    elif request.method == 'PUT':
        data = request.get_json()
        
        # 构建更新语句
        update_fields = []
        update_values = []
        
        for field in ['theme', 'language', 'accent_color', 'font_size', 
                     'animations_enabled', 'transparency_enabled', 
                     'view_mode', 'show_completed', 'default_list_id']:
            if field in data:
                update_fields.append(f"{field} = ?")
                update_values.append(data[field])
        
        if not update_fields:
            return jsonify({'error': '没有要更新的字段'}), 400
        
        update_values.append(1)  # WHERE id = 1
        
        cursor.execute(f'''
            UPDATE user_preferences 
            SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        ''', update_values)
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})

@app.route('/api/stats')
def get_stats():
    """获取任务统计信息"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 总任务数
    cursor.execute('SELECT COUNT(*) as total FROM tasks')
    total_tasks = cursor.fetchone()['total']
    
    # 已完成任务数
    cursor.execute('SELECT COUNT(*) as completed FROM tasks WHERE completed = 1')
    completed_tasks = cursor.fetchone()['completed']
    
    # 重要任务数
    cursor.execute('SELECT COUNT(*) as important FROM tasks WHERE is_important = 1 AND completed = 0')
    important_tasks = cursor.fetchone()['important']
    
    # 今日到期任务数
    today = date.today().isoformat()
    cursor.execute('SELECT COUNT(*) as today_due FROM tasks WHERE due_date = ? AND completed = 0', (today,))
    today_due_tasks = cursor.fetchone()['today_due']
    
    # 本周到期任务数
    cursor.execute('''
        SELECT COUNT(*) as week_due 
        FROM tasks 
        WHERE due_date BETWEEN ? AND ? AND completed = 0
    ''', (today, date.fromordinal(date.today().toordinal() + 7).isoformat()))
    week_due_tasks = cursor.fetchone()['week_due']
    
    conn.close()
    
    return jsonify({
        'total_tasks': total_tasks,
        'completed_tasks': completed_tasks,
        'pending_tasks': total_tasks - completed_tasks,
        'important_tasks': important_tasks,
        'today_due_tasks': today_due_tasks,
        'week_due_tasks': week_due_tasks,
        'completion_rate': round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1)
    })

@app.route('/api/search')
def search_tasks():
    """搜索任务"""
    query = request.args.get('q', '').strip()
    
    if not query:
        return jsonify({'error': '缺少搜索查询'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.id, t.title, t.description, t.completed, t.priority, 
               t.due_date, t.list_id, tl.name as list_name, tl.icon as list_icon
        FROM tasks t
        LEFT JOIN task_lists tl ON t.list_id = tl.id
        WHERE t.title LIKE ? OR t.description LIKE ?
        ORDER BY t.is_important DESC, t.due_date ASC
    ''', (f'%{query}%', f'%{query}%'))
    
    results = cursor.fetchall()
    conn.close()
    
    search_results = []
    for result in results:
        search_results.append({
            'id': result['id'],
            'title': result['title'],
            'description': result['description'],
            'completed': bool(result['completed']),
            'priority': result['priority'],
            'due_date': result['due_date'],
            'list_id': result['list_id'],
            'list_name': result['list_name'],
            'list_icon': result['list_icon']
        })
    
    return jsonify(search_results)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
