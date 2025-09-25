const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// 模拟用户登录并获取cookie
async function login(username, password) {
    const response = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
        throw new Error(`登录失败: ${response.status}`);
    }

    const cookies = response.headers.get('set-cookie');
    return cookies;
}

// 创建备忘录
async function createMemo(cookies, title, content) {
    const response = await fetch(`${BASE_URL}/api/memos`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies
        },
        body: JSON.stringify({ title, content })
    });

    if (!response.ok) {
        throw new Error(`创建备忘录失败: ${response.status}`);
    }

    return await response.json();
}

// 获取用户的备忘录
async function getMemos(cookies) {
    const response = await fetch(`${BASE_URL}/api/memos`, {
        headers: {
            'Cookie': cookies
        }
    });

    if (!response.ok) {
        throw new Error(`获取备忘录失败: ${response.status}`);
    }

    return await response.json();
}

// 更新备忘录
async function updateMemo(cookies, id, title, content) {
    const response = await fetch(`${BASE_URL}/api/memos`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies
        },
        body: JSON.stringify({ id, title, content })
    });

    if (!response.ok) {
        throw new Error(`更新备忘录失败: ${response.status}`);
    }

    return await response.json();
}

// 分享备忘录
async function shareMemo(cookies, memoId, username) {
    const response = await fetch(`${BASE_URL}/api/memos/${memoId}/share`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies
        },
        body: JSON.stringify({ username })
    });

    if (!response.ok) {
        throw new Error(`分享备忘录失败: ${response.status}`);
    }

    return await response.json();
}

// 测试函数
async function testSharing() {
    try {
        console.log('🚀 开始测试分享和同步功能...\n');

        // 注意：这里假设已经有两个用户存在
        // 在实际测试中，你需要先创建这些用户

        console.log('⚠️  注意：请确保数据库中已存在测试用户');
        console.log('你可以通过Web界面注册以下用户：');
        console.log('- 用户1: user1 / user1@example.com / password123');
        console.log('- 用户2: user2 / user2@example.com / password123\n');

        console.log('测试完成！请通过Web界面验证以下功能：');
        console.log('1. 用户1创建备忘录');
        console.log('2. 用户1分享给用户2');
        console.log('3. 用户2接受分享');
        console.log('4. 用户2修改备忘录内容');
        console.log('5. 验证用户1是否收到更新通知');

    } catch (error) {
        console.error('测试失败:', error.message);
    }
}

testSharing();