/*
 * bitbrowser api : https://doc.bitbrowser.cn/api-jie-kou-wen-dang/liu-lan-qi-jie-kou
 * playwright文档: https://playwright.dev/docs/library
*/
import playwright from 'playwright';
import axios from 'axios';
import { sleep } from '../../utils-module/utils.js';

const bitbrowserUrl = 'http://127.0.0.1:54345'

/**
 * 创建或修改浏览器窗口
 * @param {string} browserOs - 操作系统,影响ua值。最好跟本机操作系统相同
 * @param {string} browserId - bitbrowser浏览器id。此参数空值时代表创建浏览器。有值时代表修改浏览器信息
 * @returns {Promise<string>} 浏览器id
 */
export const createOrUpdateBrowser = async (browserOs = 'mac', browserId = '') => {
    // 操作系统
    browserOs = ['mac', 'macos'].includes(browserOs) ? 'MacIntel' 
              : ['win', 'windows'].includes(browserOs) ? 'Win32' 
              : browserOs;

    const body = {
        id: browserId, // 有值时为修改，无值是添加
        platform: 'https://www.google.com', // 账号平台
        platformIcon: 'other', // 取账号平台的 hostname 或者设置为other
        workbench: 'localServer', // 浏览器窗口工作台页面。chuhai2345(默认)|localServer|disable
        proxyMethod: 2, // 代理类型 1平台 2自定义
        // agentId: '', // proxyMethod为1时，平台代理IP的id
        // 自定义代理类型 ['noproxy', 'http', 'https', 'socks5', '911s5']
        proxyType: 'noproxy', // 先不设置代理。可在修改代理接口去设置
        browserFingerPrint: {
            coreVersion: '104', // 内核版本，默认104，可选92
            ostype: 'PC', // 操作系统平台 PC | Android | IOS
            version: '106', // 浏览器版本，建议92以上，不填则会从92以上版本随机。目前106最高
            os: browserOs, // 为navigator.platform值 Win32 | Linux i686 | Linux armv7l | MacIntel
            userAgent: '', // ua，不填则自动生成
            isIpCreateTimeZone: false, // 基于IP生成对应的时区
            timeZone: 'GMT+08:00', // 时区，isIpCreateTimeZone 为false时，参考附录中的时区列表
            position: '1', // 网站请求获取您当前位置时，是否允许 0询问|1允许|2禁止
            isIpCreatePosition: true, // 是否基于IP生成对应的地理位置
            lat: '', // 经度 isIpCreatePosition 为false时设置
            lng: '', // 纬度 isIpCreatePosition 为false时设置
            precisionData: '', // 精度米 isIpCreatePosition 为false时设置
            isIpCreateLanguage: false, // 是否基于IP生成对应国家的浏览器语言
            languages: 'zh-CN', // isIpCreateLanguage 为false时设置，值参考附录
            isIpCreateDisplayLanguage: false, // 是否基于IP生成对应国家的浏览器界面语言
            displayLanguages: '', // isIpCreateDisplayLanguage 为false时设置，默认为空，即跟随系统
            WebRTC: 0, // 0替换(默认)|1允许|2禁止。开启WebRTC，将公网ip替换为代理ip，同时掩盖本地ip
        }
    };

    const { data: { data: { id } } } = await axios.post(`${bitbrowserUrl}/browser/update`, body);
    console.log('创建或修改浏览器成功,浏览器id为:', id);
    return id;
};


export async function updateBitbrowserProxy(id, host, post, username, password) {
    try{
        const response = await axios.post(`${bitbrowserUrl}/browser/proxy/update`, {
            ids: [id],
            ipCheckService:'ip-api',
            proxyMethod:2, //自定义代理
            proxyType:'socks5',
            host:host,
            port:post,
            proxyUserName:username,
            proxyPassword:password
        });

        // console.log(response)
        if(response.data.success){
            console.log('修改代理成功')
        }else{
            console.log('修改代理失败')
        }
    }catch(error){console.log(error)}
}

export class BitBrowserUtil {
    /**
     * BitBrowser浏览器管理工具
     * @param {string} browserId - BitBrowser浏览器ID
     * @param {number} [navigationWaitTime=30] - 页面导航等待时间(秒)
     * @param {number} [allWaitTime=30] - 全局等待时间(秒)
     * @param {number} [maxRetries=3] - 最大重试次数
     */
    constructor(browserId) {
        this.browserId = browserId;
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isStarted = false;
    }

