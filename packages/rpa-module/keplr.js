import fs from 'fs';
import 'dotenv/config';
import { BitBrowserUtil } from './bitbrowser.js';
import { By, until } from 'selenium-webdriver';
import { enCryptText, deCryptText } from '../crypt-module/crypt.js';
import { parseToken } from '../crypt-module/onepassword.js';

const keplrID = 'pchdmmkclkhmfmflbdgnildcgidfcghb';

export class KeplrUtil extends BitBrowserUtil {
    
    constructor(browserId) {
        super(browserId);
        this.homeUrl = `chrome-extension://${keplrID}/index.html#`
        this.unlockUrl = `chrome-extension://${keplrID}/index.html#/account/unlock`
        this.importUrl = `chrome-extension://${keplrID}/register.html#`
    }
    
    async createNewWallet(indexId, walletfile = 'cosmosWallets.csv'){
        try{
            if(!process.env.KEPLRPASSWORD) {                    
                process.env.KEPLRPASSWORD = await parseToken(process.env.keplrPassword);
            }
            await this.page.goto(this.importUrl)
            await this.page.waitForTimeout(1000)
            await this.page.locator('text=/(创建新钱包|Create a new wallet)/i').click()
            await this.page.locator('text=/(^创建新助记词$)/i').click()
            await this.page.waitForTimeout(2000)
            await this.page.locator('text=/(我知道了，显示我的助记词。 )/i').click()

            let mnemonicVariables = [];
            let mnemonic = '';
            for (let i = 1; i <= 12; i++) {
                const mnemonicValue = await this.page.locator(`//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/div[1]/div[3]/div/div/div[1]/div[${i}]/div[2]/div[2]/div/div/input`).getAttribute('value');
                mnemonicVariables.push(mnemonicValue);
                console.log(mnemonicValue)
                mnemonic += mnemonicValue;
                if(i<12){mnemonic += '';}
            }
            await this.page.locator('text=/(下一步)/i').click()

            const text1 = await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[4]/div/div/form/div[1]/div/div/div[1]/div[1]').textContent()        
            const parts1 = text1.split('#');
            if (parts1.length > 1) {
                const number = parts1[1].trim();
                const selectedMnemonic = mnemonicVariables[number - 1];
                // console.log(`mnemonic${number}: ${selectedMnemonic}`);
                await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[4]/div/div/form/div[1]/div/div/div[1]/div[2]/div[2]/div/div/input').fill(selectedMnemonic)
            }

            const text2 = await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[4]/div/div/form/div[1]/div/div/div[3]/div[1]').textContent()
            const parts2 = text2.split('#');
            if (parts2.length > 1) {
                const number = parts2[1].trim();
                const selectedMnemonic = mnemonicVariables[number - 1];
                // console.log(`mnemonic${number}: ${selectedMnemonic}`);
                await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[4]/div/div/form/div[1]/div/div/div[3]/div[2]/div[2]/div/div/input').fill(selectedMnemonic)
            }

            await this.page.waitForTimeout(500)
            await this.page.getByPlaceholder('例如：交易、NFT保险柜、投资').fill('account1')
            await this.page.locator('//input[@name="password"]').fill(process.env.KEPLRPASSWORD)
            await this.page.locator('//input[@name="confirmPassword"]').fill(process.env.KEPLRPASSWORD)
            await this.page.waitForTimeout(500)
            await this.page.locator('//button[@type="submit"]').click()
            await this.page.waitForTimeout(500)
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div/div/div/div[7]/div').click()
            await this.page.waitForTimeout(500)
            await this.page.locator('text=/(保存)/i').click()
            await this.page.waitForTimeout(500)
            await this.page.locator('text=/(完成)/i').click()
        
            const enCosmosMnemonic = await enCryptText(mnemonic);

            // 判断文件是否存在
            if (!fs.existsSync(walletfile)) {
                // 文件不存在则创建文件并写入标题行
                const header = 'index_id,cosmos_wallet,tia_wallet,dym_main_wallet,dym_eth_wallet,cosmos_enMnemonic\n';
                fs.writeFileSync(walletfile, header);
            }
            const file = fs.openSync(walletfile, 'a');
            const rowData = `${indexId},,,,,${enCosmosMnemonic}\n`
            // 文件存在则追加,不存在则创建
            fs.appendFileSync(file, rowData);  
        }catch(error){console.log(error)}
    }

  

