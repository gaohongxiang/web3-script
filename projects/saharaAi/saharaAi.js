import { OkxWalletUtil } from '../../packages/rpa-module/chrome/okxWallet.js';
import { ethers } from 'ethers';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { deCryptText } from '../../packages/crypt-module/crypt.js';
import { maskValue } from '../../packages/utils-module/utils.js';
import { withRetry } from '../../packages/utils-module/retry.js';
import { notificationManager } from '../../packages/notification-module/notification.js';
import { GalxeClient } from '../../packages/social-module/galxe/galxe.js';


async function getWallet(enPrivateKey) {
    const rpcUrl = 'https://testnet.saharalabs.ai';
    const privateKey = await deCryptText(enPrivateKey);
    // 创建provider和wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    return wallet;
}
/**
 * 发送代币（支持ETH和ERC20代币）- 适用于ethers.js v6.13.3
 * @param {Object} options 发送选项
 * @param {string} options.rpcUrl RPC URL，例如 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY'
 * @param {string} options.privateKey 发送方私钥
 * @param {string} options.to 接收方地址
 * @param {string} options.amount 发送数量（以代币最小单位表示，如wei）
 * @param {bigint|number} options.gasLimit 可选，gas限制
 * @param {string} options.maxFeePerGas 可选，最大gas费用（以gwei为单位）
 * @param {string} options.maxPriorityFeePerGas 可选，最大优先费用（以gwei为单位）
 * @returns {Promise<string>} 交易哈希
*/
export async function sendToken(options) {
    const { chromeNumber, enPrivateKey, to, amount, gasLimit, maxFeePerGas, maxPriorityFeePerGas } = options;
    try {
        const wallet = await getWallet(enPrivateKey);

        const txOptions = {
            to,
            value: ethers.parseEther(amount)
        };

        // 添加可选参数
        if (gasLimit) txOptions.gasLimit = gasLimit;
        if (maxFeePerGas) txOptions.maxFeePerGas = ethers.parseUnits(maxFeePerGas, 'gwei');
        if (maxPriorityFeePerGas) txOptions.maxPriorityFeePerGas = ethers.parseUnits(maxPriorityFeePerGas, 'gwei');
        notificationManager.info(`第${chromeNumber}个账号 发送${amount}个sahara到${to}`);
        const tx = await wallet.sendTransaction(txOptions);
        // 等待交易被确认
        await tx.wait();
        notificationManager.success(`第${chromeNumber}个账号 交易哈希: ${tx.hash}`);
        return tx.hash;
    } catch (error) {
        notificationManager.error(`第${chromeNumber}个账号 交易失败: ${error.message}`);
    }
}

export class SaharaAi {
    constructor(chromeNumber, socksProxyUrl, fingerprint) {
        this.chromeNumber = chromeNumber;
        this.proxy = new SocksProxyAgent(socksProxyUrl);
        this.fingerprint = fingerprint;
        this.authToken = null;
    }

    static async create({ chromeNumber, enPrivateKey, socksProxyUrl, fingerprint }) {
        // 1. 创建基础实例
        const instance = new this(chromeNumber, socksProxyUrl, fingerprint);

        // 2. 初始化钱包
        instance.wallet = await getWallet(enPrivateKey);
        instance.address = instance.wallet.address;
        instance.enPrivateKey = enPrivateKey;  // 保存加密的私钥，用于发送交易

        // 3. 设置全局上下文
        notificationManager.setGlobalContext({
            "账号": instance.chromeNumber,
            "地址": maskValue({ value: instance.address })
        });

        // 4. 初始化 GalxeClient
        instance.galxeClient = await GalxeClient.create({
            chromeNumber,
            enPrivateKey,
            socksProxyUrl,
            fingerprint
        });

        return instance;
    }

    // 生成随机请求ID
    getRandomRequestId() {
        return crypto.randomUUID();
    }

    // 获取请求头
    async getMainHeaders(isLogin = false) {
        // 如果不是登录请求且token无效，则重新登录
        if (!isLogin && !this.authToken) {
            await this.login();
        }

        const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'origin': 'https://legends.saharalabs.ai',
            'priority': 'u=1, i',
            'referer': 'https://legends.saharalabs.ai/',
            'sec-ch-ua': this.fingerprint.headers['sec-ch-ua'],
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': 'macOS',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': this.fingerprint.userAgent
        };

        if (!isLogin) {
            headers['authorization'] = `Bearer ${this.authToken}`;
        }

