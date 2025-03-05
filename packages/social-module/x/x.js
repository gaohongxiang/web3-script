import { TwitterApi } from 'twitter-api-v2';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ChromeBrowserUtil } from "../../rpa-module/chrome/chromeBrowser/chromeBrowser.js";
import { getOTP } from "../../utils-module/otp.js";
import { generateRandomString, updateCsvFieldValueByMatch } from "../../utils-module/utils.js";

/**
 *  X OAuth2认证工具类
 * 用于处理X的OAuth2.0认证流程，获取和管理refresh token
 * @extends ChromeBrowserUtil
 */
export class XAuthenticator extends ChromeBrowserUtil {
    /**
     * 创建并初始化XAuthenticator实例
     * @static
     * @param {Object} params - 初始化参数
     * @param {number} params.chromeNumber - Chrome实例编号
     * @param {string} params.proxy - 代理服务器地址
     * @returns {Promise<XAuthenticator>} 初始化完成的实例
     * @throws {Error} 缺少必要的环境变量配置时抛出错误
     */
    static async create({ chromeNumber, proxy }) {
        // 1. 检查必要的环境变量
        if (!process.env.xClientId || !process.env.xClientSecret || !process.env.xRedirectUri) {
            throw new Error('缺少必要的环境变量配置');
        }

        // 2. 创建实例并初始化Chrome
        const instance = await super.create({ chromeNumber });

        // 3. 初始化API客户端
        instance.proxy = new SocksProxyAgent(proxy);
        instance.client = new TwitterApi({
            clientId: process.env.xClientId,
            clientSecret: process.env.xClientSecret,
            httpAgent: instance.proxy
        });

        return instance;
    }

    /**
     * 执行OAuth2授权流程并保存refresh token
     * @param {Object} params - 授权参数
     * @param {string} [params.csvFile='./data/social/x.csv'] - CSV文件路径
     * @param {string} [params.matchField='xUsername'] - CSV匹配字段
     * @param {string} params.matchValue - 匹配值
     * @param {string} [params.targetField='xRefreshToken'] - 目标字段
     * @returns {Promise<void>}
     */
    async authorizeAndSaveToken({ csvFile = './data/social/x.csv', matchField = 'xUsername', matchValue, targetField = 'xRefreshToken' }) {
        try {
            // 获取授权URL
            const { url, codeVerifier, state } = this.client.generateOAuth2AuthLink(
                process.env.xRedirectUri,
                {
                    scope: [
                        'offline.access',
                        'tweet.read',
                        'tweet.write',
                        'users.read',
                        'follows.read',
                        'follows.write',
                        'like.read',
                        'like.write',
                        'list.read',
                        'list.write'
                    ]
                }
            );

            await this.page.goto(url);
            await this.page.waitForTimeout(2000);
            await this.page.getByText('Authorize app').click();
            await this.page.waitForURL((url) => {
                return url.toString().includes('code=');
            }, { timeout: 10000 });
            const code = await this.page.url().split('code=')[1];

            // 获取 token
            const { refreshToken } = await this.client.loginWithOAuth2({
                code,
                codeVerifier,
                redirectUri: process.env.xRedirectUri
            });

            // 保存 refresh token
            await updateCsvFieldValueByMatch({
                csvFile,
                matchField,
                matchValue,
                targetField,
                targetValue: refreshToken
            });

            return true;
        } catch (error) {
            console.error('X OAuth2授权失败:', error);
            return false;
        }
    }
}

/**
 * X RPA自动化工具类
 * 用于模拟用户操作，如登录、修改密码等
 * @extends ChromeBrowserUtil
 */
export class XRpa extends ChromeBrowserUtil {
    /**
     * 创建并初始化XRpa实例
     * @static
     * @param {Object} params - 初始化参数
     * @param {number} params.chromeNumber - Chrome实例编号
     * @returns {Promise<XRpa>} 初始化完成的实例
     */
    static async create({ chromeNumber }) {
        // 创建实例并初始化Chrome
        const instance = await super.create({ chromeNumber });
        return instance;
    }

