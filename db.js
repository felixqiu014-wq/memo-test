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

        // 创建备忘录分享表
        await client.query(`
            CREATE TABLE IF NOT EXISTS memo_shares (
                id SERIAL PRIMARY KEY,
                memo_id INTEGER NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
                shared_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                shared_with INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                UNIQUE(memo_id, shared_with)
            )
        `);

        // 创建分享通知表
        await client.query(`
            CREATE TABLE IF NOT EXISTS share_notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                share_id INTEGER NOT NULL REFERENCES memo_shares(id) ON DELETE CASCADE,
                type VARCHAR(20) NOT NULL DEFAULT 'share_request',
                message TEXT NOT NULL,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at BIGINT NOT NULL
            )
        `);

        // 创建备忘录更新历史表（用于同步）
        await client.query(`
            CREATE TABLE IF NOT EXISTS memo_updates (
                id SERIAL PRIMARY KEY,
                memo_id INTEGER NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
                updated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                created_at BIGINT NOT NULL
            )
        `);

        // 创建知识库表
        await client.query(`
            CREATE TABLE IF NOT EXISTS knowledge_bases (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT DEFAULT '',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )
        `);

        // 创建备忘录和知识库的关联表
        await client.query(`
            CREATE TABLE IF NOT EXISTS memo_knowledge_base (
                id SERIAL PRIMARY KEY,
                knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
                memo_id INTEGER NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
                added_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                UNIQUE(knowledge_base_id, memo_id)
            )
        `);

        // 检查并添加 knowledge_bases 表可能缺失的列
        const kbColumns = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'knowledge_bases' AND column_name = 'description'
        `);

        if (kbColumns.rows.length === 0) {
            // 添加 description 列
            await client.query(`ALTER TABLE knowledge_bases ADD COLUMN description TEXT DEFAULT ''`);
            console.log('已为 knowledge_bases 表添加 description 列');
        }

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
                VALUES ('felix', 'felix@example.com', '$2b$10$defaulthash', $1, $1)
                ON CONFLICT (username) DO NOTHING
                RETURNING id
            `, [Date.now()]);

            let defaultUserId;
            if (defaultUserResult.rows.length > 0) {
                defaultUserId = defaultUserResult.rows[0].id;
            } else {
                const existingUser = await client.query(`SELECT id FROM users WHERE username = 'felix'`);
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

// 知识库相关数据库操作

// 获取用户的所有知识库
async function getKnowledgeBases(userId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM knowledge_bases WHERE user_id = $1 ORDER BY updated_at DESC',
            [userId]
        );
        return result.rows.map(row => ({
            id: row.id.toString(),
            name: row.name,
            description: row.description,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    } finally {
        client.release();
    }
}

// 创建知识库
async function createKnowledgeBase(userId, name, description = '') {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'INSERT INTO knowledge_bases (user_id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, name, description, now, now]
        );
        const row = result.rows[0];
        return {
            id: row.id.toString(),
            name: row.name,
            description: row.description,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } finally {
        client.release();
    }
}

// 更新知识库
async function updateKnowledgeBase(userId, id, name, description = '') {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'UPDATE knowledge_bases SET name = $1, description = $2, updated_at = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
            [name, description, now, parseInt(id), userId]
        );
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        return {
            id: row.id.toString(),
            name: row.name,
            description: row.description,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } finally {
        client.release();
    }
}

// 删除知识库
async function deleteKnowledgeBase(userId, id) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'DELETE FROM knowledge_bases WHERE id = $1 AND user_id = $2',
            [parseInt(id), userId]
        );
        return result.rowCount > 0;
    } finally {
        client.release();
    }
}

// 将备忘录添加到知识库
async function addMemoToKnowledgeBase(userId, knowledgeBaseId, memoId) {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'INSERT INTO memo_knowledge_base (knowledge_base_id, memo_id, added_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING *',
            [parseInt(knowledgeBaseId), parseInt(memoId), now, now]
        );
        return result.rows[0];
    } finally {
        client.release();
    }
}

