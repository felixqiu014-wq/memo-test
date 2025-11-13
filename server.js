const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const db = require('./db');
const auth = require('./auth');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(cookieParser());
app.use(express.static('.'));

// 认证 API 路由
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 验证输入
        if (!username || !email || !password) {
            return res.status(400).json({ error: '用户名、邮箱和密码都是必需的' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: '密码长度至少6位' });
        }

        // 检查用户名是否已存在
        const existingUser = await db.findUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }

        // 检查邮箱是否已存在
        const existingEmail = await db.findUserByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ error: '邮箱已被注册' });
        }

        // 创建用户
        const hashedPassword = await auth.hashPassword(password);
        const user = await db.createUser(username, email, hashedPassword);

        // 生成 token
        const token = auth.generateToken(user.id, user.username);

        // 设置 cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
        });

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '注册失败' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码都是必需的' });
        }

        // 查找用户
        const user = await db.findUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 验证密码
        const isValidPassword = await auth.verifyPassword(password, user.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 生成 token
        const token = auth.generateToken(user.id, user.username);

        // 设置 cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
        });

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

app.get('/api/me', auth.authenticateToken, async (req, res) => {
    try {
        const user = await db.findUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json({
            id: user.id,
            username: user.username,
            email: user.email
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ error: '获取用户信息失败' });
    }
});

// 备忘录 API 路由
app.get('/api/memos', auth.authenticateToken, async (req, res) => {
    try {
        const memos = await db.getAccessibleMemos(req.user.userId);
        res.json(memos);
    } catch (error) {
        console.error('获取备忘录失败:', error);
        res.status(500).json({ error: '获取备忘录失败' });
    }
});

app.post('/api/memos', auth.authenticateToken, async (req, res) => {
    try {
        const { id, title, content } = req.body;

        if (id) {
            // 检查用户是否有权限更新这个备忘录
            const canAccess = await db.canAccessMemo(req.user.userId, id);
            if (!canAccess) {
                return res.status(403).json({ error: '无权限编辑此备忘录' });
            }
        }

        let savedMemo;
        if (id) {
            // 更新现有备忘录（包括分享的）
            savedMemo = await db.updateMemo(req.user.userId, id, title, content);
            if (!savedMemo) {
                return res.status(404).json({ error: '备忘录不存在或无权限' });
            }
        } else {
            // 创建新备忘录
            savedMemo = await db.createMemo(req.user.userId, title, content);
        }

        res.json(savedMemo);
    } catch (error) {
        console.error('保存备忘录失败:', error);
        res.status(500).json({ error: '保存备忘录失败' });
    }
});

app.delete('/api/memos/:id', auth.authenticateToken, async (req, res) => {
    try {
        const success = await db.deleteMemo(req.user.userId, req.params.id);
        if (!success) {
            return res.status(404).json({ error: '备忘录不存在或无权限' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('删除备忘录失败:', error);
        res.status(500).json({ error: '删除备忘录失败' });
    }
});

app.delete('/api/memos', auth.authenticateToken, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: '无效的删除请求' });
        }

        const deletedCount = await db.deleteMemos(req.user.userId, ids);
        res.json({ success: true, deletedCount });
    } catch (error) {
        console.error('批量删除失败:', error);
        res.status(500).json({ error: '批量删除失败' });
    }
});

// 分享备忘录API
app.post('/api/memos/:id/share', auth.authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        const memoId = req.params.id;

        if (!username) {
            return res.status(400).json({ error: '用户名不能为空' });
        }

        // 检查分享目标用户是否存在
        const targetUser = await db.findUserByUsername(username);
        if (!targetUser) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 检查是否尝试分享给自己
        if (targetUser.id === req.user.userId) {
            return res.status(400).json({ error: '不能分享给自己' });
        }

        // 检查备忘录是否属于当前用户
        const memo = await db.getMemos(req.user.userId);
        const targetMemo = memo.find(m => m.id === memoId);
        if (!targetMemo) {
            return res.status(404).json({ error: '备忘录不存在或无权限' });
        }

        // 创建分享记录
        const share = await db.createMemoShare(memoId, req.user.userId, targetUser.id);

        // 创建通知
        const message = `${req.user.username} 想要与您分享备忘录 "${targetMemo.title}"`;
        await db.createNotification(targetUser.id, share.id, 'share_request', message);

        res.json({ success: true, message: '分享请求已发送' });
    } catch (error) {
        if (error.constraint === 'memo_shares_memo_id_shared_with_key') {
            return res.status(400).json({ error: '已经分享给该用户' });
        }
        console.error('分享备忘录失败:', error);
        res.status(500).json({ error: '分享备忘录失败' });
    }
});

// 获取分享请求
app.get('/api/share-requests', auth.authenticateToken, async (req, res) => {
    try {
        const requests = await db.getShareRequests(req.user.userId);
        res.json(requests);
    } catch (error) {
        console.error('获取分享请求失败:', error);
        res.status(500).json({ error: '获取分享请求失败' });
    }
});

