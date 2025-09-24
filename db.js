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
        // 创建 memos 表
        await client.query(`
            CREATE TABLE IF NOT EXISTS memos (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )
        `);
        console.log('数据库表初始化完成');
    } catch (error) {
        console.error('数据库初始化失败:', error);
        throw error;
    } finally {
        client.release();
    }
}

// 获取所有备忘录
async function getMemos() {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM memos ORDER BY updated_at DESC');
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
async function createMemo(title, content) {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'INSERT INTO memos (title, content, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING *',
            [title || '', content || '', now, now]
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
async function updateMemo(id, title, content) {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'UPDATE memos SET title = $1, content = $2, updated_at = $3 WHERE id = $4 RETURNING *',
            [title || '', content || '', now, parseInt(id)]
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
async function deleteMemo(id) {
    const client = await pool.connect();
    try {
        const result = await client.query('DELETE FROM memos WHERE id = $1', [parseInt(id)]);
        return result.rowCount > 0;
    } finally {
        client.release();
    }
}

// 批量删除备忘录
async function deleteMemos(ids) {
    const client = await pool.connect();
    try {
        const intIds = ids.map(id => parseInt(id));
        const result = await client.query('DELETE FROM memos WHERE id = ANY($1)', [intIds]);
        return result.rowCount;
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
    deleteMemos
};