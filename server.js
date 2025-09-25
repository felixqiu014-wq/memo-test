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
        const memos = await db.getMemos(req.user.userId);
        res.json(memos);
    } catch (error) {
        console.error('获取备忘录失败:', error);
        res.status(500).json({ error: '获取备忘录失败' });
    }
});

app.post('/api/memos', auth.authenticateToken, async (req, res) => {
    try {
        const { id, title, content } = req.body;

        let savedMemo;
        if (id) {
            // 更新现有备忘录
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