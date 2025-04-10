import { chromium } from 'playwright';
import { FingerprintInjector } from 'fingerprint-injector';
import fsp from 'fs/promises';
import robot from 'robotjs';
import { spawn, execSync } from 'child_process';
import { BASE_CONFIG } from './config.js';
import { formatNumber } from '../../../utils-module/utils.js';
import { withRetry } from '../../../utils-module/retry.js';
import { notificationManager } from '../../../notification-module/notification.js';

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
    this.AUTOMATION_CHROME_DATA_DIR = BASE_CONFIG.getProfileDataDir(this.chromeNumber);
    this.FINGERPRINT_PATH = BASE_CONFIG.getFingerprintPath(this.chromeNumber);
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.browser = null;
    this.context = null;
    this.page = null;

    // 设置全局上下文
    notificationManager.setGlobalContext({ "Chrome": this.chromeNumber });
  }

  /**
   * 创建并初始化Chrome实例
   * @param {Object} params - 初始化参数
   * @param {number} params.chromeNumber - Chrome实例编号
   * @param {number} [params.screenWidth=1680] - 屏幕宽度
   * @param {number} [params.screenHeight=1050] - 屏幕高度
   * @param {number} [params.waitTime=6] - 启动等待时间
   * @returns {Promise<ChromeBrowserUtil>} 初始化完成的实例
   */
  static async create({ chromeNumber, screenWidth = 1680, screenHeight = 1050, waitTime = 6 }) {
    // 创建实例
    const instance = new this(chromeNumber, screenWidth, screenHeight);

    // 检查Chrome状态并初始化
    const { status } = await instance.isChromeRunning();

    switch (status) {
      case 'disconnected':
        await instance.launchNewInstance(waitTime);
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
    const fingerprint = await this.getFingerprint();

    await withRetry(
      async () => {
        this.browser = await chromium.connectOverCDP(`http://localhost:${this.debugPort}`);
        this.context = this.browser.contexts()[0];

        const injector = new FingerprintInjector();
        await injector.attachFingerprintToPlaywright(this.context, fingerprint);

        if (!hasPage) {
          this.page = await this.context.newPage();
        } else {
          this.page = this.context.pages()[0];
        }

        await this.bringBrowserToFront();
        await this.closeOtherWindows();

        // notificationManager.success({
        //   "message": "浏览器连接成功",
        //   "context": this.logContext
        // });

        return true;
      },
      {
        message: '浏览器连接'
      }
    );
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
  async launchNewInstance(waitTime) {
    try {
      // 1. 启动前先清理可能存在的旧进程
      await this.killExistingProcesses();

      // Chrome 启动参数
      const chromeArgs = [
        `--remote-debugging-port=${this.debugPort}`,
        `--user-data-dir=${this.AUTOMATION_CHROME_DATA_DIR}`,
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

      await withRetry(
        async () => {
          const chromeProcess = spawn('sh', ['-c', cmd], {
            detached: true,
            stdio: 'ignore',
            shell: false
          });
          chromeProcess.unref();

          // 增加启动等待时间，确保Chrome完全初始化。时间太短也会导致检查失败，改为根据网络情况自行调整时间，默认6秒
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

          // 检查浏览器是否就绪
          const response = await fetch(`http://localhost:${this.debugPort}/json/version`);
          return response;
        },
        {
          message: '启动浏览器'
        }
      );

    } catch (error) {
      // 5. 失败时也清理
      await this.killExistingProcesses();
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
      notificationManager.warning({
        "message": "指纹文件不存在"
      });
      return;
    }
  }

  /**
   * 检查Chrome运行状态
   */
  async isChromeRunning() {
    try {
      // 先通过PID检查进程是否存在
      const pid = await this.getProcessPid();
      if (!pid) {
        return { "status": 'disconnected', "pageLength": 0 };
      }

      const pages = await withRetry(
        async () => {
          const response = await fetch(`http://localhost:${this.debugPort}/json/list`);
          const pages = await response.json();
          return pages;
        },
        {
          message: '检查浏览器状态',
          context: { "PID": pid }
        }
      );

      // 过滤掉Service Worker等非主页面
      const mainPages = pages.filter(page =>
        page.type === 'page' &&
        !page.url.startsWith('chrome-extension://') &&
        !page.url.startsWith('devtools://')
      );

      const pageLength = Array.isArray(mainPages) ? mainPages.length : 0;
      return {
        "status": pageLength === 0 ? 'connected_no_pages' : 'connected_with_pages',
        "pageLength": pageLength
      };

    } catch (error) {
      return { "status": 'disconnected', "pageLength": 0 };
    }
  }

  /**
   * 获取Chrome进程PID
   * @param {number} port - 调试端口号
   * @returns {Promise<number|null>} 进程PID或null
   */
  async getProcessPid() {
    try {
      // pgrep 和 lsof 方式
      // const cmd = `pgrep -f "${this.debugPort}"`;
      // const pid = parseInt(execSync(cmd, { encoding: 'utf8' }).trim());
      const cmd = `lsof -i :${this.debugPort} -t`;
      const pid = (await execSync(cmd, { encoding: 'utf8' })).split('\n').filter(Boolean);
      return pid || null;
    } catch (error) {
      // console.error('获取Chrome PID失败:', error);
      return null;
    }
  }

  /**
  * 清理Chrome进程
  */
  async killExistingProcesses() {
    const pid = await this.getProcessPid();
    if (!pid) return;

    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      notificationManager.warning({
        "message": "清理进程失败",
        "context": {
          "PID": pid,
          "原因": error.message
        }
      });
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
      robot.setMouseDelay(100);
      robot.moveMouse(x, y);
      await this.page.waitForTimeout(3000);
      robot.mouseClick();
      await this.page.waitForTimeout(2000);
      return true;
    } catch (error) {
      notificationManager.error({
        "message": "安装扩展失败",
        "context": {
          "原因": error.message
        }
      });
      return false;
    }
  }

  /**
   * 查询IP信息，通过ping0.cc获取IP的地理位置、风控值、IP类型等信息
   * @param {string} ip - 要查询的IP地址
   * @returns {Promise<Object|undefined>} 返回包含IP信息的对象，如果查询失败则返回undefined
   * @property {string} location - IP的地理位置，如"日本 东京"
   * @property {string} risk - IP的风控值及风险等级，如"16% 纯净"
   * @property {string} ipType - IP类型，可能包含多个值，如"家庭ip"
   * @property {string} isNativeIp - 是否为原生IP
   */
  async queryIp(ip) {
    try {
      await this.page.goto(`https://ping0.cc/ip/${ip}`, { timeout: 60000 });
      // 获取IP位置
      let location = await this.page.getByText('IP 位置').locator('xpath=following-sibling::div').textContent();
      // 移除可能出现的"错误提交"等多余文本
      if (location.includes('错误提交')) { location = location.replace(/\s*错误提交.*$/, '').trim(); }

      // 获取风控值
      const riskValue = await this.page.getByText('风控值').locator('xpath=../../div[contains(@class, "content")]//span[@class="value"]').textContent();
      const riskLabel = await this.page.getByText('风控值').locator('xpath=../../div[contains(@class, "content")]//span[@class="lab"]').textContent();
      const risk = `${riskValue}${riskLabel}`;

      // 获取IP类型（可能有多个标签）
      const ipTypeLabels = await this.page.getByText('IP类型').locator('xpath=../following-sibling::div/span').all();
      const ipTypeValues = await Promise.all(ipTypeLabels.map(label => label.textContent()));
      const ipType = ipTypeValues.join(', ');

      // 获取原生IP信息
      const isNativeIp = await this.page.getByText('原生 IP').locator('xpath=../following-sibling::div/span').textContent();

      notificationManager.success({
        "message": "查询IP成功",
        "context": {
          "IP:": ip,
          "IP位置:": location,
          "风控值:": risk,
          "IP类型:": ipType,
          "是否原生IP:": isNativeIp
        }
      });
      return { location, risk, ipType, isNativeIp };
    } catch (error) {
      notificationManager.error({
        "message": "查询IP失败",
        "context": {
          "原因": error.message
        }
      });
    }
  }
}

/**
 * 关闭指定编号的Chrome进程
 * @param {number} chromeNumber - Chrome实例编号
 * @returns {Promise<boolean>} 是否成功关闭
 */
export function shutdownChrome(chromeNumber) {
  try {
    const cmd = `lsof -i :${BASE_CONFIG.getDebugPort(chromeNumber)} -t`;
    let output;
    try {
      output = execSync(cmd, { encoding: 'utf8' });
    } catch {
      notificationManager.error({
        "message": "进程关闭失败",
        "context": {
          "Chrome": chromeNumber,
          "原因": "无法找到进程"
        }
      });
      return false;
    }

    const pid = parseInt(output.trim());
    process.kill(pid, 'SIGTERM');
    notificationManager.success({
      "message": "进程关闭成功",
      "context": {
        "Chrome": chromeNumber,
        "PID": pid
      }
    });
    return true;
  } catch (error) {
    notificationManager.error({
      "message": "进程关闭失败",
      "context": {
        "Chrome": chromeNumber,
        "原因": error.message
      }
    });
    return false;
  }
}