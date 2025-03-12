import http from "http";
import { SocksClient } from "socks";
import { SocksProxyAgent } from "socks-proxy-agent";
import { fileURLToPath } from "url";
import minimist from 'minimist';
import { notificationManager } from '../../../notification-module/notification.js';

export class ProxyServer {
    constructor({ listenPort, socksProxyUrl, chromeNumber }) {
        this.options = {
            listenHost: "127.0.0.1",
            listenPort: parseInt(listenPort),
            socksProxyUrl,
            timeout: 60000,
        };

        this.chromeNumber = chromeNumber;
        this.connections = new Map();
        this.server = null;
        this.isRunning = false;
        
        // 安全地解析代理URL
        this.proxyHost = "未知";
        try {
            if (this.options.socksProxyUrl) {
                const proxyUrl = new URL(this.options.socksProxyUrl);
                this.proxyHost = proxyUrl.hostname;
            }
        } catch (error) {
            // 忽略解析错误，使用默认值
        }

        // 初始化日志配置
        notificationManager.configure({
            logDir: 'logs/proxy'
        });
    }

    // 检查服务器是否正在运行
    isServerRunning() {
        return this.isRunning && this.server && this.server.listening;
    }

    // 处理连接关闭
    handleConnectionClose(connId, socket, type = 'unknown') {
        if (this.connections.has(connId)) {
            this.connections.delete(connId);
            
            if (process.env.DEBUG || type.includes('error') || type.includes('timeout')) {
                notificationManager.info({
                    "message": "连接关闭",
                    "context": {
                        "Chrome": this.chromeNumber,
                        "端口": this.options.listenPort,
                        "ip": this.proxyHost,
                        "类型": type
                    }
                });
            }
        }
        
        if (socket && !socket.destroyed) {
            socket.end();
            socket.destroy();
        }
    }

    // 处理 HTTP 请求
    async handleRequest(uReq, uRes) {
        const connId = Date.now() + Math.random();
        this.connections.set(connId, { type: 'http', req: uReq, res: uRes });
        let currentRequest = null;

        try {
            // 安全地解析URL
            let u;
            try {
                u = new URL(uReq.url, `http://${uReq.headers.host || 'localhost'}`);
            } catch (error) {
                throw new Error(`无效的URL: ${error.message}`);
            }

            // 安全地创建代理
            let socksAgent;
            try {
                socksAgent = new SocksProxyAgent(this.options.socksProxyUrl);
            } catch (error) {
                throw new Error(`创建代理失败: ${error.message}`);
            }

            const options = {
                hostname: u.hostname,
                port: u.port || 80,
                path: u.pathname + u.search,
                method: uReq.method,
                headers: { ...uReq.headers },
                agent: socksAgent,
                timeout: this.options.timeout
            };

            // 优化请求头
            if (options.headers['proxy-connection']) {
                delete options.headers['proxy-connection'];
            }
            options.headers['connection'] = 'keep-alive';

            currentRequest = http.request(options);

            // 设置超时
            currentRequest.setTimeout(this.options.timeout, () => {
                currentRequest.destroy(new Error('请求超时'));
            });

            // 处理响应
            currentRequest.on("response", (pRes) => {
                if (!uRes.headersSent) {
                    uRes.writeHead(pRes.statusCode, pRes.headers);
                }
                
                pRes.pipe(uRes);
            });

            // 处理错误
            currentRequest.on("error", (error) => {
                this.handleConnectionClose(connId, currentRequest, 'http-error');
                
                if (!uRes.headersSent) {
                    uRes.writeHead(500, { "Content-Type": "text/plain" });
                    uRes.end(`Proxy error: ${error.message}\n`);
                }
            });

            // 传输请求体
            uReq.pipe(currentRequest);

            // 处理客户端关闭
            uReq.on('close', () => {
                this.handleConnectionClose(connId, currentRequest, 'http-client-close');
            });

        } catch (error) {
            this.handleConnectionClose(connId, currentRequest, 'http-error-final');
            if (!uRes.headersSent) {
                uRes.writeHead(500, { "Content-Type": "text/plain" });
                uRes.end(`Proxy error: ${error.message}\n`);
            }
        }
    }

