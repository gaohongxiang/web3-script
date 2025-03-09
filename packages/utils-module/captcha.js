import 'dotenv/config';
import axios from 'axios';
import { withRetry } from './retry.js';
import { notificationManager } from '../notification-module/notification.js';

/**
 * YesCaptcha验证码服务客户端
 * 参考文档: https://yescaptcha.atlassian.net/wiki/spaces/YESCAPTCHA/pages/164286
 */
class YesCaptchaClient {
  constructor(clientKey = process.env.yesCaptchaClientKey) {
    this.clientKey = clientKey;
    this.baseUrl = "https://api.yescaptcha.com";

    const CNY_PER_POINT = 1 / 1000;

    // YesCaptcha 验证码任务处理策略
    this.captchaStrategies = {
      // reCAPTCHA V2 策略
      recaptchaV2: {
        defaultTaskType: 'standard',
        taskTypes: {
          // 标准版
          standard: {
            type: 'NoCaptchaTaskProxyless',
            price: CNY_PER_POINT * 15,
            prepareTask: ({ websiteURL, websiteKey, isInvisible = false }) => ({
              websiteURL,
              websiteKey,
              isInvisible
            })
          },
          // 高级版
          advanced: {
            type: 'RecaptchaV2TaskProxyless',
            price: CNY_PER_POINT * 20,
            prepareTask: ({ websiteURL, websiteKey, isInvisible = false }) => ({
              websiteURL,
              websiteKey,
              isInvisible
            })
          },
          // K1定制版
          k1: {
            type: 'RecaptchaV2TaskProxylessK1',
            price: CNY_PER_POINT * 20,
            prepareTask: ({ websiteURL, websiteKey, isInvisible = false }) => ({
              websiteURL,
              websiteKey,
              isInvisible
            })
          }
        },
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },

      // reCAPTCHA V3 策略
      recaptchaV3: {
        defaultTaskType: 'standard',
        taskTypes: {
          // 标准版
          standard: {
            type: 'RecaptchaV3TaskProxyless',
            price: CNY_PER_POINT * 20,
            prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
              websiteURL,
              websiteKey,
              ...(pageAction ? { pageAction } : {})
            })
          },
          // M1版本
          m1: {
            type: 'RecaptchaV3TaskProxylessM1',
            price: CNY_PER_POINT * 25,
            prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
              websiteURL,
              websiteKey,
              ...(pageAction ? { pageAction } : {})
            })
          },
          // K1定制版
          k1: {
            type: 'RecaptchaV3TaskProxylessK1',
            price: CNY_PER_POINT * 25,
            prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
              websiteURL,
              websiteKey,
              ...(pageAction ? { pageAction } : {})
            })
          },
          // 强制分值0.7版本
          m1s7: {
            type: 'RecaptchaV3TaskProxylessM1S7',
            price: CNY_PER_POINT * 30,
            prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
              websiteURL,
              websiteKey,
              ...(pageAction ? { pageAction } : {})
            })
          },
          // 强制分值0.9版本
          m1s9: {
            type: 'RecaptchaV3TaskProxylessM1S9',
            price: CNY_PER_POINT * 35,
            prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
              websiteURL,
              websiteKey,
              ...(pageAction ? { pageAction } : {})
            })
          }
        },
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },

      // hCaptcha 策略
      hcaptcha: {
        defaultTaskType: 'standard',
        taskTypes: {
          standard: {
            type: 'HCaptchaTaskProxyless',
            price: CNY_PER_POINT * 30,
            prepareTask: ({ websiteURL, websiteKey }) => ({
              websiteURL,
              websiteKey
            })
          }
        },
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },
      // CloudflareTurnstile 策略
      CloudflareTurnstile: {
        defaultTaskType: 'standard',
        taskTypes: {
          standard: {
            type: 'TurnstileTaskProxyless',
            price: CNY_PER_POINT * 25,
            prepareTask: ({ websiteURL, websiteKey }) => ({
              websiteURL,
              websiteKey
            })
          },
          m1: {
            type: 'TurnstileTaskProxylessM1',
            price: CNY_PER_POINT * 30,
            prepareTask: ({ websiteURL, websiteKey }) => ({
              websiteURL,
              websiteKey
            })
          }
        },
        extractResult: (result) => result.solution?.token
      },

      // CloudFlare5秒盾策略
      cloudflare: {
        defaultTaskType: 's2',
        taskTypes: {
          s2: {
            type: 'CloudFlareTaskS2',
            price: CNY_PER_POINT * 25,
            // 注意：代理不支持带密码的socks5代理
            prepareTask: ({ websiteURL, proxy }) => ({
              websiteURL,
              type: 'CloudFlareTaskS2',
              ...proxy
            })
          }
        },
        extractResult: (result) => result.solution?.cookies
      }
    };
  }

  /**
   * 创建验证码任务
   */
  async createTask({ captchaType = 'recaptchaV2', taskVariant, ...params }) {
    const strategy = this.captchaStrategies[captchaType];
    if (!strategy) return { error: `不支持的验证码类型 ${captchaType}` };

    const variant = strategy.taskTypes[taskVariant] ||
      strategy.taskTypes[strategy.defaultTaskType] ||
      strategy.taskTypes[Object.keys(strategy.taskTypes)[0]];
    if (!variant) return { error: `不支持的任务变体 ${taskVariant}` };

    const taskParams = variant.prepareTask(params);
    const taskData = {
      ...taskParams,
      type: variant.type
    };

    return withRetry(
      async () => {
        const result = await axios.post(`${this.baseUrl}/createTask`, {
          clientKey: this.clientKey,
          task: taskData
        });

        // 处理业务层面的错误
        if (result.data.errorId > 0) {
          throw new Error(result.data.errorDescription || '未知错误');
        }

        if (!result.data.taskId) {
          throw new Error('服务器返回的taskId为空');
        }

        return result.data.taskId;
      },
      {
        taskName: '创建验证任务',
        logContext: {
          "服务商": "YesCaptcha",
          "任务类型": captchaType,
          "任务变体": taskVariant || strategy.defaultTaskType
        }
      }
    );
  }

  /**
   * 获取任务结果
   */
  async getTaskResult(taskId, captchaType) {
    if (!taskId) {
      notificationManager.error({
        "message": '获取结果失败',
        "context": {
          "服务商": "YesCaptcha",
          "原因": "taskId不能为空"
        }
      });
      return false;
    }

    const strategy = this.captchaStrategies[captchaType];

    return withRetry(
      async () => {
        const result = await axios.post(`${this.baseUrl}/getTaskResult`, {
          clientKey: this.clientKey,
          taskId
        });

        if (result.data.errorId > 0) {
          throw new Error(result.data.errorDescription || '未知错误');
        }

        // 如果任务还在处理中，则等待3秒后重试
        if (result.data.status === 'processing') {
          await new Promise(resolve => setTimeout(resolve, 3000));
          throw new Error('验证码处理超时');
        }

        if (result.data.status === 'ready') {
          const solution = strategy.extractResult(result.data);
          if (!solution) {
            throw new Error('无法从结果中提取验证码');
          }
          return solution;
        }
      },
      {
        taskName: '验证网站验证码',
        logContext: {
          "服务商": "YesCaptcha",
        }
      }
    );
  }

  /**
   * 验证网站验证码
   */
  async verifyWebsite({ captchaType = 'recaptchaV2', taskVariant, ...params }) {
    try {
      const taskId = await this.createTask({ captchaType, taskVariant, ...params });

      const result = await this.getTaskResult(taskId, captchaType);
      if (!result) return false;

      return result;
    } catch (error) {
      notificationManager.error({
        "message": '验证网站验证码',
        "context": {
          "服务商": "YesCaptcha",
          "任务类型": captchaType,
          "任务变体": taskVariant,
          "原因": error.message
        }
      });
      return false;
    }
  }
}

