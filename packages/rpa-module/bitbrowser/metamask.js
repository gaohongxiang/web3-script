import { BitBrowserUtil } from './bitbrowser.js';
import { deCryptText } from '../../crypt-module/crypt.js';

const metamaskID = 'nkbihfbeogaeaoehlefnkodbefgpgknn'

export class MetaMaskUtil extends BitBrowserUtil {
    
    constructor(browserId, enPassword) {
        super(browserId);
        this.enPassword = enPassword
        this.homeUrl = `chrome-extension://${metamaskID}/home.html#`
        this.initializeUrl = `chrome-extension://${metamaskID}/home.html#onboarding/welcome`
        this.unlockUrl = `chrome-extension://${metamaskID}/home.html#unlock`
        this.newAccountUrl = `chrome-extension://${metamaskID}/home.html#new-account`
        this.restoreUrl = `chrome-extension://${metamaskID}/home.html#restore-vault`
        this.privatekeyImportUrl = `chrome-extension://${metamaskID}/home.html#new-account/import`
        this.advancedSettingUrl = `chrome-extension://${metamaskID}/home.html#settings/advanced`
        this.chainlistUrl = 'https://chainlist.org/'
    }

    async firstImportByMnemonic() {
        try{
            const password = await deCryptText(this.enPassword)
            
            await this.page.goto(this.initializeUrl)
            await this.page.waitForTimeout(3000)
            if(this.page.url() !== this.initializeUrl){
                return
            }
            await this.page.locator('//input[@id="onboarding__terms-checkbox"]').click()
            await this.page.getByTestId('onboarding-import-wallet').click()
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('metametrics-i-agree').click()
            await this.page.waitForTimeout(500)
            const mnemonic = 'canal share close outer away ignore mutual alert fiber upon south garlic'
            const words = mnemonic.split(' ');
            // console.log(words)
            await this.page.locator('//input[@id="import-srp__srp-word-0"]').fill(words[0])
            await this.page.locator('//input[@id="import-srp__srp-word-1"]').fill(words[1])
            await this.page.locator('//input[@id="import-srp__srp-word-2"]').fill(words[2])
            await this.page.locator('//input[@id="import-srp__srp-word-3"]').fill(words[3])
            await this.page.locator('//input[@id="import-srp__srp-word-4"]').fill(words[4])
            await this.page.locator('//input[@id="import-srp__srp-word-5"]').fill(words[5])
            await this.page.locator('//input[@id="import-srp__srp-word-6"]').fill(words[6])
            await this.page.locator('//input[@id="import-srp__srp-word-7"]').fill(words[7])
            await this.page.locator('//input[@id="import-srp__srp-word-8"]').fill(words[8])
            await this.page.locator('//input[@id="import-srp__srp-word-9"]').fill(words[9])
            await this.page.locator('//input[@id="import-srp__srp-word-10"]').fill(words[10])
            await this.page.locator('//input[@id="import-srp__srp-word-11"]').fill(words[11])
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('import-srp-confirm').click()
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('create-password-new').fill(password)
            await this.page.getByTestId('create-password-confirm').fill(password)
            await this.page.getByTestId('create-password-terms').click()
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('create-password-import').click()
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('onboarding-complete-done').click()
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('pin-extension-next').click()
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('pin-extension-done').click()
            await this.page.waitForTimeout(500)
            try{
                await this.page.getByTestId('popover-close').click()
            }catch(error){console.log(error)}
        }catch(error){console.log(error)}
    }

    async importByPrivateKey(enPrivateKey, accountName) {
        try{
            const privateKey = await deCryptText(enPrivateKey)
            await this.page.goto(this.homeUrl)
            await this.page.waitForTimeout(1000)
            await this.page.getByTestId('account-menu-icon').click()
            await this.page.locator('//button[text()="导入账户"]').click()
            await this.page.locator('//input[@id="private-key-box"]').fill(privateKey)
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('import-account-confirm-button').click()
            await this.page.waitForTimeout(1000)
            await this.page.getByTestId('account-options-menu-button').click()
            await this.page.getByTestId('account-list-menu-details').click()
            await this.page.getByTestId('editable-label-button').click()
            await this.page.waitForTimeout(500)
            await this.page.getByPlaceholder('账户名称').fill(accountName)
            await this.page.waitForTimeout(500)
            await this.page.locator('//div[@data-testid="editable-input"]/following-sibling::button').click()
            await this.page.waitForTimeout(500)
            await this.page.locator('//button[@aria-label="关闭"]').click()
            // await this.page.getByTestId('popover-close').click()
            await this.page.waitForTimeout(2000)
        }catch(error){console.log(error)}
    }