// 处理分享请求（接受或拒绝）
app.post('/api/share-requests/:id/respond', auth.authenticateToken, async (req, res) => {
    try {
        const { action } = req.body; // 'accept' or 'reject'
        const shareId = req.params.id;

        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ error: '无效的操作' });
        }

        const status = action === 'accept' ? 'accepted' : 'rejected';
        const share = await db.updateShareStatus(shareId, status);

        if (!share) {
            return res.status(404).json({ error: '分享请求不存在' });
        }

        res.json({ success: true, status });
    } catch (error) {
        console.error('处理分享请求失败:', error);
        res.status(500).json({ error: '处理分享请求失败' });
    }
});

// 获取用户通知
app.get('/api/notifications', auth.authenticateToken, async (req, res) => {
    try {
        const notifications = await db.getUserNotifications(req.user.userId);
        res.json(notifications);
    } catch (error) {
        console.error('获取通知失败:', error);
        res.status(500).json({ error: '获取通知失败' });
    }
});

// 标记通知为已读
app.post('/api/notifications/:id/read', auth.authenticateToken, async (req, res) => {
    try {
        await db.markNotificationAsRead(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('标记通知已读失败:', error);
        res.status(500).json({ error: '标记通知已读失败' });
    }
});

// 获取备忘录更新历史
app.get('/api/memos/:id/updates', auth.authenticateToken, async (req, res) => {
    try {
        const updates = await db.getMemoUpdates(req.user.userId, req.params.id);
        res.json(updates);
    } catch (error) {
        console.error('获取备忘录更新历史失败:', error);
        res.status(500).json({ error: '获取备忘录更新历史失败' });
    }
});

// 知识库 API 路由

// 获取用户的所有知识库
app.get('/api/knowledge-bases', auth.authenticateToken, async (req, res) => {
    try {
        const knowledgeBases = await db.getKnowledgeBases(req.user.userId);
        res.json(knowledgeBases);
    } catch (error) {
        console.error('获取知识库失败:', error);
        res.status(500).json({ error: '获取知识库失败' });
    }
});

// 创建知识库
app.post('/api/knowledge-bases', auth.authenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: '知识库名称不能为空' });
        }

        const knowledgeBase = await db.createKnowledgeBase(req.user.userId, name, description || '');
        res.json(knowledgeBase);
    } catch (error) {
        console.error('创建知识库失败:', error);
        res.status(500).json({ error: '创建知识库失败' });
    }
});

// 更新知识库（重命名）
app.put('/api/knowledge-bases/:id', auth.authenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: '知识库名称不能为空' });
        }

        const updatedKnowledgeBase = await db.updateKnowledgeBase(req.user.userId, req.params.id, name, description || '');

        if (!updatedKnowledgeBase) {
            return res.status(404).json({ error: '知识库不存在或无权限' });
        }

        res.json(updatedKnowledgeBase);
    } catch (error) {
        console.error('更新知识库失败:', error);
        res.status(500).json({ error: '更新知识库失败' });
    }
});

// 删除知识库
app.delete('/api/knowledge-bases/:id', auth.authenticateToken, async (req, res) => {
    try {
        const success = await db.deleteKnowledgeBase(req.user.userId, req.params.id);

        if (!success) {
            return res.status(404).json({ error: '知识库不存在或无权限' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('删除知识库失败:', error);
        res.status(500).json({ error: '删除知识库失败' });
    }
});

// 获取知识库中的所有备忘录
app.get('/api/knowledge-bases/:id/memos', auth.authenticateToken, async (req, res) => {
    try {
        const memos = await db.getKnowledgeBaseMemos(req.user.userId, req.params.id);
        res.json(memos);
    } catch (error) {
        console.error('获取知识库备忘录失败:', error);
        res.status(500).json({ error: '获取知识库备忘录失败' });
    }
});

// 将备忘录添加到知识库
app.post('/api/knowledge-bases/:id/memos', auth.authenticateToken, async (req, res) => {
    try {
        const { memoId } = req.body;

        if (!memoId) {
            return res.status(400).json({ error: 'memoId不能为空' });
        }

        // 检查用户是否有权限访问此备忘录
        const canAccess = await db.canAccessMemo(req.user.userId, memoId);
        if (!canAccess) {
            return res.status(403).json({ error: '无权限访问此备忘录' });
        }

        const result = await db.addMemoToKnowledgeBase(req.user.userId, req.params.id, memoId);
        res.json({ success: true, result });
    } catch (error) {
        console.error('添加备忘录到知识库失败:', error);
        res.status(500).json({ error: '添加备忘录到知识库失败' });
    }
});

// 从知识库移除备忘录
app.delete('/api/knowledge-bases/:id/memos/:memoId', auth.authenticateToken, async (req, res) => {
    try {
        const success = await db.removeMemoFromKnowledgeBase(req.user.userId, req.params.id, req.params.memoId);

        if (!success) {
            return res.status(404).json({ error: '备忘录不在知识库中' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('从知识库移除备忘录失败:', error);
        res.status(500).json({ error: '从知识库移除备忘录失败' });
    }
});

// 获取备忘录所属的知识库
app.get('/api/memos/:id/knowledge-bases', auth.authenticateToken, async (req, res) => {
    try {
        const knowledgeBases = await db.getMemoKnowledgeBases(req.user.userId, req.params.id);
        res.json(knowledgeBases);
    } catch (error) {
        console.error('获取备忘录的知识库失败:', error);
        res.status(500).json({ error: '获取备忘录的知识库失败' });
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