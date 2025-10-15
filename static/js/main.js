// 全局变量
let currentListId = null;
let taskLists = [];
let tasks = [];
let userPreferences = {};
let currentEditingTaskId = null;
let showCompleted = true;
let moreMenuOpen = false;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用
async function initializeApp() {
    try {
        await loadTaskLists();
        await loadUserPreferences();
        await loadStats();
        setupEventListeners();
        renderSidebar();
        
        // 默认显示"我的一天"列表
        const todayList = taskLists.find(list => list.name === '我的一天');
        if (todayList) {
            navigateToList(todayList.id);
        } else if (taskLists.length > 0) {
            navigateToList(taskLists[0].id);
        }
    } catch (error) {
        console.error('初始化失败:', error);
        showNotification('初始化失败，请刷新页面重试', 'error');
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 搜索框
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // 模态框外部点击关闭
    const taskModal = document.getElementById('taskModal');
    taskModal.addEventListener('click', function(e) {
        if (e.target === taskModal) {
            hideTaskModal();
        }
    });

    // 新建列表模态框外部点击关闭
    const newListModal = document.getElementById('newListModal');
    newListModal.addEventListener('click', function(e) {
        if (e.target === newListModal) {
            hideNewListModal();
        }
    });

    // 快速添加任务输入框
    const quickAddInput = document.getElementById('quickAddInput');
    quickAddInput.addEventListener('keypress', handleQuickAdd);
}

// 加载任务列表
async function loadTaskLists() {
    try {
        const response = await fetch('/api/task_lists');
        taskLists = await response.json();
    } catch (error) {
        console.error('加载任务列表失败:', error);
        throw error;
    }
}

// 加载用户偏好
async function loadUserPreferences() {
    try {
        const response = await fetch('/api/user_preferences');
        userPreferences = await response.json();
        showCompleted = userPreferences.show_completed;
        applyTheme(userPreferences.theme);
        updateShowCompletedIcon();
    } catch (error) {
        console.error('加载用户偏好失败:', error);
    }
}

// 加载统计信息
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        renderStats(stats);
    } catch (error) {
        console.error('加载统计信息失败:', error);
        document.getElementById('statsInfo').innerHTML = `
            <div class="text-red-500 text-sm">
                <i class="fas fa-exclamation-triangle mr-1"></i>
                无法加载统计信息
            </div>
        `;
    }
}

// 渲染统计信息
function renderStats(stats) {
    const statsInfo = document.getElementById('statsInfo');
    statsInfo.innerHTML = `
        <div class="space-y-1">
            <div class="flex justify-between">
                <span>总任务:</span>
                <span class="font-medium">${stats.total_tasks}</span>
            </div>
            <div class="flex justify-between">
                <span>已完成:</span>
                <span class="font-medium text-green-600">${stats.completed_tasks}</span>
            </div>
            <div class="flex justify-between">
                <span>待完成:</span>
                <span class="font-medium text-orange-600">${stats.pending_tasks}</span>
            </div>
            <div class="flex justify-between">
                <span>完成率:</span>
                <span class="font-medium text-blue-600">${stats.completion_rate}%</span>
            </div>
        </div>
    `;
}

