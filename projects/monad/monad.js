import axios from 'axios';
import { yesCaptchaClient, noCaptchaClient } from '../../packages/utils-module/captcha.js';
import { getOrCreateFingerprint } from './fingerprint.js';
import { myFormatData } from '../../packages/utils-module/formatdata.js';

function generateVisitorId(fingerprint) {
    // 收集指定的浏览器特征
    const features = {
        // 浏览器信息
        browser: {
            userAgent: fingerprint.fingerprint.navigator.userAgent,
            vendor: fingerprint.fingerprint.navigator.vendor,
            platform: fingerprint.fingerprint.navigator.platform,
            plugins: fingerprint.fingerprint.pluginsData.plugins
        },

        // 屏幕信息
        screen: {
            width: fingerprint.fingerprint.screen.width,
            height: fingerprint.fingerprint.screen.height,
            colorDepth: fingerprint.fingerprint.screen.colorDepth
        },

        // WebGL指纹
        webgl: fingerprint.fingerprint.videoCard,

        // 音频指纹
        audio: fingerprint.fingerprint.audioCodecs,

        // 字体检测
        fonts: fingerprint.fingerprint.fonts,

        // 存储支持
        storage: {
            localStorage: true,
            sessionStorage: true,
            indexedDB: true
        },

        // 时区
        timezone: fingerprint.fingerprint.timezone
    };

    // 将特征对象转换为字符串
    const featuresStr = JSON.stringify(features);

    // 使用murmurX64Hash128算法(从代码中提取的算法)
    const visitorId = murmurX64Hash128(featuresStr);

    // console.log('使用的指纹特征:', JSON.stringify(features, null, 2));
    // console.log('生成的visitorId:', visitorId);

    return visitorId;
}

// 从源代码提取的murmurX64Hash128算法
function murmurX64Hash128(str) {
    const k1 = [0x239b961b, 0xab0e9789];
    const k2 = [0x38b34ae5, 0xa1e38b93];

    function multiply64(a, b) {
        let result = [0, 0];
        result[0] = (a[0] * b[1] + a[1] * b[0]) >>> 0;
        result[1] = (a[1] * b[1]) >>> 0;
        return result;
    }

    function rotl64(a, b) {
        b %= 64;
        if (b === 32) {
            return [a[1], a[0]];
        } else if (b < 32) {
            return [
                (a[0] << b) | (a[1] >>> (32 - b)),
                (a[1] << b) | (a[0] >>> (32 - b))
            ];
        } else {
            b -= 32;
            return [
                (a[1] << b) | (a[0] >>> (32 - b)),
                (a[0] << b) | (a[1] >>> (32 - b))
            ];
        }
    }

    function xor64(a, b) {
        return [a[0] ^ b[0], a[1] ^ b[1]];
    }

    let h1 = [0, 0];
    let h2 = [0, 0];

    // 将字符串转换为UTF-8字节数组
    const data = new TextEncoder().encode(str);
    const blocks = Math.floor(data.length / 16);

    // 处理完整的16字节块
    for (let i = 0; i < blocks; i++) {
        let k = [
            (data[i * 16 + 3] << 24) | (data[i * 16 + 2] << 16) | (data[i * 16 + 1] << 8) | data[i * 16],
            (data[i * 16 + 7] << 24) | (data[i * 16 + 6] << 16) | (data[i * 16 + 5] << 8) | data[i * 16 + 4]
        ];

        k = multiply64(k, k1);
        k = rotl64(k, 31);
        k = multiply64(k, k2);

        h1 = xor64(h1, k);
        h1 = rotl64(h1, 27);
        h1 = multiply64(h1, k1);
        h1[0] = (h1[0] + h2[0]) >>> 0;
        h1[1] = (h1[1] + h2[1]) >>> 0;
        h1 = [(h1[0] * 5 + 0x52dce729) >>> 0, (h1[1] * 5 + 0x38495ab5) >>> 0];
    }

    // 处理剩余字节
    const tail = data.slice(blocks * 16);
    if (tail.length > 0) {
        let k = [0, 0];
        for (let i = 0; i < tail.length && i < 16; i++) {
            if (i < 8) {
                k[0] |= tail[i] << (i * 8);
            } else {
                k[1] |= tail[i] << ((i - 8) * 8);
            }
        }

        k = multiply64(k, k1);
        k = rotl64(k, 31);
        k = multiply64(k, k2);
        h1 = xor64(h1, k);
    }

    // 最终混淆
    h1[0] ^= data.length;
    h1[1] ^= data.length;
    h2[0] ^= data.length;
    h2[1] ^= data.length;

    h1 = multiply64(h1, k1);
    h2 = multiply64(h2, k2);

    h1 = rotl64(h1, 27);
    h2 = rotl64(h2, 31);

    h1 = multiply64(h1, k2);
    h2 = multiply64(h2, k1);

    return (
        ('00000000' + h1[0].toString(16)).slice(-8) +
        ('00000000' + h1[1].toString(16)).slice(-8) +
        ('00000000' + h2[0].toString(16)).slice(-8) +
        ('00000000' + h2[1].toString(16)).slice(-8)
    );
}

async function getCaptchaToken(serviceName, websiteKey) {
    try {
        const websiteURL = 'https://testnet.monad.xyz/';
        switch (serviceName.toLowerCase()) {
            case 'yescaptcha':
                return await yesCaptchaClient.verifyWebsite({
                    captchaType: 'recaptchaV2',
                    taskVariant: 'universal',
                    websiteKey,
                    websiteURL,
                });

            case 'nocaptcha':
                return await noCaptchaClient.verifyWebsite({
                    captchaType: 'recaptcha',
                    taskVariant: 'universal',
                    sitekey: websiteKey,
                    referer: websiteURL,
                    title: "Monad Testnet: Test, Play and Build on Monad Testnet",
                    size: 'normal',
                });
            default:
                throw new Error(`不支持的验证码服务: ${serviceName}`);
        }
    } catch (error) {
        console.error(`${serviceName} 验证失败:`, error.message);
        throw error;
    }
}

async function faucet({ number, address, reuse = true, serviceName, websiteKey }) {
    try {
        console.log(`第${number}个账号，地址 ${address} 开始领水`)
        // 加载指纹文件
        const fingerprint = await getOrCreateFingerprint(number, reuse);
        // 生成访客ID
        const visitorId = generateVisitorId(fingerprint);
        const recaptchaToken = await getCaptchaToken(serviceName, websiteKey);
        await axios.post('https://testnet.monad.xyz/api/claim', {
            address,
            recaptchaToken,
            visitorId
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('领水错误:', error.response?.data || error.message);
    }
}

const main = async (...inputs) => {
    try {
        const data = await myFormatData(...inputs);
        for (const d of data) {
            await faucet({
                number: d['indexId'], // 账号索引
                address: d['ethAddress'], // 账号地址
                reuse: true, // 是否重用指纹
                serviceName: 'nocaptcha', // 验证码服务名称
                websiteKey: "6LcItOMqAAAAAF9ANohQEN4jGOjHRxU8f5MNJZHu" // 验证码网站密钥
            })
        }
    } catch (error) {
        console.error(error);
    }
};

main(1);