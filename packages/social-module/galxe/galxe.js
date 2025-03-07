import axios from 'axios';
import { ethers } from 'ethers';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { faker } from '@faker-js/faker';
import { XClient } from '../x/x.js';
import { deCryptText } from '../../crypt-module/crypt.js';
import { captchaManager } from '../../utils-module/captcha.js';

export class GalxeClient {
  constructor(number, enPrivateKey, proxy, fingerprint) {
    this.number = number;
    this.proxy = new SocksProxyAgent(proxy);
    this.fingerprint = fingerprint;
    this.authToken = null;
    this.enPrivateKey = enPrivateKey;
    this.wallet = null;
    this.address = null;
  }

  static async create({ number, enPrivateKey, proxy, fingerprint }) {
    // 1. 创建基础实例
    const instance = new this(number, enPrivateKey, proxy, fingerprint);

    // 2. 初始化钱包
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    const privateKey = await deCryptText(enPrivateKey);
    instance.wallet = new ethers.Wallet(privateKey, provider);
    instance.address = instance.wallet.address;

    return instance;
  }

  // 获取登录时间
  getActivityTimeLogin() {
    const now = new Date();
    const expiration = new Date(now.getTime() + 1000 * 60 * 60); // 1小时后过期

    return {
      issuedAt: now.toISOString(),
      expirationTime: expiration.toISOString()
    };
  }

  // 生成随机nonce
  getRandomNonce() {
    return Math.random().toString(36).substring(2, 15);
  }

  // 生成随机请求ID
  getRandomRequestId() {
    return crypto.randomUUID();
  }

  async getMainHeaders() {
    // 如果token无效，则重新登录
    if (!this.authToken) {
      await this.login();
    }
    return {
      'accept': '*/*',
      'authority': 'graphigo.prd.galaxy.eco',
      'accept-language': 'en-US,en;q=0.9',
      'authorization': this.authToken,
      'content-type': 'application/json',
      'origin': 'https://app.galxe.com',
      'request-id': this.getRandomRequestId(),
      'sec-ch-ua': this.fingerprint.headers['sec-ch-ua'],
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': 'macOS',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
      'user-agent': this.fingerprint.userAgent,
    }
  }

