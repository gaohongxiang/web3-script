import { chromium } from 'playwright';
import { FingerprintInjector } from 'fingerprint-injector';
import fsp from 'fs/promises';
import path from 'path';
import { formatNumber } from './utils.js';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { BASE_CONFIG } from './config.js';

export class ChromeUtil {
  constructor(chromeNumber, proxy = null) {
    this.chromeNumber = formatNumber(chromeNumber);
    this.debugPort = BASE_CONFIG.getDebugPort(chromeNumber);
    this.listenPort = BASE_CONFIG.getListenPort(chromeNumber);
    this.AUTOMATION_CHROME_EXECUTABLE = BASE_CONFIG.getChromeExecutable(this.chromeNumber);
    this.AUTOATION_CHROME_DATA_DIR = BASE_CONFIG.getProfileDataDir(this.chromeNumber);
    this.FINGERPRINT_PATH = BASE_CONFIG.getFingerprintPath(this.chromeNumber);
    this.proxy = proxy;
    this.proxyServer = null;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.dedicatedProxy = null;
    this.chromeProcessPid = null;
  }

  /**
    * 启动本地代理服务器
    */
  async setupProxy() {
    if (!this.proxy) return;

    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const proxyServerPath = path.join(__dirname, 'proxyServer.js');

        // 直接传递参数，而不是通过环境变量
        const args = [
            proxyServerPath,
            '--chrome-number', this.chromeNumber,
            '--port', this.listenPort.toString(),
            '--host', '127.0.0.1',
            '--proxy', this.proxy
        ];

        if (this.chromeProcessPid) {
            args.push('--browser-pid', this.chromeProcessPid.toString());
        }

        const proxyProcess = spawn('node', args, {
            detached: true,
            stdio: 'ignore'
        });

        proxyProcess.unref();
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`代理服务器已启动在端口 ${this.listenPort} [用户${this.chromeNumber}]`);

    } catch (error) {
        console.error('启动代理服务器失败:', error);
        throw error;
    }
  }

  /**
   * 启动方法（复用或新建实例）
   */
  async start() {
    const { status } = await this.isChromeRunning();
    
    // 先设置代理
    await this.setupProxy();
    
    switch (status) {
      case 'disconnected':
        // Chrome没有运行，启动新实例
        console.log('Chrome未运行,启动新实例');
        await this.launchNewInstance();
        await this.connectToInstance(true);
        break;

        case 'connected_no_pages':
            console.log('Chrome在运行但没有页面,创建新页面');
            // 获取现有Chrome进程的PID
            const existingPid = await this.getChromePid();
            if (existingPid && this.dedicatedProxy) {
                this.chromeProcessPid = existingPid;
                this.dedicatedProxy.attachBrowserProcess(existingPid);
            }
            await this.connectToInstance(false);
            break;

        case 'connected_with_pages':
            console.log('Chrome在运行且有页面,连接现有页面');
            // 获取现有Chrome进程的PID
            const runningPid = await this.getChromePid();
            if (runningPid && this.dedicatedProxy) {
                this.chromeProcessPid = runningPid;
                this.dedicatedProxy.attachBrowserProcess(runningPid);
            }
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
      console.log('完整启动命令:', [this.AUTOMATION_CHROME_EXECUTABLE, ...chromeArgs].join(' '));
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

        // 等待Chrome进程启动并获取真实PID
        await new Promise(resolve => setTimeout(resolve, 1000));
        const realChromePid = await this.getChromePid();
        
        if (realChromePid) {
            this.chromeProcessPid = realChromePid;
            console.log(`Chrome进程PID: ${realChromePid}`);
            
            // 如果代理服务器存在，绑定Chrome进程
            if (this.dedicatedProxy) {
                this.dedicatedProxy.attachBrowserProcess(realChromePid);
            }
        }

        chromeProcess.unref();

    } catch (error) {
        console.error('启动失败:', error);
        throw error;
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

  async getDynamicWsUrl(port) {
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`http://localhost:${port}/json/version`);
        const data = await response.json();
        return data.webSocketDebuggerUrl;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(r => setTimeout(r, 2000));
      }
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
  * 强制关闭指定Profile的Chrome实例
  */
  async forceCloseExistingInstance() {
    try {
      // 查找并关闭指定调试端口的Chrome进程
      const cmd = `lsof -i :${this.debugPort} | grep Chrome | awk '{print $2}' | xargs kill -9`;
      execSync(cmd, { stdio: 'ignore', shell: true });
      console.log(`已关闭端口 ${this.debugPort} 的Chrome进程`);
    } catch (error) {
      // 如果没有找到进程，忽略错误
      console.log(`端口 ${this.debugPort} 没有运行的Chrome进程`);
    }
  }

  /**
   * 验证指纹是否正确注入
   * @param {Object} page - Playwright页面实例
   * @returns {Promise<Object>} 验证结果
   */
  async verifyFingerprint(page) {
    return await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      webGL: {
        vendor: document.createElement('canvas')
          .getContext('webgl')
          .getParameter(37445),
        renderer: document.createElement('canvas')
          .getContext('webgl')
          .getParameter(37446)
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height
      }
    }));
  }

  /**
   * 查看Chrome进程详细信息
   */
  async checkChromeProcesses() {
    try {
      // 1. 检查调试端口状态
      const { status, pageLength } = await this.isChromeRunning();
      console.log('\n=== Chrome运行状态 ===');
      console.log(`端口 ${this.debugPort} 状态:`, status);
      console.log(`页面数量:`, pageLength);

      // 2. 查找所有相关的Chrome进程
      console.log('\n=== Chrome进程列表 ===');
      // 分别用不同的方式查找进程
      console.log('通过调试端口查找:');
      try {
        const portCmd = `ps aux | grep "remote-debugging-port=${this.debugPort}" | grep -v grep`;
        const portProcesses = execSync(portCmd, { shell: true }).toString();
        console.log(portProcesses || '未找到相关进程');
      } catch (error) {
        console.log('未找到相关进程');
      }

      console.log('\n通过Profile目录查找:');
      try {
        const profileCmd = `ps aux | grep "profile-directory=Profile${this.chromeNumber}" | grep -v grep`;
        const profileProcesses = execSync(profileCmd, { shell: true }).toString();
        console.log(profileProcesses || '未找到相关进程');
      } catch (error) {
        console.log('未找到相关进程');
      }

      // 3. 检查端口占用
      console.log('\n=== 端口占用情况 ===');
      try {
        const portCmd = `lsof -i :${this.debugPort}`;
        const portInfo = execSync(portCmd, { shell: true }).toString();
        console.log(portInfo || '端口未被占用');
      } catch (error) {
        console.log('端口未被占用');
      }

    } catch (error) {
      console.error('检查进程失败:', error.message);
    }
  }
  

  /**
   * 获取Chrome进程PID
   */
  async getChromePid() {
    try {
        // 使用 pgrep 查找真实的 Chrome 进程
        const cmd = `pgrep -f "${this.debugPort}"`;
        const pid = parseInt(execSync(cmd, { encoding: 'utf8' }).trim());
        return pid;
    } catch (error) {
        console.error('获取Chrome PID失败:', error);
        return null;
    }
  }
}

async function main(chromeNumber) {
  const chrome = new ChromeUtil(chromeNumber);

  try {
    // await chrome.launchChrome();

    // 先检查进程状态
    await chrome.checkChromeProcesses();

    // 启动带指纹的浏览器
    await chrome.start();
    // 访问测试页面
    await chrome.page.goto('chrome://version/');

  } catch (error) {
    console.error('运行失败:', error);
  }
}

// main(1);