// 从知识库移除备忘录
async function removeMemoFromKnowledgeBase(userId, knowledgeBaseId, memoId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'DELETE FROM memo_knowledge_base WHERE knowledge_base_id = $1 AND memo_id = $2',
            [parseInt(knowledgeBaseId), parseInt(memoId)]
        );
        return result.rowCount > 0;
    } finally {
        client.release();
    }
}

// 获取知识库中的所有备忘录
async function getKnowledgeBaseMemos(userId, knowledgeBaseId) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT m.*, mkb.added_at as added_to_kb_at
            FROM memo_knowledge_base mkb
            JOIN memos m ON mkb.memo_id = m.id
            JOIN knowledge_bases kb ON mkb.knowledge_base_id = kb.id
            WHERE kb.id = $1 AND kb.user_id = $2
            ORDER BY mkb.added_at DESC
        `, [parseInt(knowledgeBaseId), userId]);

        return result.rows.map(row => ({
            id: row.id.toString(),
            title: row.title,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            addedToKBAt: row.added_to_kb_at
        }));
    } finally {
        client.release();
    }
}

// 获取备忘录所属的知识库
async function getMemoKnowledgeBases(userId, memoId) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT kb.*, mkb.added_at
            FROM memo_knowledge_base mkb
            JOIN knowledge_bases kb ON mkb.knowledge_base_id = kb.id
            JOIN memos m ON mkb.memo_id = m.id
            WHERE m.id = $1 AND (kb.user_id = $2 OR m.user_id = $2)
        `, [parseInt(memoId), userId]);

        return result.rows.map(row => ({
            id: row.id.toString(),
            name: row.name,
            description: row.description,
            addedAt: row.added_at
        }));
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

// 更新备忘录（支持被分享者更新）
async function updateMemo(userId, id, title, content) {
    const client = await pool.connect();
    try {
        const now = Date.now();

        // 首先检查用户是否有权限更新此备忘录（拥有者或被分享者）
        const accessCheck = await client.query(`
            SELECT m.*,
                   CASE WHEN m.user_id = $2 THEN 'owner' ELSE 'shared' END as access_type
            FROM memos m
            LEFT JOIN memo_shares ms ON m.id = ms.memo_id
            WHERE m.id = $1 AND (
                m.user_id = $2 OR
                (ms.shared_with = $2 AND ms.status = 'accepted')
            )
        `, [parseInt(id), userId]);

        if (accessCheck.rows.length === 0) {
            return null;
        }

        // 更新备忘录
        const result = await client.query(
            'UPDATE memos SET title = $1, content = $2, updated_at = $3 WHERE id = $4 RETURNING *',
            [title || '', content || '', now, parseInt(id)]
        );

        if (result.rows.length === 0) {
            return null;
        }

        // 记录更新历史（用于同步给其他用户）
        if (accessCheck.rows[0].access_type === 'shared') {
            await client.query(
                'INSERT INTO memo_updates (memo_id, updated_by, title, content, created_at) VALUES ($1, $2, $3, $4, $5)',
                [parseInt(id), userId, title || '', content || '', now]
            );
        }

        const row = result.rows[0];
        return {
            id: row.id.toString(),
            title: row.title,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            accessType: accessCheck.rows[0].access_type
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

// 创建备忘录分享
async function createMemoShare(memoId, sharedBy, sharedWith) {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'INSERT INTO memo_shares (memo_id, shared_by, shared_with, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [parseInt(memoId), sharedBy, sharedWith, now, now]
        );
        return result.rows[0];
    } finally {
        client.release();
    }
}

// 获取用户的分享请求
async function getShareRequests(userId) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT ms.*, m.title, m.content, u.username as shared_by_username
            FROM memo_shares ms
            JOIN memos m ON ms.memo_id = m.id
            JOIN users u ON ms.shared_by = u.id
            WHERE ms.shared_with = $1 AND ms.status = 'pending'
            ORDER BY ms.created_at DESC
        `, [userId]);
        return result.rows;
    } finally {
        client.release();
    }
}

// 更新分享状态
async function updateShareStatus(shareId, status) {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'UPDATE memo_shares SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *',
            [status, now, parseInt(shareId)]
        );
        return result.rows[0];
    } finally {
        client.release();
    }
}

// 获取用户可访问的备忘录（包括分享的）
async function getAccessibleMemos(userId) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT m.*, u.username as owner_username,
                   CASE WHEN m.user_id = $1 THEN 'owner' ELSE 'shared' END as access_type,
                   ms.shared_by, ms.shared_with
            FROM memos m
            JOIN users u ON m.user_id = u.id
            LEFT JOIN memo_shares ms ON m.id = ms.memo_id AND ms.shared_with = $1 AND ms.status = 'accepted'
            WHERE m.user_id = $1 OR (ms.shared_with = $1 AND ms.status = 'accepted')
            ORDER BY m.updated_at DESC
        `, [userId]);

        return result.rows.map(row => ({
            id: row.id.toString(),
            title: row.title,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            ownerUsername: row.owner_username,
            accessType: row.access_type,
            sharedBy: row.shared_by,
            sharedWith: row.shared_with
        }));
    } finally {
        client.release();
    }
}

