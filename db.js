const { Pool } = require('pg');

// 数据库连接配置
const pool = new Pool({
    host: 'dbconn.sealoshzh.site',
    port: 32849,
    database: 'test-db',
    user: 'postgres',
    password: 'lw4vfm8g',
    ssl: false
});

// 初始化数据库表
async function initDatabase() {
    const client = await pool.connect();
    try {
        // 创建 users 表
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )
        `);

        // 创建 memos 表
        await client.query(`
            CREATE TABLE IF NOT EXISTS memos (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )
        `);

        // 检查是否需要添加 user_id 列到现有的 memos 表
        const result = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'memos' AND column_name = 'user_id'
        `);

        if (result.rows.length === 0) {
            // 如果 user_id 列不存在，先创建一个默认用户
            const defaultUserResult = await client.query(`
                INSERT INTO users (username, email, password_hash, created_at, updated_at)
                VALUES ('default', 'default@example.com', '$2b$10$defaulthash', $1, $1)
                ON CONFLICT (username) DO NOTHING
                RETURNING id
            `, [Date.now()]);

            let defaultUserId;
            if (defaultUserResult.rows.length > 0) {
                defaultUserId = defaultUserResult.rows[0].id;
            } else {
                const existingUser = await client.query(`SELECT id FROM users WHERE username = 'default'`);
                defaultUserId = existingUser.rows[0].id;
            }

            // 添加 user_id 列
            await client.query(`ALTER TABLE memos ADD COLUMN user_id INTEGER`);

            // 将所有现有备忘录分配给默认用户
            await client.query(`UPDATE memos SET user_id = $1 WHERE user_id IS NULL`, [defaultUserId]);

            // 添加外键约束
            await client.query(`ALTER TABLE memos ALTER COLUMN user_id SET NOT NULL`);
            await client.query(`ALTER TABLE memos ADD CONSTRAINT fk_memos_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`);
        }

        console.log('数据库表初始化完成');
    } catch (error) {
        console.error('数据库初始化失败:', error);
        throw error;
    } finally {
        client.release();
    }
}

// 获取指定用户的所有备忘录
async function getMemos(userId) {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM memos WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
        return result.rows.map(row => ({
            id: row.id.toString(),
            title: row.title,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    } finally {
        client.release();
    }
}

// 创建新备忘录
async function createMemo(userId, title, content) {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'INSERT INTO memos (user_id, title, content, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, title || '', content || '', now, now]
        );
        const row = result.rows[0];
        return {
            id: row.id.toString(),
            title: row.title,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } finally {
        client.release();
    }
}

// 更新备忘录
async function updateMemo(userId, id, title, content) {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'UPDATE memos SET title = $1, content = $2, updated_at = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
            [title || '', content || '', now, parseInt(id), userId]
        );
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        return {
            id: row.id.toString(),
            title: row.title,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } finally {
        client.release();
    }
}

// 删除单个备忘录
async function deleteMemo(userId, id) {
    const client = await pool.connect();
    try {
        const result = await client.query('DELETE FROM memos WHERE id = $1 AND user_id = $2', [parseInt(id), userId]);
        return result.rowCount > 0;
    } finally {
        client.release();
    }
}

// 批量删除备忘录
async function deleteMemos(userId, ids) {
    const client = await pool.connect();
    try {
        const intIds = ids.map(id => parseInt(id));
        const result = await client.query('DELETE FROM memos WHERE id = ANY($1) AND user_id = $2', [intIds, userId]);
        return result.rowCount;
    } finally {
        client.release();
    }
}

// 创建用户
async function createUser(username, email, passwordHash) {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, created_at',
            [username, email, passwordHash, now, now]
        );
        const row = result.rows[0];
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            createdAt: row.created_at
        };
    } finally {
        client.release();
    }
}

// 通过用户名查找用户
async function findUserByUsername(username) {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            passwordHash: row.password_hash,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } finally {
        client.release();
    }
}

// 通过邮箱查找用户
async function findUserByEmail(email) {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            passwordHash: row.password_hash,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } finally {
        client.release();
    }
}

// 通过ID查找用户
async function findUserById(id) {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } finally {
        client.release();
    }
}

module.exports = {
    initDatabase,
    getMemos,
    createMemo,
    updateMemo,
    deleteMemo,
    deleteMemos,
    createUser,
    findUserByUsername,
    findUserByEmail,
    findUserById
};