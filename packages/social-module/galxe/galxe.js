import axios from 'axios';
import { ethers } from 'ethers';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { faker } from '@faker-js/faker';
import { XClient } from '../x/x.js';
import { deCryptText } from '../../crypt-module/crypt.js';
import { captchaManager } from '../../utils-module/captcha.js';
import { notificationManager } from '../../notification-module/notification.js';
import { withRetry } from '../../utils-module/retry.js';

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

  // 获取请求头
  async getMainHeaders(isLogin = false) {
    // 如果不是登录请求且token无效，则重新登录
    if (!isLogin && !this.authToken) {
      await this.login();
    }

    const headers = {
      'accept': '*/*',
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

    // 登录请求需要platform字段
    if (isLogin) {
      headers['platform'] = 'web';
    } else {
      // 非登录请求需要authority和authorization字段
      headers['authority'] = 'graphigo.prd.galaxy.eco';
      headers['authorization'] = this.authToken;
    }

    return headers;
  }

  /**
   * 执行Galxe API请求
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async executeRequest({ 
    url = 'https://graphigo.prd.galaxy.eco/query',
    method = 'post',
    data,
    headers,
    taskName = '未命名任务',
    context = {}
  }) {
    const requestHeaders = headers || await this.getMainHeaders();
    
    // 基础上下文信息，所有请求都会包含
    const baseContext = {
      "账号": this.number,
      "地址": this.address
    };
    
    // 合并用户提供的上下文和基础上下文，用户提供的上下文可以覆盖基础上下文
    const logContext = {
      ...baseContext,
      ...context
    };
    
    return withRetry(
      async () => {
        const response = await axios({
          method,
          url,
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
        taskName,
        logContext
      }
    );
  }

  async login() {
    notificationManager.info({
      "message": "Galxe开始登录",
      "config": { "logToConsole": false }
    });

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

    try {
      const result = await this.executeRequest({
        data: requestData,
        headers: await this.getMainHeaders(true), // 传入true表示是登录请求
        taskName: 'Galxe登录'
      });
      
      if (result?.data?.signin) {
        this.authToken = result.data.signin;
        notificationManager.success({
          "message": "Galxe登录成功",
          "config": { "logToConsole": false }
        });
      }
    } catch (error) {
      notificationManager.error({
        "message": "Galxe登录失败",
        "context": {
          "原因": error.message
        }
      });
      throw error;
    }
  }

  // 开始注册流程
  async register() {
    try {
      // 检查地址是否已注册
      const { success, isRegistered } = await this.checkIfAddressRegistered();
      if (success && isRegistered) {
        notificationManager.info({
          "message": "地址已注册"
        });
        return;
      }

      notificationManager.info({
        "message": "Galxe开始注册"
      });

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
          notificationManager.error({
            "message": "无法找到可用的用户名"
          });
          return false;
        }
      }

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

      const result = await this.executeRequest({
        data: requestData,
        taskName: 'Galxe注册',
        context: { "用户名": username }
      });

      if (result?.data?.createNewAccount) {
        notificationManager.success({
          "message": "注册成功",
          "context": {
            "用户名": username
          }
        });
        return true;
      }
      
      return false;
    } catch (error) {
      notificationManager.error({
        "message": "注册错误",
        "context": {
          "原因": error.message
        }
      });
      throw error;
    }
  }

  async checkIfAddressRegistered() {
    try {
      notificationManager.info({
        "message": "检查地址是否已注册"
      });

      const requestData = {
        operationName: 'GalxeIDExist',
        variables: {
          schema: `EVM:${this.address}`
        },
        query: 'query GalxeIDExist($schema: String!) {\n  galxeIdExist(schema: $schema)\n}'
      };

      const result = await this.executeRequest({
        data: requestData,
        taskName: '检查地址注册状态'
      });

      const isRegistered = result?.data?.galxeIdExist;
      if (typeof isRegistered === 'boolean') {
        notificationManager.info({
          "message": isRegistered ? "账户已注册" : "账户未注册"
        });
        return {
          success: true,
          isRegistered
        };
      }
      
      return {
        success: false,
        error: '无法获取注册状态'
      };
    } catch (error) {
      notificationManager.error({
        "message": "检查地址注册状态出错",
        "context": {
          "原因": error.message
        }
      });
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

      const result = await this.executeRequest({
        data: requestData,
        taskName: '检查用户名',
        context: { "用户名": username }
      });
      
      return result?.data?.usernameExist ?? true;
    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | 检查用户名出错:`, error);
      return true; // 出错时默认用户名存在，以避免冲突
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

      const result = await this.executeRequest({
        data: {
          operationName: 'BasicUserInfo',
          variables: {
            address: this.address
          },
          query
        },
        taskName: '检查Galxe账户信息'
      });

      const addressInfo = result?.data?.addressInfo;
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
    } catch (error) {
      console.error(`[${this.number}] | ${this.address} | 检查账户信息出错:`, error.message);
      return { success: false };
    }
  }

  // 传入的推特用户是否与galxe绑定的twitter一致
  async galxeTwitterCheckAccount(tweetUrl, userName) {
    try {
      notificationManager.info({
        "message": "检查Twitter账号",
        "context": {
          "推文": tweetUrl
        }
      });

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

      const result = await this.executeRequest({
        data: requestData,
        taskName: '检查Twitter账号',
        context: {
          "推特": userName
        }
      });

      // galxe的api返回的错了，twitterUserName返回了ID，twitterUserID返回了用户名。以防他们改回来，所以判断两个
      const twitterUserName = result?.data?.checkTwitterAccount?.twitterUserName;
      const twitterUserID = result?.data?.checkTwitterAccount?.twitterUserID;
      
      if (twitterUserName === userName || twitterUserID === userName) {
        notificationManager.success({
          "message": "Twitter账号检查通过",
          "context": {
            "推特": userName
          }
        });
        return true;
      }
      
      notificationManager.warning({
        "message": "Twitter账号不匹配",
        "context": {
          "期望": userName,
          "实际": twitterUserName || twitterUserID
        }
      });
      return false;
    } catch (error) {
      notificationManager.error({
        "message": "Twitter账号检查出错",
        "context": {
          "推特": userName,
          "原因": error.message
        }
      });
      return false;
    }
  }

  // 3. 验证 Twitter 账号
  async galxeTwitterVerifyAccount(tweetUrl, userName) {
    try {
      notificationManager.info({
        "message": "验证Twitter账号",
        "context": {
          "推文": tweetUrl
        }
      });

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

      const result = await this.executeRequest({
        data: requestData,
        taskName: '验证Twitter账号',
        context: {
          "推特": userName
        }
      });

      const twitterUserName = result?.data?.verifyTwitterAccount?.twitterUserName;
      const twitterUserID = result?.data?.verifyTwitterAccount?.twitterUserID;
      
      if (twitterUserName === userName || twitterUserID === userName) {
        notificationManager.success({
          "message": "Twitter账号验证成功",
          "context": {
            "推特": userName
          }
        });
        return true;
      }
      
      notificationManager.warning({
        "message": "Twitter账号验证不匹配",
        "context": {
          "期望": userName,
          "实际": twitterUserName || twitterUserID
        }
      });
      return false;
    } catch (error) {
      notificationManager.error({
        "message": "Twitter账号验证出错",
        "context": {
          "推特": userName,
          "原因": error.message
        }
      });
      return false;
    }
  }

  // 4. 添加 Twitter 到 Galxe 的主流程
  async addTwitterToGalxe({ refreshToken, proxy, csvFile = './data/social/x.csv', matchField = 'xUsername', matchValue, targetField = 'xRefreshToken' }) {
    try {
      notificationManager.info({
        "message": "添加Twitter到Galxe"
      });

      // 1. 获取 Galxe 用户 ID
      let accountInfo = await this.checkGalxeAccountInfo();
      if (!accountInfo.success || !accountInfo.userId) {
        await this.register();
        accountInfo = await this.checkGalxeAccountInfo();
      }
      if (!accountInfo.needTwitter) {
        notificationManager.info({
          "message": "已绑定Twitter"
        });
        return true;
      }

      // 2. 创建 Twitter 客户端
      const xClient = await XClient.create({
        refreshToken,
        proxy
      });

      // 3. 发送推文
      const tweetText = `Verifying my Twitter account for my #GalxeID ${accountInfo.userId} @Galxe\n\nhttps://galxe.com/galxeid`;
      const tweetResult = await xClient.tweet(tweetText);
      if (!tweetResult.success) {
        throw new Error(`发送推文失败: ${tweetResult.error}`);
      }

      // 4. 检查推文
      const tweetUrl = tweetResult.tweetUrl;
      const userName = xClient.username;
      
      // 5. 验证 Twitter 账号
      const checkResult = await this.galxeTwitterCheckAccount(tweetUrl, userName);
      if (!checkResult) {
        throw new Error('Twitter账号检查失败');
      }

      // 6. 确认验证
      const verifyResult = await this.galxeTwitterVerifyAccount(tweetUrl, userName);
      if (!verifyResult) {
        throw new Error('Twitter账号验证失败');
      }

      notificationManager.success({
        "message": "成功添加Twitter到Galxe",
        "context": {
          "推特": userName
        }
      });
      return true;
    } catch (error) {
      notificationManager.error({
        "message": "添加Twitter到Galxe失败",
        "context": {
          "原因": error.message
        }
      });
      return false;
    }
  }

  // 准备 Galxe 任务
  async prepareGalxeTask({ credId, campaignId, captchaService, captchaType, taskVariant, websiteURL, captchaId }) {
    try {
      notificationManager.info({
        "message": "准备Galxe任务",
        "context": {
          "任务ID": credId
        },
        "config": {
          "logToConsole": false,
        }
      });

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

      const result = await this.executeRequest({
        data: requestData,
        taskName: '准备Galxe任务',
        context: {
          "任务ID": credId,
          "活动ID": campaignId
        }
      });

      // 检查验证码错误
      if (JSON.stringify(result).includes('failed to verify recaptcha token')) {
        notificationManager.warning({
          "message": "验证码确认问题",
          "context": {
            "任务ID": credId
          }
        });
        return [false, null];
      }

      const itemId = result?.data?.typedCredentialItems?.id;
      if (itemId) {
        notificationManager.success({
          "message": "任务准备成功",
          "context": {
            "任务ID": credId,
            "项目ID": itemId
          },
          "config": {
            "logToConsole": false,
          }
        });
        return [true, itemId];
      }

      notificationManager.warning({
        "message": "任务准备失败",
        "context": {
          "任务ID": credId,
          "响应": JSON.stringify(result)
        }
      });
      return [false, null];
    } catch (error) {
      notificationManager.error({
        "message": "准备任务出错",
        "context": {
          "任务ID": credId,
          "原因": error.message
        }
      });
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
      notificationManager.info({
        "message": "确认Galxe任务",
        "context": {
          "任务ID": credId,
          "推特任务": isXTask
        },
        "config": { "logToConsole": false }
      });

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

      const result = await this.executeRequest({
        data: {
          operationName: 'SyncCredentialValue',
          variables,
          query
        },
        taskName: '确认Galxe任务',
        context: {
          "任务ID": credId,
          "推特任务": isXTask
        }
      });

      const isAllowed = result?.data?.syncCredentialValue?.value?.allow || false;
      
      if (isAllowed) {
        notificationManager.success({
          "message": "任务确认成功",
          "context": {
            "任务ID": credId
          },
          "config": { "logToConsole": false }
        });
        return true;
      } else {
        notificationManager.warning({
          "message": "任务确认失败",
          "context": {
            "任务ID": credId
          }
        });
        return false;
      }
    } catch (error) {
      notificationManager.error({
        "message": "确认任务出错",
        "context": {
          "任务ID": credId,
          "原因": error.message
        }
      });
      return false;
    }
  }

  async prepareAndConfirmGalxeTask({ credId, campaignId, captchaService, captchaType, taskVariant, websiteURL, captchaId, isXTask = false }) {
    try {
      notificationManager.info({
        "message": "开始执行Galxe任务",
        "context": {
          "任务ID": credId,
          "推特任务": isXTask
        }
      });

      // 1. 准备任务阶段
      const [prepareSuccess, itemId] = await this.prepareGalxeTask({ 
        credId, 
        campaignId, 
        captchaService, 
        captchaType, 
        taskVariant, 
        websiteURL, 
        captchaId 
      });

      if (!prepareSuccess) {
        notificationManager.warning({
          "message": "任务准备阶段失败，无法继续",
          "context": {
            "任务ID": credId
          }
        });
        return false;
      }

      // 2. 确认任务阶段
      const confirmSuccess = await this.confirmGalxeTask({
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

      if (confirmSuccess) {
        notificationManager.success({
          "message": "Galxe任务完成",
          "context": {
            "任务ID": credId
          }
        });
        return true;
      } else {
        notificationManager.warning({
          "message": "Galxe任务确认阶段失败",
          "context": {
            "任务ID": credId
          }
        });
        return false;
      }
    } catch (error) {
      notificationManager.error({
        "message": "执行Galxe任务出错",
        "context": {
          "任务ID": credId,
          "原因": error.message
        }
      });
      return false;
    }
  }
}