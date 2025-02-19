import { execSync } from 'child_process';
import fetch from 'node-fetch';

export class ChromeDebugger {
    constructor(chromeUtil) {
        this.chrome = chromeUtil;
        this.logCache = new Map(); // 新增日志缓存
    }

    /**
     * 统一日志格式方法
     */
    #formatLog(type, action, details = {}) {
        const timestamp = new Date().toISOString();
        const prefix = `[用户${this.chrome.chromeNumber}]`.padEnd(12);
        const typeMap = {
            chrome: { emoji: '🌐', base: `浏览器${action}` },
            proxy: { emoji: '🔌', base: `代理${action}` },
            error: { emoji: '❌', base: `错误: ${action}` }
        };

        const { emoji, base } = typeMap[type] || {};
        let message = `${emoji} ${base}`;
        
        // 动态添加详情
        Object.entries(details).forEach(([key, val]) => {
            if (val) message += ` | ${key}: ${val}`;
        });

        return `${timestamp} ${prefix} ${message}`;
    }

    /**
     * 带缓存的日志方法
     */
    logStatus(type, action, details = {}) {
        const logEntry = this.#formatLog(type, action, details);
        
        // 防止重复日志
        if (!this.logCache.has(logEntry)) {
            console.log(logEntry);
            this.logCache.set(logEntry, Date.now());
        }

        // 定时清理缓存（5分钟）
        if (this.logCache.size > 100) {
            const now = Date.now();
            this.logCache.forEach((time, key) => {
                if (now - time > 300000) this.logCache.delete(key);
            });
        }
    }

    /**
     * 获取Chrome实例的完整状态
     */
    async getFullStatus() {
        try {
            return await Promise.allSettled([
                this.getChromeStatus(),
                this.getProxyStatus(),
                this.getSystemResources()
            ]).then((results) => ({
                chrome: results[0].status === 'fulfilled' ? results[0].value : null,
                proxy: results[1].status === 'fulfilled' ? results[1].value : null,
                system: results[2].status === 'fulfilled' ? results[2].value : null
            }));
        } catch (error) {
            this.logStatus('error', '获取完整状态失败', { reason: error.message });
            return null;
        }
    }

    /**
     * 获取Chrome状态
     */
    async getChromeStatus() {
        const { status, pageLength } = await this.chrome.isChromeRunning();
        const pid = await this.chrome.getProcessid();
        
        return {
            debugPort: this.chrome.debugPort,
            status,
            pageCount: pageLength,
            pid,
            userDataDir: this.chrome.AUTOATION_CHROME_DATA_DIR,
            profileNumber: this.chrome.chromeNumber
        };
    }

    /**
     * 获取代理服务器状态
     */
    async getProxyStatus() {
        if (!this.chrome.proxy) return null;

        // 1. 先检查代理进程是否存在
        const proxyPid = await this.chrome.getProcessid(this.chrome.listenPort);
        if (!proxyPid) {
            return {
                status: 'stopped',
                error: 'Proxy process not running'
            };
        }

        // 2. 如果进程存在，再尝试获取详细状态
        try {
            const response = await fetch(`http://localhost:${this.chrome.listenPort}/health`);
            const stats = await response.json();
            return {
                status: 'running',
                pid: proxyPid,
                ...stats
            };
        } catch (error) {
            return {
                status: 'error',
                pid: proxyPid,
                error: 'Proxy server not responding'
            };
        }
    }

    /**
     * 获取系统资源使用情况
     */
    async getSystemResources() {
        try {
            const pid = await this.chrome.getProcessid();
            if (!pid) return null;

            const cmd = `ps -p ${pid} -o %cpu,%mem,rss,vsz,etime`;
            const output = execSync(cmd, { encoding: 'utf8', timeout: 5000 });
            
            return {
                pid,
                resources: output.trim().split('\n')[1] // 提取实际数据
                    .split(/\s+/)
                    .reduce((obj, val, i) => ({
                        ...obj,
                        cpu: i === 0 ? `${val}%` : obj.cpu,
                        memory: i === 1 ? `${val}%` : obj.memory,
                        rss: i === 2 ? `${Math.round(val/1024)}MB` : obj.rss,
                        vsz: i === 3 ? `${Math.round(val/1024)}MB` : obj.vsz,
                        uptime: i === 4 ? val : obj.uptime
                    }), {})
            };
        } catch (error) {
            this.logStatus('error', '获取系统资源失败', { reason: error.message });
            return null;
        }
    }

    /**
     * 验证指纹注入
     */
    async verifyFingerprint() {
        if (!this.chrome.page) return null;
        
        return await this.chrome.page.evaluate(() => ({
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
     * 打印完整状态报告
     */
    async printFullReport() {
        const status = await this.getFullStatus();
        
        console.log('\n=== Chrome 实例状态报告 ===');
        console.log(`用户: ${this.chrome.chromeNumber}`);
        
        console.log('\n--- Chrome 状态 ---');
        console.log(`运行状态: ${status.chrome.status}`);
        console.log(`进程 PID: ${status.chrome.pid}`);
        console.log(`调试端口: ${status.chrome.debugPort}`);
        console.log(`页面数量: ${status.chrome.pageCount}`);
        
        if (status.proxy) {
            console.log('\n--- 代理服务器状态 ---');
            console.log(`状态: ${status.proxy.status}`);
            if (status.proxy.pid) {
                console.log(`进程 PID: ${status.proxy.pid}`);
            }
            if (status.proxy.status === 'running') {
                console.log(`监听端口: ${this.chrome.listenPort}`);
                console.log(`总请求数: ${status.proxy.requestCount}`);
                console.log(`当前连接: ${status.proxy.activeConnections}`);
                console.log(`总流量: ${status.proxy.throughput}`);
            }
        }
        
        if (status.system) {
            console.log('\n--- 系统资源使用 ---');
            console.log(status.system.resources);
        }
        
        console.log('\n===============================\n');
    }
} 