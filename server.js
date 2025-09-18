const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static('.'));

// 数据存储路径
const DATA_FILE = path.join(__dirname, 'memos.json');

// 初始化数据文件
async function initDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
    }
}

// 读取备忘录
async function getMemos() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// 保存备忘录
async function saveMemos(memos) {
    await fs.writeFile(DATA_FILE, JSON.stringify(memos, null, 2));
}

// API 路由
app.get('/api/memos', async (req, res) => {
    try {
        const memos = await getMemos();
        res.json(memos);
    } catch (error) {
        res.status(500).json({ error: '获取备忘录失败' });
    }
});

app.post('/api/memos', async (req, res) => {
    try {
        const memos = await getMemos();
        const { id, title, content } = req.body;

        if (id) {
            // 更新现有备忘录
            const index = memos.findIndex(m => m.id === id);
            if (index !== -1) {
                memos[index] = {
                    ...memos[index],
                    title: title || '',
                    content: content || '',
                    updatedAt: Date.now()
                };
            }
        } else {
            // 创建新备忘录
            const newMemo = {
                id: Date.now().toString(),
                title: title || '',
                content: content || '',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            memos.unshift(newMemo);
        }

        await saveMemos(memos);
        const savedMemo = id ? memos.find(m => m.id === id) : memos[0];
        res.json(savedMemo);
    } catch (error) {
        res.status(500).json({ error: '保存备忘录失败' });
    }
});

app.delete('/api/memos/:id', async (req, res) => {
    try {
        const memos = await getMemos();
        const filteredMemos = memos.filter(m => m.id !== req.params.id);
        await saveMemos(filteredMemos);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: '删除备忘录失败' });
    }
});

app.delete('/api/memos', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: '无效的删除请求' });
        }

        const memos = await getMemos();
        const filteredMemos = memos.filter(m => !ids.includes(m.id));
        await saveMemos(filteredMemos);
        res.json({ success: true, deletedCount: ids.length });
    } catch (error) {
        res.status(500).json({ error: '批量删除失败' });
    }
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
async function startServer() {
    await initDataFile();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Memo Web App running on http://0.0.0.0:${PORT}`);
    });
}

startServer().catch(console.error);