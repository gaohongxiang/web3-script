## 邮箱脚本

## Gmail OAuth 2.0 配置指南

### 1. 创建和配置应用

#### 1.1 创建应用
1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 使用你的 Google 账号登录
3. 创建新项目或选择现有项目
4. 在左侧菜单找到"API和服务" → "OAuth 同意屏幕"
5. 选择用户类型：
   - 选择"外部"，允许任何 Google 账户访问
   - 点击"创建"
6. 配置 OAuth 同意屏幕：
   - 应用名称：自定义一个应用名称
   - 用户支持电子邮件：选择你的邮箱
   - 开发者联系信息：填写你的邮箱
   - 点击"保存并继续"

#### 1.2 配置身份验证
1. 在左侧菜单点击"凭据"(Credentials)
2. 点击"创建凭据" → "OAuth 客户端 ID"
3. 选择应用类型为"Web 应用程序"
4. 填写基本信息：
   - 名称：自定义一个名称
   - 已获授权的重定向 URI：添加 `https://mail.google.com`
5. 点击"创建"完成设置

#### 1.3 配置 API 权限
1. 在左侧菜单点击"API 和服务"
2. 搜索并启用以下 API：
   - Gmail API

#### 1.4 获取应用凭据
1. 在"凭据"页面找到刚创建的 OAuth 2.0 客户端
2. 下载 JSON 文件或记录以下信息：
   - 客户端 ID (Client ID)
   - 客户端密钥 (Client Secret)
   - 重定向 URI (Redirect URI)

### 2. 环境变量配置

在项目的 `.env` 文件中添加以下配置：

```bash
# Gmail OAuth 配置
gmailClientId = '你的客户端ID'
gmailClientSecret = '你的客户端密钥'
gmailRedirectUri = 'https://mail.google.com'
```

### 3. 注意事项

1. 一个应用（未审核）最多只能添加100个用户（邮箱），如果需要添加更多用户，需要创建多个应用。

1. 重定向 URI 配置：
   - 必须完全匹配 Google Cloud Console 中的配置

2. 权限要求：
   - 首次授权时需要用户明确同意所有请求的权限
   - 确保请求了 offline_access 以获取 refresh_token
   - 只请求应用必需的最小权限集

3. 安全性：
   - 不要在代码中硬编码 client_secret
   - 保护好凭据 JSON 文件和 .env 文件
   - 定期更新客户端密钥

4. 常见问题：
   - 如果无法获取 refresh_token，确保：
     * 应用配置为 Web 应用程序类型
     * 请求中包含 access_type=offline
     * 用户完成了授权流程
   - 授权失败时：
     * 检查重定向 URI 是否正确
     * 验证客户端 ID 和密钥
     * 查看 OAuth 同意屏幕是否正确配置

### 4. 相关文档

