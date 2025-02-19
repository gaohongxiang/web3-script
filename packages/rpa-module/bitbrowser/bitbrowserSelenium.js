// bitbrowser api: https://doc.bitbrowser.cn/api-jie-kou-wen-dang/liu-lan-qi-jie-kou
// selenium api: https://www.selenium.dev/zh-cn/documentation/
import webdriver from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome.js';
import { By, until } from 'selenium-webdriver';
import axios from 'axios';
import { myFormatData } from '../utils-module/formatData.js';

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

/**
 * 修改浏览器代理
 * @param {string} browserId - 浏览器id
 * @param {number} indexId - 序号
 * @param {string} proxyIp - 代理主机
 * @param {number} proxyPort - 代理端口
 * @param {string} proxyUsername - 代理账号
 * @param {string} proxyPassword - 代理密码
 */
export const updateProxy = async (browserId, indexId, proxyIp, proxyPort, proxyUsername, proxyPassword) => {
    const body = {
        ids: [browserId], // 浏览器id数组
        ipCheckService: '', // IP查询渠道，默认ip-api
        proxyMethod: 2, // 代理类型 1平台 2自定义
        proxyType: 'socks5', // 代理协议类型
        host: proxyIp, // 代理主机
        port: proxyPort, // 代理端口
        proxyUserName: proxyUsername, // 代理账号
        proxyPassword: proxyPassword, // 代理密码
        isIpv6: false // 默认false
    };

    await axios.post(`${bitbrowserUrl}/browser/proxy/update`, body);
    console.log('第', indexId, '个账号修改代理成功');
};

/**
 * BitBrowser浏览器操作工具类
 */
export class BitBrowserUtil {

    constructor(browserId) {
        this.driver = null;
        this.browserId = browserId;
    }

    /**
     * 静态工厂方法，用于创建并初始化浏览器实例
     * @param {string} browserId - BitBrowser浏览器ID
     * @returns {Promise<BitBrowserUtil>} 返回初始化好的实例
     */
    static async create(browserId) {
        const browser = new BitBrowserUtil(browserId);
        browser.driver = await browser.open();
        await browser.driver.manage().window().maximize();
        await browser.closeOtherWindows();
        return browser;
    }

    /**
     * 打开浏览器
     */
    async open() {
        // 发送请求打开浏览器
        const response = await axios.post(`${bitbrowserUrl}/browser/open`, { id: this.browserId });
        // console.log('请求的完整结果:', response.data);

        const { driver: driverPath, http: debuggerAddress } = response.data.data;

        // 创建 service 和 options
        const service = new chrome.ServiceBuilder(driverPath);
        const options = new chrome.Options();
        
        // 只设置 debuggerAddress
        options.options_['debuggerAddress'] = debuggerAddress;

        // 创建并返回 driver
        const driver = await new webdriver.Builder()
            .forBrowser('chrome')
            .setChromeService(service)
            .setChromeOptions(options)
            .build();

        return driver;
    }

    /**
     * 关闭其他窗口，只保留当前窗口
     */
    async closeOtherWindows() {
        const currentHandle = await this.driver.getWindowHandle();
        const handles = await this.driver.getAllWindowHandles();
        
        for (const handle of handles) {
            if (handle !== currentHandle) {
                await this.driver.switchTo().window(handle);
                await this.driver.close();
            }
        }
        await this.driver.switchTo().window(currentHandle);
    }

    /**
     * 关闭浏览器
     */
    async quit() {
        await axios.post(`${bitbrowserUrl}/browser/close`, {
            id: this.browserId
        });
        if (this.driver) {
            await this.driver.quit();
        }
    }

