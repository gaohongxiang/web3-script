import 'dotenv/config';

/**
 * YesCaptcha验证码服务客户端
 * 参考文档: https://yescaptcha.atlassian.net/wiki/spaces/YESCAPTCHA/pages/164286
 */
class YesCaptchaClient {
    constructor(clientKey = process.env.yescaptchaClientKey) {
        this.clientKey = clientKey;
        this.baseUrl = "https://api.yescaptcha.com";
        
        // YesCaptcha 验证码任务处理策略
        this.captchaStrategies = {
            // reCAPTCHA V2 策略
            recaptchaV2: {
                defaultTaskType: 'standard',
                taskTypes: {
                    // 标准版
                    standard: {
                        type: 'NoCaptchaTaskProxyless',
                        // 遇到isInvisible类型的reCaptchaV2，设为true
                        prepareTask: ({ websiteURL, websiteKey, isInvisible = false }) => ({
                            websiteURL,
                            websiteKey,
                            isInvisible
                        })
                    },
                    // 高级版
                    advanced: {
                        type: 'RecaptchaV2TaskProxyless',
                        prepareTask: ({ websiteURL, websiteKey, isInvisible = false }) => ({
                            websiteURL,
                            websiteKey,
                            isInvisible
                        })
                    },
                    // K1定制版 (20 POINTS)
                    k1: {
                        type: 'RecaptchaV2TaskProxylessK1',
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
                        prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
                            websiteURL,
                            websiteKey,
                            ...(pageAction ? { pageAction } : {})
                        })
                    },
                    // M1版本
                    m1: {
                        type: 'RecaptchaV3TaskProxylessM1',
                        prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
                            websiteURL,
                            websiteKey,
                            ...(pageAction ? { pageAction } : {})
                        })
                    },
                    // K1定制版
                    k1: {
                        type: 'RecaptchaV3TaskProxylessK1',
                        prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
                            websiteURL,
                            websiteKey,
                            ...(pageAction ? { pageAction } : {})
                        })
                    },
                    // 强制分值0.7版本
                    m1s7: {
                        type: 'RecaptchaV3TaskProxylessM1S7',
                        prepareTask: ({ websiteURL, websiteKey, pageAction = '' }) => ({
                            websiteURL,
                            websiteKey,
                            ...(pageAction ? { pageAction } : {})
                        })
                    },
                    // 强制分值0.9版本
                    m1s9: {
                        type: 'RecaptchaV3TaskProxylessM1S9',
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
                        prepareTask: ({ websiteURL, websiteKey }) => ({
                            websiteURL,
                            websiteKey
                        })
                    },
                    m1: {
                        type: 'TurnstileTaskProxylessM1',
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

            console.log(`${captchaType}${taskVariant ? ` (${taskVariant})` : ''} 任务创建成功:`, result.taskId);
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
        console.log(`正在识别 ${captchaType}...`);

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
                        console.log(`${captchaType} 识别成功 (尝试 ${attempt}/${maxAttempts})`);
                        return captchaResponse;
                    }
                }

                console.log(`等待 ${captchaType} 结果... (${attempt}/${maxAttempts})`);
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
            const taskId = await this.createTask({
                captchaType,
                taskVariant,
                ...params
            });

            return await this.getTaskResult(taskId, captchaType, maxAttempts, interval);
        } catch (error) {
            console.error(`${captchaType} 验证失败:`, error);
            throw error;
        }
    }
}

/**
 * NoCaptcha验证码服务客户端
 * 参考文档: https://chrisyp.github.io/
 */
class NoCaptchaClient {
  constructor(userToken = process.env.nocaptchaClientKey) {
    this.userToken = userToken;
    this.baseUrl = "http://api.nocaptcha.io";
    
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
      
      console.log(`${captchaType}${taskVariant ? ` (${taskVariant})` : ''} 验证成功，耗时: ${result.cost}`);
      
      // 提取结果
      return strategy.extractResult(result);
    } catch (error) {
      console.error(`${captchaType} 验证失败:`, error);
      throw error;
    }
  }
}

// 导出类和默认实例
export const yesCaptchaClient = new YesCaptchaClient();
export const nocaptchaClient = new NoCaptchaClient();


/**
 * 在浏览器中查找reCAPTCHA信息
 * 在控制台中运行此函数可获取页面上所有reCAPTCHA实例的信息
 */
export function findRecaptchaClients() {
    // eslint-disable-next-line camelcase
    if (typeof (___grecaptcha_cfg) === 'undefined') {
        console.log('页面上没有找到reCAPTCHA');
        return [];
    }

    // eslint-disable-next-line camelcase, no-undef
    return Object.entries(___grecaptcha_cfg.clients).map(([cid, client]) => {
        const data = { id: cid, version: cid >= 10000 ? 'V3' : 'V2' };

        Object.entries(client)
            .filter(([_, value]) => value && typeof value === 'object')
            .forEach(([toplevelKey, toplevel]) => {
                // 获取页面URL
                if (toplevel instanceof HTMLElement && toplevel.tagName === 'DIV') {
                    data.pageurl = toplevel.baseURI;
                }

                // 查找包含sitekey的对象
                const found = Object.entries(toplevel).find(([_, value]) => (
                    value && typeof value === 'object' && 'sitekey' in value && 'size' in value
                ));

                if (found) {
                    const [sublevelKey, sublevel] = found;

                    data.sitekey = sublevel.sitekey;
                    const callbackKey = data.version === 'V2' ? 'callback' : 'promise-callback';
                    const callback = sublevel[callbackKey];

                    data.function = callback || null;

                    if (callback) {
                        const keys = [cid, toplevelKey, sublevelKey, callbackKey]
                            .map((key) => `['${key}']`)
                            .join('');
                        data.callback = `___grecaptcha_cfg.clients${keys}`;
                    } else {
                        data.callback = null;
                    }
                }
            });

        return data;
    });
}