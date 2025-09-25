// 认证管理类
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initializeElements();
        this.bindEvents();
        this.checkAuthStatus();
    }

    initializeElements() {
        // 认证相关元素
        this.authContainer = document.getElementById('authContainer');
        this.appContainer = document.getElementById('appContainer');
        this.loginTab = document.getElementById('loginTab');
        this.registerTab = document.getElementById('registerTab');
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.loginError = document.getElementById('loginError');
        this.registerError = document.getElementById('registerError');
        this.userWelcome = document.getElementById('userWelcome');
        this.logoutBtn = document.getElementById('logoutBtn');
    }

    bindEvents() {
        // Tab切换
        this.loginTab.addEventListener('click', () => this.switchTab('login'));
        this.registerTab.addEventListener('click', () => this.switchTab('register'));

        // 表单提交
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));

        // 登出
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    switchTab(type) {
        if (type === 'login') {
            this.loginTab.classList.add('active');
            this.registerTab.classList.remove('active');
            this.loginForm.style.display = 'block';
            this.registerForm.style.display = 'none';
            this.clearErrors();
        } else {
            this.registerTab.classList.add('active');
            this.loginTab.classList.remove('active');
            this.registerForm.style.display = 'block';
            this.loginForm.style.display = 'none';
            this.clearErrors();
        }
    }

    clearErrors() {
        this.loginError.textContent = '';
        this.registerError.textContent = '';
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/me');
            if (response.ok) {
                const user = await response.json();
                this.currentUser = user;
                this.showApp();
                // 页面刷新后自动加载备忘录数据
                if (window.memoApp) {
                    window.memoApp.loadMemos();
                }
            } else {
                this.showAuth();
            }
        } catch (error) {
            this.showAuth();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        this.clearErrors();

        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (response.ok) {
                this.currentUser = result.user;
                this.showApp();
                // 初始化备忘录应用
                if (window.memoApp) {
                    window.memoApp.loadMemos();
                }
            } else {
                this.loginError.textContent = result.error || '登录失败';
            }
        } catch (error) {
            this.loginError.textContent = '网络错误，请稍后重试';
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        this.clearErrors();

        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const result = await response.json();

            if (response.ok) {
                this.currentUser = result.user;
                this.showApp();
                // 初始化备忘录应用
                if (window.memoApp) {
                    window.memoApp.loadMemos();
                }
            } else {
                this.registerError.textContent = result.error || '注册失败';
            }
        } catch (error) {
            this.registerError.textContent = '网络错误，请稍后重试';
        }
    }

    async handleLogout() {
        try {
            await fetch('/api/logout', { method: 'POST' });
            this.currentUser = null;
            this.showAuth();
            // 清理备忘录应用状态
            if (window.memoApp) {
                window.memoApp.clearState();
            }
        } catch (error) {
            console.error('登出失败:', error);
        }
    }

    showAuth() {
        this.authContainer.style.display = 'flex';
        this.appContainer.style.display = 'none';
        this.clearForms();
    }

    showApp() {
        this.authContainer.style.display = 'none';
        this.appContainer.style.display = 'flex';
        if (this.currentUser) {
            this.userWelcome.textContent = `欢迎，${this.currentUser.username}`;
        }
    }

    clearForms() {
        this.loginForm.reset();
        this.registerForm.reset();
        this.clearErrors();
    }
}

// 备忘录应用类
class MemoApp {
    constructor() {
        this.currentMemo = null;
        this.memos = [];
        this.filteredMemos = [];
        this.isEditing = false;
        this.selectedMemos = new Set();

        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.newMemoBtn = document.getElementById('newMemoBtn');
        this.memoList = document.getElementById('memoList');
        this.memoTitle = document.getElementById('memoTitle');
        this.problemContent = document.getElementById('problemContent');
        this.solutionContent = document.getElementById('solutionContent');
        this.copyBtn = document.getElementById('copyBtn');
        this.copyProblemBtn = document.getElementById('copyProblemBtn');
        this.copySolutionBtn = document.getElementById('copySolutionBtn');
        this.deleteBtn = document.getElementById('deleteBtn');
        this.charCount = document.getElementById('charCount');
        this.lastSaved = document.getElementById('lastSaved');
        this.selectAllCheckbox = document.getElementById('selectAllCheckbox');
        this.batchDeleteBtn = document.getElementById('batchDeleteBtn');
    }

