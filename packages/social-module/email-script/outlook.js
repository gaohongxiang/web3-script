import 'dotenv/config';
import { BitBrowserUtil } from '../../rpa-module/bitbrowser.js';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { updateCsvData } from '../../utils-module/utils.js';
import express from 'express';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fetch from 'node-fetch';

// MSAL配置对象
const msalConfig = {
    auth: {
        clientId: process.env.outlookClientId,        // 应用程序ID
        authority: "https://login.microsoftonline.com/common",  // OAuth2授权端点
        clientSecret: process.env.outlookClientSecret  // 应用程序密钥
    }
};

// OAuth2所需的权限范围
const scopes = [
    'offline_access',  // 获取refresh token的必需权限
    'openid',         // OpenID Connect认证
    'profile',        // 用户配置信息
    'User.Read',      // 读取用户信息
    'Mail.Read',      // 读取邮件
    'Mail.Send'       // 发送邮件
];

// 添加语言配置
const extraQueryParameters = {
    'ui_locales': 'zh-CN',  // 设置界面语言为中文简体
    'login_hint': '',       // 可选：预填登录邮箱
    'domain_hint': ''       // 可选：指定登录域
};

// 创建一个专门的函数来处理MSAL配置
function createMsalConfig(proxy = null) {
    const config = {
        auth: {
            clientId: process.env.outlookClientId,        // 应用程序ID
            authority: "https://login.microsoftonline.com/common",  // OAuth2授权端点
            clientSecret: process.env.outlookClientSecret  // 应用程序密钥
        }
    };

    if (proxy) {
        config.system = {
            networkClient: {
                sendGetRequestAsync: async (url, options) => {
                    const proxyAgent = new SocksProxyAgent(proxy);
                    const response = await fetch(url, {
                        ...options,
                        agent: proxyAgent,
                        method: 'GET'
                    });
                    return {
                        status: response.status,
                        headers: Object.fromEntries(response.headers),
                        body: await response.json() // 直接返回解析后的 JSON 对象
                    };
                },
                sendPostRequestAsync: async (url, options) => {
                    const proxyAgent = new SocksProxyAgent(proxy);
                    const response = await fetch(url, {
                        ...options,
                        agent: proxyAgent,
                        method: 'POST',
                        body: options.body
                    });
                    return {
                        status: response.status,
                        headers: Object.fromEntries(response.headers),
                        body: await response.json() // 直接返回解析后的 JSON 对象
                    };
                }
            }
        };
    }

    return config;
}

/**
 * Outlook授权类
 * 继承自BitBrowserUtil，用于处理Outlook的OAuth2.0授权流程
 */
export class OutlookAuth extends BitBrowserUtil {
    constructor(browserId, proxy = null) {
        super(browserId);
        // 使用新的配置创建函数
        this.msalClient = new ConfidentialClientApplication(createMsalConfig(proxy));
        this.REDIRECT_URI = process.env.outlookRedirectUri;
    }

    /**
     * 启动本地服务器处理OAuth回调
     * @returns {Promise<string>} 返回授权码
     */
    startServer() {
        return new Promise((resolve, reject) => {
            const app = express();
            
            // 添加中间件来解析POST数据
            app.use(express.urlencoded({ extended: true }));

            // 从配置的redirectUri中解析端口和路径
            const redirectUrl = new URL(this.REDIRECT_URI);
            const port = redirectUrl.port || 3000;
            const path = redirectUrl.pathname;

            this.server = app.listen(port, () => {
                console.log(`回调服务器启动在端口 ${port}`);
                
                // 处理GET请求
                app.get(path, async (req, res) => {
                    const code = req.query.code;
                    if (code) {
                        res.send('授权成功，请返回命令行查看结果');
                        resolve(code);
                    } else {
                        res.send('未获取到授权码');
                        reject(new Error('未获取到授权码'));
                    }
                });

                // 处理POST请求
                app.post(path, async (req, res) => {
                    const code = req.body.code;
                    if (code) {
                        res.send('授权成功，请返回命令行查看结果');
                        resolve(code);
                    } else {
                        res.send('未获取到授权码');
                        reject(new Error('未获取到授权码'));
                    }
                });
            });
        });
    }