    // 处理 HTTPS 请求
    async handleConnect(uReq, uSocket, uHead) {
        const connId = Date.now() + Math.random();
        this.connections.set(connId, { type: 'https', socket: uSocket });
        
        try {
            // 安全地解析URL
            let u;
            try {
                u = new URL(`http://${uReq.url}`);
            } catch (error) {
                throw new Error(`无效的URL: ${error.message}`);
            }

            // 安全地解析代理配置
            let proxy;
            try {
                proxy = new URL(this.options.socksProxyUrl);
            } catch (error) {
                throw new Error(`无效的代理配置: ${error.message}`);
            }

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
                timeout: this.options.timeout
            };

            // 创建SOCKS连接
            const { socket: pSocket } = await SocksClient.createConnection(options);

            // 设置 socket 选项
            pSocket.setKeepAlive(true, 1000);
            pSocket.setNoDelay(true);

            // 错误处理
            pSocket.on('error', (error) => {
                this.handleConnectionClose(connId, pSocket, 'proxy-error');
            });

            // 处理连接关闭
            pSocket.on('close', () => {
                this.handleConnectionClose(connId, uSocket, 'proxy-close');
            });

            uSocket.on('error', (error) => {
                this.handleConnectionClose(connId, uSocket, 'client-error');
            });

            uSocket.on('close', () => {
                this.handleConnectionClose(connId, pSocket, 'client-close');
            });

            // 建立双向管道
            pSocket.pipe(uSocket);
            uSocket.pipe(pSocket);

            // 发送连接成功响应
            uSocket.write(`HTTP/${uReq.httpVersion} 200 Connection established\r\n\r\n`);

            // 如果有初始数据，发送它
            if (uHead && uHead.length) {
                pSocket.write(uHead);
            }

        } catch (error) {
            this.handleConnectionClose(connId, uSocket, 'connect-error');
            if (!uSocket.destroyed) {
                uSocket.write(`HTTP/${uReq.httpVersion} 500 ${error.message}\r\n\r\n`);
                uSocket.destroy();
            }
        }
    }

    /**
     * 启动代理服务器
     */
    async start() {
        try {
            if (this.isServerRunning()) {
                notificationManager.warning({
                    "message": "代理服务器已在运行",
                    "context": {
                        "Chrome": this.chromeNumber,
                        "端口": this.options.listenPort,
                        "ip": this.proxyHost
                    }
                });
                return this.server;
            }

            this.server = http.createServer();

            this.server.on("connect", (req, socket, head) => {
                this.handleConnect(req, socket, head);
            });

            this.server.on("request", (req, res) => {
                this.handleRequest(req, res);
            });

            this.server.on("error", (error) => {
                this.isRunning = false;
                notificationManager.error({
                    "message": "服务器错误",
                    "context": {
                        "Chrome": this.chromeNumber,
                        "端口": this.options.listenPort,
                        "ip": this.proxyHost,
                        "错误": error.message
                    }
                });
            });

            await new Promise((resolve) => {
                this.server.listen(this.options.listenPort, this.options.listenHost, () => {
                    this.isRunning = true;
                    notificationManager.success({
                        "message": "代理服务启动",
                        "context": {
                            "Chrome": this.chromeNumber,
                            "端口": this.options.listenPort,
                            "ip": this.proxyHost
                        }
                    });
                    resolve();
                });
            });

            return this.server;
        } catch (error) {
            notificationManager.error({
                "message": "启动代理服务器失败",
                "context": {
                    "Chrome": this.chromeNumber,
                    "ip": this.proxyHost,
                    "错误": error.message
                }
            });
            throw error;
        }
    }

    // 安全关闭代理服务器
    async shutdown() {
        if (!this.isServerRunning()) {
            return;
        }

        return new Promise((resolve) => {
            // 停止接收新的连接
            this.server.close(() => {
                notificationManager.info({
                    "message": "代理服务器停止监听",
                    "context": {
                        "Chrome": this.chromeNumber,
                        "端口": this.options.listenPort,
                        "ip": this.proxyHost
                    }
                });
            });

            // 关闭所有现有连接
            for (const [connId, conn] of this.connections.entries()) {
                try {
                    if (conn.type === 'http') {
                        if (conn.req && !conn.req.destroyed) conn.req.destroy();
                        if (conn.res && !conn.res.destroyed) conn.res.destroy();
                    } else if (conn.type === 'https') {
                        if (conn.socket && !conn.socket.destroyed) {
                            conn.socket.end();
                            conn.socket.destroy();
                        }
                    }
                    this.connections.delete(connId);
                } catch (error) {
                    notificationManager.error({
                        "message": "关闭连接失败",
                        "context": {
                            "Chrome": this.chromeNumber,
                            "端口": this.options.listenPort,
                            "ip": this.proxyHost,
                            "原因": error.message
                        }
                    });
                }
            }

            this.isRunning = false;
            this.server = null;
            resolve();
        });
    }
}

// 解析命令行参数
const parseArgs = () => {
    const argv = minimist(process.argv.slice(2));
    return {
        listenPort: argv.port || 20001, // 默认端口
        socksProxyUrl: argv.proxy, // 代理配置参数
        chromeNumber: argv.chromeNumber || 1 // 默认为1号Chrome
    };
};

const startProxyServer = async () => {
    try {
        const config = parseArgs();
        const proxyServer = new ProxyServer(config);
        await proxyServer.start();
    } catch (error) {
        console.error('启动代理服务器失败:', error);
        process.exit(1);
    }
};

// 直接运行时启动服务器
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    startProxyServer();
}