/**
 * NoCaptcha验证码服务客户端
 * 参考文档: https://chrisyp.github.io/
 */
class NoCaptchaClient {
  constructor(userToken = process.env.noCaptchaClientKey) {
    this.userToken = userToken;
    this.baseUrl = "http://api.nocaptcha.io";

    const USDTOCNY = 7.3;
    const CNY_PER_POINT = USDTOCNY / 66000;
    /**
     * NoCaptcha 验证码任务处理策略
     */
    this.captchaStrategies = {
      // reCAPTCHA 策略
      recaptcha: {
        defaultTaskType: 'universal',
        taskTypes: {
          // 通用版本
          universal: {
            price: CNY_PER_POINT * 300,
            apiEndpoint: '/api/wanda/recaptcha/universal',
            prepareTask: ({
              sitekey,
              referer,
              title,
              size = 'normal',
              action = '',
              proxy = '',
              ubd = false
            }) => ({
              sitekey,
              referer,
              title,
              size,
              ...(action ? { action } : {}),
              ...(proxy ? { proxy } : {}),
              ...(ubd ? { ubd } : {})
            })
          }
        },
        extractResult: (result) => result.data?.token
      },

      // hCaptcha 策略
      hcaptcha: {
        defaultTaskType: 'universal',
        taskTypes: {
          // 通用版本
          universal: {
            price: CNY_PER_POINT * 300,
            apiEndpoint: '/api/wanda/hcaptcha/universal',
            prepareTask: ({
              sitekey,
              referer,
              rqdata = '',
              domain = '',
              proxy = '',
              region = '',
              invisible = false,
              need_ekey = false,
            }) => ({
              sitekey,
              referer,
              ...(rqdata ? { rqdata } : {}),
              ...(domain ? { domain } : {}),
              ...(proxy ? { proxy } : {}),
              ...(region ? { region } : {}),
              ...(invisible ? { invisible } : {}),
              ...(need_ekey ? { need_ekey } : {}),
            })
          }
        },
        extractResult: (result) => {
          // hCaptcha 返回的是 generated_pass_UUID
          return result.data?.generated_pass_UUID;
        }
      }
    };
  }