        return headers;
    }

    /**
     * 执行Galxe API请求
     * @param {Object} options - 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    async executeRequest({
        url,
        method = 'post',
        data,
        headers,
        message = '未命名任务',
        context = {}
    }) {
        const requestHeaders = headers || await this.getMainHeaders();

        return withRetry(
            async () => {
                const response = await axios({
                    method,
                    url: `https://legends.saharalabs.ai${url}`,
                    data,
                    headers: requestHeaders,
                    httpsAgent: this.proxy
                });

                // 检查错误
                if (response.data?.errors?.length > 0) {
                    throw new Error(response.data.errors[0].message);
                }
                return response.data;
            },
            {
                maxRetries: 3,
                delay: 2000,
                message,
                context // 直接传递额外的上下文
            }
        );
    }

    async getChallenge() {

        const requestData = {
            "address": this.address,
            "timestamp": Date.now(),
        }
        const result = await this.executeRequest({
            url: '/api/v1/user/challenge',
            headers: await this.getMainHeaders(true),
            data: requestData,
            message: '获取Challenge',
        });

        if (result?.challenge) {
            // notificationManager.success({
            //     "message": "获取Challenge成功",
            //     "context": {
            //         "Challenge": result.challenge
            //     }
            // });
            return result.challenge;
        }
        return false;
    }

    async login() {
        const challenge = await this.getChallenge();
        // 构造签名消息
        const message = [
            'Sign in to Sahara!',
            `Challenge:${challenge}`,
        ].join('\n');

        // 签名消息
        const signature = await this.wallet.signMessage(message);

        const requestData = {
            "address": this.address,
            "sig": signature,
            "timestamp": Date.now(),
            "walletName": "OKX Wallet",
            "walletUUID": this.getRandomRequestId()
        }
        const result = await this.executeRequest({
            url: '/api/v1/login/wallet',
            headers: await this.getMainHeaders(true),
            data: requestData,
            message: '登录',
        });
        if (result?.accessToken) {
            this.authToken = result.accessToken;
            // notificationManager.success({
            //     "message": "登录成功",
            //     "context": {
            //         "token": result.accessToken
            //     }
            // });
        }
    }

    /**
     * 获取任务状态
     * @param {string} taskID - 任务ID
     * @returns {Promise<string>} 任务状态 (1=未做, 2=待claim, 3=已完成)
     */
    async getTaskStatusById(taskID) {
        const requestData = {
            "taskIDs": [taskID],
            "timestamp": Date.now(),
        }

        const result = await this.executeRequest({
            url: '/api/v1/task/dataBatch',
            data: requestData,
            message: '获取任务状态',
        });

        return result[taskID]?.status;
    }

    async flush(taskID) {
        const requestData = {
            "taskID": taskID,
            "timestamp": Date.now(),
        }
        await this.executeRequest({
            url: '/api/v1/task/flush',
            data: requestData,
            message: '刷新任务状态',
        });
    }

    async claim(taskID) {
        const requestData = {
            "taskID": taskID,
            "timestamp": Date.now(),
        }
        await this.executeRequest({
            url: '/api/v1/task/claim',
            data: requestData,
            message: '领取奖励',
        });
    }

    /**
     * 完成所有任务并领取奖励
     */
    async completeDailyTask() {
        const TASK_STATUS = {
            PENDING: '1',   // 未完成
            CLAIMABLE: '2', // 可领取
            COMPLETED: '3'  // 已完成
        };

        const TASK_INFO = {
            '1001': { type: 'galxe', name: 'Visit the Sahara AI blog', credId: '507361624877694976' },
            '1002': { type: 'galxe', name: 'Visit @SaharaLabsAI on X', credId: '505649247018811392' },
            '1004': { type: 'transaction', name: 'Generate at least one transaction on Sahara Testnet' }
        };

        notificationManager.info({
            message: "开始检查所有任务状态",
            context: { totalTasks: Object.keys(TASK_INFO).length }
        });

        for (const [currentTaskId, taskInfo] of Object.entries(TASK_INFO)) {
            // 获取任务状态
            let status = await this.getTaskStatusById(currentTaskId);

            // 如果任务已完成，继续下一个任务
            if (status === TASK_STATUS.COMPLETED) {
                notificationManager.info({
                    message: "任务已完成",
                    context: { taskID: currentTaskId, name: taskInfo.name }
                });
                continue;
            }

            // 如果任务未完成，执行任务
            if (status === TASK_STATUS.PENDING) {
                notificationManager.info({
                    message: "开始执行任务",
                    context: { taskID: currentTaskId, name: taskInfo.name }
                });

                if (taskInfo.type === 'galxe') {
                    await this.galxeClient.prepareAndConfirmGalxeTask({
                        credId: taskInfo.credId,
                        campaignId: 'GCNLYtpFM5',
                        captchaService: 'capSolver',
                        captchaType: 'geeTestV4',
                        taskVariant: 'standard',
                        websiteURL: 'https://app.galxe.com/quest/SaharaAI/GCNLYtpFM5',
                        captchaId: '244bcb8b9846215df5af4c624a750db4',
                        isXTask: false
                    });
                } else if (taskInfo.type === 'transaction') {
                    // 发送代币
                    const randomAmount = (Math.random() * 0.005 + 0.001).toFixed(6);
                    await sendToken({
                        chromeNumber: this.chromeNumber,
                        enPrivateKey: this.enPrivateKey,
                        to: this.address, // 发送给自己
                        amount: randomAmount // 随机金额
                    });
                }

                notificationManager.info({
                    message: "等待任务状态更新",
                    context: { taskID: currentTaskId, name: taskInfo.name }
                });

                await new Promise(resolve => setTimeout(resolve, 5000));
                await this.flush(currentTaskId);
                // 更新任务状态
                status = await this.getTaskStatusById(currentTaskId);

                // 有时候发送了交易却差不到，可能链崩了，晚点再重新执行
                if (taskInfo.type === 'transaction' && status === TASK_STATUS.PENDING) {
                    notificationManager.info({
                        message: "链出问题，请稍后重试",
                            context: { taskID: currentTaskId, name: taskInfo.name }
                        });
                    }
                }
            // 如果任务可领取，领取奖励
            if (status === TASK_STATUS.CLAIMABLE) {
                notificationManager.info({
                    message: "任务已完成，正在领取奖励",
                    context: { taskID: currentTaskId, name: taskInfo.name }
                });

                await this.claim(currentTaskId);
                status = await this.getTaskStatusById(currentTaskId);

                if (status === TASK_STATUS.COMPLETED) {
                    notificationManager.success({
                        message: "任务已完成并领取奖励",
                        context: { taskID: currentTaskId, name: taskInfo.name }
                    });
                }
            }
        }

        notificationManager.success({
            message: "所有任务处理完成"
        });
    }
}

