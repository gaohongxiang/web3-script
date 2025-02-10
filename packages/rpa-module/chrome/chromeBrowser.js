import { chromium } from 'playwright';
import { FingerprintInjector } from 'fingerprint-injector';
import fsp from 'fs/promises';
import { formatNumber } from './utils.js';
import { spawn, execSync } from 'child_process';
import { BASE_CONFIG } from './config.js';

export class ChromeBrowserUtil {
  constructor(chromeNumber, proxy = null) {
    this.chromeNumber = formatNumber(chromeNumber);
    this.debugPort = BASE_CONFIG.getDebugPort(chromeNumber);
    this.listenPort = BASE_CONFIG.getListenPort(chromeNumber);
    this.AUTOMATION_CHROME_EXECUTABLE = BASE_CONFIG.getChromeExecutable(this.chromeNumber);
    this.AUTOATION_CHROME_DATA_DIR = BASE_CONFIG.getProfileDataDir(this.chromeNumber);
    this.FINGERPRINT_PATH = BASE_CONFIG.getFingerprintPath(this.chromeNumber);
    this.proxy = proxy;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * 启动方法（复用或新建实例）
   */
  async start() {
    const { status } = await this.isChromeRunning();

    switch (status) {
      case 'disconnected':
        // Chrome没有运行，启动新实例
        console.log('Chrome未运行,启动新实例');
        await this.launchNewInstance();
        await this.connectToInstance(true);
        break;

      case 'connected_no_pages':
        console.log('Chrome在运行但没有页面,创建新页面');
        await this.connectToInstance(false);
        break;

      case 'connected_with_pages':
        console.log('Chrome在运行且有页面,连接现有页面');
        await this.connectToInstance(true);
        console.log(`成功复用已有实例 [用户${this.chromeNumber}]`);
        break;
    }
  }

  /**
   * 连接已有实例并获取/创建页面
   * @param {boolean} createNewPage - 是否创建新页面
   */
  async connectToInstance(hasPage = true) {
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
        break;
      } catch (err) {
        retries++;
        if (retries === maxRetries) {
          throw new Error(`无法连接到 Chrome: ${err.message}`);
        }
        console.log(`连接失败，重试 ${retries}/${maxRetries},错误信息:${err.message}`);
      }
    }
  }

  /**
   * 启动浏览器并注入指纹
   * @param {number} profileNumber - 配置文件编号
   * @param {Object} proxyConfig - 代理配置（可选）
   * @returns {Promise<Object>} 浏览器上下文
   */
  async launchNewInstance() {
    try {
      // Chrome 启动参数
      const chromeArgs = [
        `--remote-debugging-port=${this.debugPort}`,
        `--user-data-dir=${this.AUTOATION_CHROME_DATA_DIR}`,
        // `--profile-directory=Profile${this.chromeNumber}`,
        '--no-first-run',
        '--no-default-browser-check',
        this.proxy ? `--proxy-server=127.0.0.1:${this.listenPort}` : ''
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
      
    } catch (error) {
      console.error(`Chrome启动失败 (实例${this.chromeNumber}):`, error);
      await this.cleanupFailedStart(); // 清理残留进程
    }
}

  // 获取指纹
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
   * 检查Chrome的运行状态
   * @returns {Promise<{status: string, pageLength: number}>} 
   * status: 'disconnected' - 连接不通
   * status: 'connected_no_pages' - 连接通但没有页面
   * status: 'connected_with_pages' - 连接通且有页面
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
      const pageLength = Array.isArray(pages) ? pages.length : 0;

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
    async shutdownChrome () {
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
  }