  /**
   * 验证网站验证码
   */
  async verifyWebsite({ captchaType = 'recaptcha', taskVariant, ...params }) {
    try {
      // 获取对应的策略
      const strategy = this.captchaStrategies[captchaType];
      if (!strategy) return { error: `不支持的验证码类型 ${captchaType}` };

      const variant = strategy.taskTypes[taskVariant] ||
        strategy.taskTypes[strategy.defaultTaskType] ||
        strategy.taskTypes[Object.keys(strategy.taskTypes)[0]];
      if (!variant) return { error: `不支持的任务变体 ${taskVariant}` };

      // 从任务变体中获取API端点
      const apiEndpoint = variant.apiEndpoint;
      if (!apiEndpoint) return { error: `未定义API端点` };

      // 准备任务数据
      const taskData = variant.prepareTask(params);

      return withRetry(
        async () => {
          const result = await axios.post(`${this.baseUrl}${apiEndpoint}`, {
            userToken: this.userToken,
            data: taskData
          });

          if (result.data.errorId > 0) {
            throw new Error(result.data.errorDescription || '未知错误');
          }

          if (result.data.status === 0) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            throw new Error('验证码处理超时');
          }

          if (result.data.status === 1) {
            const solution = strategy.extractResult(result.data);
            if (!solution) {
              throw new Error('无法从结果中提取验证码');
            }
            return solution;
          }
        },
        {
          taskName: '验证网站验证码',
          logContext: {
            "服务商": "NoCaptcha",
            "任务类型": captchaType,
            "任务变体": taskVariant
          }
        }
      );
    } catch (error) {
      notificationManager.error({
        "message": '验证网站验证码',
        "context": {
          "服务商": "NoCaptcha",
          "任务类型": captchaType,
          "任务变体": taskVariant,
          "原因": error.message
        }
      });
      return false;
    }
  }
}

