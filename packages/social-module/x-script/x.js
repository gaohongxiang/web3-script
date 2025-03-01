import { ChromeBrowserUtil } from "../../rpa-module/chrome/chromeBrowser/chromeBrowser.js";
import { getOTP } from "../../utils-module/otp.js";
import { generateRandomString, updateCsvFieldValueByMatch } from "../../utils-module/utils.js";

export class XUtil extends ChromeBrowserUtil {

    constructor(chromeNumber, proxy = null) {
        super(chromeNumber, proxy);
    }

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

    async changeLanguage() {
        try {
            await this.page.goto('https://x.com/settings/language', { timeout: 60000 });
            const selector = 'select#SELECTOR_1';
            // 等待下拉框出现
            await this.page.locator(selector).waitFor({state: 'visible', timeout: 5000});
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

    async changePassword({ oldPassword, csvFile, matchField = 'xUsername', matchValue, targetField = 'xPassword' }) {
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