    /**
     * 获取OAuth2登录URL
     * @returns {Promise<string>} 返回登录URL
     */
    async getLoginUrl() {
        const authCodeUrlParams = {
            scopes,
            redirectUri: this.REDIRECT_URI,
            responseMode: 'query',  // 使用query模式
            extraQueryParameters    // 添加语言配置
        };

        const response = await this.msalClient.getAuthCodeUrl(authCodeUrlParams);
        return response;
    }

    /**
     * 处理OAuth回调，获取token
     * @param {string} authCode - 授权码
     * @returns {Promise<Object>} 返回账号信息和token
     */
    async handleRedirect(authCode) {
        const tokenRequest = {
            code: authCode,
            scopes,
            redirectUri: this.REDIRECT_URI,
        };

        const response = await this.msalClient.acquireTokenByCode(tokenRequest);
        
        // 获取refresh token
        const tokenCache = this.msalClient.getTokenCache();
        const cache = await tokenCache.serialize();
        const cacheObj = JSON.parse(cache);
        // console.log('cacheObj', cacheObj);
        // 获取RefreshToken对象的第一个key
        const refreshTokenKey = Object.keys(cacheObj['RefreshToken'])[0];
        const refreshToken = cacheObj['RefreshToken'][refreshTokenKey].secret;
        // console.log('refreshToken', refreshToken);
        if (!refreshToken) {
            throw new Error('未能获取到 refresh token');
        }

        return {
            account: response.account,
            refreshToken: refreshToken,
            accessToken: response.accessToken
        };
    }

     /**
     * outlook自动授权，获取refresh token并保存到CSV文件。此函数需要打开浏览器授权，需要配合指纹浏览器使用。
     * @param {Object} options - 授权配置选项
     * @param {string} options.csvFile - CSV文件路径，用于保存refresh token
     * @param {string} options.matchField - CSV文件中用于匹配的字段名（通常是'email'）
     * @param {string} options.matchValue - CSV文件中用于匹配的值 （通常是email地址）
     * @param {string} [options.targetField='outlookRefreshToken'] - CSV文件中保存refresh token的字段名
     * @returns {Promise<boolean>} - 授权成功返回true，失败返回false
     */
    async autoAuth({ csvFile, matchField, matchValue, targetField = 'outlookRefreshToken' }) {
        try {
            if (!matchValue.endsWith('@outlook.com') && !matchValue.endsWith('@hotmail.com')) {
                console.log(`跳过非 Outlook 邮箱: ${matchValue}`);
                return false;
            }

            await this.start();

            // 启动回调服务器
            const codePromise = this.startServer();

            // 获取授权URL
            const authUrl = await this.getLoginUrl();

            console.log('正在打开授权页面...');
            await this.page.goto(authUrl);
            await this.page.waitForTimeout(3000);

            try {
                try{
                // 等待并点击接受按钮
                await this.page.waitForSelector('input[name="ucaccept"][value="接受"]', { timeout: 5000 });
                await this.page.click('input[name="ucaccept"][value="接受"]');
                }catch(e){
                    console.log('未找到接受按钮');
                }
                await this.page.waitForTimeout(3000);
                // 检查是否需要点击继续按钮
                try{
                    const isElementExist1 = await this.isElementExist('input[name="appConfirmContinue"]', {waitTime: 5});
                    if (isElementExist1) {
                        await this.page.click('input[name="appConfirmContinue"]');
                    }
                    await this.page.waitForTimeout(3000);
                    const isElementExist2 = await this.isElementExist('input[name="appConfirmContinue"]', {waitTime: 5});
                    if (isElementExist2) {
                        await this.page.click('input[name="appConfirmContinue"]');
                    }
                }catch(e){
                    console.log('未找到继续按钮');
                }

                // 等待重定向
                console.log('等待重定向...');
                await this.page.waitForURL(
                    (url) => url.toString().startsWith(this.REDIRECT_URI),
                    { timeout: 60000 }
                );

                // 等待获取授权码
                console.log('等待获取授权码...');
                const code = await codePromise;
                console.log('成功获取到授权码');
                // console.log('授权码:', code);

                // 使用授权码获取token
                const tokens = await this.handleRedirect(code);
                // console.log('Token获取成功:', {
                //     hasAccessToken: !!tokens.accessToken,
                //     hasRefreshToken: !!tokens.refreshToken,
                //     account: tokens.account
                // });

                // 更新CSV文件
                await updateCsvData({
                    csvFile,
                    matchField,
                    matchValue,
                    targetField,
                    targetValue: tokens.refreshToken
                });

                return true;

            } catch (error) {
                console.error('授权过程出错:', error);
                throw error;
            } finally {
                if (this.server) {
                    this.server.close();
                }
            }

        } catch (error) {
            console.error('Outlook授权失败:', error);
            return false;
        }
    }
}