/**
 * CapSolver验证码服务客户端
 * 参考文档: https://docs.capsolver.com/guide/getting-started.html
 */
class CapSolverClient {
  constructor(clientKey = process.env.capSolverClientKey) {
    this.clientKey = clientKey;
    this.baseUrl = "https://api.capsolver.com";
    const USDTOCNY = 7.3;
    // CapSolver 验证码任务处理策略
    this.captchaStrategies = {
      // reCAPTCHA V2 策略
      recaptchaV2: {
        defaultTaskType: 'standard',
        taskTypes: {
          standard: {
            type: 'ReCaptchaV2TaskProxyLess',
            price: USDTOCNY * 0.8 / 1000,
            prepareTask: ({ websiteURL, websiteKey, isInvisible = false }) => ({
              type: 'ReCaptchaV2TaskProxyLess',
              websiteURL,
              websiteKey,
              isInvisible
            })
          }
        },
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },

      // reCAPTCHA V3 策略
      recaptchaV3: {
        defaultTaskType: 'standard',
        taskTypes: {
          standard: {
            type: 'ReCaptchaV3TaskProxyLess',
            price: USDTOCNY * 1 / 1000,
            prepareTask: ({ websiteURL, websiteKey, pageAction = 'verify', minScore = 0.7 }) => ({
              websiteURL,
              websiteKey,
              pageAction,
              minScore
            })
          }
        },
        extractResult: (result) => result.solution?.gRecaptchaResponse
      },

      // Cloudflare Turnstile 策略
      CloudflareTurnstile: {
        defaultTaskType: 'standard',
        taskTypes: {
          standard: {
            type: 'AntiTurnstileTaskProxyLess',
            price: USDTOCNY * 1.2 / 1000,
            prepareTask: ({ websiteURL, websiteKey }) => ({
              websiteURL,
              websiteKey
            })
          }
        },
        extractResult: (result) => result.solution?.token
      },

      // GeeTest V3 策略
      geeTestV3: {
        defaultTaskType: 'standard',
        taskTypes: {
          standard: {
            type: 'GeeTestTaskProxyLess',
            price: USDTOCNY * 1.2 / 1000,
            prepareTask: ({ websiteURL, gt, challenge, geetestApiServerSubdomain }) => ({
              websiteURL,
              gt,
              challenge,
              ...(geetestApiServerSubdomain ? { geetestApiServerSubdomain } : {})
            })
          }
        },
        extractResult: (result) => ({
          challenge: result.solution?.challenge,
          validate: result.solution?.validate
        })
      },

      // GeeTest V4 策略
      geeTestV4: {
        defaultTaskType: 'standard',
        taskTypes: {
          standard: {
            type: 'GeeTestTaskProxyLess',
            price: USDTOCNY * 1.2 / 1000,
            prepareTask: ({ websiteURL, captchaId, geetestApiServerSubdomain }) => ({
              websiteURL,
              captchaId,
              ...(geetestApiServerSubdomain ? { geetestApiServerSubdomain } : {})
            })
          }
        },
        extractResult: (result) => ({
          captchaId: result.solution?.captcha_id,
          captchaOutput: result.solution?.captcha_output,
          genTime: result.solution?.gen_time,
          lotNumber: result.solution?.lot_number,
          passToken: result.solution?.pass_token,
          riskType: result.solution?.risk_type
        })
      },
    };
  }