export class SaharaAiRpa extends OkxWalletUtil {
    /**
     * 创建并初始化SaharaAi实例
     * @static
     * @param {Object} params - 初始化参数
     * @param {number} params.chromeNumber - Chrome实例编号
     * @returns {Promise<SaharaAi>} 初始化完成的实例
     */
    static async create({ chromeNumber }) {
        // 创建实例并初始化Chrome
        const instance = await super.create({ chromeNumber });
        return instance;
    }

    async legends() {
        await this.connectWallet('https://legends.saharalabs.ai/');
        await this.page.waitForTimeout(2000);
        await this.page.locator('//*[@src="/assets/all-normal-BQuqrsj0.png"]').click();
        await this.page.waitForTimeout(2000);
        await this.page.getByText('Daily Check-in').click();
        await this.page.waitForTimeout(2000);

        const taskNames = ['Visit the Sahara AI blog', 'Visit @SaharaLabsAI on X', 'Generate at least one transaction on Sahara Testnet'];
        await this.handleTaskButtons(this.page, taskNames);
    }

    async handleTaskButtons(page, taskNames) {
        await Promise.all(taskNames.map(async taskName => {
            try {
                const button = page.locator(`.task-item:has-text("${taskName}") .task-buttons`);
                await button.waitFor({ state: 'visible', timeout: 5000 });

                const buttonText = await button.textContent();

                if (buttonText.includes('claimed')) {
                    console.log(`第${this.chromeNumber}个账号 任务 "${taskName}" 已经是 claimed状态`);
                    return;
                }

                if (buttonText.includes('claim')) {
                    await button.click();
                    console.log(`第${this.chromeNumber}个账号 任务 "${taskName}" 已 claim`);
                    return;
                }

                const hasSvg = await button.locator('svg').count() > 0;
                if (hasSvg) {
                    await button.click();
                    console.log(`第${this.chromeNumber}个账号 任务 "${taskName}" 已 刷新结果`);
                    await page.waitForTimeout(10000);
                    const newButtonText = await button.textContent();
                    if (newButtonText.includes('claim')) {
                        await button.click();
                        console.log(`第${this.chromeNumber}个账号 任务 "${taskName}" 已 claim`);
                        return;
                    } else {
                        console.log(`第${this.chromeNumber}个账号 任务 "${taskName}" 没完成`);
                    }
                }
            } catch (error) {
                console.log(`第${this.chromeNumber}个账号 任务 "${taskName}" 失败:`, error.message);
            }
        }));
    }

    async dailyTask() {
        try {
            await this.connectWallet('https://app.galxe.com/quest/SaharaAI/GCNLYtpFM5', { signButton: 'text=/(OKX Wallet)/i' });
            await this.page.waitForTimeout(2000);
            await this.page.getByText('Daily Visit the Sahara AI Blog').click();
            await this.page.waitForTimeout(2000);
            try {
                await this.page.getByText('Continue to Access').click();
                await this.page.waitForTimeout(2000);
            } catch (error) {
                console.log('Continue to Access 按钮不存在');
            }
            await this.page.getByText('Daily Visit the Sahara AI Twitter').click();
        } catch (error) {
            console.log(error.message);
        }
    }
}