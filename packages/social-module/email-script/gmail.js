import 'dotenv/config';
import { ChromeBrowserUtil } from '../../rpa-module/chrome/chromeBrowser/chromeBrowser.js';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { updateCsvFieldValueByMatch} from '../../utils-module/utils.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getOTP } from '../../utils-module/otp.js';

export class GmailAuth extends ChromeBrowserUtil {
    constructor(chromeNumber, proxy = null) {
        super(chromeNumber, proxy);
        this.oauth2Client = null;
        this.proxy = proxy;
    }

    // 初始化 OAuth2 客户端
    init() {
        if (!process.env.gmailClientId || !process.env.gmailClientSecret || !process.env.gmailRedirectUri) {
            throw new Error('缺少必要的环境变量配置');
        }

        const options = {
            clientId: process.env.gmailClientId,
            clientSecret: process.env.gmailClientSecret,
            redirectUri: process.env.gmailRedirectUri
        };

        // 如果设置了代理，添加代理配置
        if (this.proxy) {
            options.httpAgent = new SocksProxyAgent(this.proxy);
        }

        this.oauth2Client = new OAuth2Client(options);
    }

    // 生成授权URL
    generateAuthUrl(email) {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://mail.google.com/'],
            prompt: 'consent',
            login_hint: email,
            hl: 'zh-CN'  // 添加这个参数设置语言为中文
        });
    }

    /**
     * Gmail自动授权，获取refresh token并保存到CSV文件。此函数需要打开浏览器授权，需要配合指纹浏览器使用。
     * @param {Object} options - 授权配置选项
     * @param {string} options.csvFile - CSV文件路径，用于保存refresh token
     * @param {string} options.matchField - CSV文件中用于匹配的字段名（通常是'email'）
     * @param {string} options.matchValue - CSV文件中用于匹配的值 （通常是email地址）
     * @param {string} [options.targetField='gmailRefreshToken'] - CSV文件中保存refresh token的字段名
     * @param {string} [options.appName='ghx_gmail'] - 应用名称，用于浏览器标识
     * @returns {Promise<boolean>} - 授权成功返回true，失败返回false
     */
    async autoAuth({csvFile, matchField, matchValue, targetField='gmailRefreshToken', appName='ghx_gmail'}) {
        try {
            // 检查是否是 Gmail 邮箱
            if (!matchValue.endsWith('@gmail.com')) {
                console.log(`跳过非 Gmail 邮箱: ${matchValue}`);
                return false;
            }

            // 初始化
            this.init();

            // 初始化浏览器
            await this.start();  // 添加这行，确保浏览器已启动
        
            // 获取授权URL
            const authUrl = this.generateAuthUrl(matchValue);

            // 打开授权页面
            await this.page.goto(authUrl);
            await this.page.waitForTimeout(2000);
            const isExist = await this.page.locator(`div[data-email="${matchValue}"]`);
            if(!isExist) {
                throw new Error('未找到邮箱,请先登录');
            }
            await this.page.locator(`div[data-email="${matchValue}"]`).click();
            const isDangerWarning = await this.page.locator('h1[text="此应用未经 Google 验证"]');
            if(isDangerWarning) {
                console.log('检测到安全警告页面，尝试处理...');
                await this.page.getByText('高级').click();
                await this.page.waitForTimeout(500);
                await this.page.getByText(`转至${appName}（不安全）`).click();
            }
            await this.page.waitForTimeout(2000);
            await this.page.getByText('继续').click();            
            await this.page.waitForTimeout(5000);
            let responseUrl;
            try {
                // 等待重定向URL出现，设置超时时间（毫秒）
                await this.page.waitForURL(url => url.toString().includes(process.env.gmailRedirectUri), { timeout: 30000 });
                responseUrl = this.page.url();
                // console.log('Response URL:', responseUrl);
            } catch (error) {
                console.error('等待重定向URL失败:', error);
                throw error;
            }
            // 从URL中提取授权码
            // console.log(responseUrl);
            const codeMatch = responseUrl.match(/code=([^&]+)/);
            const code = codeMatch ? codeMatch[1] : null;  // 只取第一个捕获组的值
            // console.log('code:',code);
            if (!code) {
                throw new Error('未获取到授权码');
            }

            // 使用授权码获取token
            const { tokens: newTokens } = await this.oauth2Client.getToken(code);
            // console.log('newTokens:',newTokens);
            const refreshToken = newTokens.refresh_token;
            await updateCsvFieldValueByMatch({
                csvFile,
                matchField,
                matchValue,
                targetField,
                targetValue: refreshToken
            })

        } catch (error) {
            console.error('Gmail自动授权失败:', error);
            return false;
        }
    }
}