    bindEvents() {
        // 搜索功能
        this.searchInput.addEventListener('input', () => this.searchMemos());

        // 新建备忘录
        this.newMemoBtn.addEventListener('click', () => this.createNewMemo());

        // 标题和内容输入
        this.memoTitle.addEventListener('input', () => this.handleInput());
        this.problemContent.addEventListener('input', () => this.handleInput());
        this.solutionContent.addEventListener('input', () => this.handleInput());

        // 操作按钮
        this.copyBtn.addEventListener('click', () => this.copyContent());
        this.copyProblemBtn.addEventListener('click', () => this.copyProblemContent());
        this.copySolutionBtn.addEventListener('click', () => this.copySolutionContent());
        this.deleteBtn.addEventListener('click', () => this.deleteCurrentMemo());

        // 批量操作
        this.selectAllCheckbox.addEventListener('change', () => this.toggleSelectAll());
        this.batchDeleteBtn.addEventListener('click', () => this.batchDeleteMemos());

        // 自动保存防抖
        this.debounceSave = this.debounce(() => this.saveMemo(), 1000);

        // 快捷键支持
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    async loadMemos() {
        try {
            const response = await fetch('/api/memos');
            if (response.status === 401) {
                // 认证失效，返回登录页面
                window.authManager.showAuth();
                return;
            }
            this.memos = await response.json();
            this.filteredMemos = [...this.memos];
            this.renderMemoList();
        } catch (error) {
            console.error('加载备忘录失败:', error);
            this.showToast('加载备忘录失败');
        }
    }

    clearState() {
        this.memos = [];
        this.filteredMemos = [];
        this.currentMemo = null;
        this.selectedMemos.clear();
        this.memoTitle.value = '';
        this.problemContent.value = '';
        this.solutionContent.value = '';
        this.lastSaved.textContent = '';
        this.updateCharCount();
        if (this.memoList) {
            this.memoList.innerHTML = '';
        }
    }

    searchMemos() {
        const query = this.searchInput.value.trim();
        if (query === '') {
            this.filteredMemos = [...this.memos];
        } else {
            this.filteredMemos = this.memos.filter(memo =>
                memo.title.toLowerCase().includes(query.toLowerCase()) ||
                memo.content.toLowerCase().includes(query.toLowerCase())
            );
        }

        // 清理不在过滤结果中的选择
        const filteredIds = new Set(this.filteredMemos.map(m => m.id));
        this.selectedMemos = new Set([...this.selectedMemos].filter(id => filteredIds.has(id)));

        this.renderMemoList();
    }

    renderMemoList() {
        if (this.filteredMemos.length === 0) {
            this.memoList.innerHTML = `
                <div class="empty-state">
                    <h3>暂无备忘录</h3>
                    <p>点击 + 按钮创建新的备忘录</p>
                </div>
            `;
            return;
        }

        this.memoList.innerHTML = this.filteredMemos.map(memo => `
            <div class="memo-item ${this.currentMemo?.id === memo.id ? 'active' : ''}"
                 data-id="${memo.id}">
                <input type="checkbox" class="memo-item-checkbox" data-memo-id="${memo.id}"
                       ${this.selectedMemos.has(memo.id) ? 'checked' : ''}>
                <div class="memo-item-content">
                    <div class="memo-item-title">${this.escapeHtml(memo.title || '无标题')}</div>
                    <div class="memo-item-preview">${this.escapeHtml(this.getPreviewText(memo.content))}</div>
                    <div class="memo-item-time">${this.formatTime(memo.updatedAt)}</div>
                </div>
            </div>
        `).join('');

        // 绑定点击事件
        this.memoList.querySelectorAll('.memo-item').forEach(item => {
            const checkbox = item.querySelector('.memo-item-checkbox');
            const content = item.querySelector('.memo-item-content');

            // 点击内容区域选择备忘录
            content.addEventListener('click', () => {
                const memoId = item.getAttribute('data-id');
                this.selectMemo(memoId);
            });

            // 复选框选择
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const memoId = checkbox.getAttribute('data-memo-id');
                this.toggleMemoSelection(memoId);
            });
        });

