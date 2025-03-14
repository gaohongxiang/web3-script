import 'dotenv/config';
import axios from 'axios';
import { withRetry } from './retry.js';
import { notificationManager } from '../notification-module/notification.js';

// 点数转人民币汇率
const USDTOCNY = 7.3;
const YESCAPTCHA_CNY_PER_POINT = 1 / 1000;
const NOCAPTCHA_CNY_PER_POINT = USDTOCNY / 66000;

// 服务商任务类型定义
const serviceTaskTypes = {
  yesCaptcha: {
    requestType: 'taskId',
    reCaptchaV2: {
      standard: {
        type: 'NoCaptchaTaskProxyless',
        price: YESCAPTCHA_CNY_PER_POINT * 15,
        prepareTask: ({ websiteURL, websiteKey, isInvisible = false }) => ({
          websiteURL,
          websiteKey,
          ...(isInvisible ? { isInvisible } : {})
        }),
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },
      advanced: {
        type: 'RecaptchaV2TaskProxyless',
        price: YESCAPTCHA_CNY_PER_POINT * 20,
        prepareTask: ({ websiteURL, websiteKey, isInvisible = false }) => ({
          websiteURL,
          websiteKey,
          ...(isInvisible ? { isInvisible } : {})
        }),
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },
      k1: {
        type: 'RecaptchaV2TaskProxylessK1',
        price: YESCAPTCHA_CNY_PER_POINT * 20,
        prepareTask: ({ websiteURL, websiteKey, isInvisible = false }) => ({
          websiteURL,
          websiteKey,
          ...(isInvisible ? { isInvisible } : {})
        }),
        extractResult: (result) => result.solution?.gRecaptchaResponse
      }
    },
    reCaptchaV3: {
      standard: {
        type: 'RecaptchaV3TaskProxyless',
        price: YESCAPTCHA_CNY_PER_POINT * 20,
        prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
          websiteURL,
          websiteKey,
          ...(pageAction ? { pageAction } : {})
        }),
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },
      m1: {
        type: 'RecaptchaV3TaskProxylessM1',
        price: YESCAPTCHA_CNY_PER_POINT * 25,
        prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
          websiteURL,
          websiteKey,
          ...(pageAction ? { pageAction } : {})
        }),
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },
      k1: {
        type: 'RecaptchaV3TaskProxylessK1',
        price: YESCAPTCHA_CNY_PER_POINT * 25,
        prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
          websiteURL,
          websiteKey,
          ...(pageAction ? { pageAction } : {})
        }),
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },
      m1s7: {
        type: 'RecaptchaV3TaskProxylessM1S7',
        price: YESCAPTCHA_CNY_PER_POINT * 30,
        prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
          websiteURL,
          websiteKey,
          ...(pageAction ? { pageAction } : {})
        }),
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },
      m1s9: {
        type: 'RecaptchaV3TaskProxylessM1S9',
        price: YESCAPTCHA_CNY_PER_POINT * 35,
        prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
          websiteURL,
          websiteKey,
          ...(pageAction ? { pageAction } : {})
        }),
        extractResult: (result) => result.solution?.gRecaptchaResponse
      }
    },
    // hCaptcha 策略
    hCaptcha: {
      defaultTaskType: 'standard',
      taskTypes: {
        standard: {
          type: 'HCaptchaTaskProxyless',
          price: YESCAPTCHA_CNY_PER_POINT * 30,
          prepareTask: ({ websiteURL, websiteKey, userAgent = '', isInvisible = false, rqdata = '' }) => ({
            websiteURL,
            websiteKey,
            ...(userAgent ? { userAgent } : {}),
            ...(isInvisible ? { isInvisible } : {}),
            ...(rqdata ? { rqdata } : {})
          })
        }
      },
      extractResult: (result) => result.solution?.gRecaptchaResponse
    },
    cloudflareTurnstile: {
      standard: {
        type: 'TurnstileTaskProxyless',
        price: YESCAPTCHA_CNY_PER_POINT * 25,
        prepareTask: ({ websiteURL, websiteKey }) => ({
          websiteURL,
          websiteKey
        }),
        extractResult: (result) => ({
          token: result.solution?.token,
          userAgent: result.solution?.userAgent,
        })
      },
      m1: {
        type: 'TurnstileTaskProxylessM1',
        price: YESCAPTCHA_CNY_PER_POINT * 30,
        prepareTask: ({ websiteURL, websiteKey }) => ({
          websiteURL,
          websiteKey
        }),
        extractResult: (result) => ({
          token: result.solution?.token,
          userAgent: result.solution?.user_agent,
        })
      }
    },
    // Cloudflare 5秒盾 策略
    // 请使用返回的ua值、cookie值以及创建任务的代理ip进行后续操作，因为cloudflare要求三者一致
    cloudflare5sShield: {
      s2: {
        type: 'CloudFlareTaskS2',
        price: YESCAPTCHA_CNY_PER_POINT * 25,
        prepareTask: ({ websiteURL, proxy, userAgent = '', waitLoad = false, requiredCookies = ['cf_clearance'], blockImage = false }) => ({
          websiteURL,
          type: 'CloudFlareTaskS2',
          ...proxy,
          ...(userAgent ? { userAgent } : {}),
          ...(waitLoad ? { waitLoad } : {}),
          ...(requiredCookies ? { requiredCookies } : {}),
          ...(blockImage ? { blockImage } : {})
        }),
        extractResult: (result) => ({
          cookies: result.solution?.cookies,
          userAgent: result.solution?.user_agent
        })
      },
      s3: {
        type: 'CloudFlareTaskS3',
        price: YESCAPTCHA_CNY_PER_POINT * 20,
        prepareTask: ({ websiteURL, proxy, waitLoad = false, requiredCookies = ['cf_clearance'], blockImage = false }) => ({
          websiteURL,
          type: 'CloudFlareTaskS3',
          ...proxy,
          ...(waitLoad ? { waitLoad } : {}),
          ...(requiredCookies ? { requiredCookies } : {}),
          ...(blockImage ? { blockImage } : {})
        }),
        extractResult: (result) => ({
          cookies: result.solution?.cookies,
          userAgent: result.solution?.userAgent
        })
      }
    }
  },

  capSolver: {
    requestType: 'taskId',
    reCaptchaV2: {
      standard: {
        type: 'ReCaptchaV2TaskProxyLess',
        price: USDTOCNY * 0.8 / 1000,
        prepareTask: ({ websiteURL, websiteKey, isInvisible = false, pageAction = '', enterprisePayload = null, apiDomain = '', userAgent = '', cookies = [], anchor = '', reload = '' }) => ({
          websiteURL,
          websiteKey,
          ...(isInvisible ? { isInvisible } : {}),
          ...(pageAction ? { pageAction } : {}),
          ...(enterprisePayload ? { enterprisePayload } : {}),
          ...(apiDomain ? { apiDomain } : {}),
          ...(userAgent ? { userAgent } : {}),
          ...(cookies.length > 0 ? { cookies } : {}),
          ...(anchor ? { anchor } : {}),
          ...(reload ? { reload } : {})
        }),
        extractResult: (result) => ({
          gRecaptchaResponse: result.solution?.gRecaptchaResponse,
          userAgent: result.solution?.userAgent,
          expireTime: result.solution?.expireTime
        })
      },
      advanced: {
        type: 'ReCaptchaV2Task',
        price: USDTOCNY * 0.8 / 1000,
        prepareTask: ({ websiteURL, websiteKey, proxy, isInvisible = false, pageAction = '', enterprisePayload = null, apiDomain = '', userAgent = '', cookies = [], anchor = '', reload = '' }) => ({
          websiteURL,
          websiteKey,
          proxy,
          ...(isInvisible ? { isInvisible } : {}),
          ...(pageAction ? { pageAction } : {}),
          ...(enterprisePayload ? { enterprisePayload } : {}),
          ...(apiDomain ? { apiDomain } : {}),
          ...(userAgent ? { userAgent } : {}),
          ...(cookies.length > 0 ? { cookies } : {}),
          ...(anchor ? { anchor } : {}),
          ...(reload ? { reload } : {})
        }),
        extractResult: (result) => ({
          gRecaptchaResponse: result.solution?.gRecaptchaResponse,
          userAgent: result.solution?.userAgent,
          expireTime: result.solution?.expireTime
        })
      }
    },
    reCaptchaV3: {
      standard: {
        type: 'ReCaptchaV3TaskProxyLess',
        price: USDTOCNY * 1 / 1000,
        prepareTask: ({ websiteURL, websiteKey, pageAction = 'verify', minScore = 0.7, enterprisePayload = null, apiDomain = '', userAgent = '', cookies = [] }) => ({
          websiteURL,
          websiteKey,
          pageAction,
          ...(minScore ? { minScore } : {}),
          ...(enterprisePayload ? { enterprisePayload } : {}),
          ...(apiDomain ? { apiDomain } : {}),
          ...(userAgent ? { userAgent } : {}),
          ...(cookies.length > 0 ? { cookies } : {})
        }),
        extractResult: (result) => ({
          gRecaptchaResponse: result.solution?.gRecaptchaResponse,
          userAgent: result.solution?.userAgent,
          expireTime: result.solution?.expireTime
        })
      },
      advanced: {
        type: 'ReCaptchaV3Task',
        price: USDTOCNY * 1 / 1000,
        prepareTask: ({ websiteURL, websiteKey, proxy, pageAction = 'verify', minScore = 0.7, enterprisePayload = null, apiDomain = '', userAgent = '', cookies = [] }) => ({
          websiteURL,
          websiteKey,
          proxy,
          pageAction,
          ...(minScore ? { minScore } : {}),
          ...(enterprisePayload ? { enterprisePayload } : {}),
          ...(apiDomain ? { apiDomain } : {}),
          ...(userAgent ? { userAgent } : {}),
          ...(cookies.length > 0 ? { cookies } : {})
        }),
        extractResult: (result) => ({
          gRecaptchaResponse: result.solution?.gRecaptchaResponse,
          userAgent: result.solution?.userAgent,
          expireTime: result.solution?.expireTime
        })
      }
    },
    cloudflareTurnstile: {
      standard: {
        type: 'AntiTurnstileTaskProxyLess',
        price: USDTOCNY * 1.2 / 1000,
        prepareTask: ({ websiteURL, websiteKey, metadata = {} }) => ({
          websiteURL,
          websiteKey,
          ...(metadata.action ? { action: metadata.action } : {}),
          ...(metadata.cdata ? { cdata: metadata.cdata } : {})
        }),
        extractResult: (result) => ({
          token: result.solution?.token,
          userAgent: result.solution?.userAgent,
        })
      }
    },
    geeTestV3: {
      standard: {
        type: 'GeeTestTaskProxyLess',
        price: USDTOCNY * 1.2 / 1000,
        prepareTask: ({ websiteURL, gt, challenge, geetestApiServerSubdomain = '' }) => ({
          websiteURL,
          gt,
          challenge,
          ...(geetestApiServerSubdomain ? { geetestApiServerSubdomain } : {})
        }),
        extractResult: (result) => ({
          challenge: result.solution?.challenge,
          validate: result.solution?.validate
        })
      },
    },
    geeTestV4: {
      standard: {
        type: 'GeeTestTaskProxyLess',
        price: USDTOCNY * 1.2 / 1000,
        prepareTask: ({ websiteURL, captchaId, geetestApiServerSubdomain = '' }) => ({
          websiteURL,
          captchaId,
          ...(geetestApiServerSubdomain ? { geetestApiServerSubdomain } : {})
        }),
        extractResult: (result) => ({
          captchaId: result.solution?.captcha_id,
          captchaOutput: result.solution?.captcha_output,
          genTime: result.solution?.gen_time,
          lotNumber: result.solution?.lot_number,
          passToken: result.solution?.pass_token,
          riskType: result.solution?.risk_type
        })
      }
    }
  },

  noCaptcha: {
    requestType: 'direct',
    reCaptcha: {
      universal: {
        price: NOCAPTCHA_CNY_PER_POINT * 300,
        apiEndpoint: '/api/wanda/recaptcha/universal',
        prepareTask: ({ sitekey, referer, size = 'normal', title, action = '', proxy = '', ubd = false }) => ({
          sitekey,
          referer,
          size,
          title,
          ...(action ? { action } : {}),
          ...(proxy ? { proxy } : {}),
          ...(ubd ? { ubd } : {})
        }),
        extractResult: (result) => result.data?.token
      }
    },
    hCaptcha: {
      universal: {
        price: NOCAPTCHA_CNY_PER_POINT * 300,
        apiEndpoint: '/api/wanda/hcaptcha/universal',
        prepareTask: ({ sitekey, referer, rqdata = '', domain = '', proxy = '', region = '', invisible = false, need_ekey = false }) => ({
          sitekey,
          referer,
          ...(rqdata ? { rqdata } : {}),
          ...(domain ? { domain } : {}),
          ...(proxy ? { proxy } : {}),
          ...(region ? { region } : {}),
          ...(invisible ? { invisible } : {}),
          ...(need_ekey ? { need_ekey } : {})
        }),
        extractResult: (result) => ({
          generatedPassUUID: result.data?.generated_pass_UUID,
          userAgent: result.data?.user_agent
        })
      }
    },
    cloudflareTurnstile: {
      universal: {
        price: NOCAPTCHA_CNY_PER_POINT * 300,
        apiEndpoint: '/api/wanda/cloudflare/universal',
        prepareTask: ({ href, sitekey, proxy = '', explicit = false, action = '', cdata = '', user_agent = '', alpha = false }) => ({
          href,
          sitekey,
          ...(proxy ? { proxy } : {}),
          ...(explicit ? { explicit } : {}),
          ...(action ? { action } : {}),
          ...(cdata ? { cdata } : {}),
          ...(user_agent ? { user_agent } : {}),
          ...(alpha ? { alpha } : {})
        }),
        extractResult: (result) => ({
          token: result.data?.token,
          extra: result.extra
        })
      }
    },
    cloudflare5sShield: {
      universal: {
        price: NOCAPTCHA_CNY_PER_POINT * 1000,
        apiEndpoint: '/api/wanda/cloudflare/universal',
        prepareTask: ({ href, proxy, user_agent = '', alpha = false }) => ({
          href,
          proxy,
          ...(user_agent ? { user_agent } : {}),
          ...(alpha ? { alpha } : {})
        }),
        extractResult: (result) => ({
          cookies: result.data?.cookies,
          extra: result.extra
        })
      }
    },
    vercel: {
      universal: {
        price: NOCAPTCHA_CNY_PER_POINT * 150,
        apiEndpoint: '/api/wanda/vercel/universal',
        prepareTask: ({ href, proxy = '', user_agent = '', timeout = 15 }) => ({
          href,
          ...(proxy ? { proxy } : {}),
          ...(user_agent ? { user_agent } : {}),
          ...(timeout ? { timeout } : {})
        }),
        extractResult: (result) => ({
          _vcrcs: result.data?._vcrcs,
          extra: result.extra
        })
      }
    },
    tls: {
      universal: {
        price: NOCAPTCHA_CNY_PER_POINT * 100,
        apiEndpoint: '/api/wanda/tls/v1',
        prepareTask: ({ url, method = 'get', headers = {}, cookies = {}, proxy = '', data = '', json = '', timeout = 15, http2 = false, redirect = true, ja3 = '' }) => ({
          url,
          ...(method ? { method } : {}),
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
          ...(Object.keys(cookies).length > 0 ? { cookies } : {}),
          ...(proxy ? { proxy } : {}),
          ...(data ? { data } : {}),
          ...(json ? { json } : {}),
          ...(timeout ? { timeout } : {}),
          ...(http2 ? { http2 } : {}),
          ...(redirect !== undefined ? { redirect } : {}),
          ...(ja3 ? { ja3 } : {})
        }),
        extractResult: (result) => ({
          text: result.data?.response?.text,
          cookies: result.data?.response?.cookies,
          tls: result.data?.response?.tls
        })
      }
    }
  }
};