    /**
     * 创建并初始化BitBrowser实例
     * @static
     * @param {Object} params - 初始化参数
     * @param {string} params.browserId - BitBrowser浏览器ID
     * @param {number} [params.navigationWaitTime=30] - 页面导航等待时间(秒)
     * @param {number} [params.allWaitTime=30] - 全局等待时间(秒)
     * @param {number} [params.maxRetries=3] - 最大重试次数
     * @returns {Promise<BitBrowserUtil>} 初始化完成的实例
     * @throws {Error} 如果初始化失败
     */
    static async create({ browserId, navigationWaitTime = 30, allWaitTime = 30, maxRetries = 3 }) {
        // 创建实例
        const instance = new this(browserId);
        
        // 执行初始化
        await instance.start(navigationWaitTime, allWaitTime, maxRetries);
        return instance;
    }

    /**
     * 打开BitBrowser浏览器并获取连接信息
     * @private
     * @returns {Promise<{ws: string, chromeDriverPath: string, http: string}>} 浏览器连接信息
     * @throws {Error} 如果打开浏览器失败
     */
    async open() { 
        try {

            const response = await axios.post(`${bitbrowserUrl}/browser/open`, {id: this.browserId});
            if(response.data.success === true) {
                const { ws, driver: chromeDriverPath, http } = response.data.data;
                return { ws, chromeDriverPath, http };  
            } else {
                throw new Error('ws请求失败,请重试');
            }
        } catch(error) {
            console.error('打开浏览器失败:', error);
            throw error;
        }
    }
  
    /**
     * 启动并初始化浏览器实例
     * @private
     * @param {number} navigationWaitTime - 页面导航等待时间(秒)
     * @param {number} allWaitTime - 全局等待时间(秒)
     * @param {number} maxRetries - 最大重试次数
     * @throws {Error} 如果初始化失败且达到最大重试次数
     */
    async start(navigationWaitTime = 30, allWaitTime = 30, maxRetries = 3) {
        let retries = 0;
        while (retries < maxRetries) {
            try {
                if (this.isStarted) {
                    // console.log('已经调用过start方法,不执行初始化操作');
                    return;
                }
                const { ws, chromeDriverPath, http } = await this.open();
                this.browser = await playwright.chromium.connectOverCDP(ws);
    
                const allContexts = this.browser.contexts();
                this.context = allContexts[0];
    
                const allPages = this.context.pages();
                this.page = allPages[0];
    
                // this.defaultWaitTime(this.context, navigationWaitTime, allWaitTime);
    
                // 设置全屏
                // this.browser.maximize();
    
                // 关闭其他页面
                allPages.forEach(page => {
                    if (page != this.page) {
                        page.close();
                    }
                });
    
                // 初始化完毕后设为true，下次调用不会再次初始化
                this.isStarted = true;
    
                // 如果成功初始化，跳出循环
                break;
            } catch (error) {
                console.error('初始化失败，重试中...', error);
                retries++;
                if (retries >= maxRetries) {
                    console.error('达到最大重试次数，无法继续初始化。');
                    break;
                }
                // 在重试之前等待一段时间
                await sleep(3); // 3秒后重试
            }
        }
    }
    
    async newContext() {
        // Create new context 
        return await this.browser.newContext()
    }

    async newPage(context='') {
        // 创建新的page.不传context就是使用默认的context创建page
        if (!context) { context = this.context }
        return await context.newPage()
    }

    async getPages(context='') {
        // 获取所有页面及长度
        if (!context){ context = this.context } 
        const pages = context.pages()
        const pagesCount = pages.length
        return { pages, pagesCount }
    }

    async isElementExist(selector, { waitTime=5, page='' }={}) { 
        // 判断元素是否存在
        if (!page){ page = this.page } 
        try {
            await page.waitForSelector(selector, {timeout:waitTime*1000})
            return true
        }catch(error) {
            // console.log(error)
            return false
        }       
    }

    async isEnabled(selector, { waitTime=5, page='' }){
        // 判断元素是否可操作，如点击
        if (!page){ page = this.page }
        const element = await page.$(selector);
        while(true){
            let i = 1
            // 等待元素可用（包括可点击）
            const isEnabled = await element.isEnabled();
            console.log(isEnabled)
            if(isEnabled){
                await element.click()
                break
            }
            await page.waitForTimeout(10000)
            // 等待太久退出
            i++
            if(i > 8){break}
        }
    }

    async pause(page='') {
        // Pause page
        if (!page){ page = this.page } 
        page.pause()
    }

    async stop() {
        // 关闭浏览器

        // // 这个方法只能关闭playwright自己创建的浏览器，不能关闭连接的浏览器。。。。
        // this.browser.close()

        // 用bitbrowser的api关闭浏览器
        // const body = {'id': this.browserId}
        // body = {'id': this.browserId,'args': [{'openWidth':200000,'openHeight':200000}]}
        await axios.post(`${bitbrowserUrl}/browser/close`, {id: this.browserId});
    }
    
    async closeOtherWindows(context='') {
        // 关闭上下文中的无关页面。
        if (!context){ context = this.context } 
        const allPages = context.pages()
        allPages.forEach(page => {
            if (page != this.page) {
                page.close();
            } 
        });
    }
}