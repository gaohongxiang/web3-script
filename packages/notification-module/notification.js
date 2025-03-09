/**
 * 通知模块 - 用于统一管理系统中的消息提示
 */
import fs from 'fs';
import path from 'path';
import { getPathFromRoot, makeSureDirExists } from '../utils-module/path.js';

class NotificationManager {
  constructor() {
    // 是否启用调试模式
    this.debug = process.env.DEBUG === 'true';

    // 消息格式化配置
    this.formatConfig = {
      showTimestamp: true,    // 是否显示时间戳
      logToConsole: true,     // 是否在控制台打印信息
      logToFile: true,       // 是否写入日志文件
      logDir: 'logs',        // 日志目录
      logRetentionDays: 7,    // 日志保留天数
      contextFirst: false,    // 是否将上下文放在消息前面
    };

    // 定义消息类型及其样式
    this.messageTypes = {
      INFO: { 
        color: null,
        label: '信息'
      },
      SUCCESS: { 
        color: '\x1b[32m',  // 绿色
        label: '成功'
      },
      WARNING: { 
        color: '\x1b[33m',  // 黄色
        label: '警告'
      },
      ERROR: { 
        color: '\x1b[31m',  // 红色
        label: '错误'
      }
    };

    // 颜色重置代码
    this.RESET_COLOR = '\x1b[0m';

    // 初始化日志目录
    this._initLogDir();

    this.messageQueue = [];
    this.isProcessing = false;

    this.formatters = new Map();

    // 当前上下文
    this.currentContext = {};
  }

  /**
   * 初始化日志目录
   * @private
   */
  async _initLogDir() {
    if (this.formatConfig.logToFile) {
      const logDir = getPathFromRoot(this.formatConfig.logDir);
      try {
        await makeSureDirExists(logDir);
      } catch (error) {
        console.error('初始化日志目录失败:', error);
      }
    }
  }

  /**
   * 获取日志文件路径
   * @private
   */
  _getLogFilePath() {
    const now = new Date();
    const utc8Date = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = utc8Date.getUTCFullYear();
    const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utc8Date.getUTCDate()).padStart(2, '0');
    const date = `${year}-${month}-${day}`;