/**
 * 创建 OAuth2 客户端
 * @param {string} [proxy] - SOCKS5 代理字符串（可选）
 * @returns {OAuth2Client} Google OAuth2 客户端实例
 */
function createOAuth2Client(proxy = null) {
    const options = {
        clientId: process.env.gmailClientId,
        clientSecret: process.env.gmailClientSecret,
        redirectUri: process.env.gmailRedirectUri
    };

    // 如果提供了代理，添加代理配置
    if (proxy) {
        options.httpAgent = new SocksProxyAgent(proxy);
    }

    return new google.auth.OAuth2(options);
}

/**
 * 等待并获取指定邮件中的验证码
 * @param {string} refreshToken - Gmail的refreshToken
 * @param {Object} options - 查询选项
 * @param {string} options.from - 发件人邮箱
 * @param {string} options.subject - 邮件主题关键词
 * @param {number} [options.pollInterval=10] - 轮询间隔（秒）
 * @param {number} [options.timeout=300] - 总超时时间（秒）
 * @param {number} [options.recentMinutes=5] - 查询最近几分钟内的邮件
 * @param {string} [options.proxy] - SOCKS5 代理字符串（可选）
 * @returns {Promise<string|null>} 验证码或null
 */
export async function waitForGmailVerificationCode(refreshToken, { 
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
        
        while (Date.now() - startTime < timeoutMs) {
            console.log('正在查找验证码邮件...');
            
            const oauth2Client = createOAuth2Client(proxy);
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            
            // 构建查询语句，使用参数化的时间范围
            const query = `from:${from} subject:${subject} newer_than:${recentMinutes}m`;
            
            // 获取邮件列表
            const response = await gmail.users.messages.list({
                userId: 'me',
                maxResults: 1, // 只需要最新的一封
                q: query
            });

            if (response.data.messages && response.data.messages.length > 0) {
                // 找到邮件，获取内容
                const email = await gmail.users.messages.get({
                    userId: 'me',
                    id: response.data.messages[0].id,
                    format: 'full'
                });

                // 获取邮件文本内容
                let content = '';
                if (email.data.payload.parts) {
                    content = getTextFromParts(email.data.payload.parts);
                } else if (email.data.payload.body.data) {
                    content = Buffer.from(email.data.payload.body.data, 'base64').toString();
                }

                // 查找6位验证码
                const codeMatch = content.match(/\b\d{6}\b/);
                if (codeMatch) {
                    console.log('找到验证码！');
                    return codeMatch[0];
                }
            }

            // 计算剩余时间
            const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
            const remainingTime = timeout - elapsedTime;
            console.log(`未找到验证码，剩余等待时间: ${remainingTime} 秒`);

            if (remainingTime <= 0) {
                console.log('等待超时，未收到验证码');
                return null;
            }

            // 等待一段时间后继续查询
            await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
        }

        return null;

    } catch (error) {
        console.error('获取验证码失败:', error);
        throw error;
    }
}

/**
 * 从邮件部分中获取文本内容
 * @param {Array} parts - 邮件的各个部分
 * @returns {string} 文本内容
 */
function getTextFromParts(parts) {
    let text = '';
    for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
            text += Buffer.from(part.body.data, 'base64').toString();
        } else if (part.parts) {
            text += getTextFromParts(part.parts);
        }
    }
    return text;
}


export class Gmail extends ChromeBrowserUtil {
    constructor(chromeNumber, proxy = null) {
        super(chromeNumber, proxy);
    }