    async unlock() {
        try{
            const password = await deCryptText(this.enPassword)
            await this.page.goto(this.unlockUrl);
            // await this.page.goto(this.unlockUrl, { waitUntil:'networkidle', timeout:10000 });
            await this.page.waitForTimeout(3000)
            // console.log(this.page.url())
            if (this.page.url() === this.unlockUrl) {
                const isExist = await this.isElementExist('#password', 7)
                console.log(isExist)
                if(isExist) {
                    await this.page.locator('#password').fill(password); 
                    await this.page.click('text="登录"');    
                    await this.page.waitForTimeout(5000);  
                } else {
                    await this.unlock();
                }
            }
        }catch(error){console.log(error)}
    }

    async changeChain(chain) {
        try{
            chain = chain.toLowerCase()
            await this.page.goto(this.homeUrl, { waitUntil:'networkidle', timeout:10000 })
            await this.page.waitForTimeout(1000)
            const chainButton = await this.page.locator('//button[@data-testid="network-display"]/p')
            let currentChain = await chainButton.textContent()
            currentChain = currentChain.toLowerCase()
            // console.log(currentChain)
            if (currentChain.includes(chain)) {
                return
            }
            await chainButton.click();
            await this.page.waitForTimeout(1000)
            // 打开‘显示测试网按钮’
            try{
                await this.page.waitForSelector('.toggle-button--off', {timeout:2000}).then(element => { element.click() });
            }catch(error){}
            try{
                const targetChain = await this.page.waitForSelector(`text=/(^${chain})/i`, {timeout:3000});
                await targetChain.click()
                // console.log(targetChain)
                try{
                    await this.page.waitForSelector('//button[text()="明白了"]', {timeout:3000}).then(element => { element.click() }); // 关闭提示
                    await this.page.waitForTimeout(1000)
                }catch(error){}
            }catch(error){
                console.log('没有要切换的链，去添加')
                // console.log(error)
                await this.addChain(chain)
            }
            await this.page.waitForTimeout(3000)
        }catch(error){console.log(error)}
    }

    async addChain(chain) {
        try{
            await this.page.goto(this.chainlistUrl);
            await this.page.waitForTimeout(2000)
            try{
                // 登录按钮
                await this.page.waitForSelector('text=/(^Connect Wallet$)/i', {timeout:5000}).then(element => { element.click() });
                await this.page.waitForTimeout(3000)
                const metamaskPage = await this.context.newPage()
                await metamaskPage.goto(this.homeUrl, {waitUntil:'networkidle', timeout:10000})
                try{
                    await this.page.waitForTimeout(3000)
                    await metamaskPage.waitForSelector('text=/(^下一步$|^next$)/i', {timeout:3000}).then(element => { element.click() });
                }catch(error) {console.log('不用点击下一步按钮')}
                await metamaskPage.waitForSelector('text=/(^连接$|^connect$)/i', {timeout:5000}).then(element => { element.click() });
                await this.page.waitForTimeout(2000)
                // 将page页面带到前台
                await metamaskPage.close()
            }catch(error){}
            await this.page.waitForTimeout(1000)
            await this.page.locator('//span[text()="Search Networks"]/following-sibling::input').fill(chain);
            await this.page.waitForTimeout(1000);
            //可能有多个。选第一个
            const eles = await this.page.$$('//button[text()="Add to Metamask"]')
            await eles[0].click()
            await this.page.waitForTimeout(3000);
            const metamaskPage = await this.context.newPage()
            await metamaskPage.goto(this.homeUrl, {waitUntil:'networkidle', timeout:10000})
            await this.page.waitForTimeout(3000)
            await metamaskPage.waitForSelector('text=/(^批准$)/i', {timeout:3000}).then(element => { element.click() });
            await this.page.waitForTimeout(1000)
            await metamaskPage.waitForSelector('text=/(^切换网络$)/i', {timeout:3000}).then(element => { element.click() });
            await this.page.waitForTimeout(2000)
            try{
                await metamaskPage.waitForSelector('//button[text()="明白了"]', {timeout:3000}).then(element => { element.click() }); // 关闭提示
                await this.page.waitForTimeout(1000)
            }catch(error){}
            await metamaskPage.close()
            await this.page.waitForTimeout(3000)
        }catch(error){console.log(error)}
    }

