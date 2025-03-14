import { notificationManager } from "../notification-module/notification.js";

/**
 * HTTP状态码错误信息映射
 */
const HTTP_ERROR_MESSAGES = {
    // 客户端错误 4xx
    400: '请求参数错误，请检查请求数据',
    401: '未授权或登录已过期，请重新登录',
    402: '需要付费才能访问',
    403: '无权访问该资源，请检查权限',
    404: '请求的资源不存在，请检查URL',
    405: '不允许使用该请求方法',
    406: '请求的格式不被支持',
    407: '需要代理认证',
    408: '请求超时，请检查网络状况',
    409: '资源冲突，可能已被修改',
    410: '请求的资源已永久删除',
    411: '需要指定Content-Length',
    412: '前提条件验证失败',
    413: '请求内容过大',
    414: 'URL过长',
    415: '不支持的媒体类型',
    416: '请求范围不合法',
    417: '预期验证失败',
    429: '请求频率过高，请稍后重试',
    431: '请求头字段过大',
    451: '因法律原因无法访问',

    // 服务器错误 5xx
    500: '服务器内部错误，请稍后重试',
    501: '服务器不支持该功能',
    502: '网关错误，请检查服务是否可用',
    503: '服务暂时不可用，可能在维护或过载',
    504: '网关超时，请稍后重试',
    505: '不支持的HTTP版本',
    506: '服务器配置错误',
    507: '服务器存储空间不足',
    508: '检测到循环引用',
    510: '需要进一步扩展协议',
    511: '需要网络认证'
};

/**
 * 网络错误映射表
 */
const NETWORK_ERROR_MAP = {
    // 连接错误
    'ECONNREFUSED': '连接被拒绝，目标服务未启动或端口未开启',
    'ECONNRESET': '连接被重置，服务器可能已关闭连接',
    'ECONNABORTED': '连接已中止，可能是客户端取消了请求',
    // 超时错误
    'ETIMEDOUT': '连接超时，服务器响应时间过长',
    'network timeout': '网络超时，请检查网络连接',
    'timeout': '请求超时，服务器响应时间过长',
    // 网络错误
    'fetch failed': '网络请求失败，请检查网络连接',
    'ERR_NETWORK': '网络错误，请检查网络连接是否正常',
    'ENOTFOUND': 'DNS解析失败，域名无法解析',
    'CERT_HAS_EXPIRED': 'SSL证书已过期，请检查服务器证书',
    'EPROTO': '协议错误，可能是SSL/TLS握手失败',
    // 其他错误
    'EACCES': '访问被拒绝，没有权限访问资源',
    'EADDRINUSE': '地址已被使用，端口可能被占用',
    'ERR_CANCELED': '请求已被取消',
    'status code': '请求失败，状态码异常' // 用于捕获一些通用的状态码错误
};

/**
 * 获取HTTP错误的友好描述
 * @param {number} status - HTTP状态码
 * @param {string} statusText - 状态描述
 * @returns {string} 友好的错误描述
 */
function getHttpErrorMessage(status, statusText) {
    return HTTP_ERROR_MESSAGES[status] 
        ? `${HTTP_ERROR_MESSAGES[status]} (HTTP ${status})` 
        : `HTTP ${status}: ${statusText || '未知错误'}`;
}

/**
 * 获取网络错误的友好描述
 * @param {Error} error - 错误对象
 * @returns {string} 友好的错误描述
 */
function getNetworkErrorMessage(error) {
    // 处理 axios 的错误响应
    if (error.response && error.response.status) {
        const { status, statusText } = error.response;
        return getHttpErrorMessage(status, statusText);
    }

    // 处理请求超时
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
        return '请求超时，服务器响应时间过长';
    }

    // 处理网络错误
    if (error.code) {
        const message = NETWORK_ERROR_MAP[error.code];
        if (message) return message;
    }

    // 检查错误消息中的关键字
    const errorMessage = error.message || '';
    for (const [key, message] of Object.entries(NETWORK_ERROR_MAP)) {
        if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
            return message;
        }
    }

    // 处理状态码错误（有些库会直接在错误消息中包含状态码）
    const statusCodeMatch = errorMessage.match(/status code (\d+)/i);
    if (statusCodeMatch && statusCodeMatch[1]) {
        const status = parseInt(statusCodeMatch[1]);
        if (HTTP_ERROR_MESSAGES[status]) {
            return getHttpErrorMessage(status, '');
        }
    }

    // 默认返回原始错误信息
    return errorMessage;
}

