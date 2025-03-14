import { generateUUID } from "../../packages/utils-module/utils.js";
import { captchaManager } from "../../packages/utils-module/captcha.js";
import { notificationManager } from "../../packages/notification-module/notification.js";
import axios from 'axios';
import { withRetry } from "../../packages/utils-module/retry.js";
import { SocksProxyAgent } from 'socks-proxy-agent';

export async function faucet({ chromeNumber, address, socksProxyUrl }) {
    try {
        notificationManager.info({
            message: `monad开始领水`,
            context: {
                "账号": chromeNumber,
                "地址": address,
            }
        });

        const href = 'https://testnet.monad.xyz/';
        const baseProxy = socksProxyUrl.replace(/^socks5:\/\//i, '');

        // vercel验证码
        // const { _vcrcs, extra } = await captchaManager.verifyWebsite({
        //     captchaService: 'noCaptcha',
        //     captchaType: 'vercel',
        //     taskVariant: 'universal',
        //     href,
        //     proxy: baseProxy,
        //     user_agent: fingerprint.userAgent,
        // });

        // CloudflareTurnstile验证码
        // const { token: cfToken, userAgent } = await captchaManager.verifyWebsite({
        //     captchaService: 'capSolver',
        //     captchaType: 'cloudflareTurnstile',
        //     taskVariant: 'standard',
        //     websiteURL: href,
        //     websiteKey: '0x4AAAAAAA-3X4Nd7hf3mNGx',
        // });

        // CloudflareTurnstile验证码
        const { token: cfToken, extra } = await captchaManager.verifyWebsite({
            captchaService: 'noCaptcha',
            captchaType: 'cloudflareTurnstile',
            taskVariant: 'universal',
            href,
            sitekey: '0x4AAAAAAA-3X4Nd7hf3mNGx',
            proxy: baseProxy
        });

        const headers = {
            ...extra,
            "accept": "*/*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "zh-CN,zh;q=0.9",
            "content-type": "application/json",
            "origin": "https://testnet.monad.xyz",
            "priority": "u=1, i",
            "referer": "https://testnet.monad.xyz/",
        }
            
        // const headers = {
        //     "accept": "*/*",
        //     "accept-encoding": "gzip, deflate, br, zstd",
        //     "accept-language": "zh-CN,zh;q=0.9",
        //     // "accept-language": extra["accept-language"],
        //     "content-type": "application/json",
        //     "origin": "https://testnet.monad.xyz",
        //     "priority": "u=1, i",
        //     "referer": "https://testnet.monad.xyz/",
        //     "sec-ch-ua": fingerprint.headers["sec-ch-ua"],
        //     // "sec-ch-ua": extra["sec-ch-ua"],
        //     "sec-ch-ua-mobile": "?0",
        //     "sec-ch-ua-platform": "macOS",
        //     // "sec-ch-ua-platform": extra["sec-ch-ua-platform"],
        //     "sec-fetch-dest": "empty",
        //     "sec-fetch-mode": "cors",
        //     "sec-fetch-site": "same-origin",
        //     "user-agent": fingerprint.userAgent,
        //     // "user-agent": extra["user-agent"],
        //     // "cookie": `_vcrcs=${_vcrcs}`,
        // }

        const jsonData = {
            "address": address,
            "cloudFlareResponseToken": cfToken,
            "visitorId": generateUUID(false)
        }

        // tls接口
        // await captchaManager.verifyWebsite({
        //     captchaService: 'noCaptcha',
        //     captchaType: 'tls',
        //     taskVariant: 'universal',
        //     url: `${href}api/claim`,
        //     method: 'post',
        //     headers,
        //     proxy: baseProxy,
        //     json: jsonData,
        //     http2: true,
        //     timeout: 30,
        // });

        const result = await withRetry(
            async () => {
                // console.log('monad领水参数', jsonData);
                const response = await axios.post(`${href}api/faucet/claim`, jsonData, {
                    headers,
                    httpsAgent: new SocksProxyAgent(socksProxyUrl),
                });
                return response.data;
            },
            {
                message: 'monad领水',
                context: {
                    "账号": chromeNumber,
                    "地址": address,
                }
            }
        )

        notificationManager.success({
            message: `monad领水成功`,
            context: {
                "账号": chromeNumber,
                "地址": address,
                "结果": result,
            }
        });
    } catch (error) {
        notificationManager.error({
            message: `monad领水失败`,
            context: {
                "账号": chromeNumber,
                "地址": address,
                "错误": error,
            }
        });
    }
}