    /**
     * 检查元素是否存在
     * @param {string} element - 元素选择器
     * @param {string} by - 查找方式 'XPATH' | 'CSS_SELECTOR'
     * @param {number} time - 等待时间(秒)
     * @returns {Promise<boolean>} 元素是否存在
     */
    async isElementExist(element, by = 'XPATH', time = 5) {
        try {
            const locator = by === 'XPATH' ? By.xpath(element) : By.css(element);
            await this.driver.wait(until.elementLocated(locator), time * 1000);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 切换窗口句柄
     * @param {Array<string>} currentAllHandles - 当前所有句柄
     * @param {Array<string>} allHandles - 所有句柄
     */
    async changeHandle(currentAllHandles, allHandles) {
        const newHandles = allHandles.filter(h => !currentAllHandles.includes(h));
        if (newHandles.length > 0) {
            await this.driver.switchTo().window(newHandles[0]);
        }
    }

    /**
     * 触发事件并执行操作
     * @param {string} triggerEle - 触发元素的xpath
     * @param {Array<string>} executionEles - 需要点击的元素xpath数组
     * @param {number} time - 等待时间(秒)
     */
    async triggerEvent(triggerEle, executionEles, time = 3) {
        const currentHandle = await this.driver.getWindowHandle();
        const currentAllHandles = await this.driver.getAllWindowHandles();

        await this.driver.wait(until.elementLocated(By.xpath(triggerEle)), 10000);
        await this.driver.findElement(By.xpath(triggerEle)).click();
        
        await new Promise(resolve => setTimeout(resolve, time * 1000));
        
        const allHandles = await this.driver.getAllWindowHandles();
        
        if (allHandles.length > currentAllHandles.length) {
            await this.changeHandle(currentAllHandles, allHandles);
            
            for (const ele of executionEles) {
                await this.driver.wait(until.elementLocated(By.xpath(ele)), 10000);
                await this.driver.findElement(By.xpath(ele)).click();
            }
            
            await this.driver.switchTo().window(currentHandle);
        }
    }

    /**
     * Yescaptcha自动验证
     * @param {string|null} iframTitle - iframe标题
     */
    async yescaptchaAutoVerify(iframTitle = null) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const currentHandle = await this.driver.getWindowHandle();
        console.log(currentHandle);

        if (iframTitle !== null) {
            try {
                const iframe = await this.driver.wait(
                    until.elementLocated(By.xpath(`//iframe[@title="${iframTitle}"]`)),
                    20000
                );
                await this.driver.switchTo().frame(iframe);
            } catch (e) {
                console.log('查看iframe是否正确');
                return;
            }
        }

        try {
            await this.driver.wait(
                until.elementLocated(By.xpath('//*[@id="mymessage"]')),
                20000
            );
        } catch (e) {
            console.log('请先打开yescaptcha人机验证插件');
            return;
        }

        try {
            await this.driver.wait(
                until.elementLocated(By.xpath("//div[text()='请先填写密钥ClientKey']")),
                3000
            );
            console.log('请先填写密钥ClientKey');
            return;
        } catch (e) {
            // 正常情况下不存在这个元素
        }

        try {
            await this.driver.wait(
                until.elementLocated(By.xpath("//div[text()='']")),
                3000
            );
            console.log('yescaptcha余额不足,请充值');
            return;
        } catch (e) {
            // 正常情况下不存在这个元素
        }

        // 等待yescaptcha自动验证
        while (true) {
            const status = await this.isElementExist("//*[@role='checkbox']");
            if (!status) {
                console.log('false');
                break;
            }
            console.log('true');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log(111);
        await this.driver.switchTo().defaultContent();
        console.log(222);
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        const newHandle = await this.driver.getWindowHandle();
        console.log(newHandle);
    }


/*------------------------------------------------seleniumx相关操作操作-------------------------------------------------*/

    // 初始化 Selenium WebDriver 的函数
    async initSeleniumDriver(chromeDriverPath, debuggerAddress) {
        try{
            let options = new chrome.Options()
            options.options_['debuggerAddress'] = debuggerAddress

            let service = new chrome.ServiceBuilder(chromeDriverPath)
            // chrome.setDefaultService(service)
        
            let driver = new webdriver.Builder()
                .setChromeService(service)
                .setChromeOptions(options)
                // .withCapabilities(webdriver.Capabilities.chrome())
                .forBrowser('chrome')
                .build()

            return driver;
        } catch (error) {
            console.error('初始化 Selenium WebDriver失败:', error);
            throw error; 
        }
    }
   
    async changeHandle() {
        await sleep(3)
        // 查找新打开的窗口句柄
        const allHandles = await this.driver.getAllWindowHandles();
        if (allHandles.length > 1) {
            const newHandle = allHandles[1]; // 直接取第二个新句柄。原来的句柄是数组的第一个元素
            // 切换到新窗口
            await this.driver.switchTo().window(newHandle);
            return true; // 返回 true 表示成功切换到了新窗口
        } else {
            // console.log('No new window was opened.');
            return false; // 返回 false 表示没有新窗口被打开
        }
    }
    
    // async changeHandle(currentAllHandles, allHandles) {
    //     await sleep(2)
    //     // 查找新打开的窗口句柄
    //     const newHandles = currentAllHandles.filter(handle => !allHandles.includes(handle));
    //     if (newHandles.length > 0) {
    //         // 假设只有一个新句柄，获取该句柄
    //         const newHandle = newHandles[0]; // 直接取第一个新句柄，假设一次只会打开一个新窗口
    //         // 切换到新窗口
    //         await this.driver.switchTo().window(newHandle);
    //         return true; // 返回 true 表示成功切换到了新窗口
    //     } else {
    //         // console.log('No new window was opened.');
    //         return false; // 返回 false 表示没有新窗口被打开
    //     }
    // }

    async closeSeleniumDriver() {
        if (this.driver) {
            await this.driver.quit();  // 关闭 Selenium WebDriver
            this.driver = null;
        }
    }
    /*------------------------------------------------seleniumx相关操作操作-------------------------------------------------*/
}

// 测试代码
const main = async () => {
    try {
        const data = await myFormatData(2);
        for (const d of data) {
            console.log(`第${d['indexId']}个账号`);
            const bitBrowser = await BitBrowserUtil.create(d['browserId']);
            await bitBrowser.driver.get('https://www.baidu.com');
            // 这里添加你的其他操作
            // await bitBrowser.quit();
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

main();