    async importByMnemonic(enMnemonic) {
        const mnemonic = await deCryptText(enMnemonic)
        const mnemonics = mnemonic.split(' ')
        if(!process.env.KEPLRPASSWORD) {                    
            process.env.KEPLRPASSWORD = await parseToken(keplrPassword);
        }
        try{
            await this.page.waitForTimeout(3000)
            await this.page.goto(this.importUrl)
            await this.page.waitForTimeout(3000)
            await this.page.locator('text=/(导入已有钱包)/i').click()
            await this.page.locator('text=/(^使用助记词或私钥$)/i').click()

            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[1]/div[2]/div[2]/div/div/input').fill(mnemonics[0])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[2]/div[2]/div[2]/div/div/input').fill(mnemonics[1])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[3]/div[2]/div[2]/div/div/input').fill(mnemonics[2])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[4]/div[2]/div[2]/div/div/input').fill(mnemonics[3])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[5]/div[2]/div[2]/div/div/input').fill(mnemonics[4])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[6]/div[2]/div[2]/div/div/input').fill(mnemonics[5])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[7]/div[2]/div[2]/div/div/input').fill(mnemonics[6])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[8]/div[2]/div[2]/div/div/input').fill(mnemonics[7])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[9]/div[2]/div[2]/div/div/input').fill(mnemonics[8])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[10]/div[2]/div[2]/div/div/input').fill(mnemonics[9])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[11]/div[2]/div[2]/div/div/input').fill(mnemonics[10])
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div[3]/div/div/form/div[3]/div/div/div[1]/div[12]/div[2]/div[2]/div/div/input').fill(mnemonics[11])
          
            await this.page.waitForTimeout(500)
            await this.page.getByRole('button', { name: '导入', exact: true }).click()
            await this.page.waitForTimeout(500)
            await this.page.getByPlaceholder('例如：交易、NFT保险柜、投资').fill('account1')
            await this.page.locator('//input[@name="password"]').fill(process.env.KEPLRPASSWORD)
            await this.page.locator('//input[@name="confirmPassword"]').fill(process.env.KEPLRPASSWORD)
            await this.page.waitForTimeout(500)
            await this.page.locator('text=/(下一步)/i').click()
            await this.page.waitForTimeout(500)
            await this.page.locator('//*[@id="app"]/div/div[2]/div/div/div/div/div/div[7]/div').click()
            await this.page.waitForTimeout(500)
            await this.page.locator('text=/(保存)/i').click()
            await this.page.waitForTimeout(500)
            await this.page.locator('text=/(完成)/i').click()
        }catch(error){console.log(error)}
    }

    async unlock() {
        if(!process.env.UNISATPASSWORD) {                    
            process.env.UNISATPASSWORD = await parseToken(unisatPassword);
        }
        
        await this.page.goto(this.homeUrl, { waitUntil:'networkidle', timeout:30000 });
        await this.page.waitForTimeout(5000)
        if (this.page.url() === this.unlockUrl) {
            const isExist = await this.isElementExist('//input[@placeholder="Password"]', { waitTime:15, page: this.argentXPage })
            // console.log(isExist)
            if(isExist) {
                await this.page.locator('//input[@placeholder="Password"]').fill(process.env.UNISATPASSWORD); 
                await this.page.click('text="Unlock"');
                await this.page.waitForTimeout(2000);
            }
        }
    }


    async connectWallet(url, {hasConnectButton=true, connectButton='text=/(Connect|Connect Wallet?|Connect to Wallet|连接钱包|Login|join now)/i', hasCheckButton=false, checkButton='text=/(Unisat Wallet|Unisat)/i', waitTime=3}={}){
        await this.unlock();
        await this.page.goto(url)
        await this.page.waitForTimeout(waitTime*1000)
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
                // 等待元素变为可见并点击
                await this.driver.wait(until.elementLocated(By.xpath(`//div[text()='Connect']`)), 5000)
                    .then(element => this.driver.wait(until.elementIsVisible(element), 5000))
                    .then(element => element.click());
            }catch(error){console.log(error)}
        }

        await this.page.waitForTimeout(1000)
        status = await this.changeHandle()
        // console.log(`status: ${status}`)
        if(status){
            try{
                // 等待元素变为可见并点击
                await this.driver.wait(until.elementLocated(By.xpath(`//div[text()='Sign']`)), 5000)
                    .then(element => this.driver.wait(until.elementIsVisible(element), 5000))
                    .then(element => element.click());
            }catch(error){}
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