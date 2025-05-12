import 'dotenv/config';
import { createBrowserUtil } from './browserConfig.js';
import { parseToken } from '../crypt-module/onepassword.js';
import { deCryptText } from '../crypt-module/crypt.js';

// 不同浏览器环境下的钱包ID，指纹浏览器里插件的ID可能跟本地不一样。
const walletConfigs = {
    chrome: { walletID: 'mcohilncbfahbmgdjkbpemcciiolgcge' },
    bitbrowser: { walletID: 'dkaonkcpflfhalioalibgpdiamnjcpbn' }  // 默认值。不传walletID时，使用默认值。
};

/**
 * OKX钱包工具类 - 统一实现适用于所有浏览器环境
 * 
 * 设计说明:
 * 1. 实现方式采用组合模式+工厂模式的结合:
 *    - 组合模式: 通过持有browserUtil实例而非继承，实现了浏览器操作和钱包操作的职责分离
 *    - 工厂模式: 通过静态create方法根据参数动态创建合适的浏览器实现
 * 
 * 2. 技术优势:
 *    - 运行时可动态切换浏览器环境(Chrome/BitBrowser)而不影响钱包功能
 *    - 低耦合: OkxWalletUtil不依赖于具体浏览器实现，仅依赖接口
 *    - 易扩展: 新增浏览器类型时无需修改OkxWalletUtil类
 *    - 代理方法: 提供常用browserUtil方法的直接代理，简化调用方式
 */
export class OkxWalletUtil {
    /**
     * OKX钱包工具构造函数
     * @param {Object} browserUtil - 浏览器工具实例 
     * @param {string} walletID - OKX钱包扩展ID
     */
    constructor(browserUtil, walletID) {
        this.browserUtil = browserUtil;
        this.page = browserUtil.page;
        this.context = browserUtil.context;
        this.okxPage = null;

        // 初始化通用URL
        this.updateWalletID(walletID);

        // 创建常用方法的代理，简化调用方式
        this.isElementExist = (selector, options) => 
            this.browserUtil.isElementExist(selector, options);
    }

    /**
     * 更新钱包ID并重置相关URL
     * @param {string} walletID - 新的钱包ID
     */
    updateWalletID(walletID) {
        this.walletID = walletID;
        this.unlockUrl = `chrome-extension://${walletID}/popup.html#/unlock`;
        this.homeUrl = `chrome-extension://${walletID}/popup.html#`;
        this.firstImportUrl = `chrome-extension://${walletID}/popup.html#/import-with-seed-phrase-and-private-key`;
        this.importUrl = `chrome-extension://${walletID}/popup.html#/wallet-add/import-with-seed-phrase-and-private-key`
        this.settingsUrl = `chrome-extension://${walletID}/popup.html#/new-settings`;
        this.editAccountUrl = `chrome-extension://${walletID}/popup.html#/wallet/management-edit-page`;
    }

    /**
     * 创建并初始化OKX钱包工具实例
     * @param {Object} options - 初始化参数
     * @param {string} [options.browserType='chrome'] - 浏览器类型，'chrome'或'bitbrowser'
     * @param {number|string} options.browserId - Chrome实例编号或BitBrowser浏览器ID
     * @param {string} [options.walletID] - OKX钱包扩展ID，如不提供则使用默认值
     * @param {Function} [options.classType=OkxWalletUtil] - 要创建的类，默认为OkxWalletUtil，可以是OkxWalletUtil的子类
     * @returns {Promise<OkxWalletUtil>} 初始化完成的实例
     */
    static async create({ browserType = 'chrome', browserId, walletID, classType = OkxWalletUtil }) {
        try {
            // 获取钱包配置
            const walletConfig = walletConfigs[browserType.toLowerCase()] || {};
            if (!walletConfig) {
                throw new Error(`浏览器类型不匹配: ${browserType}`);
            }

            // 使用传入的walletID或默认值
            const actualWalletID = walletID || walletConfig.walletID;

            // 使用共享的浏览器工具创建函数
            const browserUtil = await createBrowserUtil({ browserType, browserId });

            // 创建钱包实例 - 使用传入的类型
            const wallet = new classType(browserUtil, actualWalletID);

            // 初始化OKX专用页面
            wallet.okxPage = await browserUtil.context.newPage();

            return wallet;
        } catch (error) {
            console.error('创建OKX钱包实例失败:', error);
            throw error;
        }
    }

