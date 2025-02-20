import 'dotenv/config';

/**
 * 创建验证码任务函数。
 * @param {string} websiteURL - 需要过验证码验证的网站URL。
 * @param {string} websiteKey - 目标网站的验证码密钥（可以通过查看网站源代码获取）。
 * @param {string} captchaType - 验证码的类型，如'recaptchaV2'或'hcaptcha'。
 * @returns {Promise<string>} - 一个Promise，解决时返回创建成功的任务ID。
 */
async function createTask(websiteURL, websiteKey, captchaType) {
    const url = "https://api.yescaptcha.com/createTask";
    let taskType;

    if (captchaType === 'recaptchaV2') {
        taskType = 'NoCaptchaTaskProxyless';
    } else if (captchaType === 'recaptchaV3') {
        taskType = 'RecaptchaV3TaskProxylessM1';
        // RecaptchaV3TaskProxylessM1
    } else if (captchaType === 'hcaptcha') {
        taskType = 'HCaptchaTaskProxyless';
    } else {
        console.log('验证码类型填写错误');
        return;
    }

    const data = {
        clientKey: process.env.yescaptchaClientKey,
        task: {
            websiteURL: websiteURL,
            websiteKey: websiteKey,
            type: taskType
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        const taskId = result.taskId;
        if (taskId) {
            console.log('captcha创建任务:', taskId);
            return taskId;
        }
        console.log(result);
    } catch (e) {
        console.error(e);
    }
}

/**
 * 获取验证码识别结果函数。
 * @param {string} taskId - 由createTask函数创建的任务ID。
 * @returns {Promise<string>} - 一个Promise，解决时返回验证码识别结果。
 */
async function getResponse(taskId) {
    console.log('正在识别验证码...');
    const url = "https://api.yescaptcha.com/getTaskResult";

    for (let times = 0; times < 40; times++) { // 尝试最多120秒，每3秒一次
        try {
            const data = {
                clientKey: process.env.yescaptchaClientKey,
                taskId: taskId
            };
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            const solution = result.solution || {};
            const gRecaptchaResponse = solution.gRecaptchaResponse;
            if (gRecaptchaResponse) {
                return gRecaptchaResponse;
            }
            console.log(result);
        } catch (e) {
            console.error(e);
        }
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
    }
}

/**
 * 完成验证码验证过程的函数。
 * @param {string} websiteURL - 需要过验证码验证的网站URL。
 * @param {string} websiteKey - 目标网站的验证码密钥。
 * @param {string} [captchaType='recaptchaV2'] - 验证码的类型，默认为'recaptchaV2'。
 * @returns {Promise<string>} - 一个Promise，解决时返回验证码识别结果。
 */
export async function verifyWebsite(websiteURL, websiteKey, captchaType = 'recaptchaV2') {
    const taskId = await createTask(websiteURL, websiteKey, captchaType);
    if (taskId) {
        const response = await getResponse(taskId);
        console.log('验证码识别成功');
        return response;
    }
}


/**
 * 遍历页面上的所有reCAPTCHA实例并收集它们的相关信息。
 * 打开出现验证码的网页，按F12键，进入console， 输入下面代码，回车即可
 * 
 * 此函数检查全局变量 `___grecaptcha_cfg`，这是Google reCAPTCHA库用来存储当前页面上所有reCAPTCHA实例信息的对象。
 * 对于每个找到的reCAPTCHA客户端，此函数将提取并返回一个包含客户端ID、版本（V2或V3）、sitekey、回调函数引用以及实例所在页面URL的对象。
 * 
 * 返回的数据结构为一个对象数组，每个对象代表一个reCAPTCHA客户端，并包含以下字段：
 * - id: 客户端ID，用于标识特定的reCAPTCHA实例。
 * - version: reCAPTCHA的版本，根据客户端ID判断，ID >= 10000 时为V3，否则为V2。
 * - sitekey: 用于reCAPTCHA的网站密钥。
 * - pageurl: reCAPTCHA实例所在的页面URL。
 * - callback: 如果存在，此字段为回调函数的全局引用字符串。
 * - function: 实际的回调函数（如果有的话），对于V2为`callback`字段，V3为`promise-callback`字段。
 * 
 * 如果页面上没有找到任何reCAPTCHA实例或者 `___grecaptcha_cfg` 未定义，函数将返回一个空数组。
 * 
 * 注意：此函数使用了一些高级JavaScript特性，如`Object.entries`和数组解构，确保你的环境支持这些特性。
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
       
          if (typeof toplevel === 'object' && toplevel instanceof HTMLElement && toplevel['tagName'] === 'DIV'){
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
  findRecaptchaClients()