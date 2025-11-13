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
        this.loadingContainer = document.getElementById('loadingContainer');
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
        // 确保加载动画至少显示300ms，提供更好的视觉体验
        const startTime = Date.now();
        const minLoadingTime = 300;

        try {
            const response = await fetch('/api/me');

            // 等待最小加载时间
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < minLoadingTime) {
                await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
            }

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
            // 确保即使出错也等待最小加载时间
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < minLoadingTime) {
                await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
            }
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
        this.loadingContainer.style.display = 'none';
        this.authContainer.style.display = 'flex';
        this.appContainer.style.display = 'none';
        this.clearForms();
    }

    showApp() {
        this.loadingContainer.style.display = 'none';
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
        this.addToKBBtn = document.getElementById('addToKBBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.copyProblemBtn = document.getElementById('copyProblemBtn');
        this.copySolutionBtn = document.getElementById('copySolutionBtn');
        this.deleteBtn = document.getElementById('deleteBtn');
        this.charCount = document.getElementById('charCount');
        this.lastSaved = document.getElementById('lastSaved');
        this.selectAllCheckbox = document.getElementById('selectAllCheckbox');
        this.batchDeleteBtn = document.getElementById('batchDeleteBtn');

        // 通知相关元素
        this.notificationBtn = document.getElementById('notificationBtn');
        this.notificationCount = document.getElementById('notificationCount');
        this.notificationDropdown = document.getElementById('notificationDropdown');
        this.notificationList = document.getElementById('notificationList');
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
        this.addToKBBtn.addEventListener('click', () => this.addToKnowledgeBase());
        this.shareBtn.addEventListener('click', () => this.showShareModal());
        this.copyProblemBtn.addEventListener('click', () => this.copyProblemContent());
        this.copySolutionBtn.addEventListener('click', () => this.copySolutionContent());
        this.deleteBtn.addEventListener('click', () => this.deleteCurrentMemo());

        // 通知功能
        this.notificationBtn.addEventListener('click', () => this.toggleNotificationDropdown());
        document.addEventListener('click', (e) => {
            if (!this.notificationBtn.contains(e.target) && !this.notificationDropdown.contains(e.target)) {
                this.notificationDropdown.style.display = 'none';
            }
        });

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

            // 尝试恢复之前选中的备忘录
            this.restoreCurrentMemo();
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
        // 清除localStorage
        localStorage.removeItem('currentMemoId');
    }

    // 恢复之前选中的备忘录
    restoreCurrentMemo() {
        const savedMemoId = localStorage.getItem('currentMemoId');
        if (savedMemoId && this.memos.length > 0) {
            const memo = this.memos.find(m => m.id === savedMemoId);
            if (memo) {
                // 延迟选择，确保DOM已经渲染
                setTimeout(() => {
                    this.selectMemo(savedMemoId);
                }, 100);
            } else {
                // 如果找不到之前的备忘录，清除localStorage
                localStorage.removeItem('currentMemoId');
            }
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

            // 保存当前备忘录ID到localStorage
            localStorage.setItem('currentMemoId', memoId);
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

        // 清除localStorage中的当前备忘录ID
        localStorage.removeItem('currentMemoId');
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
                // 保存新创建的备忘录ID到localStorage
                localStorage.setItem('currentMemoId', savedMemo.id);
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

            // 如果是被分享者保存，显示特殊提示
            if (savedMemo.accessType === 'shared') {
                this.showToast('已保存到共享备忘录，分享者将收到更新通知');
            }

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
                // 清除localStorage中的当前备忘录ID
                localStorage.removeItem('currentMemoId');
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

    addToKnowledgeBase() {
        if (!this.currentMemo) {
            this.showToast('请先选择要添加的备忘录');
            return;
        }
        window.knowledgeBaseManager.openAddMemoModal(this.currentMemo.id);
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
                        localStorage.removeItem('currentMemoId');
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

    // 显示分享模态框
    showShareModal() {
        if (!this.currentMemo) {
            this.showToast('请先选择要分享的备忘录');
            return;
        }
        document.getElementById('shareModal').style.display = 'flex';
        document.getElementById('shareUsername').value = '';
        document.getElementById('shareError').textContent = '';
    }

    // 切换通知下拉菜单
    async toggleNotificationDropdown() {
        if (this.notificationDropdown.style.display === 'none' || !this.notificationDropdown.style.display) {
            await this.loadNotifications();
            this.notificationDropdown.style.display = 'block';
        } else {
            this.notificationDropdown.style.display = 'none';
        }
    }

    // 加载通知
    async loadNotifications() {
        try {
            const response = await fetch('/api/notifications');
            if (response.status === 401) {
                window.authManager.showAuth();
                return;
            }

            const notifications = await response.json();
            this.renderNotifications(notifications);
            this.updateNotificationCount(notifications.length);
        } catch (error) {
            console.error('加载通知失败:', error);
        }
    }

    // 渲染通知列表
    renderNotifications(notifications) {
        if (notifications.length === 0) {
            this.notificationList.innerHTML = '<div class="notification-item">暂无通知</div>';
            return;
        }

        this.notificationList.innerHTML = notifications.map(notification => `
            <div class="notification-item" data-id="${notification.id}">
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${this.formatTime(notification.created_at)}</div>
                <div class="notification-actions">
                    <button class="btn-accept" onclick="window.memoApp.respondToShareRequest(${notification.share_id}, 'accept', ${notification.id})">接受</button>
                    <button class="btn-reject" onclick="window.memoApp.respondToShareRequest(${notification.share_id}, 'reject', ${notification.id})">拒绝</button>
                </div>
            </div>
        `).join('');
    }

    // 更新通知计数
    updateNotificationCount(count) {
        if (count > 0) {
            this.notificationCount.textContent = count;
            this.notificationCount.style.display = 'flex';
        } else {
            this.notificationCount.style.display = 'none';
        }
    }

    // 响应分享请求
    async respondToShareRequest(shareId, action, notificationId) {
        try {
            const response = await fetch(`/api/share-requests/${shareId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action })
            });

            if (response.status === 401) {
                window.authManager.showAuth();
                return;
            }

            if (response.ok) {
                // 标记通知为已读
                await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });

                // 重新加载通知和备忘录列表
                await this.loadNotifications();
                await this.loadMemos();

                this.showToast(action === 'accept' ? '已接受分享' : '已拒绝分享');
            } else {
                const error = await response.json();
                this.showToast(error.error || '操作失败');
            }
        } catch (error) {
            console.error('响应分享请求失败:', error);
            this.showToast('操作失败');
        }
    }

    // 修改renderMemoList方法，添加分享标识
    renderMemoList() {
        if (this.filteredMemos.length === 0) {
            this.memoList.innerHTML = '<div class="no-memos">暂无备忘录</div>';
            return;
        }

        this.memoList.innerHTML = this.filteredMemos.map(memo => {
            const isSelected = this.selectedMemos.has(memo.id);
            const isActive = this.currentMemo && this.currentMemo.id === memo.id;
            const previewText = this.getPreviewText(memo.content) || '空白备忘录';
            const isShared = memo.accessType === 'shared';

            return `
                <div class="memo-item ${isActive ? 'active' : ''} ${isShared ? 'shared' : ''}" data-id="${memo.id}">
                    <div class="memo-checkbox">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.memoApp.toggleMemoSelection('${memo.id}')">
                    </div>
                    <div class="memo-content" onclick="window.memoApp.selectMemo('${memo.id}')">
                        <div class="memo-title">
                            ${this.escapeHtml(memo.title) || '未命名备忘录'}
                            ${isShared ? '<span class="memo-shared-badge">共享</span>' : ''}
                        </div>
                        <div class="memo-preview">${this.escapeHtml(previewText)}</div>
                        <div class="memo-time">${this.formatTime(memo.updatedAt)}</div>
                        ${isShared ? `<div class="memo-owner">来自: ${memo.ownerUsername}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        this.updateBatchControls();
    }

    // 初始化时加载通知
    async init() {
        await this.loadMemos();
        await this.loadNotifications();

        // 定期检查通知和备忘录更新
        setInterval(() => {
            this.loadNotifications();
            this.checkForMemoUpdates();
        }, 30000); // 每30秒检查一次
    }

    // 检查备忘录更新
    async checkForMemoUpdates() {
        try {
            // 只检查当前用户拥有的被分享的备忘录
            const ownedSharedMemos = this.memos.filter(memo => memo.accessType === 'owner' && memo.sharedWith);

            for (const memo of ownedSharedMemos) {
                const updates = await this.getMemoUpdates(memo.id);
                if (updates.length > 0) {
                    // 如果有更新，刷新备忘录列表
                    await this.loadMemos();

                    // 如果当前正在查看这个备忘录，也需要刷新
                    if (this.currentMemo && this.currentMemo.id === memo.id) {
                        this.selectMemo(memo.id);
                    }

                    // 显示通知
                    const latestUpdate = updates[0];
                    this.showToast(`${latestUpdate.updatedByUsername} 更新了共享备忘录 "${memo.title}"`);
                    break; // 只显示一个通知，避免过多弹窗
                }
            }
        } catch (error) {
            console.error('检查备忘录更新失败:', error);
        }
    }

    // 获取备忘录更新历史
    async getMemoUpdates(memoId) {
        try {
            const response = await fetch(`/api/memos/${memoId}/updates`);
            if (response.status === 401) {
                window.authManager.showAuth();
                return [];
            }

            if (response.ok) {
                return await response.json();
            }
            return [];
        } catch (error) {
            console.error('获取备忘录更新历史失败:', error);
            return [];
        }
    }
}

// 全局函数用于模态框操作
function closeShareModal() {
    document.getElementById('shareModal').style.display = 'none';
}

function closeShareRequestModal() {
    document.getElementById('shareRequestModal').style.display = 'none';
}

async function shareMemo() {
    const username = document.getElementById('shareUsername').value.trim();
    const errorElement = document.getElementById('shareError');

    if (!username) {
        errorElement.textContent = '请输入用户名';
        return;
    }

    if (!window.memoApp.currentMemo) {
        errorElement.textContent = '请先选择要分享的备忘录';
        return;
    }

    try {
        const response = await fetch(`/api/memos/${window.memoApp.currentMemo.id}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });

        if (response.status === 401) {
            window.authManager.showAuth();
            return;
        }

        const result = await response.json();

        if (response.ok) {
            window.memoApp.showToast(result.message || '分享请求已发送');
            closeShareModal();
        } else {
            errorElement.textContent = result.error || '分享失败';
        }
    } catch (error) {
        console.error('分享备忘录失败:', error);
        errorElement.textContent = '分享失败，请稍后重试';
    }
}

// 知识库管理器类
class KnowledgeBaseManager {
    constructor() {
        this.knowledgeBases = [];
        this.currentEditingId = null;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.knowledgeBaseBtn = document.getElementById('knowledgeBaseBtn');
        this.knowledgeBaseView = document.getElementById('knowledgeBaseView');
        this.appContainer = document.getElementById('appContainer');
        this.backToMemosBtn = document.getElementById('backToMemosBtn');
        this.createKBModalBtn = document.getElementById('createKBModalBtn');
        this.knowledgeBaseList = document.getElementById('knowledgeBaseList');
        this.knowledgeBaseModal = document.getElementById('knowledgeBaseModal');
        this.knowledgeBaseModalTitle = document.getElementById('knowledgeBaseModalTitle');
        this.kbNameInput = document.getElementById('kbNameInput');
        this.kbDescInput = document.getElementById('kbDescInput');
        this.kbModalError = document.getElementById('kbModalError');
        this.addMemoToKBModal = document.getElementById('addMemoToKBModal');
        this.kbSelect = document.getElementById('kbSelect');
        this.addMemoKBError = document.getElementById('addMemoKBError');
        this.currentMemoId = null;
    }

    bindEvents() {
        this.knowledgeBaseBtn.addEventListener('click', () => this.showKnowledgeBaseView());
        this.backToMemosBtn.addEventListener('click', () => this.showMemoView());
        this.createKBModalBtn.addEventListener('click', () => this.openCreateModal());
    }

    showKnowledgeBaseView() {
        this.appContainer.style.display = 'none';
        this.knowledgeBaseView.style.display = 'block';
        this.loadKnowledgeBases();
    }

    showMemoView() {
        this.knowledgeBaseView.style.display = 'none';
        this.appContainer.style.display = 'block';
    }

    async loadKnowledgeBases() {
        try {
            const response = await fetch('/api/knowledge-bases');
            if (response.status === 401) {
                window.authManager.showAuth();
                return;
            }
            const knowledgeBases = await response.json();
            this.knowledgeBases = knowledgeBases;
            this.renderKnowledgeBases();
        } catch (error) {
            console.error('加载知识库失败:', error);
            window.memoApp.showToast('加载知识库失败');
        }
    }

    renderKnowledgeBases() {
        if (this.knowledgeBases.length === 0) {
            this.knowledgeBaseList.innerHTML = '<div class="empty-kb-message">暂无知识库，点击"新建知识库"创建</div>';
            return;
        }

        this.knowledgeBaseList.innerHTML = this.knowledgeBases.map(kb => `
            <div class="knowledge-base-item" data-id="${kb.id}">
                <div class="kb-header">
                    <h3 class="kb-name">${kb.name}</h3>
                    <div class="kb-actions">
                        <button class="kb-action-btn" onclick="knowledgeBaseManager.editKnowledgeBase('${kb.id}')" title="编辑">✏️</button>
                        <button class="kb-action-btn" onclick="knowledgeBaseManager.deleteKnowledgeBase('${kb.id}')" title="删除">🗑️</button>
                    </div>
                </div>
                ${kb.description ? `<p class="kb-description">${kb.description}</p>` : ''}
                <div class="kb-meta">
                    <span class="kb-date">创建于: ${new Date(Number(kb.createdAt)).toLocaleDateString()}</span>
                    <button class="kb-view-btn" onclick="knowledgeBaseManager.viewKnowledgeBase('${kb.id}')">查看内容</button>
                </div>
            </div>
        `).join('');
    }

    openCreateModal() {
        this.currentEditingId = null;
        this.knowledgeBaseModalTitle.textContent = '新建知识库';
        this.kbNameInput.value = '';
        this.kbDescInput.value = '';
        this.kbModalError.textContent = '';
        this.knowledgeBaseModal.style.display = 'flex';
    }

    editKnowledgeBase(id) {
        const kb = this.knowledgeBases.find(k => k.id === id);
        if (!kb) return;

        this.currentEditingId = id;
        this.knowledgeBaseModalTitle.textContent = '编辑知识库';
        this.kbNameInput.value = kb.name;
        this.kbDescInput.value = kb.description || '';
        this.kbModalError.textContent = '';
        this.knowledgeBaseModal.style.display = 'flex';
    }

    closeModal() {
        this.knowledgeBaseModal.style.display = 'none';
        this.currentEditingId = null;
    }

    async saveKnowledgeBase() {
        const name = this.kbNameInput.value.trim();
        const description = this.kbDescInput.value.trim();

        if (!name) {
            this.kbModalError.textContent = '知识库名称不能为空';
            return;
        }

        try {
            const url = this.currentEditingId
                ? `/api/knowledge-bases/${this.currentEditingId}`
                : '/api/knowledge-bases';

            const method = this.currentEditingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (response.status === 401) {
                window.authManager.showAuth();
                return;
            }

            if (response.ok) {
                window.memoApp.showToast(this.currentEditingId ? '知识库已更新' : '知识库已创建');
                this.closeModal();
                this.loadKnowledgeBases();
            } else {
                const result = await response.json();
                this.kbModalError.textContent = result.error || '操作失败';
            }
        } catch (error) {
            console.error('保存知识库失败:', error);
            this.kbModalError.textContent = '保存失败，请稍后重试';
        }
    }

    async deleteKnowledgeBase(id) {
        if (!confirm('确定要删除这个知识库吗？知识库中的备忘录不会被删除。')) {
            return;
        }

        try {
            const response = await fetch(`/api/knowledge-bases/${id}`, {
                method: 'DELETE'
            });

            if (response.status === 401) {
                window.authManager.showAuth();
                return;
            }

            if (response.ok) {
                window.memoApp.showToast('知识库已删除');
                this.loadKnowledgeBases();
            } else {
                window.memoApp.showToast('删除知识库失败');
            }
        } catch (error) {
            console.error('删除知识库失败:', error);
            window.memoApp.showToast('删除知识库失败');
        }
    }

    async viewKnowledgeBase(id) {
        try {
            const response = await fetch(`/api/knowledge-bases/${id}/memos`);

            if (response.status === 401) {
                window.authManager.showAuth();
                return;
            }

            if (response.ok) {
                const memos = await response.json();
                this.showKnowledgeBaseMemos(memos);
            }
        } catch (error) {
            console.error('获取知识库备忘录失败:', error);
            window.memoApp.showToast('获取知识库备忘录失败');
        }
    }

    showKnowledgeBaseMemos(memos) {
        if (memos.length === 0) {
            this.knowledgeBaseList.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <button class="back-btn" onclick="knowledgeBaseManager.loadKnowledgeBases()">← 返回知识库列表</button>
                </div>
                <div class="empty-kb-message">此知识库暂无备忘录</div>
            `;
            return;
        }

        this.knowledgeBaseList.innerHTML = `
            <div style="margin-bottom: 20px;">
                <button class="back-btn" onclick="knowledgeBaseManager.loadKnowledgeBases()">← 返回知识库列表</button>
            </div>
            <div class="kb-memos-list">
                ${memos.map(memo => `
                    <div class="memo-item" data-id="${memo.id}">
                        <div class="memo-item-content">
                            <div class="memo-item-title">${memo.title || '无标题'}</div>
                            <div class="memo-item-preview">${memo.content.substring(0, 100)}${memo.content.length > 100 ? '...' : ''}</div>
                        </div>
                        <div class="memo-item-footer">
                            <span class="memo-item-date">${new Date(Number(memo.updatedAt)).toLocaleDateString()}</span>
                            <button class="memo-item-action" onclick="knowledgeBaseManager.removeMemoFromKB('${memo.id}')">移除</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async removeMemoFromKB(memoId) {
        if (!confirm('确定要从知识库中移除此备忘录吗？')) {
            return;
        }

        alert('此功能需要当前知识库ID，请在知识库详情页操作');
    }

    openAddMemoModal(memoId) {
        this.currentMemoId = memoId;
        this.addMemoKBError.textContent = '';
        this.loadKBSelectOptions();
        this.addMemoToKBModal.style.display = 'flex';
    }

    closeAddMemoModal() {
        this.addMemoToKBModal.style.display = 'none';
        this.currentMemoId = null;
        this.kbSelect.innerHTML = '<option value="">-- 选择知识库 --</option>';
    }

    async loadKBSelectOptions() {
        try {
            const response = await fetch('/api/knowledge-bases');
            if (response.ok) {
                const knowledgeBases = await response.json();
                knowledgeBases.forEach(kb => {
                    const option = document.createElement('option');
                    option.value = kb.id;
                    option.textContent = kb.name;
                    this.kbSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('加载知识库选项失败:', error);
        }
    }

    async addMemoToKB() {
        const knowledgeBaseId = this.kbSelect.value;

        if (!knowledgeBaseId) {
            this.addMemoKBError.textContent = '请选择知识库';
            return;
        }

        if (!this.currentMemoId) {
            this.addMemoKBError.textContent = '无效的备忘录';
            return;
        }

        try {
            const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/memos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memoId: this.currentMemoId })
            });

            if (response.status === 401) {
                window.authManager.showAuth();
                return;
            }

            if (response.ok) {
                window.memoApp.showToast('备忘录已添加到知识库');
                this.closeAddMemoModal();
            } else {
                const result = await response.json();
                this.addMemoKBError.textContent = result.error || '添加失败';
            }
        } catch (error) {
            console.error('添加备忘录到知识库失败:', error);
            this.addMemoKBError.textContent = '添加失败，请稍后重试';
        }
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
    window.memoApp = new MemoApp();

    // 在用户登录后初始化应用
    const originalShowApp = window.authManager.showApp;
    window.authManager.showApp = function() {
        originalShowApp.call(this);
        if (window.memoApp) {
            window.memoApp.init();
        }
        // 初始化知识库管理器
        window.knowledgeBaseManager = new KnowledgeBaseManager();
    };
});