/**
 * 通用重试机制
 * @param {Function} task - 要执行的任务
 * @param {Object} [options] - 重试选项
 * @param {number} [options.maxRetries=3] - 最大重试次数
 * @param {number} [options.delay=1000] - 重试延迟(ms)
 * @param {string} [options.message='未命名任务'] - 任务消息
 * @param {Object} [options.context={}] - 上下文信息
 * @returns {Promise<*>} 任务结果
 * 
 * @example
 * // fetch 用法
 * await withRetry(
 *   () => fetch('http://example.com'),
 *   { message: '请求示例' }
 * );
 * 
 * // axios 用法
 * await withRetry(
 *   () => axios.get('http://example.com'),
 *   { message: '请求示例' }
 * );
 */
export async function withRetry(task, options = {}) {
    const {
        maxRetries = 3,
        delay = 1000,
        message = '未命名任务',
        context = {}
    } = options;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await task();
            
            // 如果返回值是HTTP响应,才检查状态
            if (response instanceof Response || 
                // 更严格地检查是否为 axios 响应
                (response?.status !== undefined && 
                 response?.config !== undefined && // axios 响应特有的 config 属性
                 response?.headers !== undefined)) {
                const isSuccess = await checkResponse(response);
                if (!isSuccess.ok) {
                    throw new Error(isSuccess.error);
                }
            }

            return response;

        } catch (error) {
            // 获取友好的错误描述
            const errorMessage = getNetworkErrorMessage(error);

            // 最后一次重试失败，记录错误并抛出
            if (attempt === maxRetries) {
                notificationManager.error({
                    "message": `${message}失败`,
                    "context": {
                        ...context,
                        "达到最大重试次数": maxRetries,
                        "原因": errorMessage
                    }
                });
                throw new Error(errorMessage);
            }

            // 记录警告并准备重试
            notificationManager.warning({
                "message": `${message}失败`,
                "context": {
                    ...context,
                    "重试":`准备第${attempt + 1}次重试`,
                    "原因": errorMessage
                }
            });

            // 对于429错误（请求过多），增加等待时间
            let waitTime = delay;
            if (error.response && error.response.status === 429) {
                // 指数退避策略，每次重试等待时间翻倍
                waitTime = delay * Math.pow(2, attempt - 1);
                console.log(`检测到请求频率限制(429)，等待${waitTime/1000}秒后重试...`);
            }

            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

/**
 * 检查响应是否成功
 * @param {Response|Object} response - fetch的Response对象或axios的响应对象
 * @returns {Promise<{ok: boolean, error?: string}>} 检查结果
 * 
 * fetch Response 对象结构:
 * {
 *   ok: boolean,            // 如果状态码在 200-299 之间则为 true
 *   status: number,         // HTTP 状态码 如 200, 404, 500
 *   statusText: string,     // 状态描述 如 "OK", "Not Found"
 *   headers: Headers,       // 响应头
 *   body: ReadableStream,   // 响应体（流）
 *   // 方法
 *   json(): Promise<any>,   // 解析 JSON
 *   text(): Promise<string> // 解析文本
 * }
 * 
 * axios Response 对象结构:
 * {
 *   data: any,             // 响应数据，已经自动解析好了
 *   status: number,        // HTTP 状态码
 *   statusText: string,    // 状态描述
 *   headers: Object,       // 响应头
 *   config: Object,        // axios 配置
 *   request: Object        // 请求对象
 * }
 */
async function checkResponse(response) {
    // 统一获取状态码和状态文本
    const getStatusInfo = (response) => {
        // 处理 fetch 响应
        if (response instanceof Response) {
            return {
                status: response.status,
                statusText: response.statusText
            };
        }
        // 处理 axios 正常响应
        if (response?.status !== undefined) {
            return {
                status: response.status,
                statusText: response.statusText
            };
        }
        return null;
    };

    // 检查响应状态
    const statusInfo = getStatusInfo(response);
    if (!statusInfo) {
        return { 
            ok: false, 
            error: '非标准HTTP响应' 
        };
    }

    const { status, statusText } = statusInfo;
    const isSuccess = status >= 200 && status < 300;

    if (!isSuccess) {
        return {
            ok: false,
            error: getHttpErrorMessage(status, statusText)
        };
    }

    return { ok: true };
}