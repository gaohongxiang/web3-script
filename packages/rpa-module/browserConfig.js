/**
 * 浏览器环境配置文件。支持本地浏览器环境和指纹浏览器环境
 * 提供统一的浏览器配置，供不同模块共享使用
 */

import { ChromeBrowserUtil } from './chrome/chromeBrowser/chromeBrowser.js';
import { BitBrowserUtil } from './bitbrowser/bitbrowser.js';

/**
 * 各种浏览器环境的统一配置
 * 用于创建不同类型的浏览器实例
 */
export const browserConfigs = {
    chrome: {
        baseClass: ChromeBrowserUtil,
        createParams: (browserId) => ({ chromeNumber: browserId })
    },
    bitbrowser: {
        baseClass: BitBrowserUtil,
        createParams: (browserId) => ({ browserId })
    }
};

/**
 * 创建浏览器工具实例的通用函数
 * @param {Object} options - 创建选项
 * @param {string} [options.browserType='chrome'] - 浏览器类型，'chrome'或'bitbrowser'
 * @param {number|string} options.browserId - Chrome实例编号或BitBrowser浏览器ID
 * @param {Object} [options.additionalParams={}] - 其他参数
 * @returns {Promise<Object>} 创建的浏览器实例
 */
export async function createBrowserUtil({ browserType = 'chrome', browserId, additionalParams = {} }) {
    // 1. 获取浏览器配置
    const config = browserConfigs[browserType.toLowerCase()];
    if (!config) {
        throw new Error(`不支持的浏览器类型: ${browserType}`);
    }

    // 2. 创建浏览器参数
    const params = {
        ...config.createParams(browserId),
        ...additionalParams
    };

    // 3. 创建浏览器实例
    return await config.baseClass.create(params);
} 