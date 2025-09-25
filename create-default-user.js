const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// 数据库连接配置
const pool = new Pool({
    host: 'dbconn.sealoshzh.site',
    port: 32849,
    database: 'test-db',
    user: 'postgres',
    password: 'lw4vfm8g',
    ssl: false
});

async function createDefaultUser() {
    const client = await pool.connect();
    try {
        console.log('正在创建/更新默认用户...');

        // 生成密码哈希
        const password = 'memo123'; // 默认密码
        const passwordHash = await bcrypt.hash(password, 12);

        // 更新默认用户的密码哈希
        const result = await client.query(`
            UPDATE users
            SET password_hash = $1
            WHERE username = 'default'
            RETURNING id, username, email
        `, [passwordHash]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log('✅ 默认用户已更新:');
            console.log(`   用户名: ${user.username}`);
            console.log(`   邮箱: ${user.email}`);
            console.log(`   密码: ${password}`);
            console.log(`   用户ID: ${user.id}`);

            // 检查该用户有多少备忘录
            const memoCount = await client.query('SELECT COUNT(*) FROM memos WHERE user_id = $1', [user.id]);
            console.log(`   备忘录数量: ${memoCount.rows[0].count}`);
        } else {
            console.log('❌ 未找到默认用户');
        }

    } catch (error) {
        console.error('创建默认用户失败:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

createDefaultUser();