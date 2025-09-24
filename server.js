const express = require('express');
const path = require('path');
const db = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static('.'));

// API 路由
app.get('/api/memos', async (req, res) => {
    try {
        const memos = await db.getMemos();
        res.json(memos);
    } catch (error) {
        console.error('获取备忘录失败:', error);
        res.status(500).json({ error: '获取备忘录失败' });
    }
});

app.post('/api/memos', async (req, res) => {
    try {
        const { id, title, content } = req.body;

        let savedMemo;
        if (id) {
            // 更新现有备忘录
            savedMemo = await db.updateMemo(id, title, content);
            if (!savedMemo) {
                return res.status(404).json({ error: '备忘录不存在' });
            }
        } else {
            // 创建新备忘录
            savedMemo = await db.createMemo(title, content);
        }

        res.json(savedMemo);
    } catch (error) {
        console.error('保存备忘录失败:', error);
        res.status(500).json({ error: '保存备忘录失败' });
    }
});

app.delete('/api/memos/:id', async (req, res) => {
    try {
        const success = await db.deleteMemo(req.params.id);
        if (!success) {
            return res.status(404).json({ error: '备忘录不存在' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('删除备忘录失败:', error);
        res.status(500).json({ error: '删除备忘录失败' });
    }
});

app.delete('/api/memos', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: '无效的删除请求' });
        }

        const deletedCount = await db.deleteMemos(ids);
        res.json({ success: true, deletedCount });
    } catch (error) {
        console.error('批量删除失败:', error);
        res.status(500).json({ error: '批量删除失败' });
    }
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
async function startServer() {
    await db.initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Memo Web App running on http://0.0.0.0:${PORT}`);
    });
}

startServer().catch(console.error);