    async changeAccount(accountName='1撸毛') {
        try{
            // 切换到交互账户，比如撸毛账户、土狗账户
            await this.page.goto(this.homeUrl, { waitUntil:'networkidle', timeout:10000 })
            // 判断当前钱包是不是要用的那个，如果不是就切换到第二个钱包(默认用第二个钱包，是导入的)
            // 通过账户名来来判断。比如撸毛账户和土狗账户
            const text = await this.page.locator('//*[@data-testid="account-menu-icon"]/span/span[1]').textContent()
            if (text === accountName) {
                return
            }
            // 点击账户图标
            await this.page.locator('//*[@data-testid="account-menu-icon"]').click()
            // 搜索账户
            await this.page.getByPlaceholder('搜索账户').fill(accountName);
            // 点击账户
            await this.page.locator(`//*[text()="${accountName}"]`).click()
        }catch(error){console.log(error)}
    }

    async connectWallet(url, {chain='', accountName='1撸毛', hasAnime=false, hasNavigator=false, navigatorButton='text=/(close)/i', hasConnectButton=true, hasMetaMaskButton=true, connectButton='text=/(Connect Wallet?|连接钱包|Login|Connect)/i', checkButton='', metamaskButton='text=/(metamask|browser wallet|Ethereum Wallet)/i',signButton='', waitTime=5}) {
       /* 连接钱包
        * text=/(connect wallet?|连接钱包|Login)/i 匹配解析: ?表示前面的字符可有可无 i表示对大小写不敏感 |表示或者
        */
        await this.unlock();
        await this.changeAccount(accountName);
        // 有些应用不需要切换链
        // console.log(chain)
        if (chain != '') { await this.changeChain(chain) };
        await this.page.goto(url)
        await this.page.waitForTimeout(waitTime*1000)
        // 链接钱包
        // 是否第一次连接钱包。如果之前连接过钱包就没有这一步
        try{
            // 有些应用有开机动画，等他结束
            if(hasAnime) {
                await this.page.waitForTimeout(30000);
            }
            // 第一次使用时有些应用有导航页面，熟悉应用的。直接关闭.第二次就没有了，所以加个try/catch
            if(hasNavigator){
                try{
                    await this.page.waitForSelector(navigatorButton, {timeout:6000}).then(element => { element.click() });
                }catch(error){console.log(error)}
            }
            if(hasConnectButton){
                await this.page.waitForTimeout(2000)
                // 登录按钮
                await this.page.waitForSelector(connectButton, {timeout:10000}).then(element => { element.click() });
            }
            // 有些应用还需要先点一下checkbox才能选钱包。。。
            if(checkButton){
                try{
                    await this.page.waitForTimeout(1000)
                    await this.page.waitForSelector(checkButton, {timeout:6000}).then(element => { element.click() });
                    await this.page.waitForTimeout(1000)
                }catch(error){console.log(error)}
            }
            if(hasMetaMaskButton) {
                try{
                    // 选择钱包按钮
                    await this.page.waitForSelector(metamaskButton, {timeout:5000}).then(element => { element.click() });
                }catch(error) {console.log(error)}
            }
            
            // 有些应用连接完钱包需要再点击签名按钮才会弹出签名页面
            if(signButton){
                await this.page.waitForTimeout(1000)
                await this.page.waitForSelector(signButton, { timeout:waitTime*1000 }).then(element => { element.click() });
                // 等待钱包响应
                await this.page.waitForTimeout(waitTime)
            }
            // try{
            //     await this.page.waitForSelector(signButton, { timeout:waitTime*1000}).then(element => { element.click() });
            //     // 等待钱包响应
            //     await this.page.waitForTimeout(waitTime)
            // }catch(error) {
            //     console.log('签名按钮不正确或者不需要签名按钮')
            // }
            const metamaskPage = await this.context.newPage()
            await metamaskPage.goto(this.homeUrl)
            // await metamaskPage.goto(this.homeUrl, {waitUntil:'networkidle', timeout:10000})
            await this.page.waitForTimeout(1000)
            await metamaskPage.reload()
            const currentUrl = metamaskPage.url()
            // console.log(currentUrl)
            // url里有connect字符串代表连接账户。连接
            if (currentUrl.includes('connect')){
                try{
                    await metamaskPage.waitForSelector('text=/(^下一步$|^next$)/i', {timeout:3000}).then(element => { element.click() });
                }catch(error) {console.log('不用点击下一步按钮')}
                await metamaskPage.waitForSelector('text=/(^连接$|^connect$)/i', {timeout:5000}).then(element => { element.click() });
                await this.page.waitForTimeout(1000)
                // 有些应用连接完钱包需要再点击签名按钮才会弹出签名页面
                if(signButton){
                    await this.page.waitForSelector(signButton, { timeout:waitTime*1000}).then(element => { element.click() });
                    // 等待钱包响应
                    await this.page.waitForTimeout(waitTime)
                }
                await metamaskPage.reload({waitUntil:'networkidle', timeout:10000})
                await this.page.waitForTimeout(1000)

                const currentUrl = metamaskPage.url()
                // url里有confirm字符串代表签名。签名并关闭页面
                if (currentUrl.includes('confirm')) {
                    try{
                        await metamaskPage.waitForSelector('*[aria-label="向下滚动"]', {timeout:3000}).then(element => { element.click() });
                    }catch(error) {}
                    await metamaskPage.waitForSelector('text=/(^签名$|^sign$)/i', {timeout:3000}).then(element => { element.click() });
                    await this.page.waitForTimeout(1000)
                    metamaskPage.close()
                // 不需要签名，直接关闭页面
                }else if (currentUrl === this.homeUrl){
                    await metamaskPage.close()
                }      
            // url里有confirm字符串代表签名。签名并关闭页面
            }else if (currentUrl.includes('confirm')) {
                try{
                    await metamaskPage.waitForSelector('*[aria-label="向下滚动"]', {timeout:3000}).then(element => { element.click() });
                }catch(error) {}
                await metamaskPage.waitForSelector('text=/(^签名$|^sign$)/i', {timeout:3000}).then(element => { element.click() });
                await this.page.waitForTimeout(1000)
                await metamaskPage.close()
                // url没变化，说明连接好了。直接关闭页面
            }else if (currentUrl === this.homeUrl) {
                await metamaskPage.close()
            }
        }catch(error) {
            console.log(error)
            console.log('已连接，不需重复连接')
        }
    }

