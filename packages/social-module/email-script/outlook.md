# Outlook OAuth 2.0 配置指南

## 1. 创建和配置应用

### 1.1 创建应用
1. 访问 [Microsoft Entra 管理中心](https://entra.microsoft.com)
2. 使用你的 Microsoft 账号登录
3. 在左侧菜单找到"应用注册"(App registrations)
4. 点击"新注册"(New registration)按钮
5. 填写应用信息：
   - 名称：自定义一个应用名称
   - 支持的账户类型：选择"任何组织目录中的账户和个人 Microsoft 帐户"
   - 重定向 URI：选择"Web"，输入 `http://localhost:3000/auth/redirect`
6. 点击"注册"完成创建

### 1.2 配置身份验证
1. 在应用页面左侧菜单点击"身份验证"(Authentication)
2. 在"平台配置"下确认已添加 Web 平台
3. 确保重定向 URI 正确：`http://localhost:3000/auth/redirect`
5. 点击"保存"

### 1.3 配置 API 权限
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

### 1.4 获取应用凭据
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

## 2. 环境变量配置

在项目的 `.env` 文件中添加以下配置：

```bash
# Outlook OAuth 配置
outlookClientId = '你的应用程序ID'
outlookClientSecret = '你的客户端密码'
outlookRedirectUri = 'http://localhost:3000/auth/redirect'
```

## 3. 注意事项

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

## 4. 相关文档

- [Microsoft 身份平台文档](https://learn.microsoft.com/zh-cn/entra/identity-platform/quickstart-web-app-nodejs-sign-in)
- [Graph API 文档](https://learn.microsoft.com/zh-cn/graph/api/overview)
