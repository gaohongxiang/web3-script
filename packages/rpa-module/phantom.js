import fs from 'fs';
import 'dotenv/config';
import { BitBrowserUtil } from './bitbrowser.js';
import { By, until } from 'selenium-webdriver';
import { enCryptText } from '../crypt-module/crypt.js';
import { parseToken } from '../crypt-module/onepassword.js';

const phantomID = 'hllcbhiiebohplnhonnmmhmbppoaegcn'

export class PhantomUtil extends BitBrowserUtil {
    
    constructor(browserId) {
        super(browserId);
        this.homeUrl = `chrome-extension://${phantomID}/index.html#`
        this.unlockUrl = `chrome-extension://${phantomID}/index.html#/account/unlock`
        this.importUrl = `chrome-extension://${phantomID}/onboarding.html`
    }
    
    async createNewWallet(indexId, walletfile = 'solWallets.csv'){
        if(!process.env.PHANTOMPASSWORD) {                    
            process.env.PHANTOMPASSWORD = await parseToken(process.env.phantomPassword);
        }
        await this.page.goto(this.importUrl)
        await this.page.waitForTimeout(1000)
        await this.page.getByTestId('create-wallet-button').click()
        await this.page.waitForTimeout(1000)
        try{
            await this.page.getByTestId('onboarding-form-password-input').fill(process.env.PHANTOMPASSWORD)
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('onboarding-form-confirm-password-input').fill(process.env.PHANTOMPASSWORD)
            await this.page.waitForTimeout(500)
            const status = await this.page.getByTestId('onboarding-form-terms-of-service-checkbox').isChecked()
            if(!status){
                await this.page.getByTestId('onboarding-form-terms-of-service-checkbox').click()
            }
            await this.page.waitForTimeout(500)
            await this.page.getByTestId('onboarding-form-submit-button').click()
            await this.page.waitForTimeout(1000)
        }catch(error){}

        await this.page.waitForTimeout(1000)
        // 获取屏幕的宽度和高度
        const screenWidth = await this.page.evaluate(() => window.screen.width);
        const screenHeight = await this.page.evaluate(() => window.screen.height);
        // 计算屏幕中央的坐标
        const centerX = Math.floor(screenWidth / 2);
        const centerY = Math.floor(screenHeight / 2);
        await this.page.mouse.move(centerX, centerY);
        await this.page.waitForTimeout(1000)
        
        const mnemonic1 = await this.page.getByTestId('secret-recovery-phrase-word-input-0').getAttribute('value')
        const mnemonic2 = await this.page.getByTestId('secret-recovery-phrase-word-input-1').getAttribute('value')
        const mnemonic3 = await this.page.getByTestId('secret-recovery-phrase-word-input-2').getAttribute('value')
        const mnemonic4 = await this.page.getByTestId('secret-recovery-phrase-word-input-3').getAttribute('value')
        const mnemonic5 = await this.page.getByTestId('secret-recovery-phrase-word-input-4').getAttribute('value')
        const mnemonic6 = await this.page.getByTestId('secret-recovery-phrase-word-input-5').getAttribute('value')
        const mnemonic7 = await this.page.getByTestId('secret-recovery-phrase-word-input-6').getAttribute('value')
        const mnemonic8 = await this.page.getByTestId('secret-recovery-phrase-word-input-7').getAttribute('value')
        const mnemonic9 = await this.page.getByTestId('secret-recovery-phrase-word-input-8').getAttribute('value')
        const mnemonic10 = await this.page.getByTestId('secret-recovery-phrase-word-input-9').getAttribute('value')
        const mnemonic11 = await this.page.getByTestId('secret-recovery-phrase-word-input-10').getAttribute('value')
        const mnemonic12 = await this.page.getByTestId('secret-recovery-phrase-word-input-11').getAttribute('value')
        
        const mnemonic = mnemonic1 + ' ' + mnemonic2 + ' ' + mnemonic3 + ' ' + mnemonic4 + ' ' + mnemonic5 + ' ' + mnemonic6 + ' ' + mnemonic7 + ' ' + mnemonic8 + ' ' + mnemonic9 + ' ' + mnemonic10 + ' ' + mnemonic11 + ' ' + mnemonic12
        // console.log(mnemonic)
        const enSolMnemonic = await enCryptText(mnemonic)
        const status = await this.page.getByTestId('onboarding-form-saved-secret-recovery-phrase-checkbox').isChecked()
        if(!status){
            await this.page.getByTestId('onboarding-form-saved-secret-recovery-phrase-checkbox').click()
        }
        await this.page.getByTestId('onboarding-form-submit-button').click()
        await this.page.waitForTimeout(1000)
        await this.page.getByTestId('onboarding-form-submit-button').click()

        // 判断文件是否存在
        if (!fs.existsSync(walletfile)) {
            // 文件不存在则创建文件并写入标题行
            const header = 'index_id,enSolMnemonic\n';
            fs.writeFileSync(walletfile, header);
        }
        const file = fs.openSync(walletfile, 'a');
		const rowData = `${indexId},${enSolMnemonic}\n`
        // 文件存在则追加,不存在则创建
		fs.appendFileSync(file, rowData);  

    }