  /**
   * 创建验证码任务
   */
  async createTask({ captchaType = 'recaptchaV2', taskVariant, ...params }) {

    const strategy = this.captchaStrategies[captchaType];
    if (!strategy) return { error: `不支持的验证码类型 ${captchaType}` };

    // 确定任务变体
    const variant = strategy.taskTypes[taskVariant] ||
      strategy.taskTypes[strategy.defaultTaskType] ||
      strategy.taskTypes[Object.keys(strategy.taskTypes)[0]];
    if (!variant) return { error: `不支持的任务变体 ${taskVariant}` };
    // console.log('variant', variant)

    // 准备任务数据
    const taskParams = variant.prepareTask(params);
    // 添加任务类型
    const taskData = {
      ...taskParams,
      type: variant.type
    };

    return withRetry(
      async () => {
        const result = await axios.post(`${this.baseUrl}/createTask`, {
          clientKey: this.clientKey,
          task: taskData
        });

        // 处理业务层面的错误
        if (result.data.errorId > 0) {
          throw new Error(result.data.errorDescription || '未知错误');
        }

        if (!result.data.taskId) {
          throw new Error('服务器返回的taskId为空');
        }

        return result.data.taskId;
      },
      {
        taskName: '创建验证任务',
        logContext: {
          "服务商": "CapSolver",
          "任务类型": captchaType,
          "任务变体": taskVariant || strategy.defaultTaskType
        }
      }
    );
  }

  /**
   * 获取任务结果
   */
  async getTaskResult(taskId, captchaType) {
    if (!taskId) {
      notificationManager.error({
        "message": '获取结果失败',
        "context": {
          "服务商": "CapSolver",
          "原因": "taskId不能为空"
        }
      });
      return false;
    }

    const strategy = this.captchaStrategies[captchaType];

    return withRetry(
      async () => {
        const result = await axios.post(`${this.baseUrl}/getTaskResult`, {
          clientKey: this.clientKey,
          taskId
        });

        if (result.data.errorId > 0) {
          throw new Error(result.data.errorDescription || '未知错误');
        }

        // 如果任务还在处理中，则等待3秒后重试
        if (result.data.status === 'processing') {
          await new Promise(resolve => setTimeout(resolve, 3000));
          throw new Error('验证码处理超时');
        }

        if (result.data.status === 'ready') {
          const solution = strategy.extractResult(result.data);
          if (!solution) {
            throw new Error('无法从结果中提取验证码');
          }
          return solution;
        }
      },
      {
        taskName: '验证网站验证码',
        logContext: {
          "服务商": "CapSolver",
        }
      }
    );
  }

  /**
  * 验证网站验证码
  */
  async verifyWebsite({ captchaType = 'recaptchaV2', taskVariant, ...params }) {

    try {
      const taskId = await this.createTask({ captchaType, taskVariant, ...params });

      const result = await this.getTaskResult(taskId, captchaType);
      if (!result) return false;

      return result;
    } catch (error) {
      notificationManager.error({
        "message": '验证网站验证码',
        "context": {
          "服务商": "CapSolver",
          "任务类型": captchaType,
          "任务变体": taskVariant,
          "原因": error.message
        }
      });
      return false;
    }
  }
}

/**
 * 验证码服务管理器
 * 负责管理多个验证码服务商,自动选择最优服务或使用指定服务
 */
class CaptchaManager {
  constructor() {
    this.services = {
      yesCaptcha: new YesCaptchaClient(),
      noCaptcha: new NoCaptchaClient(),
      capSolver: new CapSolverClient()
    };
  }

  // 显示价格排序作为参考
  showPriceSorting(captchaType, taskVariant) {
    const providers = [];
    for (const [provider, service] of Object.entries(this.services)) {
      const strategy = service.captchaStrategies[captchaType];
      if (!strategy) continue;

      if (taskVariant) {
        const variant = strategy.taskTypes[taskVariant];
        if (variant) {
          providers.push({
            provider,
            variant: taskVariant,
            price: variant.price
          });
        }
      } else {
        const defaultVariant = strategy.taskTypes[strategy.defaultTaskType];
        providers.push({
          provider,
          variant: strategy.defaultTaskType,
          price: defaultVariant.price
        });
      }
    }

    if (providers.length > 0) {
      providers.sort((a, b) => a.price - b.price);
      notificationManager.info(`价格排序 [任务类型 ${captchaType}${taskVariant ? ` (${taskVariant})` : ''}]`);
      providers.forEach(({ provider, variant, price }, index) => {
        notificationManager.info(`[排名 ${index + 1}] [服务商 ${provider}] [变体 ${variant}] [价格 ¥${price.toFixed(4)}/次]`);
      });
    }
  }

