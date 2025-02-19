import fs from 'fs';
import 'dotenv/config';
import clipboardy from 'clipboardy'; //访问系统剪贴板（复制/粘贴）
import { BitBrowserUtil } from './bitbrowser.js';
import { By, until } from 'selenium-webdriver';
import { enCryptText, deCryptText } from '../../crypt-module/crypt.js';
import { parseToken } from '../../crypt-module/onepassword.js';

const unisatID = 'hllcbhiiebohplnhonnmmhmbppoaegcn'

export class UnisatUtil extends BitBrowserUtil {
    
    constructor(browserId) {
        super(browserId);
        this.homeUrl = `chrome-extension://${unisatID}/index.html#`
        this.unlockUrl = `chrome-extension://${unisatID}/index.html#/account/unlock`
        this.importUrl = `chrome-extension://${unisatID}/index.html#/welcome`
    }
    
    async createNewWallet(indexId, walletfile = 'btcWallets.csv'){
        await this.page.goto(this.importUrl)
        await this.page.waitForTimeout(1000)
        await this.page.getByText('Create new wallet').click()
        await this.page.waitForTimeout(1000)
        try{
            if(!process.env.UNISATPASSWORD) {                    
                process.env.UNISATPASSWORD = await parseToken(process.env.unisatPassword);
            }
            await this.page.locator('input[type="password"]').nth(0).fill(process.env.UNISATPASSWORD)
            await this.page.waitForTimeout(500)
            await this.page.locator('input[type="password"]').nth(1).fill(process.env.UNISATPASSWORD)
            await this.page.waitForTimeout(500)
            // await this.page.locator('input[placeholder="Confirm Password"]').click(process.env.UNISATPASSWORD)
            // await this.page.waitForTimeout(500)
            await this.page.getByText('Continue').click()
            await this.page.waitForTimeout(1000)
        }catch(error){}
        await this.page.getByText('Copy to clipboard').click()
        await this.page.waitForTimeout(500)
        const btcMnemonic = await clipboardy.read();
        const enBtcMnemonic = await enCryptText(btcMnemonic);
        // console.log(enBtcMnemonic)
        await this.page.waitForTimeout(100)
        await this.page.getByText('I saved My Secret Recovery Phrase').click()
        await this.page.waitForTimeout(100)
        await this.page.getByText('Continue').click()
        await this.page.waitForTimeout(500)
        await this.page.getByText('Taproot (P2TR)').click()
        await this.page.waitForTimeout(100)
        await this.page.getByText('Continue').click()
        await this.page.waitForTimeout(3000)
        // // await this.page.locator('//span[text()="Taproot (P2TR)"]').click()
        
        await this.page.getByText('for Ordinals assets, ').click()
        await this.page.getByText('for Atomicals assets, ').click()
        await this.page.waitForTimeout(500)
        await this.page.getByText('OK').click()
        await this.page.waitForTimeout(1000)
        await this.page.locator('//*[@id="root"]/div[1]/div/div[2]/div/div[3]/div[1]/div').click()
        const trprootAddress = await clipboardy.read();
        // console.log(trprootAddress)
        await this.page.waitForTimeout(1000)
        await this.changeNetwork('TESTNET');
        await this.changeAddressType('Native Segwit (P2WPKH)');
        await this.page.goto('chrome-extension://hllcbhiiebohplnhonnmmhmbppoaegcn/index.html#/main')
        await this.page.waitForTimeout(1000)
        await this.page.locator('//*[@id="root"]/div[1]/div/div[2]/div/div[4]/div[1]/div').click()  
        const NativeSegwitAddress = await clipboardy.read();
        // console.log(NativeSegwitAddress)

        // 判断文件是否存在
        if (!fs.existsSync(walletfile)) {
            // 文件不存在则创建文件并写入标题行
            const header = 'index_id,btc_taprootAddress,btc_test_NativeSegwitAddress,enBtcMnemonic\n';
            fs.writeFileSync(walletfile, header);
        }
        const file = fs.openSync(walletfile, 'a');
		const rowData = `${indexId},${trprootAddress},${NativeSegwitAddress},${enBtcMnemonic}\n`
        // 文件存在则追加,不存在则创建
		fs.appendFileSync(file, rowData);  

    }

    async changeNetwork(network='LIVENET'){
        await this.page.goto('chrome-extension://hllcbhiiebohplnhonnmmhmbppoaegcn/index.html#/settings/network-type')
        await this.page.waitForTimeout(500)
        await this.page.getByText(`${network}`).click()
        await this.page.waitForTimeout(500)
    }

    async changeAddressType(network='Taproot'){
        await this.page.goto('chrome-extension://hllcbhiiebohplnhonnmmhmbppoaegcn/index.html#/settings/address-type')
        await this.page.waitForTimeout(500)
        await this.page.getByText(`${network}`).click()
        await this.page.waitForTimeout(500)
    }

    async importByMnemonic(enMnemonic) {
        const mnemonic = await deCryptText(enMnemonic)
        const mnemonics = mnemonic.split(' ')
        const password = await deCryptText(this.enPassword)
        try{
            await this.page.waitForTimeout(5000)
            await this.page.goto(this.homeUrl)
            await this.page.waitForTimeout(3000)
            await this.page.locator('//button[text()="Restore an existing wallet"]').click()
            await this.page.getByTestId('seed-input-0').fill(mnemonics[0])
            await this.page.getByTestId('seed-input-1').fill(mnemonics[1])
            await this.page.getByTestId('seed-input-2').fill(mnemonics[2])
            await this.page.getByTestId('seed-input-3').fill(mnemonics[3])
            await this.page.getByTestId('seed-input-4').fill(mnemonics[4])
            await this.page.getByTestId('seed-input-5').fill(mnemonics[5])
            await this.page.getByTestId('seed-input-6').fill(mnemonics[6])
            await this.page.getByTestId('seed-input-7').fill(mnemonics[7])
            await this.page.getByTestId('seed-input-8').fill(mnemonics[8])
            await this.page.getByTestId('seed-input-9').fill(mnemonics[9])
            await this.page.getByTestId('seed-input-10').fill(mnemonics[10])
            await this.page.getByTestId('seed-input-11').fill(mnemonics[11])
            await this.page.waitForTimeout(500)
            await this.page.locator('//button[text()="Continue"]').click()
            await this.page.waitForTimeout(500)
            await this.page.getByPlaceholder('Password', { exact: true }).fill(password)
            await this.page.getByPlaceholder('Repeat password').fill(password)
            await this.page.waitForTimeout(500)
            await this.page.locator('//button[text()="Continue"]').click()
            await this.page.waitForTimeout(30000)
            await this.page.locator('//button[text()="Finish"]').click()
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