    async approve(selector, value, { canEditGas=true, isApprove=true, isSign=false, gasLimitRate=0.7, hasCheckPage=false }){
        // 有些代币是approve，有些是sign
        try{
            await this.page.waitForTimeout(1000)
            await this.page.waitForSelector(selector, {timeout:5000}).then(element => { element.click() });
            await this.page.waitForTimeout(2000)
            const metamaskPage = await this.page.context().newPage()
            await metamaskPage.goto(this.homeUrl, {wait_until:'networkidle', timeout:10000})
            await this.page.waitForTimeout(8000)
            await metamaskPage.reload()
            value = (Number(value) * 1.1).toFixed(3).toString()
            // console.log(value)
            // console.log(typeof(value))
            await metamaskPage.locator('#custom-spending-cap-input-value').fill(value)
            await metamaskPage.waitForTimeout(2000)
            await metamaskPage.waitForSelector('text=/(^下一步$|^next$)/i', {timeout:10000}).then(element => { element.click() });
            // 修改gas limit。设置为推荐的gasLimitRate倍
            if(canEditGas){
                try{
                    await metamaskPage.waitForTimeout(1000)
                    await metamaskPage.locator('//button[text()="编辑"]').nth(1).click() // 编辑
                    await metamaskPage.locator('//a[text()="编辑"]').click() // 编辑
                    let gasLimit = await metamaskPage.getByTestId('gas-limit-input').getAttribute('value')
                    await metamaskPage.waitForTimeout(500)
                    gasLimit = Math.floor(gasLimit * gasLimitRate).toString()
                    await metamaskPage.getByTestId('gas-limit-input').fill(gasLimit)
                    await metamaskPage.waitForTimeout(1000)
                    await metamaskPage.locator('text=/(^保存$)/').click() // 保存
                    await metamaskPage.waitForTimeout(1000)
                }catch(error){console.log(error)}
            }
            if(isApprove){
                try{
                    await metamaskPage.waitForSelector('text=/(^批准$|^approve$)/i', {timeout:6000}).then(element => { element.click() });
                }catch(error){console.log(error)}
            }
            if(isSign){
                try{
                    await metamaskPage.waitForSelector('*[aria-label="向下滚动"]', {timeout:6000}).then(element => { element.click() });
                }catch(error) {}
                try{
                    await metamaskPage.waitForSelector('text=/(^签名$|^sign$)/i', {timeout:6000}).then(element => { element.click() });
                }catch(error){console.log(error)}
            }
            // 等待授权完成
            await metamaskPage.waitForTimeout(6000)
            await metamaskPage.close()
            if(hasCheckPage) {
                await this.page.click('body', { position: { x: 50, y: 300 } });
            }
        }catch(error){
            console.log(error)
        }
    }