    return getPathFromRoot(this.formatConfig.logDir, `${date}.log`);
  }

  /**
   * 格式化时间戳
   * @private
   */
  _formatTimestamp() {
    const now = new Date();
    // 转换为北京时间
    const utc8Date = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    const year = utc8Date.getUTCFullYear();
    const month = String(utc8Date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utc8Date.getUTCDate()).padStart(2, '0');
    const hours = String(utc8Date.getUTCHours()).padStart(2, '0');
    const minutes = String(utc8Date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(utc8Date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
  }

  /**
   * 格式化消息
   * @private
   */
  _formatMessage(message) {
    let formatted = message;
    for (const formatter of this.formatters.values()) {
      formatted = formatter(formatted);
    }
    return formatted;
  }

  /**
   * 写入日志文件
   * @private
   */
  async _writeToFile(message, type = 'INFO') {
    if (!this.formatConfig.logToFile) {
      console.log('日志写入已禁用');
      return;
    }

    const timestamp = this._formatTimestamp();
    const logMessage = `[${timestamp}] [${type}] ${message}\n`;

    try {
      // 确保使用绝对路径
      const logPath = this._getLogFilePath();

      // console.log('调试信息:', {
      //   当前工作目录: process.cwd(),
      //   日志目录: path.dirname(logPath),
      //   日志文件: logPath,
      //   消息类型: type
      // });

      // 确保日志目录存在
      await makeSureDirExists(logPath);

      // 写入日志
      await fs.promises.appendFile(logPath, logMessage);
      // console.log('日志写入成功');
    } catch (error) {
      console.error('写入日志文件失败:', error, {
        错误信息: error.message,
        错误堆栈: error.stack,
        日志路径: this._getLogFilePath()
      });
    }
  }

  /**
   * 设置消息上下文
   * @param {Object} context - 上下文对象
   * @returns {NotificationManager} - 返回this以支持链式调用
   */
  withContext(context = {}) {
    this.currentContext = { ...this.currentContext, ...context };
    return this;
  }

  /**
   * 清除上下文
   * @returns {NotificationManager} - 返回this以支持链式调用
   */
  clearContext() {
    this.currentContext = {};
    return this;
  }

  /**
   * 格式化带上下文的消息
   * @private
   */
  _formatWithContext(message, context = {}) {
    if (Object.keys(context).length === 0) {
      return message;
    }

    const contextStr = Object.entries(context)
      .map(([key, value]) => `[${key} ${value}]`)
      .join(' ');

    return this.formatConfig.contextFirst 
      ? `${contextStr} ${message}`
      : `${message} ${contextStr}`;
  }

  /**
   * 通用消息发送方法
   * @param {string|Object} messageOrOptions - 消息内容或配置对象。当为对象时，message 可以为空
   * @param {string} [type='INFO'] - 消息类型
   */
  notify(messageOrOptions, type = 'INFO') {
    let message = '';  // 默认为空字符串
    let context = {};
    let messageType = type;
    let messageConfig = {}; // 消息级别的配置

    // 支持对象形式的参数
    if (typeof messageOrOptions === 'object') {
      message = messageOrOptions.message || '';  // 允许 message 为空
      context = messageOrOptions.context || {};
      messageType = messageOrOptions.type || type;

      // // 调试日志
      // console.log('Debug - 收到的参数:', {
      //   message,
      //   context,
      //   messageType
      // });

      messageConfig = messageOrOptions.config || {}; // 新增：消息级别的配置
    } else {
      message = messageOrOptions || '';  // 允许直接传入空值
    }

    // 合并上下文
    const fullContext = { ...this.currentContext, ...context };
    
    // 调试日志
    // console.log('Debug - 合并后的上下文:', fullContext);

    const messageWithContext = this._formatWithContext(message, fullContext);

    // 调试日志
    // console.log('Debug - 格式化后的消息:', messageWithContext);
    
    const formattedMessage = this._formatMessage(messageWithContext);
    
    // 获取时间戳
    const timestamp = this._formatTimestamp();
    const finalMessage = this.formatConfig.showTimestamp 
      ? `[${timestamp}] ${formattedMessage}`
      : formattedMessage;
    
    // 使用消息级别的配置覆盖全局配置
    const effectiveConfig = {
      ...this.formatConfig,
      ...messageConfig
    };
    
    if (effectiveConfig.logToConsole) {
      const msgType = this.messageTypes[messageType];
      if (msgType.color) {
        console.log(`${msgType.color}${finalMessage}${this.RESET_COLOR}`);
      } else {
        console.log(finalMessage);
      }
    }
    
    if (effectiveConfig.logToFile) {
      this._writeToFile(messageWithContext, messageType).catch(error => {
        console.error('写入日志失败:', error);
      });
    }

    // 清除临时上下文
    this.currentContext = {};
    
    return this;
  }

  // 更新现有方法以支持新特性
  info(messageOrOptions) { 
    return this.notify(messageOrOptions, 'INFO');
  }

  success(messageOrOptions) { 
    return this.notify(messageOrOptions, 'SUCCESS');
  }

  warning(messageOrOptions) { 
    return this.notify(messageOrOptions, 'WARNING');
  }

  error(messageOrOptions) { 
    return this.notify(messageOrOptions, 'ERROR');
  }

  /**
   * 配置通知管理器
   * @param {object} config - 配置项
   */
  configure(config = {}) {
    this.formatConfig = {
      ...this.formatConfig,
      ...config
    };

    // 如果更改了日志目录,异步初始化目录
    if ('logDir' in config || 'logToFile' in config) {
      this._initLogDir().catch(error => {
        console.error('初始化日志目录失败:', error);
      });
    }
  }

  /**
   * 清理过期日志文件
   */
  cleanLogs() {
    if (!this.formatConfig.logToFile) return;

    const logDir = path.resolve(process.cwd(), this.formatConfig.logDir);
    if (!fs.existsSync(logDir)) return;

    const files = fs.readdirSync(logDir);
    const now = new Date();

    files.forEach(file => {
      const filePath = path.join(logDir, file);
      const stats = fs.statSync(filePath);
      const daysOld = (now - stats.mtime) / (1000 * 60 * 60 * 24);

      if (daysOld > this.formatConfig.logRetentionDays) {
        try {
          fs.unlinkSync(filePath);
          console.log(`已清理过期日志文件: ${file}`);
        } catch (error) {
          console.error(`清理日志文件失败: ${file}`, error);
        }
      }
    });
  }

  async _processMessageQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    while (this.messageQueue.length > 0) {
      const { message, type } = this.messageQueue.shift();
      try {
        await this._writeToFile(message, type);
      } catch (error) {
        console.error('写入日志失败:', error);
      }
    }
    
    this.isProcessing = false;
  }

  addFormatter(name, formatter) {
    this.formatters.set(name, formatter);
  }
}

// 导出通知管理器实例
export const notificationManager = new NotificationManager(); 