        this.updateBatchControls();
    }

    selectMemo(memoId) {
        const memo = this.memos.find(m => m.id === memoId);
        if (memo) {
            this.currentMemo = memo;
            this.memoTitle.value = memo.title || '';

            // 解析内容，分离Problem和Solution
            const content = memo.content || '';
            const sections = this.parseContent(content);
            this.problemContent.value = sections.problem;
            this.solutionContent.value = sections.solution;

            this.lastSaved.textContent = `最后更新: ${this.formatTime(memo.updatedAt)}`;
            this.updateCharCount();
            this.renderMemoList();
            this.problemContent.focus();
        }
    }

    createNewMemo() {
        this.currentMemo = null;
        this.memoTitle.value = '';
        this.problemContent.value = '';
        this.solutionContent.value = '';
        this.lastSaved.textContent = '';
        this.updateCharCount();
        this.problemContent.focus();
        this.renderMemoList();
    }

    handleInput() {
        this.updateCharCount();
        this.debounceSave();
    }

    updateCharCount() {
        const problemCount = this.problemContent.value.length;
        const solutionCount = this.solutionContent.value.length;
        const totalCount = problemCount + solutionCount;
        this.charCount.textContent = `${totalCount} 字符 (问题: ${problemCount}, 方案: ${solutionCount})`;
    }

    async saveMemo() {
        const combinedContent = this.combineContent();
        if (!this.memoTitle.value && !combinedContent) {
            return;
        }

        try {
            const memoData = {
                id: this.currentMemo?.id,
                title: this.memoTitle.value.trim(),
                content: combinedContent
            };

            const response = await fetch('/api/memos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(memoData)
            });

            if (response.status === 401) {
                // 认证失效，返回登录页面
                window.authManager.showAuth();
                return;
            }

            const savedMemo = await response.json();

            if (!this.currentMemo) {
                this.currentMemo = savedMemo;
                this.memos.unshift(savedMemo);
                this.filteredMemos = [...this.memos];
            } else {
                Object.assign(this.currentMemo, savedMemo);
                // 更新数组中对应的项目
                const memoIndex = this.memos.findIndex(m => m.id === savedMemo.id);
                if (memoIndex !== -1) {
                    Object.assign(this.memos[memoIndex], savedMemo);
                }
                const filteredIndex = this.filteredMemos.findIndex(m => m.id === savedMemo.id);
                if (filteredIndex !== -1) {
                    Object.assign(this.filteredMemos[filteredIndex], savedMemo);
                }
            }

            this.lastSaved.textContent = `最后更新: ${this.formatTime(savedMemo.updatedAt)}`;
            this.renderMemoList();

        } catch (error) {
            console.error('保存备忘录失败:', error);
            this.showToast('保存备忘录失败');
        }
    }

    async deleteCurrentMemo() {
        if (!this.currentMemo) return;

        if (confirm('确定要删除这个备忘录吗？')) {
            try {
                const response = await fetch(`/api/memos/${this.currentMemo.id}`, {
                    method: 'DELETE'
                });

                if (response.status === 401) {
                    window.authManager.showAuth();
                    return;
                }

                this.memos = this.memos.filter(m => m.id !== this.currentMemo.id);
                this.filteredMemos = this.filteredMemos.filter(m => m.id !== this.currentMemo.id);
                this.createNewMemo();
                this.renderMemoList();
            } catch (error) {
                console.error('删除备忘录失败:', error);
                this.showToast('删除备忘录失败');
            }
        }
    }

    async copyContent() {
        const combinedContent = this.combineContent();
        if (combinedContent) {
            try {
                await navigator.clipboard.writeText(combinedContent);
                this.showToast('内容已复制到剪贴板');
            } catch (error) {
                console.error('复制失败:', error);
                // 降级方案
                const tempTextarea = document.createElement('textarea');
                tempTextarea.value = combinedContent;
                document.body.appendChild(tempTextarea);
                tempTextarea.select();
                document.execCommand('copy');
                document.body.removeChild(tempTextarea);
                this.showToast('内容已复制到剪贴板');
            }
        }
    }

    async copyProblemContent() {
        const problemContent = this.problemContent.value.trim();
        if (problemContent) {
            try {
                await navigator.clipboard.writeText(problemContent);
                this.showToast('Problem内容已复制到剪贴板');
            } catch (error) {
                console.error('复制失败:', error);
                // 降级方案
                const tempTextarea = document.createElement('textarea');
                tempTextarea.value = problemContent;
                document.body.appendChild(tempTextarea);
                tempTextarea.select();
                document.execCommand('copy');
                document.body.removeChild(tempTextarea);
                this.showToast('Problem内容已复制到剪贴板');
            }
        }
    }

    async copySolutionContent() {
        const solutionContent = this.solutionContent.value.trim();
        if (solutionContent) {
            try {
                await navigator.clipboard.writeText(solutionContent);
                this.showToast('Solution内容已复制到剪贴板');
            } catch (error) {
                console.error('复制失败:', error);
                // 降级方案
                const tempTextarea = document.createElement('textarea');
                tempTextarea.value = solutionContent;
                document.body.appendChild(tempTextarea);
                tempTextarea.select();
                document.execCommand('copy');
                document.body.removeChild(tempTextarea);
                this.showToast('Solution内容已复制到剪贴板');
            }
        }
    }

    handleKeyboard(event) {
        // Ctrl/Cmd + N: 新建备忘录
        if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
            event.preventDefault();
            this.createNewMemo();
        }

        // Ctrl/Cmd + S: 保存
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.saveMemo();
        }

        // Ctrl/Cmd + F: 聚焦搜索框
        if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
            event.preventDefault();
            this.searchInput.focus();
        }

        // Escape: 清除搜索或隐藏应用（由主进程处理）
        if (event.key === 'Escape') {
            if (this.searchInput.value) {
                this.searchInput.value = '';
                this.searchMemos();
                event.preventDefault();
            }
        }
    }

    showToast(message) {
        // 简单的toast提示实现
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 1000;
            font-size: 14px;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            document.body.removeChild(toast);
        }, 2000);
    }

    formatTime(timestamp) {
        if (!timestamp) {
            return '未知时间';
        }

        // 确保时间戳是数字格式
        const numericTimestamp = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
        if (isNaN(numericTimestamp)) {
            return '未知时间';
        }

        const date = new Date(numericTimestamp);
        if (isNaN(date.getTime())) {
            return '未知时间';
        }

        const now = new Date();
        const diff = now - date;

        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) { // 1天内
            return `${Math.floor(diff / 3600000)}小时前`;
        } else {
            return date.toLocaleDateString();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debounce(func, wait) {
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

    toggleMemoSelection(memoId) {
        if (this.selectedMemos.has(memoId)) {
            this.selectedMemos.delete(memoId);
        } else {
            this.selectedMemos.add(memoId);
        }
        this.updateBatchControls();
    }

    toggleSelectAll() {
        if (this.selectAllCheckbox.checked) {
            this.filteredMemos.forEach(memo => {
                this.selectedMemos.add(memo.id);
            });
        } else {
            this.selectedMemos.clear();
        }
        this.renderMemoList();
    }

    updateBatchControls() {
        const selectedCount = this.selectedMemos.size;
        const totalCount = this.filteredMemos.length;

        // 更新全选复选框状态
        if (selectedCount === 0) {
            this.selectAllCheckbox.indeterminate = false;
            this.selectAllCheckbox.checked = false;
        } else if (selectedCount === totalCount) {
            this.selectAllCheckbox.indeterminate = false;
            this.selectAllCheckbox.checked = true;
        } else {
            this.selectAllCheckbox.indeterminate = true;
        }

        // 更新批量删除按钮状态
        this.batchDeleteBtn.disabled = selectedCount === 0;
        this.batchDeleteBtn.textContent = selectedCount > 0
            ? `删除选中(${selectedCount})`
            : '删除选中';
    }

    // 解析备忘录内容，分离Problem和Solution
    parseContent(content) {
        // 如果内容包含新的标记分隔符，则按标记分离
        if (content.includes('Problem\n') && content.includes('Solution\n')) {
            const problemStart = content.indexOf('Problem\n') + 8;
            const solutionIndex = content.indexOf('\n\nSolution\n');
            const solutionStart = solutionIndex + 11;

            const problem = content.substring(problemStart, solutionIndex).trim();
            const solution = content.substring(solutionStart).trim();

            return { problem, solution };
        }
        // 如果只包含Problem标记
        else if (content.includes('Problem\n')) {
            const problemStart = content.indexOf('Problem\n') + 8;
            const problem = content.substring(problemStart).trim();
            return { problem, solution: '' };
        }
        // 如果只包含Solution标记
        else if (content.includes('Solution\n')) {
            const solutionStart = content.indexOf('Solution\n') + 9;
            const solution = content.substring(solutionStart).trim();
            return { problem: '', solution };
        }
        // 兼容旧格式：如果内容包含旧的标记分隔符，则按标记分离
        else if (content.includes('=== PROBLEM ===') && content.includes('=== SOLUTION ===')) {
            const problemStart = content.indexOf('=== PROBLEM ===') + 15;
            const solutionStart = content.indexOf('=== SOLUTION ===') + 16;

            const problem = content.substring(problemStart, content.indexOf('=== SOLUTION ===')).trim();
            const solution = content.substring(solutionStart).trim();

            return { problem, solution };
        }
        // 如果只包含旧的Problem标记
        else if (content.includes('=== PROBLEM ===')) {
            const problemStart = content.indexOf('=== PROBLEM ===') + 15;
            const problem = content.substring(problemStart).trim();
            return { problem, solution: '' };
        }
        // 如果只包含旧的Solution标记
        else if (content.includes('=== SOLUTION ===')) {
            const solutionStart = content.indexOf('=== SOLUTION ===') + 16;
            const solution = content.substring(solutionStart).trim();
            return { problem: '', solution };
        }

        // 否则，将现有内容放在Problem区域
        return { problem: content, solution: '' };
    }

    // 合并Problem和Solution内容
    combineContent() {
        const problem = this.problemContent.value.trim();
        const solution = this.solutionContent.value.trim();

        if (!problem && !solution) return '';

        let combined = '';
        if (problem) {
            combined += `Problem\n${problem}`;
        }
        if (solution) {
            if (combined) combined += '\n\n';
            combined += `Solution\n${solution}`;
        }

        return combined;
    }

    // 获取预览文本，去除标记
    getPreviewText(content) {
        const sections = this.parseContent(content);
        const combinedText = (sections.problem + ' ' + sections.solution).trim();
        return combinedText.substring(0, 50);
    }

    async batchDeleteMemos() {
        const selectedIds = Array.from(this.selectedMemos);
        if (selectedIds.length === 0) return;

        if (confirm(`确定要删除选中的 ${selectedIds.length} 个备忘录吗？`)) {
            try {
                const response = await fetch('/api/memos', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ids: selectedIds })
                });

                if (response.status === 401) {
                    window.authManager.showAuth();
                    return;
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('删除请求失败:', response.status, errorText);
                    this.showToast(`删除失败: ${response.status}`);
                    return;
                }

                const result = await response.json();

                if (result.success) {
                    // 从本地数组中删除
                    this.memos = this.memos.filter(m => !selectedIds.includes(m.id));
                    this.filteredMemos = this.filteredMemos.filter(m => !selectedIds.includes(m.id));

                    // 清空选择
                    this.selectedMemos.clear();

                    // 如果当前选中的备忘录被删除了，创建新的
                    if (this.currentMemo && selectedIds.includes(this.currentMemo.id)) {
                        this.createNewMemo();
                    }

                    this.renderMemoList();
                    this.showToast(`成功删除 ${result.deletedCount} 个备忘录`);
                } else {
                    console.error('删除操作返回失败:', result);
                    this.showToast('删除操作失败');
                }
            } catch (error) {
                console.error('批量删除异常:', error);
                this.showToast(`批量删除失败: ${error.message}`);
            }
        }
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
    window.memoApp = new MemoApp();
});