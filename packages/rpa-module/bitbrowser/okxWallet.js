import 'dotenv/config';
import { BitBrowserUtil } from './bitbrowser.js';
import { parseToken } from '../../crypt-module/onepassword.js';
import { deCryptText } from '../../crypt-module/crypt.js';

const okxWalletID = 'dkaonkcpflfhalioalibgpdiamnjcpbn'

export class OkxWalletUtil extends BitBrowserUtil {
    /**
     * OKX钱包工具构造函数
     * @param {string} browserId - BitBrowser浏览器ID
     */
    constructor(browserId) {
        // 调用父类构造函数
        super(browserId);
        
        // 初始化OKX特有属性
        this.okxPage = null;
        this.unlockUrl = `chrome-extension://${okxWalletID}/popup.html#/unlock`;
        this.homeUrl = `chrome-extension://${okxWalletID}/popup.html#`;
        this.importUrl = `chrome-extension://${okxWalletID}/popup.html#/import-with-seed-phrase-and-private-key`;
        this.settingsUrl = `chrome-extension://${okxWalletID}/popup.html#/new-settings`;
        this.editAccountUrl = `chrome-extension://${okxWalletID}/popup.html#/wallet/management-edit-page`;
    }

    /**
     * 创建并初始化OKX钱包工具实例
     * @static
     * @param {string} browserId - BitBrowser浏览器ID
     * @returns {Promise<OkxWalletUtil>} 初始化完成的实例
     * @throws {Error} 如果初始化失败
     */
    static async create({ browserId }) {
        // 创建实例
        const instance = await super.create({ browserId });
        
        // 初始化 okxPage
        instance.okxPage = await instance.context.newPage();

        return instance;
    }

    async importByPrivateKey(enPrivateKey) {
        try {
            if(!process.env.OKXWALLETPASSWORD) {   
                process.env.OKXWALLETPASSWORD = await parseToken(process.env.okxWalletPassword);
            }
            const privateKey = await deCryptText(enPrivateKey);
            await this.okxPage.goto(this.importUrl);
            await this.okxPage.waitForTimeout(3000);
            await this.okxPage.click('text="Private key"');

            await this.okxPage.locator('textarea[placeholder*="Paste or input your private key"]').fill(privateKey);
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('button[type="submit"]:has-text("Confirm"):visible:not([disabled])').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('div.choose-network-list-card__title >> text=Aptos network').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('div.choose-network-list-card__title >> text=EVM networks').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('button[type="button"]:has-text("Confirm"):visible:not([disabled])').click();
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.locator('input[placeholder*="Enter at least 8 characters"]').nth(0).fill(process.env.OKXWALLETPASSWORD);
            await this.okxPage.locator('input[placeholder*="Enter at least 8 characters"]').nth(1).fill(process.env.OKXWALLETPASSWORD);
            await this.okxPage.locator('button[type="submit"]:has-text("Confirm"):visible:not([disabled])').click();
            await this.okxPage.waitForTimeout(1000);

        } catch (error) {
            console.log(error)
        }
    }

    async changeLanguage() {
        try {
            await this.okxPage.goto(this.settingsUrl);
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.click('text="Preferences"');
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.click('text="Language"');
            await this.okxPage.waitForTimeout(1000);
            await this.okxPage.click('text="简体中文"');
            await this.okxPage.waitForTimeout(8000);
        } catch (error) {
            console.log(error)
        }
    }

    async changeAccountName(address, accountName) {
        try {
            await this.okxPage.goto(this.editAccountUrl);
            await this.okxPage.waitForTimeout(1000);
            address = `${address.slice(0, 6)}...${address.slice(-4)}`;
            
        // 使用 css i 标志实现不区分大小写
        await this.okxPage.locator(`text=${address}`, { exact: false }).click();
        await this.okxPage.waitForTimeout(1000);
        
        // 使用 i 标志实现不区分大小写
        await this.okxPage.locator(`input[value*="${address}" i]`).fill(accountName);
        await this.okxPage.waitForTimeout(1000);
        
        await this.okxPage.locator('button[type="button"]:has-text("确认"):visible:not([disabled])').click();
        await this.okxPage.waitForTimeout(1000);
        await this.okxPage.click('text="完成"');
            await this.okxPage.waitForTimeout(1000);
        } catch (error) {
            console.log(error)
        }
    }

    async changeAccount(accountName = '撸毛') {
        try {
            await this.okxPage.goto(this.homeUrl);
            
            // 检查是否已经在指定账户
            const isExist = await this.isElementExist(`div:has-text("${accountName}")`, { waitTime: 5, page: this.okxPage });
            
            if (!isExist) {
                // 点击头像打开下拉菜单
                await this.okxPage.locator('img[alt="wallet-avatar"]').click();
                await this.okxPage.waitForTimeout(2000);
                
                // 使用 locator 定位私钥区域的 accordion header
                const accordionHeader = this.okxPage.locator('div[data-testid="okd-accordion-header"]:has-text("私钥")');
                
                // 获取 accordion 的展开状态
                const isExpanded = await accordionHeader.getAttribute('data-e2e-okd-accordion-expanded');
                // console.log('私钥区域是否展开:', isExpanded);
                
                // 如果未展开，则点击展开
                if (isExpanded === 'false') {
                    await accordionHeader.click();
                    await this.okxPage.waitForTimeout(1000);
                }
                
                // 使用更精确的选择器定位指定账户
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

    async unlock() {
        try {
            if(!process.env.OKXWALLETPASSWORD) {   
                process.env.OKXWALLETPASSWORD = await parseToken(process.env.okxWalletPassword);
            }
            await this.okxPage.goto(this.unlockUrl);
            await this.okxPage.waitForTimeout(3000);
            if (this.okxPage.url() == this.unlockUrl) {
                const isExist = await this.isElementExist('input[placeholder="请输入密码"]',  { waitTime: 5, page: this.okxPage})
                console.log(isExist)
                if (isExist) {
                    await this.okxPage.locator('input[placeholder="请输入密码"]').fill(process.env.OKXWALLETPASSWORD);
                    await this.okxPage.click('text="解锁"');
                    await this.okxPage.waitForTimeout(3000);
                } else {
                    await this.unlock();
                }
            }
        } catch (error) { console.log(error) }
    }
}