    /**
     * 使用私钥导入钱包。第一次导入时的流程
     * @param {string} enPrivateKey - 加密的私钥
     */
    async firstImportByPrivateKey(enPrivateKey) {
        try {
            if (!process.env.OKXWALLETPASSWORD) {
                process.env.OKXWALLETPASSWORD = await parseToken(process.env.okxWalletPassword);
            }
            const privateKey = await deCryptText(enPrivateKey);
            await this.okxPage.goto(this.firstImportUrl, { timeout: 30000 });
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.getByTestId('okd-tabs-scroll-container').getByText(/^(私钥|Private key)$/i).click();
            await this.okxPage.locator('textarea[data-testid="okd-input"][type="password"]').fill(privateKey);
            await this.okxPage.waitForTimeout(2000);
            await this.okxPage.getByTestId('okd-tabs-panel-2').getByTestId('okd-button').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('div.choose-network-list-card__title >> text=Aptos 网络').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('div.choose-network-list-card__title >> text=EVM 网络').click();
            await this.okxPage.waitForTimeout(2000);
            await this.okxPage.locator('button[data-testid="okd-button"][type="button"]').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('text=/(^密码验证$|^Password verification$)/i').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('button[data-testid="okd-button"][type="button"]').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('input[data-testid="okd-input"][type="password"]').nth(0).fill(process.env.OKXWALLETPASSWORD);
            await this.okxPage.locator('input[data-testid="okd-input"][type="password"]').nth(1).fill(process.env.OKXWALLETPASSWORD);
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('button[data-testid="okd-button"][type="button"]').click();
            await this.okxPage.waitForTimeout(1000);
        } catch (error) {
            console.log('导入私钥失败:', error);
        }
    }

    /**
     * 使用私钥导入钱包。
     * @param {string} enPrivateKey - 加密的私钥
     */
    async importByPrivateKey(enPrivateKey) {
        try {
            await this.unlock();
            const privateKey = await deCryptText(enPrivateKey);
            await this.okxPage.goto(this.importUrl, { timeout: 30000 });
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.getByTestId('okd-tabs-scroll-container').getByText(/^(私钥|Private key)$/i).click();
            await this.okxPage.locator('textarea[data-testid="okd-input"][type="password"]').fill(privateKey);
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.getByTestId('okd-tabs-panel-2').getByTestId('okd-button').click();
            await this.okxPage.waitForTimeout(2000);
            await this.okxPage.locator('button[data-testid="okd-button"][type="button"]').click();
            await this.okxPage.waitForTimeout(2000);
        } catch (error) {
            console.log('导入私钥失败:', error);
        }
    }

    /**
     * 切换OKX钱包语言到简体中文
     */
    async changeLanguage() {
        try {
            await this.okxPage.goto(this.settingsUrl);
            await this.okxPage.waitForTimeout(1000);

            // 检查是否已经设置为中文
            const isExist = await this.isElementExist('text="偏好设置"', { waitTime: 10, page: this.okxPage });
            if (isExist) {
                console.log('已设置为简体中文');
                return;
            }

            // 进行语言切换
            await this.okxPage.getByText(/^(Preferences)$/i, { timeout: 1000 }).click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.getByText(/^(Language)$/i, { timeout: 1000 }).click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.getByText(/^(Simplified Chinese)$/i, { timeout: 1000 }).click();
            await this.okxPage.waitForTimeout(8000);
        } catch (error) {
            console.log('切换语言失败:', error);
        }
    }

    /**
     * 修改账户名称
     * @param {string} address - 账户地址
     * @param {string} accountName - 新的账户名称
     */
    async changeAccountName(address, accountName) {
        try {
            await this.okxPage.goto(this.editAccountUrl);
            await this.okxPage.waitForTimeout(1000);
            address = `${address.slice(0, 6)}...${address.slice(-4)}`;

            // 使用通用选择器
            await this.okxPage.locator(`text=${address}`, { exact: false }).click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator(`input[value*="${address}" i]`).fill(accountName);
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('button[type="button"]:has-text("确认"):visible:not([disabled])').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.click('text="完成"');
            await this.okxPage.waitForTimeout(1000);
        } catch (error) {
            console.log('修改账户名称失败:', error);
        }
    }

    /**
     * 切换到指定账户
     * @param {string} [accountName='EVM撸毛'] - 要切换到的账户名称
     */
    async changeAccount(accountName = 'EVM撸毛') {
        try {
            await this.okxPage.goto(this.homeUrl);

            // 检查是否已经在指定账户
            const isExist = await this.isElementExist(`div:has-text("${accountName}")`, { waitTime: 5, page: this.okxPage });

            if (!isExist) {
                // 点击头像打开下拉菜单
                await this.okxPage.locator('img[alt="wallet-avatar"]').click();
                await this.okxPage.waitForTimeout(2000);

                // 使用locator定位私钥区域的accordion header
                const accordionHeader = this.okxPage.locator('div[data-testid="okd-accordion-header"]:has-text("私钥")');

                // 获取accordion的展开状态
                const isExpanded = await accordionHeader.getAttribute('data-e2e-okd-accordion-expanded');

                // 如果未展开，则点击展开
                if (isExpanded === 'false') {
                    await accordionHeader.click();
                    await this.okxPage.waitForTimeout(1000);
                }

                // 使用精确的选择器定位指定账户
                const targetAccount = this.okxPage
                    .locator('[data-testid="okd-virtual-list-filler-inner"]')
                    .locator('div')
                    .filter({ hasText: accountName })
                    .first();

                // 等待元素可见并可点击
                await targetAccount.waitFor({ state: 'visible' });
                await targetAccount.click();

                console.log(`已切换到${accountName}账户`);
            } else {
                console.log(`已在${accountName}账户，无需切换`);
            }
        } catch (error) {
            console.error(`切换到${accountName}账户时发生错误:`, error);
        }
    }

