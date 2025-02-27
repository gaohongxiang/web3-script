import axios from 'axios';
import { yesCaptchaClient } from '../../packages/utils-module/captcha.js';
import { SocksProxyAgent } from 'socks-proxy-agent';

async function getCaptchaToken(serviceName) {
    try {
        const websiteURL = 'https://faucet.saharalabs.ai/';
        const websiteKey = '0x4AAAAAAA8hNPuIp1dAT_d9';
        switch (serviceName.toLowerCase()) {
            case 'yescaptcha':
                return await yesCaptchaClient.verifyWebsite({
                    captchaType: 'CloudflareTurnstile',
                    taskVariant: 'standard',
                    websiteKey,
                    websiteURL,
                });
            default:
                throw new Error(`不支持的验证码服务: ${serviceName}`);
        }
    } catch (error) {
        console.error(`${serviceName} 验证失败:`, error.message);
        throw error;
    }
}

// 注意eth主网余额 >=0.01eth 才能领到水
export async function faucet({ number, address, serviceName, proxy }) {
    try {
        console.log(`第${number}个账号，地址 ${address} 开始领水`)

        // 创建代理配置
        const agent = proxy ? new SocksProxyAgent(proxy) : null;

        const recaptchaToken = await getCaptchaToken(serviceName);
        await axios.post('https://faucet-api.saharaa.info/api/claim2', {
            address,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'cf-turnstile-response': recaptchaToken
            },
            httpsAgent: agent, // HTTPS代理
        });
        console.log(`第${number}个账号，地址 ${address} 领水成功`)
    } catch (error) {
        console.error('领水错误:', error.response?.data || error.message);
    }
}