class CaptchaClient {
  constructor(serviceName, config) {
    this.serviceName = serviceName;
    this.config = config;
    this.taskTypes = serviceTaskTypes[serviceName];
  }

  getTaskType(params) {
    // 获取验证码类型配置
    const captchaTypes = this.taskTypes[params.captchaType];
    // 获取任务类型配置
    return captchaTypes[params.taskVariant];
  }

  buildTaskParams(params) {
    const taskType = this.getTaskType(params);
    // 使用任务类型的prepareTask方法构建参数
    let taskParams = taskType.prepareTask(params);
    // 只有非noCaptcha服务才添加type参数
    if (this.serviceName !== 'noCaptcha') {
      taskParams = {
        ...taskParams,
        type: taskType.type
      };
    }
    return taskParams;
  }

  extractResult(result, taskType) {
    if (!taskType.extractResult) {
      throw new Error('任务类型未定义extractResult方法');
    }
    return taskType.extractResult(result);
  }

  async verifyWebsite(params) {
    const taskType = this.getTaskType(params);
    const taskParams = this.buildTaskParams(params);

    // console.log('params', params);
    // console.log('taskType', taskType);
    // console.log('taskParams', taskParams);

    // 根据requestType选择验证方式
    let result;
    if (this.taskTypes.requestType === 'direct') {
      result = await this.directVerify(taskParams, taskType.apiEndpoint);
    } else {
      // taskId方式处理流程
      const taskId = await this.createTask(taskParams);
      result = await this.getTaskResult(taskId);
    }

    // 统一提取结果
    return this.extractResult(result, taskType);
  }