// 检查用户是否可以访问备忘录
async function canAccessMemo(userId, memoId) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 1 FROM memos m
            LEFT JOIN memo_shares ms ON m.id = ms.memo_id
            WHERE m.id = $1 AND (
                m.user_id = $2 OR
                (ms.shared_with = $2 AND ms.status = 'accepted')
            )
        `, [parseInt(memoId), userId]);
        return result.rows.length > 0;
    } finally {
        client.release();
    }
}

// 创建通知
async function createNotification(userId, shareId, type, message) {
    const client = await pool.connect();
    try {
        const now = Date.now();
        const result = await client.query(
            'INSERT INTO share_notifications (user_id, share_id, type, message, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, shareId, type, message, now]
        );
        return result.rows[0];
    } finally {
        client.release();
    }
}

// 获取用户通知
async function getUserNotifications(userId) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT sn.*, ms.memo_id, m.title as memo_title, u.username as shared_by_username
            FROM share_notifications sn
            JOIN memo_shares ms ON sn.share_id = ms.id
            JOIN memos m ON ms.memo_id = m.id
            JOIN users u ON ms.shared_by = u.id
            WHERE sn.user_id = $1 AND sn.is_read = FALSE
            ORDER BY sn.created_at DESC
        `, [userId]);
        return result.rows;
    } finally {
        client.release();
    }
}

// 标记通知为已读
async function markNotificationAsRead(notificationId) {
    const client = await pool.connect();
    try {
        await client.query('UPDATE share_notifications SET is_read = TRUE WHERE id = $1', [parseInt(notificationId)]);
    } finally {
        client.release();
    }
}

// 获取备忘录的更新历史
async function getMemoUpdates(userId, memoId) {
    const client = await pool.connect();
    try {
        // 首先检查用户是否有权限访问此备忘录
        const accessCheck = await client.query(`
            SELECT 1 FROM memos m
            LEFT JOIN memo_shares ms ON m.id = ms.memo_id
            WHERE m.id = $1 AND (
                m.user_id = $2 OR
                (ms.shared_with = $2 AND ms.status = 'accepted')
            )
        `, [parseInt(memoId), userId]);

        if (accessCheck.rows.length === 0) {
            return [];
        }

        // 获取更新历史
        const result = await client.query(`
            SELECT mu.*, u.username as updated_by_username
            FROM memo_updates mu
            JOIN users u ON mu.updated_by = u.id
            WHERE mu.memo_id = $1
            ORDER BY mu.created_at DESC
            LIMIT 10
        `, [parseInt(memoId)]);

        return result.rows.map(row => ({
            id: row.id,
            memoId: row.memo_id.toString(),
            updatedBy: row.updated_by,
            updatedByUsername: row.updated_by_username,
            title: row.title,
            content: row.content,
            createdAt: row.created_at
        }));
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
    findUserById,
    createMemoShare,
    getShareRequests,
    updateShareStatus,
    getAccessibleMemos,
    canAccessMemo,
    createNotification,
    getUserNotifications,
    markNotificationAsRead,
    getMemoUpdates,
    getKnowledgeBases,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    addMemoToKnowledgeBase,
    removeMemoFromKnowledgeBase,
    getKnowledgeBaseMemos,
    getMemoKnowledgeBases
};