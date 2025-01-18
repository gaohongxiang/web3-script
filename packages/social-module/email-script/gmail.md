# Gmail OAuth 2.0 配置指南

## 1. 创建和配置应用

### 1.1 创建应用
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

### 1.2 配置身份验证
1. 在左侧菜单点击"凭据"(Credentials)
2. 点击"创建凭据" → "OAuth 客户端 ID"
3. 选择应用类型为"Web 应用程序"
4. 填写基本信息：
   - 名称：自定义一个名称
   - 已获授权的重定向 URI：添加 `https://mail.google.com`
5. 点击"创建"完成设置

### 1.3 配置 API 权限
1. 在左侧菜单点击"API 和服务"
2. 搜索并启用以下 API：
   - Gmail API

### 1.4 获取应用凭据
1. 在"凭据"页面找到刚创建的 OAuth 2.0 客户端
2. 下载 JSON 文件或记录以下信息：
   - 客户端 ID (Client ID)
   - 客户端密钥 (Client Secret)
   - 重定向 URI (Redirect URI)

## 2. 环境变量配置

在项目的 `.env` 文件中添加以下配置：

```bash
# Gmail OAuth 配置
gmailClientId = '你的客户端ID'
gmailClientSecret = '你的客户端密钥'
gmailRedirectUri = 'https://mail.google.com'
```

## 3. 注意事项

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

## 4. 相关文档

- [Gmail API 文档](https://developers.google.com/gmail/api/guides)
- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
- [Node.js Gmail API 快速入门](https://developers.google.com/gmail/api/quickstart/nodejs) 