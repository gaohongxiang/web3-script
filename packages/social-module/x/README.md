## X API 脚本

## X OAuth 2.0 配置指南

### 1. 创建和配置应用

#### 1.1 创建应用
1. 访问 [X开发者平台](https://developer.x.com/en/portal/dashboard)
2. 使用你的 X 账号登录
3. 点击'Sign up for Free Account'注册免费账户
    - 描述 Twitter 数据和 API 的所有使用案例（根据[开发者政策支持](https://developer.x.com/en/support/x-api/policy#faq-developer-use-case)去ds生成一个使用案例）
4. 填写项目基本信息：
   - 项目名称：自定义一个名称
   - 项目描述：简单描述项目用途
5. 在项目设置中进行用户身份验证设置
   - 应用程序权限选择：读写和直接留言
   - 应用程序类型选择：Web 应用程序、自动化应用程序或机器
   - 应用信息
    - 回调 URI/重定向 URL填写：https://x.com/home
    - 网站网址填写：https://x.com
6. 第五步填写完后跳转到OAuth 2.0页面，记下OAuth 2.0的 Client ID 和 Client Secret

### 2. 环境变量配置

在项目的 `.env` 文件中添加以下配置：

```bash
# X OAuth 配置
xClientId = '你的客户端ID'
xClientSecret = '你的客户端密钥'
xRedirectUri = '你的重定向URI'
```

### 3. 注意事项

1. 免费的应用有很多限制（如果需要操作的号很多，那么可能需要别的x号申请多个应用程序）
    - 只能创建一个免费应用程序
    - 只有一个环境
    - 每月最多检索 100 篇帖子，发送 500 篇文章。详情：[X API V2 产品](https://developer.x.com/en/portal/products/free)

2. API 限制：
   - 注意遵守 X API 的速率限制
   - 建议实现请求限流机制
   - 关注API配额使用情况

3. 安全性：
   - 不要在代码中硬编码 client_secret
   - 保护好 .env 文件
   - 定期更新客户端密钥

4. 常见问题：
   - 如果无法获取 refresh_token：
     * 确保请求了 offline.access 权限
     * 验证重定向URI配置是否正确
   - API调用失败时：
     * 检查token是否过期
     * 验证权限范围是否足够
     * 确认API限流情况

### 4. 相关文档

- [X API 文档](https://developer.x.com/docs)
- [twitter-api-v2 文档](https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/v2.md)

## 使用示例

```js
import { XAuthenticator } from './x.js';
import { XClient } from './x.js';
import { XRpa } from './x.js';

// OAuth2.0授权示例（需要指纹浏览器配合）
const xAuth = await XAuthenticator.create({ 
    chromeNumber: 1,  // 指纹浏览器编号
    socksProxyUrl: 'socks5://username:password@ip:port'  // 代理地址
});
await xAuth.authorizeAndSaveToken({ 
    csvFile: './data/social/x.csv', 
    matchField: 'xUsername', 
    matchValue: 'xxx', 
    targetField: 'xRefreshToken' 
});

// API操作示例（每次调用会产生新的刷新令牌，所以需要用新的刷新令牌替换掉文件里的旧的刷新令牌）。
const xClient = await XClient.create({ 
    refreshToken: 'x刷新令牌',
    socksProxyUrl: 'socks5://username:password@ip:port',
    csvFile: './data/social/x.csv',
    matchField: 'xUsername',
    matchValue: 'xxx',
    targetField: 'xRefreshToken'
});

// 获取当前用户信息
const userInfo = await xClient.getCurrentUserProfile();
console.log(userInfo);

// 发送推文
const tweetId = await xClient.tweet('Hello World!');
console.log(tweetId);

// 关注用户
await xClient.follow('elonmusk');

// RPA操作示例（需要指纹浏览器配合）
const xRpa = await XRpa.create({ 
    chromeNumber: 1  // 指纹浏览器编号
});

// 登录账号
await xRpa.loginX('username', 'password', 'otpSecretKey');

// 切换界面语言为英文
await xRpa.changeLanguage();

// 修改密码
await xRpa.changePassword({
    oldPassword: 'oldPassword',
    csvFile: './data/social/x.csv',
    matchField: 'xUsername',
    matchValue: 'xxx',
    targetField: 'xPassword'
});