    /**
     * X 账号登录
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @param {string} otpSecretKey - OTP密钥
     * @returns {Promise<void>}
     */
    async loginX(username, password, otpSecretKey) {
        try {
            await this.page.goto('https://x.com/home', { timeout: 60000 });
            await this.page.waitForTimeout(2000);
            // console.log(this.page.url());
            if (this.page.url().includes('login')) {
                await this.page.locator('input[autocomplete="username"]').fill(username);
                await this.page.locator('text=/(^下一步$|^Next$)/i').click();
                await this.page.waitForTimeout(2000);
                await this.page.locator('input[autocomplete="current-password"]').fill(password);
                await this.page.waitForTimeout(2000);
                await this.page.locator('[data-testid="LoginForm_Login_Button"]').first().click();
                await this.page.waitForTimeout(2000);
                const otp = await getOTP(otpSecretKey);
                await this.page.locator('input[inputmode="numeric"]').fill(otp);
                await this.page.locator('[data-testid="ocfEnterTextNextButton"]').first().click();
                await this.page.waitForTimeout(2000);
            } else {
                console.log('已登录状态，无需重复登录');
            }
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * 切换X界面语言为英文
     * @returns {Promise<boolean>} 是否切换成功
     */
    async changeLanguage() {
        try {
            await this.page.goto('https://x.com/settings/language', { timeout: 60000 });
            const selector = 'select#SELECTOR_1';
            // 等待下拉框出现
            await this.page.locator(selector).waitFor({ state: 'visible', timeout: 5000 });
            // 获取当前选中的值
            const currentValue = await this.page.locator(selector).evaluate(select => select.value);
            // 如果已经是英语，直接返回
            if (currentValue === 'en') {
                console.log('当前已经是英语，无需切换');
                return true;
            }
            // 否则切换到英语
            await this.page.locator(selector).selectOption('en');
            await this.page.locator('button[data-testid="settingsDetailSave"]').click();
        } catch (error) {
            console.log('选择语言操作失败:', error.message);
        }
    }

    /**
     * 修改X账号密码
     * @param {Object} params - 密码修改参数
     * @param {string} params.oldPassword - 旧密码
     * @param {string} [params.csvFile='./data/social/x.csv'] - CSV文件路径
     * @param {string} [params.matchField='xUsername'] - CSV匹配字段
     * @param {string} params.matchValue - 匹配值
     * @param {string} [params.targetField='xPassword'] - 目标字段
     * @returns {Promise<void>}
     */
    async changePassword({ oldPassword, csvFile = './data/social/x.csv', matchField = 'xUsername', matchValue, targetField = 'xPassword' }) {
        try {
            const newPassword = generateRandomString(12);
            // console.log(`新密码：${newPassword}`);
            await this.page.goto('https://x.com/settings/password', { timeout: 60000 });
            await this.page.locator('input[name="current_password"]').fill(oldPassword);
            await this.page.locator('input[name="new_password"]').fill(newPassword);
            await this.page.locator('input[name="password_confirmation"]').fill(newPassword);
            await this.page.waitForTimeout(2000);
            await this.page.locator('button[data-testid="settingsDetailSave"]').click();
            await this.page.waitForTimeout(5000);

            // 保存验证器密钥到CSV文件
            await updateCsvFieldValueByMatch({
                csvFile,
                matchField,
                matchValue,
                targetField,
                targetValue: newPassword
            })
        } catch (error) {
            console.log(error);
        }
    }
}

/**
 * X API客户端类
 * 用于调用 X API执行各种操作，如发推、关注等
 */
export class XClient {
    /**
     * 创建并初始化XClient实例
     * @static
     * @param {Object} params - 初始化参数
     * @param {string} params.refreshToken - 刷新令牌
     * @param {string} params.proxy - 代理服务器地址
     * @param {string} [params.csvFile='./data/social/x.csv'] - CSV文件路径
     * @param {string} [params.matchField='xUsername'] - CSV匹配字段
     * @param {string} params.matchValue - 匹配值
     * @param {string} [params.targetField='xRefreshToken'] - 目标字段
     * @returns {Promise<XClient>} 初始化完成的实例
     * @throws {Error} 如果缺少必要的环境变量或初始化失败
     */
    static async create({ 
        refreshToken, 
        proxy, 
        csvFile = './data/social/x.csv', 
        matchField = 'xUsername', 
        matchValue, 
        targetField = 'xRefreshToken' 
    }) {
        // 1. 检查必要的环境变量
        if (!process.env.xClientId || !process.env.xClientSecret) {
            throw new Error('缺少必要的环境变量: xClientId, xClientSecret');
        }

        // 2. 创建实例
        const instance = new XClient();
        instance.proxy = new SocksProxyAgent(proxy);

        try {
            // 3. 初始化 X API 客户端
            const client = new TwitterApi({
                clientId: process.env.xClientId,
                clientSecret: process.env.xClientSecret,
                httpAgent: instance.proxy
            });

            // 4. 刷新token
            const { 
                client: refreshedClient, 
                refreshToken: newRefreshToken 
            } = await client.refreshOAuth2Token(refreshToken);

            // 5. 更新token
            await updateCsvFieldValueByMatch({
                csvFile,
                matchField,
                matchValue,
                targetField,
                targetValue: newRefreshToken
            });

            // 6. 设置客户端
            instance.client = refreshedClient;
            
            return instance;
        } catch (error) {
            console.error('初始化X客户端失败:', error);
            throw error;
        }
    }

    /**
     * 获取当前用户信息
     * @returns {Promise<{userId: string, userName: string}>} 用户ID和用户名
     */
    async getCurrentUserProfile(){
        try {
            const user = await this.client.v2.me();
            // console.log('用户信息:', user);
            const { id: userId, userName } = user.data;
            return { userId, userName };
        } catch (error) {
            console.log('获取用户信息失败:', error);    
        }
    }

    /**
     * 通过用户名查找用户信息
     * @param {string} username - 目标用户名
     * @returns {Promise<{userId: string}>} 用户ID
     */
    async findUserByUsername(username) {
        try {
            const user = await this.client.v2.userByUsername(username);
            // console.log('用户信息:', user);
            const { id: userId } = user.data;
            return { userId };
        } catch (error) {
            console.log('获取用户信息失败:', error);
        }
    }

    /**
     * 关注指定用户
     * @param {string} username - 要关注的用户名
     * @returns {Promise<void>}
     */
    async follow(username) {
        try {
            const { userId } = await this.getCurrentUserProfile();
            const { userId: targetUserId } = await this.findUserByUsername(username);
            await this.client.v2.follow(userId, targetUserId);
            console.log('关注成功');
        } catch (error) {
            console.log('关注失败:', error);
        }
    }

    /**
     * 发送推文
     * @param {string} text - 推文内容
     * @returns {Promise<void>}
     */
    async tweet(text) {
        try {
            await this.client.v2.tweet(text);
            console.log('发送推文成功');
        } catch (error) {
            console.log('发送推文失败:', error);
        }
    }

    // async like(){}


}