    async connectWallet(url,{hasConnectButton=true, connectButton='text=/(Connect|Connect Wallet|Connect to Wallet|连接钱包|Login)/i', hasCheckButton=false, checkButton='text=/(Phantom)/i', waitTime=3}={}){
        if(!process.env.PHANTOMPASSWORD) {                    
            process.env.PHANTOMPASSWORD = await parseToken(process.env.phantomPassword);
        }
        await this.page.goto(url)
        if(hasConnectButton){
            try{
                await this.page.waitForTimeout(500)
                await this.page.waitForSelector(connectButton, {timeout:10000}).then(element => { element.click() });
                await this.page.waitForTimeout(500)
            }catch(error){console.log(error)}
        }
        // 有些应用还需要先点一下checkbox才能选钱包。。。
        if(hasCheckButton){
            try{
                await this.page.waitForTimeout(500)
                await this.page.waitForSelector(checkButton, {timeout:6000}).then(element => { element.click() });
                await this.page.waitForTimeout(500)
            }catch(error){console.log(error)}
        }

        let status = await this.changeHandle()
        // console.log(`status: ${status}`)
        if(status){
            try{
                await this.driver.wait(until.elementLocated(By.xpath('//form[@id="unlock-form"]/div/div[2]/div/input')), 5000)
                    .then(element => this.driver.wait(until.elementIsVisible(element), 5000))
                    .then(element => element.sendKeys(process.env.PHANTOMPASSWORD));
                await this.driver.wait(until.elementLocated(By.xpath('//button[text()="解锁"]')), 5000)
                    .then(element => this.driver.wait(until.elementIsVisible(element), 5000))
                    .then(element => element.click());
            }catch{}
            try{
                await this.driver.wait(until.elementLocated(By.xpath('//button[text()="连接"]')), 5000)
                    .then(element => this.driver.wait(until.elementIsVisible(element), 5000))
                    .then(element => element.click());
            }catch{}
        }
        
    }

    async executeTransaction(selector, { page='', isElementhadle=false, isConfirmPage=false, confirmButton='text=/(^Confirm Swap%$)/', canEditGas=true, gasLimitRate=0.5 }={}) {
        try{
            if (!page){ page = this.page } 
            try{
                await page.waitForTimeout(3000)
                if(isElementhadle){
                    await selector.click()
                }else{
                    await page.waitForSelector(selector, {timeout:10000}).then(element => { element.click() });
                }
                await page.waitForTimeout(2000)
            }catch(error){console.log(error)}
            
            // 有些应用会多一个确认页面
            if (isConfirmPage) {
                try{
                    await page.waitForSelector('text=/(^Accept%$)/', {timeout:1000}).then(element => { element.click() });
                }catch(error){}
                try{
                    await page.waitForTimeout(2000)
                    await page.waitForSelector(confirmButton, {timeout:5000}).then(element => { element.click() });
                }catch(error){console.log(error)}
            }
            await page.waitForTimeout(5000)

            const element = await this.argentXPage.$('text=/(^Confirm$)/');
            while(true){
                let i = 1
                // 等待元素可用（包括可点击）
                const isEnabled = await element.isEnabled();
                console.log(isEnabled)
                if(isEnabled){
                    await element.click()
                    break
                }
                await this.argentXPage.waitForTimeout(10000)
                // 等待太久退出
                i++
                if(i > 8){break}
            }
            // 将page页面带到前台
            await page.bringToFront()
            // 等待确认
            await page.waitForTimeout(10000)
        }catch(error){console.log(error)}
    }
}