// 渲染侧边栏导航
function renderSidebar() {
    const sidebarNav = document.getElementById('sidebarNav');
    sidebarNav.innerHTML = '';

    taskLists.forEach(list => {
        const navItem = document.createElement('div');
        navItem.className = 'sidebar-item flex items-center space-x-3';
        navItem.dataset.listId = list.id;
        navItem.onclick = () => navigateToList(list.id);

        const completedCount = list.completed_tasks || 0;
        const totalCount = list.total_tasks || 0;
        const showBadge = completedCount > 0;

        navItem.innerHTML = `
            <span class="text-xl">${list.icon}</span>
            <div class="flex-1">
                <div class="font-medium">${list.name}</div>
                ${totalCount > 0 ? `<div class="text-xs text-gray-500">${completedCount}/${totalCount} 已完成</div>` : ''}
            </div>
            ${showBadge ? `<div class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">${completedCount}</div>` : ''}
        `;

        sidebarNav.appendChild(navItem);
    });
}

// 更新任务列表统计（不重新加载整个列表）
function updateTaskListStats() {
    // 更新当前列表的统计
    const currentList = taskLists.find(list => list.id === currentListId);
    if (currentList) {
        const completedCount = tasks.filter(task => task.completed).length;
        const totalCount = tasks.length;
        currentList.completed_tasks = completedCount;
        currentList.total_tasks = totalCount;
        
        // 更新侧边栏中当前列表的显示
        const navItem = document.querySelector(`[data-list-id="${currentListId}"]`);
        if (navItem) {
            const completedElement = navItem.querySelector('.text-xs.text-gray-500');
            const badgeElement = navItem.querySelector('.bg-green-100');
            
            if (completedElement) {
                completedElement.textContent = totalCount > 0 ? `${completedCount}/${totalCount} 已完成` : '';
            }
            
            if (badgeElement) {
                if (completedCount > 0) {
                    badgeElement.textContent = completedCount;
                    badgeElement.classList.remove('hidden');
                } else {
                    badgeElement.classList.add('hidden');
                }
            }
        }
    }
}

// 导航到指定列表
async function navigateToList(listId) {
    if (currentListId === listId) return;

    currentListId = listId;
    updateSidebarActiveState(listId);
    
    try {
        await loadTasks(listId);
        showPage('tasksList');
        
        const list = taskLists.find(l => l.id === listId);
        if (list) {
            updatePageHeader(list.name, getListDescription(list.name));
        }
    } catch (error) {
        console.error('加载任务列表失败:', error);
        showNotification('加载任务失败', 'error');
    }
}

// 获取列表描述
function getListDescription(listName) {
    const descriptions = {
        '我的一天': '今日任务',
        '重要': '重要任务',
        '已计划': '已计划的任务',
        '任务': '所有任务',
        '购物': '购物清单',
        '工作': '工作任务',
        '个人': '个人事务'
    };
    return descriptions[listName] || '任务列表';
}

// 更新侧边栏活动状态
function updateSidebarActiveState(listId) {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`[data-list-id="${listId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}

// 加载任务列表
async function loadTasks(listId = null) {
    try {
        const url = listId ? `/api/tasks?list_id=${listId}&show_completed=${showCompleted}` : `/api/tasks?show_completed=${showCompleted}`;
        const response = await fetch(url);
        tasks = await response.json();
        renderTasks();
    } catch (error) {
        console.error('加载任务失败:', error);
        throw error;
    }
}

// 渲染任务列表
function renderTasks() {
    const tasksList = document.getElementById('tasksList');
    
    if (tasks.length === 0) {
        tasksList.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">暂无任务</p>
                <p class="text-sm text-gray-400 mt-2">点击上方"+ 新建任务"按钮创建第一个任务</p>
            </div>
        `;
        return;
    }

    tasksList.innerHTML = '';
    
    tasks.forEach(task => {
        const taskItem = createTaskItem(task);
        tasksList.appendChild(taskItem);
    });
}

// 创建任务项
function createTaskItem(task) {
    const taskItem = document.createElement('div');
    taskItem.className = `task-item windows-card relative ${task.completed ? 'completed' : ''}`;
    taskItem.dataset.taskId = task.id;

    const priorityClass = `priority-${task.priority}`;
    const dueDateText = task.due_date ? formatDate(task.due_date) : '';
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;

    taskItem.innerHTML = `
        <div class="priority-indicator ${priorityClass}"></div>
        <div class="flex items-center space-x-3 pl-2">
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                 onclick="toggleTaskComplete(${task.id})"></div>
            <div class="flex-1 min-w-0">
                <div class="task-title font-medium">${task.title}</div>
                ${task.description ? `<div class="text-sm text-gray-500 mt-1">${task.description}</div>` : ''}
                <div class="flex items-center space-x-4 mt-2">
                    ${dueDateText ? `
                        <div class="text-xs ${isOverdue ? 'text-red-500' : 'text-gray-500'}">
                            <i class="fas fa-calendar-alt mr-1"></i>${dueDateText}
                        </div>
                    ` : ''}
                    ${task.is_important ? `
                        <div class="text-xs text-orange-500">
                            <i class="fas fa-star mr-1"></i>重要
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <button class="important-star ${task.is_important ? 'fas' : 'far'} fa-star" 
                        onclick="toggleTaskImportant(${task.id})"></button>
                <button class="text-gray-400 hover:text-gray-600" onclick="editTask(${task.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="text-gray-400 hover:text-red-500" onclick="deleteTask(${task.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    return taskItem;
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
        return '今天';
    } else if (date.toDateString() === tomorrow.toDateString()) {
        return '明天';
    } else {
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
}

// 切换任务完成状态
async function toggleTaskComplete(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ completed: !task.completed })
        });

        if (response.ok) {
            await loadTasks(currentListId);
            await loadStats();
            updateTaskListStats(); // 更新侧边栏统计（不重新加载整个列表）
            showNotification(task.completed ? '任务已标记为未完成' : '任务已完成');
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        console.error('更新任务状态失败:', error);
        showNotification('更新失败，请重试', 'error');
    }
}

// 切换任务重要性
async function toggleTaskImportant(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_important: !task.is_important })
        });

        if (response.ok) {
            await loadTasks(currentListId);
            showNotification(task.is_important ? '已取消重要标记' : '已标记为重要');
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        console.error('更新任务重要性失败:', error);
        showNotification('更新失败，请重试', 'error');
    }
}

// 快速添加任务
function handleQuickAdd(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addQuickTask();
    }
}

async function addQuickTask() {
    const input = document.getElementById('quickAddInput');
    const title = input.value.trim();
    
    if (!title) return;

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: title,
                list_id: currentListId || userPreferences.default_list_id
            })
        });

        if (response.ok) {
            input.value = '';
            await loadTasks(currentListId);
            await loadStats();
            updateTaskListStats(); // 更新侧边栏统计
            showNotification('任务已添加');
        } else {
            throw new Error('创建失败');
        }
    } catch (error) {
        console.error('创建任务失败:', error);
        showNotification('创建失败，请重试', 'error');
    }
}

// 显示添加任务模态框
function showAddTaskModal() {
    currentEditingTaskId = null;
    document.getElementById('modalTitle').textContent = '新建任务';
    document.getElementById('taskForm').reset();
    loadTaskListOptions();
    showTaskModal();
}

// 编辑任务
async function editTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`);
        const task = await response.json();
        
        currentEditingTaskId = taskId;
        document.getElementById('modalTitle').textContent = '编辑任务';
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDueDate').value = task.due_date || '';
        document.getElementById('taskImportant').checked = task.is_important;
        
        loadTaskListOptions(task.list_id);
        showTaskModal();
    } catch (error) {
        console.error('加载任务详情失败:', error);
        showNotification('加载任务失败', 'error');
    }
}

// 加载任务列表选项
async function loadTaskListOptions(selectedId = null) {
    const select = document.getElementById('taskListId');
    select.innerHTML = '';
    
    taskLists.forEach(list => {
        const option = document.createElement('option');
        option.value = list.id;
        option.textContent = list.name;
        if (list.id === selectedId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// 显示任务模态框
function showTaskModal() {
    document.getElementById('taskModal').classList.add('show');
}

// 隐藏任务模态框
function hideTaskModal() {
    document.getElementById('taskModal').classList.remove('show');
    currentEditingTaskId = null;
}

// 保存任务
async function saveTask(event) {
    event.preventDefault();
    
    const formData = {
        title: document.getElementById('taskTitle').value.trim(),
        description: document.getElementById('taskDescription').value.trim(),
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('taskDueDate').value,
        list_id: parseInt(document.getElementById('taskListId').value),
        is_important: document.getElementById('taskImportant').checked
    };

    if (!formData.title) {
        showNotification('任务标题不能为空', 'error');
        return;
    }

    try {
        const url = currentEditingTaskId ? `/api/tasks/${currentEditingTaskId}` : '/api/tasks';
        const method = currentEditingTaskId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            hideTaskModal();
            await loadTasks(currentListId);
            await loadStats();
            updateTaskListStats(); // 更新侧边栏统计
            showNotification(currentEditingTaskId ? '任务已更新' : '任务已创建');
        } else {
            throw new Error('保存失败');
        }
    } catch (error) {
        console.error('保存任务失败:', error);
        showNotification('保存失败，请重试', 'error');
    }
}

// 删除任务
async function deleteTask(taskId) {
    if (!confirm('确定要删除这个任务吗？')) {
        return;
    }

    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadTasks(currentListId);
            await loadStats();
            updateTaskListStats(); // 更新侧边栏统计
            showNotification('任务已删除');
        } else {
            throw new Error('删除失败');
        }
    } catch (error) {
        console.error('删除任务失败:', error);
        showNotification('删除失败，请重试', 'error');
    }
}

// 搜索处理
async function handleSearch() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        showPage('tasksList');
        if (currentListId) {
            const list = taskLists.find(l => l.id === currentListId);
            if (list) {
                updatePageHeader(list.name, getListDescription(list.name));
            }
        }
        return;
    }

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        renderSearchResults(results, query);
        showPage('searchResults');
        updatePageHeader('搜索结果', `搜索 "${query}" 的结果`);
    } catch (error) {
        console.error('搜索失败:', error);
        showNotification('搜索失败', 'error');
    }
}

// 渲染搜索结果
function renderSearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResults.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-search text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">未找到与 "${query}" 相关的任务</p>
            </div>
        `;
        return;
    }

    searchResults.innerHTML = `
        <div class="mb-6">
            <p class="text-gray-600">找到 ${results.length} 个结果</p>
        </div>
    `;

    results.forEach(result => {
        const taskItem = createTaskItem(result);
        searchResults.appendChild(taskItem);
    });
}

// 切换显示已完成任务
async function toggleShowCompleted() {
    showCompleted = !showCompleted;
    
    try {
        const response = await fetch('/api/user_preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ show_completed: showCompleted })
        });

        if (response.ok) {
            userPreferences.show_completed = showCompleted;
            updateShowCompletedIcon();
            await loadTasks(currentListId);
            showNotification(showCompleted ? '显示已完成任务' : '隐藏已完成任务');
        }
    } catch (error) {
        console.error('更新设置失败:', error);
        showNotification('更新设置失败', 'error');
    }
}

// 更新显示已完成任务图标
function updateShowCompletedIcon() {
    const icon = document.getElementById('showCompletedIcon');
    icon.className = showCompleted ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// 主题切换
async function toggleTheme() {
    const newTheme = userPreferences.theme === 'light' ? 'dark' : 'light';
    
    try {
        const response = await fetch('/api/user_preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ theme: newTheme })
        });

        if (response.ok) {
            userPreferences.theme = newTheme;
            applyTheme(newTheme);
            showNotification(`已切换到${newTheme === 'light' ? '浅色' : '深色'}主题`);
        }
    } catch (error) {
        console.error('切换主题失败:', error);
        showNotification('切换主题失败', 'error');
    }
}

// 应用主题
function applyTheme(theme) {
    const themeIcon = document.getElementById('themeIcon');
    
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.className = 'fas fa-sun';
        // 更新Tailwind CSS的深色模式类
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeIcon.className = 'fas fa-moon';
        // 移除Tailwind CSS的深色模式类
        document.documentElement.classList.remove('dark');
    }
}

// 显示页面
function showPage(pageId) {
    const pages = ['tasksList', 'searchResults'];
    pages.forEach(id => {
        const page = document.getElementById(id);
        if (id === pageId) {
            page.classList.remove('hidden');
        } else {
            page.classList.add('hidden');
        }
    });
}

// 更新页面标题
function updatePageHeader(title, subtitle) {
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = subtitle;
}

// 显示通知
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = message;
    
    // 设置背景颜色
    notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg fade-in`;
    
    switch (type) {
        case 'error':
            notification.classList.add('bg-red-500', 'text-white');
            break;
        case 'info':
            notification.classList.add('bg-blue-500', 'text-white');
            break;
        default:
            notification.classList.add('bg-green-500', 'text-white');
    }
    
    notification.classList.remove('hidden');
    
    // 3秒后自动隐藏
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 新建列表相关功能
function showNewListModal() {
    document.getElementById('newListForm').reset();
    document.getElementById('newListIcon').value = '📋';
    
    // 重置图标选择状态
    document.querySelectorAll('.icon-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // 默认选中第一个图标
    const firstIcon = document.querySelector('.icon-option[data-icon="📋"]');
    if (firstIcon) {
        firstIcon.classList.add('selected');
    }
    
    document.getElementById('newListModal').classList.add('show');
}

function hideNewListModal() {
    document.getElementById('newListModal').classList.remove('show');
}

function selectIcon(icon) {
    // 更新隐藏字段的值
    document.getElementById('newListIcon').value = icon;
    
    // 更新选中状态
    document.querySelectorAll('.icon-option').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    const selectedBtn = document.querySelector(`.icon-option[data-icon="${icon}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }
}

async function saveNewList(event) {
    event.preventDefault();
    
    const listName = document.getElementById('newListName').value.trim();
    const listIcon = document.getElementById('newListIcon').value;
    
    if (!listName) {
        showNotification('列表名称不能为空', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/task_lists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: listName,
                icon: listIcon
            })
        });
        
        if (response.ok) {
            hideNewListModal();
            await loadTaskLists();
            renderSidebar();
            await loadStats();
            showNotification('列表创建成功');
            
            // 自动导航到新创建的列表
            const newList = taskLists.find(list => list.name === listName && list.icon === listIcon);
            if (newList) {
                navigateToList(newList.id);
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '创建失败');
        }
    } catch (error) {
        console.error('创建列表失败:', error);
        showNotification('创建列表失败: ' + error.message, 'error');
    }
}

// 切换更多菜单
function toggleMoreMenu() {
    const moreMenu = document.getElementById('moreMenu');
    const moreBtn = document.getElementById('moreBtn');
    
    moreMenuOpen = !moreMenuOpen;
    
    if (moreMenuOpen) {
        moreMenu.classList.add('show');
        moreBtn.style.background = 'var(--windows-blue)';
        moreBtn.style.color = 'white';
    } else {
        moreMenu.classList.remove('show');
        moreBtn.style.background = 'var(--windows-surface)';
        moreBtn.style.color = 'var(--windows-text)';
    }
}

// 处理更多菜单操作
function handleMoreAction(action) {
    toggleMoreMenu(); // 关闭菜单
    
    switch (action) {
        case 'import':
            showNotification('导入任务功能开发中...', 'info');
            break;
        case 'export':
            showNotification('导出任务功能开发中...', 'info');
            break;
        case 'settings':
            showNotification('设置功能开发中...', 'info');
            break;
        case 'about':
            showNotification('Microsoft To Do 克隆版本 v1.0', 'info');
            break;
        default:
            showNotification('功能开发中...', 'info');
    }
}

// 点击外部关闭更多菜单
document.addEventListener('click', function(event) {
    const moreBtn = document.getElementById('moreBtn');
    const moreMenu = document.getElementById('moreMenu');
    const actionButtonsContainer = document.getElementById('actionButtonsContainer');
    
    // 如果点击的不是更多按钮或菜单内部，且不在按钮容器内，则关闭菜单
    if (moreMenuOpen && 
        !moreBtn.contains(event.target) && 
        !moreMenu.contains(event.target) &&
        !actionButtonsContainer.contains(event.target)) {
        toggleMoreMenu();
    }
});

// 防止菜单内部点击事件冒泡
document.getElementById('moreMenu').addEventListener('click', function(event) {
    event.stopPropagation();
});