    /**
     * 解锁钱包
     */
    async unlock() {
        try {
            if (!process.env.OKXWALLETPASSWORD) {
                process.env.OKXWALLETPASSWORD = await parseToken(process.env.okxWalletPassword);
            }
            await this.okxPage.goto(this.unlockUrl);
            await this.okxPage.waitForTimeout(3000);
            if (this.okxPage.url() == this.unlockUrl) {
                const isExist = await this.isElementExist('input[placeholder="请输入密码"]', { waitTime: 5, page: this.okxPage })
                // console.log(isExist)
                if (isExist) {
                    await this.okxPage.locator('input[placeholder="请输入密码"]').fill(process.env.OKXWALLETPASSWORD);
                    await this.okxPage.click('text="解锁"');
                    await this.okxPage.waitForTimeout(3000);
                } else {
                    await this.unlock();
                }
            }
        } catch (error) {
            console.log('解锁钱包失败:', error);
        }
    }

    /**
     * 连接钱包到指定网站
     */
    async connectWallet(url, { chain = '', accountName = 'EVM撸毛', hasAnime = false, hasNavigator = false, navigatorButton = 'text=/(close)/i', hasConnectButton = true, hasOkxButton = true, connectButton = 'text=/(Connect Wallet?|连接钱包|Sign in|Login|Lon in|Connect)/i', checkButton = '', okxButton = 'text=/(OKX|OKX Wallet|browser wallet|Ethereum Wallet)/i', signButton = '', waitTime = 5 } = {}) {
        /* 连接钱包
         * text=/(connect wallet?|连接钱包|Login)/i 匹配解析: ?表示前面的字符可有可无 i表示对大小写不敏感 |表示或者
         */
        await this.unlock();
        await this.changeAccount(accountName);
        // 将浏览器指定页面带到前台
        await this.page.bringToFront();
        await this.page.goto(url);
        await this.page.waitForTimeout(waitTime * 1000);

        // 连接钱包流程
        try {
            if (hasAnime) {
                await this.page.waitForTimeout(30000);
            }

            if (hasNavigator) {
                try {
                    await this.page.waitForSelector(navigatorButton, { timeout: 6000 }).then(element => { element.click() });
                } catch (error) { console.log(error) }
            }

            if (hasConnectButton) {
                await this.page.waitForTimeout(2000);
                await this.page.waitForSelector(connectButton, { timeout: 10000 }).then(element => { element.click() });
            }

            if (checkButton) {
                try {
                    await this.page.waitForTimeout(1000);
                    await this.page.waitForSelector(checkButton, { timeout: 6000 }).then(element => { element.click() });
                    await this.page.waitForTimeout(1000);
                } catch (error) { console.log(error) }
            }

            if (hasOkxButton) {
                try {
                    await this.page.waitForSelector(okxButton, { timeout: 5000 }).then(element => { element.click() });
                } catch (error) { console.log(error) }
            }

            await this.page.waitForTimeout(3000);
            await this.okxPage.reload();
            const currentUrl = this.okxPage.url();
            console.log('currentUrl', currentUrl);

            if (currentUrl.includes('connect')) {
                await this.okxPage.waitForSelector('text=/(^连接$|^connect$)/i', { timeout: 5000 }).then(element => { element.click() });
                await this.page.waitForTimeout(1000);

                if (signButton) {
                    await this.page.waitForSelector(signButton, { timeout: waitTime * 1000 }).then(element => { element.click() });
                    await this.page.waitForTimeout(waitTime);
                }

                await this.okxPage.reload({ waitUntil: 'networkidle', timeout: 10000 });
                await this.page.waitForTimeout(1000);

                const updatedUrl = this.okxPage.url();
                if (updatedUrl.includes('dapp-entry')) {
                    try {
                        await this.okxPage.waitForSelector('*[aria-label="向下滚动"]', { timeout: 3000 }).then(element => { element.click() });
                    } catch (error) { }
                    await this.okxPage.waitForSelector('text=/(^确认$|^confirm$)/i', { timeout: 3000 }).then(element => { element.click() });
                    await this.page.waitForTimeout(1000);
                }
            } else if (currentUrl.includes('dapp-entry')) {
                try {
                    await this.okxPage.waitForSelector('*[aria-label="向下滚动"]', { timeout: 3000 }).then(element => { element.click() });
                } catch (error) { }
                await this.okxPage.waitForSelector('text=/(^确认$|^confirm$)/i', { timeout: 3000 }).then(element => { element.click() });
                await this.page.waitForTimeout(1000);
            }
        } catch (error) {
            console.log(error);
            console.log('已连接，不需重复连接');
        }
    }
}