  async createTask(taskParams) {
    return withRetry(
      async () => {

        // console.log('验证码请求数据:', taskParams);

        const response = await axios.post(`${this.config.baseUrl}/createTask`, {
          clientKey: this.config.clientKey,
          task: taskParams
        });

        const result = response.data;

        // console.log('创建验证任务响应数据:', result);

        // 统一检查错误和结果
        if (result.errorId > 0 || !result.taskId) {
          throw new Error(result.errorDescription || '服务器返回的taskId为空');
        }

        return result.taskId;
      },
      {
        taskName: '创建验证任务',
        logContext: {
          "服务商": this.serviceName,
          "验证码类型": taskParams.captchaType,
          "任务类型": taskParams.taskVariant,
        }
      }
    );
  }

  async getTaskResult(taskId) {
    if (!taskId) {
      notificationManager.error({
        "message": '获取结果失败',
        "context": {
          "服务商": this.serviceName,
          "原因": "taskId不能为空"
        }
      });
      return false;
    }

    return withRetry(
      async () => {
        const response = await axios.post(`${this.config.baseUrl}/getTaskResult`, {
          clientKey: this.config.clientKey,
          taskId
        });
        const result = response.data;
        
        // console.log('获取验证结果响应数据:', result);

        // 检查错误和状态
        if (result.errorId > 0 || result.status !== 'ready') {
          // 处理中状态特殊处理
          if (result.status === 'processing') {
            await new Promise(resolve => setTimeout(resolve, 3000));
            throw new Error('验证码处理超时');
          }
          // 其他错误状态
          throw new Error(result.errorDescription || `验证码状态异常: ${result.status}`);
        }

        return result;
      },
      {
        taskName: '获取验证结果',
        logContext: {
          "服务商": this.serviceName,
          "任务ID": taskId
        }
      }
    );
  }