/**
 * 等待并获取指定邮件中的验证码
 * @param {string} refreshToken - Outlook的refreshToken
 * @param {Object} options - 查询选项
 * @param {string} options.from - 发件人邮箱
 * @param {string} options.subject - 邮件主题关键词
 * @param {number} [options.pollInterval=10] - 轮询间隔（秒）
 * @param {number} [options.timeout=300] - 总超时时间（秒）
 * @param {number} [options.recentMinutes=5] - 查询最近几分钟内的邮件
 * @param {string} [options.proxy] - SOCKS5 代理字符串（可选）
 * @returns {Promise<string|null>} 返回验证码或null
 */
export async function waitForOutlookVerificationCode(refreshToken, {
    from,
    subject,
    pollInterval = 10,
    timeout = 300,
    recentMinutes = 5,
    proxy = null
}) {
    try {
        // 检查 refreshToken 是否存在
        if (!refreshToken) {
            console.log('未提供 refresh token, 请先完成授权');
            return null;
        }

        const startTime = Date.now();
        const timeoutMs = timeout * 1000;

        // 创建MSAL客户端实例,使用相同的配置创建函数
        const msalClient = new ConfidentialClientApplication(createMsalConfig(proxy));

        while (Date.now() - startTime < timeoutMs) {
            console.log('正在查找验证码邮件...');

            try {
                // 使用refresh token获取新的access token
                const tokenResponse = await msalClient.acquireTokenByRefreshToken({
                    refreshToken,
                    scopes: scopes
                });

                // 初始化Graph API客户端
                const graphClient = Client.init({
                    authProvider: (done) => {
                        done(null, tokenResponse.accessToken);
                    }
                });

                // 构建查询条件：按时间过滤
                const timeFilter = new Date(Date.now() - recentMinutes * 60 * 1000).toISOString();
                const response = await graphClient.api('/me/messages')
                    .filter(`receivedDateTime gt ${timeFilter}`)  // 时间过滤
                    .orderby('receivedDateTime desc')            // 按时间倒序
                    .select('subject,from,body,receivedDateTime') // 选择需要的字段
                    .top(10)                                     // 最多返回10封邮件
                    .get();

                // 在代码中过滤发件人和主题
                if (response.value && response.value.length > 0) {
                    const targetEmails = response.value.filter(email => 
                        email.from.emailAddress.address === from &&  // 匹配发件人
                        email.subject.includes(subject)              // 匹配主题
                    );

                    if (targetEmails.length > 0) {
                        const email = targetEmails[0];
                        // console.log('找到目标邮件，内容:', email.body.content);
                        // 使用正则表达式匹配6位数字验证码
                        const codeMatch = email.body.content.match(/\d{6}/);
                        if (codeMatch) {
                            console.log('找到验证码！');
                            return codeMatch[0];
                        }
                    }
                }

                // 计算剩余等待时间
                const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
                const remainingTime = timeout - elapsedTime;
                console.log(`未找到验证码，剩余等待时间: ${remainingTime} 秒`);

                if (remainingTime <= 0) {
                    console.log('等待超时，未收到验证码');
                    return null;
                }

                // 等待一段时间后继续下一次查询
                await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));

            } catch (error) {
                console.error('查询邮件失败:', error);
                throw error;
            }
        }

        return null;

    } catch (error) {
        console.error('获取验证码失败:', error);
        throw error;
    }
}
