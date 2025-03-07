import { chromium } from 'playwright';
import { FingerprintInjector } from 'fingerprint-injector';
import fsp from 'fs/promises';
import robot from 'robotjs';
import { spawn, execSync } from 'child_process';
import { BASE_CONFIG } from './config.js';
import { formatNumber } from '../../../utils-module/utils.js';

export class ChromeBrowserUtil {
  /**
   * Chrome浏览器管理工具
   * @param {number} chromeNumber - 浏览器实例编号
   * @param {number} [screenWidth] - 屏幕宽度
   * @param {number} [screenHeight] - 屏幕高度
   */
  constructor(chromeNumber, screenWidth, screenHeight) {
    this.chromeNumber = formatNumber(chromeNumber);
    this.debugPort = BASE_CONFIG.getDebugPort(chromeNumber);
    this.listenPort = BASE_CONFIG.getListenPort(chromeNumber);
    this.AUTOMATION_CHROME_EXECUTABLE = BASE_CONFIG.getChromeExecutable(this.chromeNumber);
    this.AUTOATION_CHROME_DATA_DIR = BASE_CONFIG.getProfileDataDir(this.chromeNumber);
    this.FINGERPRINT_PATH = BASE_CONFIG.getFingerprintPath(this.chromeNumber);
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * 创建并初始化Chrome实例
   * @param {Object} params - 初始化参数
   * @param {number} params.chromeNumber - Chrome实例编号
   * @param {number} [params.screenWidth=1680] - 屏幕宽度
   * @param {number} [params.screenHeight=1050] - 屏幕高度
   * @returns {Promise<ChromeBrowserUtil>} 初始化完成的实例
   */
  static async create({ chromeNumber, screenWidth = 1680, screenHeight = 1050 }) {

    // 创建实例
    const instance = new this(chromeNumber, screenWidth, screenHeight);

    // 检查Chrome状态并初始化
    const { status } = await instance.isChromeRunning();

    switch (status) {
      case 'disconnected':
        await instance.launchNewInstance();
        await instance.connectToInstance(true);
        break;

      case 'connected_no_pages':
        await instance.connectToInstance(false);
        break;

      case 'connected_with_pages':
        await instance.connectToInstance(true);
        break;
    }

    return instance;
  }

  /**
   * 连接到已运行的Chrome实例，并注入指纹
   * @param {boolean} hasPage - 是否已有可用页面
   * @throws {Error} 连接失败时抛出错误
   */
  async connectToInstance(hasPage = true) {
    try {
      let retries = 0;
      const maxRetries = 5;
      const fingerprint = await this.getFingerprint();
      while (retries < maxRetries) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          this.browser = await chromium.connectOverCDP(`http://localhost:${this.debugPort}`);
          this.context = this.browser.contexts()[0];
          const injector = new FingerprintInjector();
          await injector.attachFingerprintToPlaywright(this.context, fingerprint);
          if (!hasPage) {
            // 创建新页面
            this.page = await this.context.newPage();
          } else {
            // 获取已有页面
            this.page = this.context.pages()[0];
          }
          // 将浏览器窗口带到前台
          await this.bringBrowserToFront();
          // 关闭其他页面
          await this.closeOtherWindows();
          break;
        } catch (err) {
          retries++;
          if (retries === maxRetries) {
            throw new Error(`无法连接到 Chrome: ${err.message}`);
          }
          console.log(`连接失败，重试 ${retries}/${maxRetries},错误信息:${err.message}`);
        }
      }
    } catch (error) { console.log(error) }
  }

  /**
  * 激活浏览器窗口到前台
  */
  async bringBrowserToFront() {
    const platform = process.platform;

    if (platform === 'darwin') { // macOS
      execSync(`
        osascript -e '
          tell application "Chrome${this.chromeNumber}"
            activate
            reopen --确保窗口非最小化状态
          end tell'
      `);
    }
  }

  /**
   * 启动新的Chrome实例
   * 使用双重派生技术启动进程，确保父进程退出后浏览器仍保持运行
   */
  async launchNewInstance() {
    try {
      // Chrome 启动参数
      const chromeArgs = [
        `--remote-debugging-port=${this.debugPort}`,
        `--user-data-dir=${this.AUTOATION_CHROME_DATA_DIR}`,
        '--no-first-run',
        `--window-size=${this.screenWidth},${this.screenHeight}`,
        '--no-default-browser-check',
        `--proxy-server=127.0.0.1:${this.listenPort}`
      ].filter(Boolean);

      // 打印完整启动命令
      // console.log('完整启动命令:', [this.AUTOMATION_CHROME_EXECUTABLE, ...chromeArgs].join(' '));
      // console.log('启动参数:', chromeArgs);

      // 使用双重派生技术启动进程
      const cmd = [
        'trap "" HUP &&',      // 忽略挂断信号
        'exec',                // 替换当前进程
        `"${this.AUTOMATION_CHROME_EXECUTABLE}"`,
        ...chromeArgs.map(arg => `"${arg.replace(/"/g, '\\"')}"`),
        '&'                    // 后台运行
      ].join(' ');

      const chromeProcess = spawn('sh', ['-c', cmd], {
        detached: true,
        stdio: 'ignore',
        shell: false
      });
      chromeProcess.unref();


      // 等待浏览器启动// 新增启动等待机制
      let isReady = false;
      let retries = 0;
      const maxRetries = 5; // 5次重试 * 2000ms = 10秒超时

      while (retries < maxRetries && !isReady) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const response = await fetch(`http://localhost:${this.debugPort}/json/version`);
          if (response.ok) {
            isReady = true;
            // console.log(`Chrome实例${this.chromeNumber}启动成功`);
          }
        } catch (error) {
          retries++;
          if (retries === maxRetries) {
            throw new Error(`浏览器启动超时，调试端口${this.debugPort}未响应`);
          }
        }
      }

    } catch (error) {
      console.error(`Chrome启动失败 (实例${this.chromeNumber}):`, error);
      await this.cleanupFailedStart(); // 清理残留进程
      throw error;
    }
  }

  /**
   * 获取存储的浏览器指纹
   * @returns {Promise<Object>} 指纹数据对象
   */
  async getFingerprint() {
    try {
      // 尝试读取已存在的指纹
      const data = await fsp.readFile(this.FINGERPRINT_PATH, 'utf8');
      const fingerprint = JSON.parse(data);
      // console.log(fingerprint);
      return fingerprint;
    } catch {
      console.log('指纹不存在');
      return;
    }
  }

  /**
   * 检查Chrome运行状态
   * @returns {Promise<{status: string, pageLength: number}>} 状态对象包含：
   *   status: 'disconnected' - 未连接
   *           'connected_no_pages' - 已连接但无主页面
   *           'connected_with_pages' - 已连接且有主页面
   *   pageLength: 主页面数量
   */
  async isChromeRunning() {

    // 先通过PID检查进程是否存在
    const pid = await this.getProcessPid();
    if (!pid) {
      return { status: 'disconnected', pageLength: 0 };
    }
    try {
      // 获取页面列表
      const response = await fetch(`http://localhost:${this.debugPort}/json/list`);
      if (!response.ok) {
        // console.log('Chrome连接不通');
        return { status: 'disconnected', pageLength: 0 };
      }

      const pages = await response.json();
      // 过滤掉Service Worker等非主页面
      const mainPages = pages.filter(page =>
        page.type === 'page' &&
        !page.url.startsWith('chrome-extension://') &&
        !page.url.startsWith('devtools://')
      );
      // console.log(mainPages)
      const pageLength = Array.isArray(mainPages) ? mainPages.length : 0;

      if (pageLength === 0) {
        // console.log('Chrome连接正常，但没有页面');
        return { status: 'connected_no_pages', pageLength: 0 };
      } else {
        // console.log(`Chrome连接正常，有 ${pageLength} 个页面`);
        return { status: 'connected_with_pages', pageLength };
      }
    } catch (error) {
      // console.log('Chrome连接失败:', error.message);
      return { status: 'disconnected', pageLength: 0 };
    }
  }

  /**
   * 获取Chrome进程PID
   * @param {number} port - 调试端口号
   * @returns {Promise<number|null>} 进程PID或null
   */
  async getProcessPid(port = this.debugPort) {
    try {
      // 使用 pgrep 查找真实的 Chrome 进程
      const cmd = `pgrep -f "${port}"`;
      const pid = parseInt(execSync(cmd, { encoding: 'utf8' }).trim());
      return pid || null;
    } catch (error) {
      // console.error('获取Chrome PID失败:', error);
      return null;
    }
  }

  async newContext() {
    // Create new context 
    return await this.browser.newContext()
  }

  async newPage(context = '') {
    // 创建新的page.不传context就是使用默认的context创建page
    if (!context) { context = this.context }
    return await context.newPage()
  }

  async closeOtherWindows(context = '') {
    // 关闭上下文中的无关页面。
    if (!context) { context = this.context }
    const allPages = context.pages()
    allPages.forEach(page => {
      if (page != this.page) {
        page.close();
      }
    });
  }

  async isElementExist(selector, { waitTime = 5, page = '' } = {}) {
    // 判断元素是否存在
    if (!page) { page = this.page }
    try {
      await page.waitForSelector(selector, { timeout: waitTime * 1000 })
      return true
    } catch (error) {
      // console.log(error)
      return false
    }
  }

  /**
   * 安全关闭Chrome进程
   */
  async shutdownChrome() {
    const logger = {
      info: (msg) => console.log(`[${new Date().toISOString()}] [进程管理] ${msg}`),
      error: (msg) => console.error(`[${new Date().toISOString()}] [进程管理] ${msg}`)
    };
    const chromeProcessesId = await this.getProcessPid();

    if (!chromeProcessesId) {
      logger.error('无法找到Chrome进程');
      return;
    }
    process.kill(chromeProcessesId, 'SIGTERM');
    logger.info(`已关闭Chrome进程: ${chromeProcessesId}`);
  }

  /**
   * 安装Chrome扩展程序
   * @param {string} url - 扩展程序商店URL
   * @param {Object} options - 安装选项
   * @param {number} options.x - 确认按钮X坐标
   * @param {number} options.y - 确认按钮Y坐标
   */
  async installExtension(url, { x = 900, y = 575 } = {}) {
    try {
      await this.page.goto(url);
      await this.page.waitForTimeout(1000);
      await this.page.locator('text=/(^添加至 Chrome$|^Add to Chrome$)/i').click();
      await this.page.waitForTimeout(1000);
      // 设置较长的延迟确保移动平滑
      robot.setMouseDelay(100);
      // 移动到目标位置（使用传入的坐标或默认值）
      robot.moveMouse(x, y);
      await this.page.waitForTimeout(3000);
      robot.mouseClick();
      await this.page.waitForTimeout(2000);
    } catch (error) {
      // console.log(error);
    }
  }
}

export function shutdownChrome(chromeNumber) {
  const logger = {
    info: (msg) => console.log(`[${new Date().toISOString()}] [进程管理] ${msg}`),
    error: (msg) => console.error(`[${new Date().toISOString()}] [进程管理] ${msg}`)
  };
  try {
    // 使用 pgrep 查找真实的 Chrome 进程
    const cmd = `pgrep -f "${BASE_CONFIG.getDebugPort(chromeNumber)}"`;
    let output;
    try {
      output = execSync(cmd, { encoding: 'utf8' });
    } catch {
      // pgrep 没找到进程时会抛出错误，这是正常的
      logger.error(`无法找到第${chromeNumber}个Chrome进程`);
      return false;
    }

    const pid = parseInt(output.trim());

    process.kill(pid, 'SIGTERM');
    logger.info(`已关闭第${chromeNumber}个Chrome进程: ${pid}`);
    return true;
  } catch (error) {
    logger.error(`关闭第${chromeNumber}个Chrome失败: ${error.message}`);
    return false;
  }
}