  async login() {
    try {
      console.log(`[${this.number}] | ${this.address} | Galxe开始登录`);
      const { issuedAt, expirationTime } = this.getActivityTimeLogin();
      const nonce = this.getRandomNonce();

      // 构造签名消息
      const message = [
        'app.galxe.com wants you to sign in with your Ethereum account:',
        this.address,
        '\nSign in with Ethereum to the app.\n',
        'URI: https://app.galxe.com',
        'Version: 1',
        'Chain ID: 1',
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
        `Expiration Time: ${expirationTime}`
      ].join('\n');

      // 签名消息
      const signature = await this.wallet.signMessage(message);

      // 构造请求头
      const headers = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': 'https://app.galxe.com',
        'platform': 'web',
        'request-id': this.getRandomRequestId(),
        'sec-ch-ua': this.fingerprint.headers['sec-ch-ua'],
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': 'macOS',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': this.fingerprint.userAgent
      };

      // 构造请求数据
      const requestData = {
        operationName: 'SignIn',
        variables: {
          input: {
            address: this.address,
            message,
            signature,
            addressType: 'EVM',
            publicKey: '1'
          }
        },
        query: 'mutation SignIn($input: Auth) {\n  signin(input: $input)\n}'
      };

      // 发送请求
      const response = await axios.post(
        'https://graphigo.prd.galaxy.eco/query',
        requestData,
        {
          headers,
          httpsAgent: this.proxy
        }
      );

      if (response.status === 200 && response.data?.data?.signin) {
        this.authToken = response.data.data.signin;
        console.log(`[${this.number}] | ${this.address} | Galxe登录成功`);
      } else {
        console.warn(`[${this.number}] | ${this.address} | Galxe登录失败. 服务器响应:`, response.data);
      }
    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | Galxe登录错误:`, error);
    }
  }

  // 开始注册流程
  async register() {
    try {
      // 检查地址是否已注册
      const { success, isRegistered } = await this.checkIfAddressRegistered();
      if (success && isRegistered) {
        console.log(`[${this.number}] | ${this.address} | 地址已注册`);
        return;
      }
      console.log(`[${this.number}] | ${this.address} | Galxe开始注册`);
      // 生成并验证用户名
      let username = faker.internet.username();
      let attempts = 0;
      const retryTimes = 10;
      while (attempts < retryTimes) {
        const usernameExists = await this.checkIfUsernameExist(username);
        if (!usernameExists) {
          break;
        }
        username = faker.internet.username();
        attempts++;

        if (attempts === retryTimes) {
          return { message: '无法找到可用的用户名' };
        }
      };

      const requestData = {
        operationName: 'CreateNewAccount',
        variables: {
          input: {
            schema: `EVM:${this.address}`,
            socialUsername: '',
            username: username,
          },
        },
        query: 'mutation CreateNewAccount($input: CreateNewAccount!) {\n  createNewAccount(input: $input)\n}\n',
      };

      const response = await axios.post(
        'https://graphigo.prd.galaxy.eco/query',
        requestData,
        {
          headers: await this.getMainHeaders(),
          httpsAgent: this.proxy
        }
      );

      if (response.status === 200 && response.data?.data?.createNewAccount) {
        console.log(`[${this.number}] | ${this.address} | 注册成功`);
        return true;
      } else {
        console.warn(`[${this.number}] | ${this.address} | 注册失败. 服务器响应:`, response.data);
        return false;
      }
    } catch (error) {
      console.error(`[${this.number}] | 注册错误:`, error);
    }
  }

  async checkIfAddressRegistered() {
    try {
      console.log(`[${this.number}] | ${this.address} | 检查地址是否已注册`);
      const requestData = {
        operationName: 'GalxeIDExist',
        variables: {
          schema: `EVM:${this.address}`
        },
        query: 'query GalxeIDExist($schema: String!) {\n  galxeIdExist(schema: $schema)\n}'
      };

      const headers = {
        'accept': '*/*',
        'authority': 'graphigo.prd.galaxy.eco',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'origin': 'https://app.galxe.com',
        'request-id': this.getRandomRequestId(),
        'sec-ch-ua': this.fingerprint.headers['sec-ch-ua'],
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': 'macOS',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'user-agent': this.fingerprint.userAgent
      };

      const response = await axios.post(
        'https://graphigo.prd.galaxy.eco/query',
        requestData,
        {
          headers,
          httpsAgent: this.proxy
        }
      );
      // console.log('response', response.data)
      if (response.status === 200) {
        const isRegistered = response.data?.data?.galxeIdExist;
        if (typeof isRegistered === 'boolean') {
          console.log(`[${this.number}] | ${this.address} | 账户注册状态检查: ${isRegistered ? '已注册' : '未注册'}`);
          return {
            success: true,
            isRegistered
          };
        }
      }

      console.warn(`[${this.number}] | ${this.address} | 检查账户注册状态失败. 响应:`, response.data);
      return {
        success: false,
        error: '无法获取注册状态'
      };

    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | 检查账户注册状态出错:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 检查用户名是否存在
  async checkIfUsernameExist(username) {
    try {
      const requestData = {
        operationName: 'IsUsernameExisting',
        variables: {
          username: username,
        },
        query: 'query IsUsernameExisting($username: String!) {\n  usernameExist(username: $username)\n}\n',
      };

      const response = await axios.post(
        'https://graphigo.prd.galaxy.eco/query',
        requestData,
        {
          headers: await this.getMainHeaders(),
          httpsAgent: this.proxy
        }
      );
      if (response.status === 200) {
        return response.data?.data?.usernameExist ?? true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | 检查用户名出错:`, error);
    }
  }

  async checkGalxeAccountInfo() {
    try {
      const query = `query BasicUserInfo($address: String!) {
        addressInfo(address: $address) {
          id
          username
          avatar
          address
          evmAddressSecondary {
            address
            __typename
          }
          hasEmail
          hasTwitter
          hasDiscord
          twitterUserName
          discordUserName
          email
          __typename
        }
      }`;

      const response = await axios.post(
        'https://graphigo.prd.galaxy.eco/query',
        {
          operationName: 'BasicUserInfo',
          variables: {
            address: this.address
          },
          query: query
        },
        {
          headers: await this.getMainHeaders(),
          httpsAgent: this.proxy
        }
      );
      // console.log('response', response.data)
      if (response.status === 200) {
        const addressInfo = response.data?.data?.addressInfo;
        // console.log('addressInfo', addressInfo)
        if (!addressInfo) {
          console.warn(`[${this.number}] | ${this.address} | 无法获取账户信息`);
          return { success: false };
        }
        // 检查需要绑定的社交账号
        return {
          success: true,
          userId: addressInfo.id || null,
          needEmail: !addressInfo.hasEmail,
          needTwitter: !addressInfo.hasTwitter,
          needDiscord: !addressInfo.hasDiscord,
          info: addressInfo // 返回完整信息以供使用
        };
      }

      console.warn(`[${this.number}] | ${this.address} | 获取账户信息失败. 响应:`, response.data);
      return { success: false };

    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | 检查账户信息出错:`, error.message);
      return { success: false };
    }
  }

  // 传入的推特用户是否与galxe绑定的twitter一致
  async galxeTwitterCheckAccount(tweetUrl, userName) {
    try {
      console.log(`[${this.number}] | ${this.address} | 检查Twitter账号`);
      const requestData = {
        operationName: 'checkTwitterAccount',
        variables: {
          input: {
            address: `EVM:${this.address}`,
            tweetURL: tweetUrl
          }
        },
        query: `mutation checkTwitterAccount($input: VerifyTwitterAccountInput!) {
          checkTwitterAccount(input: $input) {
            address
            twitterUserID
            twitterUserName
            __typename
          }
        }`
      };

      const response = await axios.post(
        'https://graphigo.prd.galaxy.eco/query',
        requestData,
        {
          headers: await this.getMainHeaders(),
          httpsAgent: this.proxy
        }
      );
      if (response.status === 200) {
        // galxe的api返回的错了，twitterUserName返回了ID，twitterUserID返回了用户名。以防他们改回来，所以判断两个
        const twitterUserName = response.data?.data?.checkTwitterAccount?.twitterUserName;
        const twitterUserID = response.data?.data?.checkTwitterAccount?.twitterUserID;
        if (twitterUserName === userName || twitterUserID === twitterUserID) {
          console.log(`[${this.number}] | ${this.address} | Twitter账号检查通过`);
          return true;
        }
      }

      console.warn(`[${this.number}] | ${this.address} | Twitter账号检查失败. 响应:`, response.data);
      return false;
    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | Twitter账号检查出错:`, error);
      return false;
    }
  }

  // 3. 验证 Twitter 账号
  async galxeTwitterVerifyAccount(tweetUrl, userName) {
    try {
      console.log(`[${this.number}] | ${this.address} | 验证Twitter账号`);
      const requestData = {
        operationName: 'VerifyTwitterAccount',
        variables: {
          input: {
            address: `EVM:${this.address}`,
            tweetURL: tweetUrl
          }
        },
        query: `mutation VerifyTwitterAccount($input: VerifyTwitterAccountInput!) {
            verifyTwitterAccount(input: $input) {
              address
              twitterUserID
              twitterUserName
              __typename
            }
          }`
      };

      const response = await axios.post(
        'https://graphigo.prd.galaxy.eco/query',
        requestData,
        {
          headers: await this.getMainHeaders(),
          httpsAgent: this.proxy
        }
      );
      if (response.status === 200) {
        const twitterUserName = response.data?.data?.verifyTwitterAccount?.twitterUserName;
        const twitterUserID = response.data?.data?.verifyTwitterAccount?.twitterUserID;
        if (twitterUserName === userName || twitterUserID === userName) {
          console.log(`[${this.number}] | ${this.address} | Twitter账号验证成功`);
          return true;
        }
      }

      console.warn(`[${this.number}] | ${this.address} | Twitter账号验证失败. 响应:`, response.data);
      return false;
    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | Twitter账号验证出错:`, error);
      return false;
    }
  }

  // 4. 添加 Twitter 到 Galxe 的主流程
  async addTwitterToGalxe({ refreshToken, proxy, csvFile = './data/social/x.csv', matchField = 'xUsername', matchValue, targetField = 'xRefreshToken' }) {
    try {
      console.log(`[${this.number}] | ${this.address} | 添加Twitter到Galxe`);
      // 1. 获取 Galxe 用户 ID
      let accountInfo = await this.checkGalxeAccountInfo();
      if (!accountInfo.success || !accountInfo.userId) {
        await this.register();
        accountInfo = await this.checkGalxeAccountInfo();
      }
      if (!accountInfo.needTwitter) {
        console.log(`[${this.number}] | ${this.address} | 已绑定Twitter`);
        return true;
      }
      // 2. 初始化 Twitter 客户端
      const xClient = await XClient.create({ refreshToken, proxy, csvFile, matchField, matchValue, targetField });
      if (!xClient) {
        console.error(`[${this.number}] | ${this.address} | 无法初始化Twitter客户端`);
        return false;
      }
      // 3. 发布推文
      const tweetId = await xClient.tweet(`Verifying my Twitter account for my #GalxeID\ngid:${accountInfo.userId} @Galxe\n\n`);
      if (!tweetId) { return false; };

      const { userName } = await xClient.getCurrentUserProfile();

      // 4. 构建推文URL并验证
      const tweetUrl = `https://x.com/${userName}/status/${tweetId}`;

      // 5. 检查Twitter账号
      const checkStatus = await this.galxeTwitterCheckAccount(tweetUrl, userName);
      if (!checkStatus) {
        return false;
      }

      console.log(`[${this.number}] | ${this.address} | 等待5秒`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 6. 验证Twitter账号
      const verifyStatus = await this.galxeTwitterVerifyAccount(tweetUrl, userName);
      if (!verifyStatus) {
        return false;
      }

      console.log(`[${this.number}] | ${this.address} | Twitter账号绑定成功`);
      return true;

    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | Twitter绑定过程出错:`, error);
      return false;
    }
  }

  // 准备 Galxe 任务
  async prepareGalxeTask({ credId, campaignId, captchaService, captchaType, taskVariant, websiteURL, captchaId }) {
    try {
      const query = `mutation AddTypedCredentialItems($input: MutateTypedCredItemInput!) {
        typedCredentialItems(input: $input) {
          id
          __typename
        }
      }`;

      const solution = await captchaManager.verifyWebsite({
        captchaService,
        captchaType,
        taskVariant,
        websiteURL,
        captchaId,
      });

      // console.log('solution', solution);

      const requestData = {
        operationName: 'AddTypedCredentialItems',
        variables: {
          input: {
            credId,
            campaignId,
            operation: 'APPEND',
            items: [`EVM:${this.address}`],
            captcha: {
              lotNumber: solution.lotNumber,
              captchaOutput: solution.captchaOutput,
              passToken: solution.passToken,
              genTime: solution.genTime
            }
          }
        },
        query
      };

      const response = await axios.post(
        'https://graphigo.prd.galaxy.eco/query',
        requestData,
        {
          headers: await this.getMainHeaders(),
          httpsAgent: this.proxy
        }
      );

      if (response.status === 200) {
        const answer = response.data;

        // 检查验证码错误
        if (JSON.stringify(answer).includes('failed to verify recaptcha token')) {
          console.warn(`[${this.number}] | ${this.address} | 验证码确认问题！请检查`);
          return [false, null];
        }

        const itemId = answer?.data?.typedCredentialItems?.id;
        if (itemId) {
          console.log(`[${this.number}] | ${this.address} | 任务准备成功`);
          return [true, itemId];
        }

        console.warn(`[${this.number}] | ${this.address} | 错误，服务器响应:`, answer);
        return [false, null];
      }

      return [false, 'notId'];
    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | 准备任务出错:`, error);
      return [false, null];
    }
  }

  /**
   * 确认Galxe任务
   * @param {Object} params 
   * @param {string} params.credId - 任务ID
   * @param {boolean} [params.isXTask=false] - 是否为推特任务
   * @param {Object} [params.xTaskParams] - 推特任务相关参数,仅isXTask=true时需要
   * @param {string} [params.xTaskParams.campaignId] - 活动ID
   * @param {string} [params.xTaskParams.captchaService] - 验证码服务
   * @param {string} [params.xTaskParams.captchaType] - 验证码类型
   * @param {string} [params.xTaskParams.taskVariant] - 任务变体
   * @param {string} [params.xTaskParams.websiteURL] - 网站URL
   * @param {string} [params.xTaskParams.captchaId] - 验证码ID
   */
  async confirmGalxeTask({ credId, isXTask = false, ...xTaskParams }) {
    try {
      const query = `mutation SyncCredentialValue($input: SyncCredentialValueInput!) {
        syncCredentialValue(input: $input) {
          value {
            address
            spaceUsers {
              follow
              points 
              participations
              __typename
            }
            campaignReferral {
              count
              __typename
            }
            gitcoinPassport {
              score
              lastScoreTimestamp
              __typename
            }
            walletBalance {
              balance
              __typename
            }
            multiDimension {
              value
              __typename
            }
            allow
            survey {
              answers
              __typename
            }
            quiz {
              allow
              correct
              __typename
            }
            __typename
          }
          message
          __typename
        }
      }`;

      const variables = {
        input: {
          syncOptions: {
            credId,
            address: this.address
          }
        }
      };

      // 只有在isXTask=true时才处理xTaskParams相关参数
      if (isXTask) {
        const { campaignId, captchaService, captchaType, taskVariant, websiteURL, captchaId } = xTaskParams;
        
        const solution = await captchaManager.verifyWebsite({
          captchaService,
          captchaType,
          taskVariant,
          websiteURL,
          captchaId,
        });

        variables.input.syncOptions.twitter = {
          campaignID: campaignId,
          captcha: {
            lotNumber: solution.lotNumber,
            captchaOutput: solution.captchaOutput,
            passToken: solution.passToken,
            genTime: solution.genTime
          }
        };
      }

      const response = await axios.post(
        'https://graphigo.prd.galaxy.eco/query',
        {
          operationName: 'SyncCredentialValue',
          variables,
          query
        },
        {
          headers: await this.getMainHeaders(),
          httpsAgent: this.proxy
        }
      );

      if (response.status === 200) {
        const answer = response.data;
        const isAllowed = answer?.data?.syncCredentialValue?.value?.allow || false;
        
        if (isAllowed) {
          console.log(`[${this.number}] | ${this.address} | 任务 ${credId} 确认成功!`);
          return true;
        } else {
          console.log(`[${this.number}] | ${this.address} | 任务 ${credId} 确认失败`);
          return false;
        }
      }

      console.error(`[${this.number}] | ${this.address} | 确认任务失败: HTTP ${response.status}`);
      return false;
    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | 确认任务出错:`, error);
      return false;
    }
  }

  async prepareAndConfirmGalxeTask({ credId, campaignId, captchaService, captchaType, taskVariant, websiteURL, captchaId, isXTask = false }) {
    // 1. 准备任务阶段
    await this.prepareGalxeTask({ 
      credId, 
      campaignId, 
      captchaService, 
      captchaType, 
      taskVariant, 
      websiteURL, 
      captchaId 
    });

    // 2. 确认任务阶段
    await this.confirmGalxeTask({
      credId,
      isXTask,
      ...(isXTask ? {  // 只有X任务才传入这些参数
        campaignId,
        captchaService,
        captchaType,
        taskVariant,
        websiteURL,
        captchaId
      } : {})
    });
  }
}