  async verifyWebsite({ captchaService, captchaType, taskVariant, ...params }) {
    // 验证服务商
    if (!captchaService || !this.services[captchaService]) {
      const supportedServices = Object.keys(this.services).join(', ');
      notificationManager.error({
        "message": '验证失败',
        "context": {
          "服务商": captchaService,
          "原因": `不支持的服务商，支持: ${supportedServices}`
        }
      });
      return false;
    }

    const service = this.services[captchaService];

    // 验证验证码类型
    if (!service.captchaStrategies[captchaType]) {
      const supportedTypes = Object.keys(service.captchaStrategies).join(', ');
      notificationManager.error({
        "message": '验证失败',
        "context": {
          "服务商": captchaService,
          "原因": `不支持的验证码类型 ${captchaType}，支持: ${supportedTypes}`
        }
      });
      return false;
    }

    const strategy = service.captchaStrategies[captchaType];

    // 验证任务变体
    if (taskVariant && !strategy.taskTypes[taskVariant]) {
      const supportedVariants = Object.keys(strategy.taskTypes).join(', ');
      notificationManager.error({
        "message": '验证失败',
        "context": {
          "服务商": captchaService,
          "原因": `不支持的任务变体 ${taskVariant}，支持: ${supportedVariants}`
        }
      });
      return false;
    }

    // 使用指定的服务商
    const variant = strategy && (taskVariant ? strategy.taskTypes[taskVariant] : strategy.taskTypes[strategy.defaultTaskType]);
    const price = variant ? variant.price : 0;

    // 显示价格排序
    // this.showPriceSorting(captchaType, taskVariant);

    // 开始验证
    notificationManager.info({
      "message": '开始验证网站验证码',
      "context": {
        "服务商": captchaService,
        "任务类型": captchaType,
        "任务变体": taskVariant,
        "价格": `¥${price.toFixed(4)}/次`
      }
    });

    const result = await service.verifyWebsite({ captchaType, taskVariant, ...params });
    // console.log('验证码结果', result)
    notificationManager.info({
      "message": '网站验证码验证完成',
      "context": {
        "服务商": captchaService,
        "任务类型": captchaType,
        "任务变体": taskVariant,
        // "结果": result
      }
    });
    return result;
  }
}

// 只导出验证码管理器实例
export const captchaManager = new CaptchaManager();

/**
 * 在浏览器中查找reCAPTCHA信息
 * 在控制台中运行此函数可获取页面上所有reCAPTCHA实例的信息
 */
function findRecaptchaClients() {
  // eslint-disable-next-line camelcase
  if (typeof (___grecaptcha_cfg) !== 'undefined') {
    // eslint-disable-next-line camelcase, no-undef
    return Object.entries(___grecaptcha_cfg.clients).map(([cid, client]) => {
      const data = { id: cid, version: cid >= 10000 ? 'V3' : 'V2' };
      const objects = Object.entries(client).filter(([_, value]) => value && typeof value === 'object');

      objects.forEach(([toplevelKey, toplevel]) => {
        const found = Object.entries(toplevel).find(([_, value]) => (
          value && typeof value === 'object' && 'sitekey' in value && 'size' in value
        ));

        if (typeof toplevel === 'object' && toplevel instanceof HTMLElement && toplevel['tagName'] === 'DIV') {
          data.pageurl = toplevel.baseURI;
        }

        if (found) {
          const [sublevelKey, sublevel] = found;

          data.sitekey = sublevel.sitekey;
          const callbackKey = data.version === 'V2' ? 'callback' : 'promise-callback';
          const callback = sublevel[callbackKey];
          if (!callback) {
            data.callback = null;
            data.function = null;
          } else {
            data.function = callback;
            const keys = [cid, toplevelKey, sublevelKey, callbackKey].map((key) => `['${key}']`).join('');
            data.callback = `___grecaptcha_cfg.clients${keys}`;
          }
        }
      });
      return data;
    });
  }
  return [];
}
findRecaptchaClients();