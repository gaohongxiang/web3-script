import 'dotenv/config';
import { ChromeBrowserUtil } from './chromeBrowser/chromeBrowser.js';
import { parseToken } from '../../crypt-module/onepassword.js';
import { deCryptText } from '../../crypt-module/crypt.js';

const okxWalletID = 'mcohilncbfahbmgdjkbpemcciiolgcge'

export class OkxWalletUtil extends ChromeBrowserUtil {
    /**
     * OKX钱包工具构造函数
     * @param {number} chromeNumber - Chrome实例编号
     */
    constructor(chromeNumber) {
        super(chromeNumber);
        this.okxPage = null;
        this.unlockUrl = `chrome-extension://${okxWalletID}/popup.html#/unlock`
        this.homeUrl = `chrome-extension://${okxWalletID}/popup.html#`
        this.importUrl = `chrome-extension://${okxWalletID}/popup.html#/import-with-seed-phrase-and-private-key`
        this.settingsUrl = `chrome-extension://${okxWalletID}/popup.html#/new-settings`
        this.editAccountUrl = `chrome-extension://${okxWalletID}/popup.html#/wallet/management-edit-page`
    }

    /**
     * 创建并初始化OKX钱包工具实例
     * @param {Object} params - 初始化参数
     * @param {number} params.chromeNumber - Chrome实例编号
     * @returns {Promise<OkxWalletUtil>} 初始化完成的实例
     */
    static async create({ chromeNumber }) {
        // 1. 调用父类的create方法初始化Chrome，使用父类默认的屏幕尺寸
        const instance = await super.create({ chromeNumber });
        
        // 2. 初始化OKX专用页面
        instance.okxPage = await instance.context.newPage();
        
        return instance;
    }

    async importByPrivateKey(enPrivateKey) {
        try {
            if (!process.env.OKXWALLETPASSWORD) {
                process.env.OKXWALLETPASSWORD = await parseToken(process.env.okxWalletPassword);
            }
            const privateKey = await deCryptText(enPrivateKey);
            await this.okxPage.goto(this.importUrl);
            await this.okxPage.waitForTimeout(3000);
            await this.okxPage.locator('text=/(^私钥$|^Private key$)/i').click();

            await this.okxPage.locator('textarea[data-testid="okd-input"][type="password"]').fill(privateKey);
            await this.okxPage.waitForTimeout(2000);
            await this.okxPage.locator('button[data-testid="okd-button"][type="submit"]').click();
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
            if (!process.env.OKXWALLETPASSWORD) {
                process.env.OKXWALLETPASSWORD = await parseToken(process.env.okxWalletPassword);
            }
            await this.okxPage.goto(this.unlockUrl);
            await this.okxPage.waitForTimeout(3000);
            if (this.okxPage.url() == this.unlockUrl) {
                const isExist = await this.isElementExist('input[placeholder="请输入密码"]', { waitTime: 5, page: this.okxPage })
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

    async connectWallet(url, {chain = '', accountName = '撸毛', hasAnime = false, hasNavigator = false, navigatorButton = 'text=/(close)/i', hasConnectButton = true, hasOkxButton = true, connectButton = 'text=/(Connect Wallet?|连接钱包|Sign in|Login|Lon in|Connect)/i', checkButton = '', okxButton = 'text=/(OKX|OKX Wallet|browser wallet|Ethereum Wallet)/i', signButton = '', waitTime = 5 } = {}) {
        /* 连接钱包
         * text=/(connect wallet?|连接钱包|Login)/i 匹配解析: ?表示前面的字符可有可无 i表示对大小写不敏感 |表示或者
         */
        await this.unlock();
        await this.changeAccount(accountName);
        await this.page.goto(url);
        await this.page.waitForTimeout(waitTime * 1000);
        // 链接钱包
        // 是否第一次连接钱包。如果之前连接过钱包就没有这一步
        try {
            // 有些应用有开机动画，等他结束
            if (hasAnime) {
                await this.page.waitForTimeout(30000);
            }
            // 第一次使用时有些应用有导航页面，熟悉应用的。直接关闭.第二次就没有了，所以加个try/catch
            if (hasNavigator) {
                try {
                    await this.page.waitForSelector(navigatorButton, { timeout: 6000 }).then(element => { element.click() });
                } catch (error) { console.log(error) }
            }
            if (hasConnectButton) {
                await this.page.waitForTimeout(2000)
                // 登录按钮
                await this.page.waitForSelector(connectButton, { timeout: 10000 }).then(element => { element.click() });
            }
            // 有些应用还需要先点一下checkbox才能选钱包。。。
            if (checkButton) {
                try {
                    await this.page.waitForTimeout(1000)
                    await this.page.waitForSelector(checkButton, { timeout: 6000 }).then(element => { element.click() });
                    await this.page.waitForTimeout(1000)
                } catch (error) { console.log(error) }
            }
            if (hasOkxButton) {
                try {
                    // 选择钱包按钮
                    await this.page.waitForSelector(okxButton, { timeout: 5000 }).then(element => { element.click() });
                } catch (error) { console.log(error) }
            }

            // // 有些应用连接完钱包需要再点击签名按钮才会弹出签名页面
            // if (signButton) {
            //     await this.page.waitForTimeout(1000)
            //     await this.page.waitForSelector(signButton, { timeout: waitTime * 1000 }).then(element => { element.click() });
            //     // 等待钱包响应
            //     await this.page.waitForTimeout(waitTime)
            // }
            await this.page.waitForTimeout(3000)
            await this.okxPage.reload()
            const currentUrl = this.okxPage.url()
            console.log('currentUrl', currentUrl)
            // url里有connect字符串代表连接账户。连接
            if (currentUrl.includes('connect')){
                await this.okxPage.waitForSelector('text=/(^连接$|^connect$)/i', {timeout:5000}).then(element => { element.click() });
                await this.page.waitForTimeout(1000)
                // 有些应用连接完钱包需要再点击签名按钮才会弹出签名页面
                if(signButton){
                    await this.page.waitForSelector(signButton, { timeout:waitTime*1000}).then(element => { element.click() });
                    // 等待钱包响应
                    await this.page.waitForTimeout(waitTime)
                }
                await this.okxPage.reload({waitUntil:'networkidle', timeout:10000})
                await this.page.waitForTimeout(1000)

                const currentUrl = this.okxPage.url()
                // url里有confirm字符串代表签名。签名并关闭页面
                if (currentUrl.includes('dapp-entry')) {
                    try{
                        await this.okxPage.waitForSelector('*[aria-label="向下滚动"]', {timeout:3000}).then(element => { element.click() });
                    }catch(error) {}
                    await this.okxPage.waitForSelector('text=/(^确认$|^confirm$)/i', {timeout:3000}).then(element => { element.click() });
                    await this.page.waitForTimeout(1000)
                }
            // url里有confirm字符串代表签名。签名并关闭页面
            }else if (currentUrl.includes('dapp-entry')) {
                try{
                    await this.okxPage.waitForSelector('*[aria-label="向下滚动"]', {timeout:3000}).then(element => { element.click() });
                }catch(error) {}
                await this.okxPage.waitForSelector('text=/(^确认$|^confirm$)/i', {timeout:3000}).then(element => { element.click() });
                await this.page.waitForTimeout(1000)
            }
        } catch (error) {
            console.log(error)
            console.log('已连接，不需重复连接')
        }
    }
}