    async executeTransaction(selector, { confirmPage=false, canEditGas=true, gasLimitRate=0.5 }) {
        try{
            try{
                await this.page.waitForTimeout(3000)
                await this.page.waitForSelector(selector, {timeout:10000}).then(element => { element.click() });
                await this.page.waitForTimeout(2000)
            }catch(error){console.log(error)}
            
            // 有些应用会多一个确认页面
            if (confirmPage) {
                try{
                    await this.page.waitForSelector('text=/(^Accept%$)/', {timeout:1000}).then(element => { element.click() });
                }catch(error){}
                await this.page.waitForSelector('text=/(^Confirm Swap%$)/', {timeout:5000}).then(element => { element.click() });
            }
            await this.page.waitForTimeout(1000)
            const metamaskPage = await this.context.newPage()
            await metamaskPage.goto(this.homeUrl, {wait_until:'networkidle', timeout:10000})
            await metamaskPage.waitForTimeout(8000)
            await metamaskPage.reload()
            // 修改gas limit。设置为推荐的gasLimitRate倍。两种页面。
            if(canEditGas){
                try{
                    await metamaskPage.waitForTimeout(1000)
                    await metamaskPage.waitForSelector('text=/(^建议的网站$)/', {timeout:6000}).then(element => { element.click() }); // 建议的网站
                    await metamaskPage.locator('//span[text()="高级"]').click() // 高级
                    await metamaskPage.locator('//a[text()="编辑"]').click() // 编辑
                    let gasLimit = await metamaskPage.getByTestId('gas-limit-input').getAttribute('value')
                    gasLimit = Math.round(gasLimit * gasLimitRate).toString()
                    await metamaskPage.waitForTimeout(500)
                    await metamaskPage.getByTestId('gas-limit-input').fill(gasLimit)
                    await metamaskPage.waitForTimeout(500)
                    await metamaskPage.locator('text=/(^保存$)/').click() // 保存
                    await metamaskPage.waitForTimeout(500)
                }catch(error){console.log(error)}
                try{
                    // 等待gas区域闪烁完毕
                    await metamaskPage.waitForTimeout(5000)
                    await metamaskPage.waitForSelector('//div[@class="transaction-detail-edit"]/button', {timeout:6000}).then(element => { element.click() }); // 编辑
                    await metamaskPage.locator('text=/(^编辑建议的燃料费$)/').click() // 编辑建议的燃料费
                    const gasLimitEle = await metamaskPage.locator('//h6[text()="燃料上限"]/../../following-sibling::div/input')
                    let gasLimit = await gasLimitEle.getAttribute('value') 
                    gasLimit = Math.floor(gasLimit * gasLimitRate).toString()
                    await metamaskPage.waitForTimeout(500)
                    await gasLimitEle.fill(gasLimit)
                    await metamaskPage.waitForTimeout(500)
                    await metamaskPage.locator('text=/(^保存$)/').click() // 保存
                    await metamaskPage.waitForTimeout(500)
                }catch(error){console.log(error)}
            }
            await metamaskPage.locator('text=/(^确认$)/').click()
            // 等待确认
            await this.page.waitForTimeout(10000)
            await metamaskPage.close()
        }catch(error){console.log(error)}
    }
}