  async directVerify(taskParams, apiEndpoint) {
    return withRetry(
      async () => {
        const headers = {
          "User-Token": this.config.userToken,
          "Content-Type": "application/json",
        };
        
        // console.log('验证码请求头:', headers);
        // console.log('验证码请求数据:', taskParams);
        // console.log('验证码请求URL:', `${this.config.baseUrl}${apiEndpoint}`);

        const response = await axios.post(
          `${this.config.baseUrl}${apiEndpoint}`,
          taskParams,
          { headers }
        );

        const result = response.data;

        // console.log('获取验证结果响应数据:', result);

        // 统一检查状态
        if (result.status !== 1) {
          throw new Error(result.msg || '验证失败');
        }

        return result;
      },
      {
        taskName: '直接验证',
        logContext: {
          "服务商": this.serviceName,
          "验证码类型": taskParams.captchaType,
          "任务类型": taskParams.taskVariant,
          "API": taskParams.apiEndpoint
        }
      }
    );
  }
}

// 统一管理器
class CaptchaManager {
  constructor() {
    this.services = {};
  }

  initService(serviceName) {
    try {
      // 如果已经初始化过，直接返回
      if (this.services[serviceName]) {
        return this.services[serviceName];
      }

      // 检查环境变量
      const envKey = `${serviceName}ClientKey`;
      if (!process.env[envKey]) {
        notificationManager.error({
          "message": '初始化失败',
          "context": {
            "服务商": serviceName,
            "原因": "未配置API密钥"
          }
        });
        return null;
      }

      // 创建配置
      const config = {
        ...(serviceName === 'noCaptcha'
          ? { userToken: process.env[envKey] }
          : { clientKey: process.env[envKey] }),
        baseUrl: serviceName === 'yesCaptcha'
          ? 'https://api.yescaptcha.com'
          : serviceName === 'noCaptcha'
            ? 'http://api.nocaptcha.io'
            : 'https://api.capsolver.com'
      };
      // console.log('配置:', config);

      this.services[serviceName] = new CaptchaClient(serviceName, config);

      return this.services[serviceName];
    } catch (error) {
      notificationManager.error({
        "message": '初始化失败',
        "context": {
          "服务商": serviceName,
          "原因": error.message,
          // "错误信息": error.stack
        }
      });
      return null;
    }
  }

