const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// JWT 密钥 (生产环境中应该使用环境变量)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// 密码哈希
async function hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
}

// 验证密码
async function verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

// 生成 JWT token
function generateToken(userId, username) {
    return jwt.sign(
        { userId, username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// 验证 JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// 认证中间件
function authenticateToken(req, res, next) {
    // 从 cookie 或 Authorization header 获取 token
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: '需要登录' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: '无效的登录状态' });
    }

    req.user = decoded;
    next();
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    authenticateToken
};