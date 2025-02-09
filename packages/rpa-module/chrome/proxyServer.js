import http from "http";
import { EventEmitter } from "events";
import { SocksClient } from "socks";
import { SocksProxyAgent } from "socks-proxy-agent";
import { fileURLToPath } from "url";
import minimist from 'minimist';

class DedicatedProxy extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            listenHost: "127.0.0.1",
            listenPort: parseInt(options.listenPort),
            proxy: options.proxy,
            timeout: 30000,
            statsInterval: 30000,  // 每30秒打印统计
            chromeNumber: options.chromeNumber
        };

        this.stats = {
            requestCount: 0,
            errorCount: 0,
            activeConnections: 0,
            bytesTransferred: 0
        };

        this.statsTimer = null;
        this.browserProcessPid = null;  // 存储浏览器进程PID
        this.processCheckInterval = null;  // 进程检查定时器

        this.connectionPool = new Map();
    }

    /**
     * 绑定浏览器进程
     */
    attachBrowserProcess(pid) {
        this.browserProcessPid = pid;
        if (pid) {
            console.log(`[${this.options.listenPort}] 代理服务器已绑定到浏览器进程 ${pid}`);
            // 启动进程检查
            this.startProcessCheck();
        } else {
            // 解绑时清理检查定时器
            this.stopProcessCheck();
        }
    }

    /**
     * 检查浏览器进程是否存活
     */
    async checkProcess() {
        if (!this.browserProcessPid) return;
        
        try {
            process.kill(this.browserProcessPid, 0); // 检查进程是否存在
        } catch (error) {
            console.log(`[${this.options.listenPort}] 浏览器进程 ${this.browserProcessPid} 已终止，关闭代理服务器`);
            this.shutdown();
            return false;
        }
        return true;
    }

    /**
     * 启动进程检查
     */
    startProcessCheck() {
        if (this.processCheckInterval) return;
        
        this.processCheckInterval = setInterval(async () => {
            await this.checkProcess();
        }, 5000); // 每5秒检查一次
    }

    /**
     * 停止进程检查
     */
    stopProcessCheck() {
        if (this.processCheckInterval) {
            clearInterval(this.processCheckInterval);
            this.processCheckInterval = null;
        }
    }

    /**
     * 打印统计信息
     */
    printStats() {
        const mb = (this.stats.bytesTransferred / 1024 / 1024).toFixed(2);
        console.log(`\n=== 代理服务器统计 [${this.options.listenPort}] ===`);
        console.log(`总请求数: ${this.stats.requestCount}`);
        console.log(`错误数: ${this.stats.errorCount}`);
        console.log(`当前连接数: ${this.stats.activeConnections}`);
        console.log(`活跃连接: ${this.connectionPool.size}`);
        console.log(`总流量: ${mb} MB`);
        console.log('=====================================\n');
    }

    /**
     * 处理 HTTP 请求
     */
    async handleRequest(uReq, uRes) {
        const requestId = Symbol('request');
        this.stats.requestCount++;

        // 只在开始时增加连接数
        if (!this.connectionPool.has(requestId)) {
            this.stats.activeConnections++;
            this.connectionPool.set(requestId, { type: 'http' });
        }

        try {
            console.log(`[${this.options.listenPort}] 处理请求:`, uReq.url);
            const u = new URL(uReq.url, `http://${uReq.headers.host}`);
            const socksAgent = new SocksProxyAgent(this.options.proxy);

            const options = {
                hostname: u.hostname,
                port: u.port || 80,
                path: u.pathname + u.search,
                method: uReq.method,
                headers: uReq.headers,
                agent: socksAgent,
                timeout: this.options.timeout,
            };

            const pReq = http.request(options);
            
            // 请求成功处理
            pReq.on("response", (pRes) => {
                console.log(`[${this.options.listenPort}] 请求成功:`, uReq.url);
                uRes.writeHead(pRes.statusCode, pRes.headers);
                pRes.pipe(uRes);
                
                // 统计传输数据量
                pRes.on('data', (chunk) => {
                    this.stats.bytesTransferred += chunk.length;
                });
                
                this.emit("request:success");
            });

            // 请求错误处理
            pReq.on("error", (error) => {
                console.error(`[${this.options.listenPort}] 请求错误:`, uReq.url, error);
                this.stats.errorCount++;
                if (!uRes.headersSent) {
                    uRes.writeHead(500, { "Content-Type": "text/plain" });
                    uRes.end("Connection error\n");
                }
                this.emit("request:error", error);
            });

            // 请求超时处理
            pReq.on("timeout", () => {
                console.error(`[${this.options.listenPort}] 请求超时:`, uReq.url);
                this.stats.errorCount++;
                pReq.destroy(new Error("Request timeout"));
            });

            // 传输请求数据
            uReq.pipe(pReq);

            // 统计上行数据量
            uReq.on('data', (chunk) => {
                this.stats.bytesTransferred += chunk.length;
            });

        } catch (error) {
            console.error(`[${this.options.listenPort}] 请求处理错误:`, error);
            this.stats.errorCount++;
            if (!uRes.headersSent) {
                uRes.writeHead(500, { "Content-Type": "text/plain" });
                uRes.end("Internal server error\n");
            }
            this.emit("request:error", error);
        } finally {
            // 只在连接确实存在时减少计数
            if (this.connectionPool.has(requestId)) {
                this.stats.activeConnections--;
                this.connectionPool.delete(requestId);
            }
        }
    }

    /**
     * 处理 HTTPS 请求（CONNECT 方法）
     */
    async handleConnect(uReq, uSocket, uHead) {
        const connId = Symbol('connection');
        this.stats.requestCount++;

        // 只在开始时增加连接数
        if (!this.connectionPool.has(connId)) {
            this.stats.activeConnections++;
            this.connectionPool.set(connId, { type: 'https' });
        }

        try {
            // console.log(`[${this.options.listenPort}] 处理CONNECT:`, uReq.url);
            const u = new URL(`http://${uReq.url}`);
            const proxy = new URL(this.options.proxy);

            const options = {
                proxy: {
                    host: proxy.hostname,
                    port: parseInt(proxy.port),
                    type: 5,
                    userId: proxy.username ? decodeURIComponent(proxy.username) : "",
                    password: proxy.password ? decodeURIComponent(proxy.password) : "",
                },
                destination: {
                    host: u.hostname,
                    port: parseInt(u.port) || 443,
                },
                command: "connect",
                timeout: this.options.timeout,
            };

            // 错误处理
            uSocket.on('error', (error) => {
                console.error(`[${this.options.listenPort}] 客户端连接错误:`, error);
                this.stats.errorCount++;
                this.emit("connect:error", error);
            });

            // 创建SOCKS连接
            const { socket } = await SocksClient.createConnection(options);
            
            // 代理连接错误处理
            socket.on('error', (error) => {
                console.error(`[${this.options.listenPort}] 代理连接错误:`, error);
                this.stats.errorCount++;
                this.emit("connect:error", error);
                uSocket?.destroy();
            });

            // 数据传输统计
            socket.on('data', (chunk) => {
                this.stats.bytesTransferred += chunk.length;
            });
            uSocket.on('data', (chunk) => {
                this.stats.bytesTransferred += chunk.length;
            });

            // 建立双向管道
            socket.pipe(uSocket);
            uSocket.pipe(socket);
            
            // 发送连接成功响应
            uSocket.write(`HTTP/${uReq.httpVersion} 200 Connection established\r\n\r\n`);
            
            // console.log(`[${this.options.listenPort}] CONNECT成功:`, uReq.url);
            this.emit("connect:success");

            // 连接成功后更新连接池
            this.connectionPool.set(connId, { 
                clientSocket: uSocket, 
                proxySocket: socket,
                type: 'https'
            });

            // 清理连接的处理移到这里
            const cleanup = () => {
                if (this.connectionPool.has(connId)) {
                    this.stats.activeConnections--;
                    this.connectionPool.delete(connId);
                }
                socket?.destroy();
                uSocket?.destroy();
            };

            socket.on('close', cleanup);
            uSocket.on('close', cleanup);

        } catch (error) {
            console.error(`[${this.options.listenPort}] CONNECT失败:`, error);
            this.stats.errorCount++;
            uSocket?.write(`HTTP/${uReq.httpVersion} 500 Connection error\r\n\r\n`);
            this.emit("connect:error", error);
            uSocket?.destroy();
        }
    }

    /**
     * 启动代理服务器
     */
    async start() {
        const server = http.createServer();

        // 处理CONNECT请求
        server.on("connect", (req, socket, head) => {
            this.handleConnect(req, socket, head);
        });

        // 处理HTTP请求
        server.on("request", (req, res) => {
            // 健康检查接口
            if (req.url === "/health") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    status: "ok",
                    ...this.stats,
                    connections: this.connectionPool.size,
                    throughput: `${(this.stats.bytesTransferred / 1024 / 1024).toFixed(2)} MB`
                }));
                return;
            }
            this.handleRequest(req, res);
        });

        // 服务器错误处理
        server.on("error", (error) => {
            console.error(`[${this.options.listenPort}] 服务器错误:`, error);
            this.emit("server:error", error);
        });

        // 启动统计信息打印定时器
        this.statsTimer = setInterval(() => {
            this.printStats();
        }, this.options.statsInterval);

        // 启动服务器
        return new Promise((resolve) => {
            server.listen(this.options.listenPort, this.options.listenHost, () => {
                console.log(`[${this.options.listenPort}] 代理服务器已启动`);
                this.server = server;
                // 立即打印初始统计信息
                this.printStats();
                resolve(server);
            });
        });
    }

    /**
     * 安全关闭代理服务器
     */
    async shutdown() {
        if (!this.server) return;
        
        // 清除所有定时器
        this.stopProcessCheck();
        if (this.statsTimer) {
            clearInterval(this.statsTimer);
            this.statsTimer = null;
        }

        // 打印最终统计信息
        this.printStats();
        
        return new Promise((resolve) => {
            // 关闭所有连接
            this.connectionPool.forEach(({clientSocket, proxySocket}) => {
                clientSocket?.destroy();
                proxySocket?.destroy();
            });
            
            // 关闭服务器
            this.server.close(() => {
                console.log(`[${this.options.listenPort}] 代理服务器已关闭`);
                resolve();
            });
        });
    }
}

// 解析命令行参数
const parseArgs = () => {
    const argv = minimist(process.argv.slice(2), {
        string: ['chrome-number', 'port', 'host', 'proxy', 'browser-pid'],
        alias: {
            n: 'chrome-number',
            p: 'port',
            h: 'host',
            x: 'proxy',
            b: 'browser-pid'
        }
    });

    return {
        chromeNumber: argv['chrome-number'],
        listenPort: parseInt(argv.port),
        listenHost: argv.host || '127.0.0.1',
        proxy: argv.proxy,
        browserPid: argv['browser-pid'] ? parseInt(argv['browser-pid']) : null
    };
};

const startProxyServer = async () => {
    try {
        const config = parseArgs();
        const proxy = new DedicatedProxy(config);

        await proxy.start();

        if (config.browserPid) {
            proxy.attachBrowserProcess(config.browserPid);
        }

        console.log(`代理服务器已启动 [用户${config.chromeNumber}]`);

    } catch (error) {
        console.error('启动代理服务器失败:', error);
        process.exit(1);
    }
};

// 直接运行时启动服务器
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    startProxyServer();
}