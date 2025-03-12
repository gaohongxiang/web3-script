import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { withRetry } from '../../packages/utils-module/retry.js';
import { captchaManager } from '../../packages/utils-module/captcha.js';
import { notificationManager } from '../../packages/notification-module/notification.js';

// 注意eth主网余额 >=0.01eth 才能领到水
export async function faucet({ chromeNumber, address, httpProxyUrl, fingerprint }) {
    try {

        notificationManager.info({
            message: `saharaAi开始领水`,
            context: {
                "账号": chromeNumber,
                "地址": address,
            }
        });
        // 创建 HTTP 代理实例
        const agent = new HttpsProxyAgent(httpProxyUrl);

        const recaptchaToken = await captchaManager.verifyWebsite({
            captchaService: 'capSolver',
            captchaType: 'CloudflareTurnstile',
            taskVariant: 'standard',
            websiteURL: 'https://faucet.saharalabs.ai/',
            websiteKey: '0x4AAAAAAA8hNPuIp1dAT_d9'
        });;
        if (!recaptchaToken) { console.log('验证码获取失败'); return false; }

        await withRetry(
            async () => {
                const response = await axios.post('https://faucet-api.saharaa.info/api/claim2',
                    { address },
                    {
                        headers: {
                            'accept': '*/*',
                            'accept-language': 'en-US,en;q=0.9',
                            'content-type': 'application/json',
                            'cf-turnstile-response': recaptchaToken,
                            'origin': 'https://faucet.saharalabs.ai',
                            'priority': 'u=1, i',
                            'referer': 'https://faucet.saharalabs.ai/',
                            'sec-ch-ua': fingerprint.headers['sec-ch-ua'],
                            'sec-ch-ua-mobile': '?0',
                            'sec-ch-ua-platform': 'macOS',
                            'sec-fetch-dest': 'empty',
                            'sec-fetch-mode': 'cors',
                            'sec-fetch-site': 'cross-site',
                            'user-agent': fingerprint.userAgent
                        },
                        httpsAgent: agent,
                        timeout: 30000
                    }
                );

                if (response.status === 200) {
                    notificationManager.success({
                        "message": `saharaAi领水成功`,
                        "context": {
                            "账号": chromeNumber,
                            "地址": address,
                        }
                    });
                    return true;
                }
            },
            {
                maxRetries: 5,
                delay: 2000,
                taskName: 'saharaAi领水',
            }
        );
    } catch (error) {
        notificationManager.error({
            "message": `saharaAi领水失败`,
            "context": {
                "账号": chromeNumber,
                "地址": address,
                "错误": error.message
            }
        });
    }
}