- [Gmail API 文档](https://developers.google.com/gmail/api/guides)
- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
- [Node.js Gmail API 快速入门](https://developers.google.com/gmail/api/quickstart/nodejs) 


## Outlook OAuth 2.0 配置指南

### 1. 创建和配置应用

#### 1.1 创建应用
1. 访问 [Microsoft Entra 管理中心](https://entra.microsoft.com)
2. 使用你的 Microsoft 账号登录
3. 在左侧菜单找到"应用注册"(App registrations)
4. 点击"新注册"(New registration)按钮
5. 填写应用信息：
   - 名称：自定义一个应用名称
   - 支持的账户类型：选择"任何组织目录中的账户和个人 Microsoft 帐户"
   - 重定向 URI：选择"Web"，输入 `http://localhost:3000/auth/redirect`
6. 点击"注册"完成创建

#### 1.2 配置身份验证
1. 在应用页面左侧菜单点击"身份验证"(Authentication)
2. 在"平台配置"下确认已添加 Web 平台
3. 确保重定向 URI 正确：`http://localhost:3000/auth/redirect`
5. 点击"保存"

#### 1.3 配置 API 权限
1. 在左侧菜单点击"API 权限"(API permissions)
2. 点击"添加权限"(Add a permission)
3. 选择 "Microsoft Graph"
4. 选择"委托的权限"(Delegated permissions)
5. 搜索并添加以下权限：
   - offline_access (必需，用于获取 refresh token)
   - openid
   - profile
   - Mail.Read
   - Mail.Send
   - User.Read
6. 点击"代表 xxx 授予管理员同意"按钮

#### 1.4 获取应用凭据
1. 在左侧菜单点击"证书和密码"(Certificates & secrets)
2. 在"客户端密码"(Client secrets)部分：
   - 点击"新建客户端密码"
   - 选择合适的过期时间（建议1年或2年）
   - 点击"添加"
3. 立即复制生成的密码值（仅显示一次！）
4. 记录以下信息：
   - 应用程序(客户端) ID：从应用概述页面获取
   - 客户端密码：刚才生成的密码值
   - 租户 ID：从应用概述页面获取（可选）

### 2. 环境变量配置

在项目的 `.env` 文件中添加以下配置：

```bash
# Outlook OAuth 配置
outlookClientId = '你的应用程序ID'
outlookClientSecret = '你的客户端密码'
outlookRedirectUri = 'http://localhost:3000/auth/redirect'
```

### 3. 注意事项

1. 重定向 URI 必须完全匹配：
   - Azure 门户中的配置
   - 代码中的 REDIRECT_URI
   - .env 文件中的配置

2. 权限要求：
   - 确保所有必需的权限都已获得管理员同意
   - offline_access 权限是获取 refresh_token 的必要条件

3. 安全性：
   - 不要在代码中硬编码 client_secret
   - 保护好 .env 文件
   - 定期更新客户端密码

4. 常见问题：
   - 如果无法获取 refresh_token，检查是否已授权 offline_access 权限
   - 授权失败时，检查重定向 URI 是否配置正确
   - 确保使用了正确的应用类型（Web 应用程序）

### 4. 相关文档

- [Microsoft 身份平台文档](https://learn.microsoft.com/zh-cn/entra/identity-platform/quickstart-web-app-nodejs-sign-in)
- [Graph API 文档](https://learn.microsoft.com/zh-cn/graph/api/overview)


## 使用示例

```js
import { GmailAuthenticator, waitForGmailVerificationCode, GmailRpa } from './gmail.js';
import { OutlookAuthenticator, waitForOutlookVerificationCode } from './outlook.js';

// Gmail授权示例
const gmailAuth = await GmailAuthenticator.create({ 
    browserType: 'chrome',     // 浏览器类型：'chrome'或'bitbrowser'
    browserId: 1,              // Chrome实例编号或BitBrowser浏览器ID
    socksProxyUrl: 'socks5://username:password@ip:port'  // 代理地址
});
await gmailAuth.authorizeAndSaveToken({ 
    csvFile: './data/social/email.csv', 
    matchField: 'email', 
    matchValue: 'xxx@gmail.com', 
    targetField: 'gmailRefreshToken' 
});

// 获取Gmail验证码
const gmailVerifyCode = await waitForGmailVerificationCode({ 
    refreshToken: 'gmail刷新令牌',
    socksProxyUrl: 'socks5://username:password@ip:port',
    from: '发送方邮箱',
    subject: '验证码',
    pollInterval: 10,  // 可选，轮询间隔（秒）
    timeout: 300,      // 可选，总超时时间（秒）
    recentMinutes: 5   // 可选，查询最近几分钟内的邮件
});
console.log(gmailVerifyCode);

// Gmail RPA操作示例
const gmailRpa = await GmailRpa.create({
    browserType: 'chrome',     // 浏览器类型：'chrome'或'bitbrowser'
    browserId: 1               // Chrome实例编号或BitBrowser浏览器ID
});

// 登录Gmail账号
await gmailRpa.login('username@gmail.com', 'password', 'otpSecretKey');

// 切换界面语言为中文
await gmailRpa.changeLanguage();

// 设置两步验证
await gmailRpa.addOrChange2fa({
    password: 'yourPassword',
    matchValue: 'username@gmail.com'
});


// Outlook授权示例（需要指纹浏览器配合）
const outlookAuth = await OutlookAuthenticator.create({ 
    browserType: 'chrome',     // 浏览器类型：'chrome'或'bitbrowser'
    browserId: 1,              // Chrome实例编号或BitBrowser浏览器ID
    socksProxyUrl: 'socks5://username:password@ip:port'  // 代理地址
});
await outlookAuth.authorizeAndSaveToken({ 
    csvFile: './data/social/email.csv', 
    matchField: 'email', 
    matchValue: 'xxx@outlook.com', 
    targetField: 'outlookRefreshToken' 
});

// 获取Outlook验证码
const outlookVerifyCode = await waitForOutlookVerificationCode({ 
    refreshToken: 'outlook刷新令牌',
    socksProxyUrl: 'socks5://username:password@ip:port',
    from: '发送方邮箱',
    subject: '验证码',
    pollInterval: 10,  // 可选，轮询间隔（秒）
    timeout: 300,      // 可选，总超时时间（秒）
    recentMinutes: 5   // 可选，查询最近几分钟内的邮件
});
console.log(outlookVerifyCode);
```