    async login(username, password, otpSecretKey) {
        await this.page.goto('https://accounts.google.com/');
        await this.page.waitForTimeout(2000);
        const currentUrl = this.page.url();
        if(currentUrl.includes('signin')) {
            try { // 判断是不是第一次登录，不是第一次登录会有用户名留存，直接点击用户名登录
                await this.page.locator('input[autocomplete="username webauthn"]').fill(username);
                await this.page.locator('div[id="identifierNext"]').click();
            } catch (error) {
                await this.page.getByText(username).click({ timeout: 10000 });
            }
            await this.page.waitForTimeout(2000);
            await this.page.locator('input[autocomplete="current-password"]').fill(password);
            await this.page.locator('div[id="passwordNext"]').click();
            await this.page.waitForTimeout(2000);
            try { // 有时候不需要这个验证码
                const otp = await getOTP(otpSecretKey);
                await this.page.locator('input[id="totpPin"]').fill(otp);
                await this.page.locator('div[id="totpNext"]').click();
                await this.page.waitForTimeout(2000);
            } catch (error) {
                console.log('未找到“验证码”输入框，跳过');
            }
            try {
                await this.page.locator('text=/(^以后再说$|^Not now$)/i').click();
            } catch (error) {
                console.log('未找到“以后再说”按钮，跳过');
            }
            try { // 设置辅助邮箱等
                await this.page.locator('text=/(^取消$|^Cancel$)/i').click();
            } catch (error) {
                console.log('未找到“取消”按钮，跳过');
            }
        } else {
            console.log('已登录状态，无需重复登录');
        }
    }

    async changeLanguage() {
        await this.page.goto('https://myaccount.google.com/personal-info', { waitUntil: 'networkidle' , timeout: 60000 });
        await this.page.waitForTimeout(5000);
        try {
            // 检查元素是否包含"简体中文"文本
            await this.page.locator('a:has(img[src*="language"])').filter({ hasText: '简体中文' }).waitFor({ timeout: 5000 });
            console.log('已设置为简体中文');
            return;  // 如果找到包含文本的元素就结束
        } catch {
            await this.page.locator('a:has(img[src*="language"])').click({ timeout: 5000 });
            await this.page.waitForTimeout(2000);
            await this.page.locator('button[jsname="Pr7Yme"][aria-haspopup="true"][autofocus]').click();
            await this.page.waitForTimeout(2000);
            await this.page.locator('input[jsname="YPqjbf"][role="combobox"][data-axe="mdc-autocomplete"]').fill("简体中文");
            await this.page.waitForTimeout(500);
            await this.page.getByText('简体中文').click({ timeout: 5000 });
            await this.page.waitForTimeout(2000);
            await this.page.locator('[data-mdc-dialog-action="x8hlje"]').click({ timeout: 5000 });
            await this.page.waitForTimeout(2000);
            console.log('已设置为简体中文');
        }
    }

    async addOrChange2fa({ password, csvFile, matchField = 'email', matchValue, targetField = 'emailOtpSecretKey' }) {
        await this.changeLanguage();
        await this.page.goto('https://myaccount.google.com/security', { waitUntil: 'networkidle' , timeout: 60000 });
        await this.page.waitForTimeout(2000);
       
        await this.page.locator('text=/(^两步验证$|^2-Step Verification$|^Xác minh 2 bước$|^২-ধাপে যাচাইকরণ$)/i').click();
        await this.page.waitForTimeout(2000);
        try { // 有时候需要先验证密码
            await this.page.locator('input[autocomplete="current-password"]').fill(password, { timeout: 10000 });
            await this.page.locator('div[id="passwordNext"]').click({ timeout: 10000 });
        } catch (error) {
            console.log('不需要验证密码');
        }
        await this.page.waitForTimeout(2000);
        await this.page.locator('text=/(^身份验证器$|^Authenticator$)/i').click();
        await this.page.waitForTimeout(5000);
        // 添加或者更改身份验证器应用
        await this.page.getByRole('button', { 
            name: /^(设置身份验证器|Set up authenticator|更改身份验证器应用|Change authenticator app)$/i 
        }).click({ timeout: 10000 });
        await this.page.locator('div[jsname="Ptcard"]').click();
        await this.page.waitForTimeout(2000);
        const key = await this.page.locator('li div strong').filter({ hasText: /[a-z0-9]/ }).first().textContent();        
        const otpSecretKey = key.replace(/\s+/g, '');
        await this.page.getByRole('button', { name: /^(下一页|Next)$/i }).click();    
        const otp = await getOTP(otpSecretKey);
        await this.page.getByPlaceholder(/^(输入验证码|Enter code)$/i).fill(otp);
        await this.page.getByRole('button', { name: /^(验证|Verify)$/i }).click();    
        await this.page.waitForTimeout(10000);
        // 保存验证器密钥到CSV文件
        await updateCsvFieldValueByMatch({
            csvFile,
            matchField,
            matchValue,
            targetField,
            targetValue: otpSecretKey
        })
    }
}