  async verifyWebsite(params) {
    // 验证服务商
    if (!params.captchaService || !serviceTaskTypes[params.captchaService]) {
      const supportedServices = Object.keys(serviceTaskTypes).join(', ');
      notificationManager.error({
        "message": '验证失败',
        "context": {
          "服务商": params.captchaService,
          "原因": `未指定或不支持的服务商，支持: ${supportedServices}`
        }
      });
      return false;
    }

    // 初始化服务
    const service = this.initService(params.captchaService);
    if (!service) {
      return false;
    }

    // 验证验证码类型
    const serviceTypes = serviceTaskTypes[params.captchaService];
    if (!serviceTypes[params.captchaType]) {
      const supportedTypes = Object.keys(serviceTypes).join(', ');
      notificationManager.error({
        "message": '验证失败',
        "context": {
          "服务商": params.captchaService,
          "原因": `未指定或不支持的验证码类型 ${params.captchaType}，支持: ${supportedTypes}`
        }
      });
      return false;
    }

    // 验证任务类型
    const captchaTypes = serviceTypes[params.captchaType];
    if (!captchaTypes[params.taskVariant]) {
      const supportedTaskTypes = Object.keys(captchaTypes).join(', ');
      notificationManager.error({
        "message": '验证失败',
        "context": {
          "服务商": params.captchaService,
          "验证码类型": params.captchaType,
          "原因": `未指定或不支持的任务类型 ${params.taskVariant}，支持: ${supportedTaskTypes}`
        }
      });
      return false;
    }


    try {

      // 获取任务类型配置和价格
      const taskType = service.getTaskType(params);
      const price = taskType.price;

      notificationManager.info({
        "message": '开始验证网站验证码',
        "context": {
          "服务商": params.captchaService,
          "验证码类型": params.captchaType,
          "任务类型": params.taskVariant,
          "价格": `¥${price.toFixed(4)}/次`
        }
      });

      const result = await service.verifyWebsite(params);


      notificationManager.info({
        "message": '网站验证码验证完成',
        "context": {
          "服务商": params.captchaService,
          "验证码类型": params.captchaType,
          "任务类型": params.taskVariant,
        }
      });

      return result;
    } catch (error) {
      notificationManager.error({
        "message": '网站验证码验证失败',
        "context": {
          "服务商": params.captchaService,
          "验证码类型": params.captchaType,
          "任务类型": params.taskVariant,
          "原因": error.message
        }
      });
      return false;
    }
  }

  // 显示价格排序
  showPriceSorting(captchaType, version, taskType) {
    const providers = [];

    for (const [provider, service] of Object.entries(this.services)) {
      try {
        const taskTypeInfo = service.getTaskType({
          captchaType,
          version,
          taskType
        });

        if (taskTypeInfo) {
          providers.push({
            provider,
            type: taskTypeInfo.type,
            price: taskTypeInfo.price
          });
        }
      } catch (e) {
        // 忽略不支持的服务商
      }
    }

    if (providers.length > 0) {
      providers.sort((a, b) => a.price - b.price);
      console.log(`\n价格排序 [${captchaType} ${version || ''} ${taskType || ''}]`);
      providers.forEach(({ provider, type, price }, index) => {
        console.log(`[${index + 1}] ${provider} - ${type}: ¥${price.toFixed(4)}/次`);
      });
    }
  }
}

// 只导出验证码管理器实例
export const captchaManager = new CaptchaManager();