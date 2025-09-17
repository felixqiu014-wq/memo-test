const { ipcRenderer } = require('electron');

class MemoApp {
    constructor() {
        this.currentMemo = null;
        this.memos = [];
        this.filteredMemos = [];
        this.isEditing = false;
        
        this.initializeElements();
        this.bindEvents();
        this.loadMemos();
        this.createNewMemo();
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.newMemoBtn = document.getElementById('newMemoBtn');
        this.memoList = document.getElementById('memoList');
        this.memoTitle = document.getElementById('memoTitle');
        this.memoContent = document.getElementById('memoContent');
        this.copyBtn = document.getElementById('copyBtn');
        this.deleteBtn = document.getElementById('deleteBtn');
        this.charCount = document.getElementById('charCount');
        this.lastSaved = document.getElementById('lastSaved');
    }

    bindEvents() {
        // 搜索功能
        this.searchInput.addEventListener('input', () => this.searchMemos());
        
        // 新建备忘录
        this.newMemoBtn.addEventListener('click', () => this.createNewMemo());
        
        // 标题和内容输入
        this.memoTitle.addEventListener('input', () => this.handleInput());
        this.memoContent.addEventListener('input', () => this.handleInput());
        
        // 操作按钮
        this.copyBtn.addEventListener('click', () => this.copyContent());
        this.deleteBtn.addEventListener('click', () => this.deleteCurrentMemo());
        
        // 自动保存防抖
        this.debounceSave = this.debounce(() => this.saveMemo(), 1000);
        
        // 快捷键支持
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    async loadMemos() {
        try {
            this.memos = await ipcRenderer.invoke('get-memos');
            this.filteredMemos = [...this.memos];
            this.renderMemoList();
        } catch (error) {
            console.error('加载备忘录失败:', error);
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
                <div class="memo-item-title">${this.escapeHtml(memo.title || '无标题')}</div>
                <div class="memo-item-preview">${this.escapeHtml(memo.content.substring(0, 50))}</div>
                <div class="memo-item-time">${this.formatTime(memo.updatedAt)}</div>
            </div>
        `).join('');

        // 绑定点击事件
        this.memoList.querySelectorAll('.memo-item').forEach(item => {
            item.addEventListener('click', () => {
                const memoId = item.getAttribute('data-id');
                this.selectMemo(memoId);
            });
        });
    }

    selectMemo(memoId) {
        const memo = this.memos.find(m => m.id === memoId);
        if (memo) {
            this.currentMemo = memo;
            this.memoTitle.value = memo.title || '';
            this.memoContent.value = memo.content || '';
            this.lastSaved.textContent = `最后更新: ${this.formatTime(memo.updatedAt)}`;
            this.updateCharCount();
            this.renderMemoList();
            this.memoContent.focus();
        }
    }

    createNewMemo() {
        this.currentMemo = null;
        this.memoTitle.value = '';
        this.memoContent.value = '';
        this.lastSaved.textContent = '';
        this.updateCharCount();
        this.memoContent.focus();
        this.renderMemoList();
    }

    handleInput() {
        this.updateCharCount();
        this.debounceSave();
    }

    updateCharCount() {
        const count = this.memoContent.value.length;
        this.charCount.textContent = `${count} 字符`;
    }

    async saveMemo() {
        if (!this.memoTitle.value && !this.memoContent.value) {
            return;
        }

        try {
            const memoData = {
                id: this.currentMemo?.id,
                title: this.memoTitle.value.trim(),
                content: this.memoContent.value
            };

            const savedMemo = await ipcRenderer.invoke('save-memo', memoData);
            
            if (!this.currentMemo) {
                this.currentMemo = savedMemo;
                this.memos.unshift(savedMemo);
            } else {
                Object.assign(this.currentMemo, savedMemo);
            }

            this.lastSaved.textContent = `最后更新: ${this.formatTime(savedMemo.updatedAt)}`;
            this.renderMemoList();
            
        } catch (error) {
            console.error('保存备忘录失败:', error);
        }
    }

    async deleteCurrentMemo() {
        if (!this.currentMemo) return;

        if (confirm('确定要删除这个备忘录吗？')) {
            try {
                await ipcRenderer.invoke('delete-memo', this.currentMemo.id);
                this.memos = this.memos.filter(m => m.id !== this.currentMemo.id);
                this.filteredMemos = this.filteredMemos.filter(m => m.id !== this.currentMemo.id);
                this.createNewMemo();
                this.renderMemoList();
            } catch (error) {
                console.error('删除备忘录失败:', error);
            }
        }
    }

    async copyContent() {
        if (this.memoContent.value) {
            try {
                await navigator.clipboard.writeText(this.memoContent.value);
                this.showToast('内容已复制到剪贴板');
            } catch (error) {
                console.error('复制失败:', error);
                // 降级方案
                this.memoContent.select();
                document.execCommand('copy');
                this.showToast('内容已复制到剪贴板');
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
        const date = new Date(timestamp);
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
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    new MemoApp();
});