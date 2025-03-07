import 'dotenv/config';

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
   * @param {Object} options - 任务选项
   * @param {string} [options.captchaType='recaptchaV2'] - 验证码类型，默认为recaptchaV2
   * @param {string} [options.taskVariant] - 任务变体类型
   * @returns {Promise<string>} 任务ID
   */
  async createTask(options) {
    const { captchaType = 'recaptchaV2', taskVariant, ...params } = options;

    // 获取对应的策略
    const strategy = this.captchaStrategies[captchaType];
    if (!strategy) {
      throw new Error(`不支持的验证码类型: ${captchaType}`);
    }

    // 确定任务变体
    let variant;
    if (taskVariant && strategy.taskTypes[taskVariant]) {
      variant = strategy.taskTypes[taskVariant];
    } else if (strategy.defaultTaskType && strategy.taskTypes[strategy.defaultTaskType]) {
      variant = strategy.taskTypes[strategy.defaultTaskType];
    } else {
      // 如果没有指定默认类型，使用第一个可用的类型
      const firstType = Object.keys(strategy.taskTypes)[0];
      variant = strategy.taskTypes[firstType];
    }

    if (!variant) {
      throw new Error(`验证码类型 ${captchaType} 不支持任务变体 ${taskVariant}`);
    }

    // 准备任务数据
    const taskParams = variant.prepareTask(params);

    // 添加任务类型
    const taskData = {
      ...taskParams,
      type: variant.type
    };

    const data = {
      clientKey: this.clientKey,
      task: taskData
    };

    try {
      const response = await fetch(`${this.baseUrl}/createTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.errorId > 0) {
        throw new Error(`创建任务失败: ${result.errorDescription || '未知错误'}`);
      }

      // console.log(`${captchaType}${taskVariant ? ` (${taskVariant})` : ''} 任务创建成功:`, result.taskId);
      return result.taskId;
    } catch (error) {
      console.error(`创建 ${captchaType} 任务失败:`, error);
      throw error;
    }
  }

  /**
   * 获取任务结果
   * @param {string} taskId - 任务ID
   * @param {string} captchaType - 验证码类型
   * @param {number} [maxAttempts=40] - 最大尝试次数
   * @param {number} [interval=3000] - 轮询间隔(毫秒)
   * @returns {Promise<string>} 验证码结果
   */
  async getTaskResult(taskId, captchaType, maxAttempts = 40, interval = 3000) {
    // console.log(`正在识别 ${captchaType}...`);

    // 获取对应的策略
    const strategy = this.captchaStrategies[captchaType];
    if (!strategy) {
      throw new Error(`不支持的验证码类型: ${captchaType}`);
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/getTaskResult`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientKey: this.clientKey,
            taskId
          })
        });

        const result = await response.json();

        if (result.errorId > 0) {
          throw new Error(`获取结果失败: ${result.errorDescription || '未知错误'}`);
        }

        if (result.status === 'ready') {
          // 使用策略提取结果
          const captchaResponse = strategy.extractResult(result);
          if (captchaResponse) {
            // console.log(`${captchaType} 识别成功 (尝试 ${attempt}/${maxAttempts})`);
            return captchaResponse;
          }
        }

        // console.log(`等待 ${captchaType} 结果... (${attempt}/${maxAttempts})`);
      } catch (error) {
        console.error(`获取 ${captchaType} 结果失败 (尝试 ${attempt}/${maxAttempts}):`, error);
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    throw new Error(`${captchaType} 识别超时`);
  }

  /**
   * 验证网站验证码
   * @param {Object} options - 验证选项
   * @param {string} [options.captchaType='recaptchaV2'] - 验证码类型，默认为recaptchaV2
   * @param {string} [options.taskVariant] - 任务变体类型
   * @returns {Promise<string>} 验证码结果
   */
  async verifyWebsite(options) {
    const { captchaType = 'recaptchaV2', taskVariant, maxAttempts, interval, ...params } = options;

    try {
      console.log(`[YesCaptcha] 开始${captchaType}验证${taskVariant ? ` (${taskVariant})` : ''}...`);

      const taskId = await this.createTask({
        captchaType,
        taskVariant,
        ...params
      });

      const result = await this.getTaskResult(taskId, captchaType, maxAttempts, interval);
      console.log(`[YesCaptcha] ${captchaType}验证完成${taskVariant ? ` (${taskVariant})` : ''}`);

      return result;
    } catch (error) {
      console.error(`[YesCaptcha] ${captchaType}验证失败:`, error);
      throw error;
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
   * @param {Object} options - 验证选项
   * @param {string} [options.captchaType='recaptcha'] - 验证码类型，默认为recaptcha
   * @param {string} [options.taskVariant] - 任务变体类型
   * @returns {Promise<string>} 验证码结果
   */
  async verifyWebsite(options) {
    const { captchaType = 'recaptcha', taskVariant, ...params } = options;

    try {
      console.log(`[NoCaptcha] 开始${captchaType}验证${taskVariant ? ` (${taskVariant})` : ''}...`);

      // 获取对应的策略
      const strategy = this.captchaStrategies[captchaType];
      if (!strategy) {
        throw new Error(`不支持的验证码类型: ${captchaType}`);
      }

      // 确定任务变体
      let variant;
      if (taskVariant && strategy.taskTypes[taskVariant]) {
        variant = strategy.taskTypes[taskVariant];
      } else if (strategy.defaultTaskType && strategy.taskTypes[strategy.defaultTaskType]) {
        variant = strategy.taskTypes[strategy.defaultTaskType];
      } else {
        // 如果没有指定默认类型，使用第一个可用的类型
        const firstType = Object.keys(strategy.taskTypes)[0];
        variant = strategy.taskTypes[firstType];
      }

      if (!variant) {
        throw new Error(`验证码类型 ${captchaType} 不支持任务变体 ${taskVariant}`);
      }

      // 准备任务数据
      const taskData = variant.prepareTask(params);

      // 从任务变体中获取API端点
      const apiEndpoint = variant.apiEndpoint;
      if (!apiEndpoint) {
        throw new Error(`验证码类型 ${captchaType} 的任务变体 ${taskVariant || strategy.defaultTaskType} 未定义API端点`);
      }

      const response = await fetch(`${this.baseUrl}${apiEndpoint}`, {
        method: 'POST',
        headers: {
          'User-Token': this.userToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });

      const result = await response.json();

      if (result.status !== 1) {
        throw new Error(`验证失败: ${result.msg || '未知错误'}`);
      }

      console.log(`[NoCaptcha] ${captchaType}验证完成${taskVariant ? ` (${taskVariant})` : ''}`);

      // 提取结果
      return strategy.extractResult(result);
    } catch (error) {
      console.error(`[NoCaptcha] ${captchaType}验证失败:`, error);
      throw error;
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
      cloudflare: {
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
          captcha_id: result.solution?.captcha_id,
          captcha_output: result.solution?.captcha_output,
          gen_time: result.solution?.gen_time,
          lot_number: result.solution?.lot_number,
          pass_token: result.solution?.pass_token,
          risk_type: result.solution?.risk_type
        })
      },
    };
  }

  /**
   * 创建验证码任务
   */
  async createTask(options) {
    const { captchaType = 'recaptchaV2', taskVariant, ...params } = options;

    const strategy = this.captchaStrategies[captchaType];
    if (!strategy) {
      throw new Error(`不支持的验证码类型: ${captchaType}`);
    }

    // 确定任务变体
    let variant = strategy.taskTypes[taskVariant] ||
      strategy.taskTypes[strategy.defaultTaskType] ||
      strategy.taskTypes[Object.keys(strategy.taskTypes)[0]];
    
      // console.log('variant', variant)

    if (!variant) {
      throw new Error(`验证码类型 ${captchaType} 不支持任务变体 ${taskVariant}`);
    }
   
    // 准备任务数据
    const taskParams = variant.prepareTask(params);
    // 添加任务类型
    const taskData = {
      ...taskParams,
      type: variant.type
    };

    // console.log('taskData', taskData)

    try {
      const response = await fetch(`${this.baseUrl}/createTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: this.clientKey,
          task: taskData
        })
      });

      const result = await response.json();

      if (!result.taskId) {
        throw new Error(`创建任务失败: ${result.errorDescription || '未知错误'}`);
      }

      return result.taskId;
    } catch (error) {
      console.error(`创建 ${captchaType} 任务失败:`, error);
      throw error;
    }
  }

  /**
   * 获取任务结果
   */
  async getTaskResult(taskId, captchaType, maxAttempts = 40, interval = 3000) {
    const strategy = this.captchaStrategies[captchaType];
    if (!strategy) {
      throw new Error(`不支持的验证码类型: ${captchaType}`);
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/getTaskResult`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientKey: this.clientKey,
            taskId
          })
        });

        const result = await response.json();

        if (result.status === 'ready') {
          const solution = strategy.extractResult(result);
          if (solution) {
            return solution;
          }
        }

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (error) {
        console.error(`获取 ${captchaType} 结果失败 (尝试 ${attempt}/${maxAttempts}):`, error);
      }
    }

    throw new Error(`${captchaType} 识别超时`);
  }

  /**
   * 验证网站验证码
   */
  async verifyWebsite(options) {
    const { captchaType = 'recaptchaV2', taskVariant, maxAttempts, interval, ...params } = options;

    try {
      console.log(`[CapSolver] 开始${captchaType}验证${taskVariant ? ` (${taskVariant})` : ''}...`);

      const taskId = await this.createTask({
        captchaType,
        taskVariant,
        ...params
      });

      const result = await this.getTaskResult(taskId, captchaType, maxAttempts, interval);
      console.log(`[CapSolver] ${captchaType}验证完成${taskVariant ? ` (${taskVariant})` : ''}`);

      return result;
    } catch (error) {
      console.error(`[CapSolver] ${captchaType}验证失败:`, error);
      throw error;
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

    // 定义统一的结果格式转换器
    this.resultFormatters = {
      // reCAPTCHA V2 结果格式化
      recaptchaV2: (result) => ({
        token: result.gRecaptchaResponse || result // 兼容不同服务商返回格式
      }),

      // reCAPTCHA V3 结果格式化
      recaptchaV3: (result) => ({
        token: result.gRecaptchaResponse || result
      }),

      // hCaptcha 结果格式化
      hcaptcha: (result) => ({
        token: result.gRecaptchaResponse || result.generated_pass_UUID || result
      }),

      // Cloudflare Turnstile 结果格式化
      CloudflareTurnstile: (result) => ({
        token: result.token || result
      }),

      // GeeTest V3 结果格式化
      geeTestV3: (result) => ({
        challenge: result.challenge,
        validate: result.validate
      }),

      // GeeTest V4 结果格式化
      geeTestV4: (result) => ({
        captchaId: result.captcha_id,
        captchaOutput: result.captcha_output,
        genTime: result.gen_time,
        lotNumber: result.lot_number,
        passToken: result.pass_token,
        riskType: result.risk_type
      })
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
      console.log(`[CaptchaManager] ${captchaType}${taskVariant ? ` (${taskVariant})` : ''} 验证码价格排序:`);
      providers.forEach(({ provider, variant, price }, index) => {
        console.log(`${index + 1}. ${provider} (${variant}): ¥${price.toFixed(4)}/次`);
      });
    }
  }

  /**
   * 格式化验证码结果
   */
  formatResult(captchaType, result) {
    const formatter = this.resultFormatters[captchaType];
    if (!formatter) {
      throw new Error(`未知的验证码类型: ${captchaType}`);
    }
    return formatter(result);
  }

  async verifyWebsite(options) {
    const { 
      captchaService,
      captchaType,
      taskVariant,
      ...params
    } = options;

    // 验证服务商
    if (!captchaService || !this.services[captchaService]) {
      const supportedServices = Object.keys(this.services).join(', ');
      throw new Error(`无效的验证码服务商 "${captchaService}"，支持的服务商: ${supportedServices}`);
    }

    const service = this.services[captchaService];
    
    // 验证验证码类型
    if (!service.captchaStrategies[captchaType]) {
      const supportedTypes = Object.keys(service.captchaStrategies).join(', ');
      throw new Error(`服务商 ${captchaService} 不支持验证码类型 "${captchaType}"，支持的类型: ${supportedTypes}`);
    }

    const strategy = service.captchaStrategies[captchaType];

    // 验证任务变体
    if (taskVariant && !strategy.taskTypes[taskVariant]) {
      const supportedVariants = Object.keys(strategy.taskTypes).join(', ');
      throw new Error(`验证码类型 ${captchaType} 不支持任务变体 "${taskVariant}"，支持的变体: ${supportedVariants}`);
    }

    // 显示价格排序作为参考
    this.showPriceSorting(captchaType, taskVariant);

    // 使用指定的服务商
    const variant = strategy && (taskVariant ? strategy.taskTypes[taskVariant] : strategy.taskTypes[strategy.defaultTaskType]);
    const price = variant ? `¥${variant.price.toFixed(4)}/次` : '未知价格';
    console.log(`\n[CaptchaManager] 使用服务商 ${captchaService} 处理 ${captchaType} 验证码 (${price})`);
    
    try {
      const result = await service.verifyWebsite({
        captchaType,
        taskVariant,
        ...params
      });

      // 统一格式化结果
      return this.formatResult(captchaType, result);
    } catch (error) {
      console.error(`[CaptchaManager] ${captchaService} 验证失败:`, error);
      throw error;
    }
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