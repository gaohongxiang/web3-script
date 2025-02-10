import http from "http";
import { SocksClient } from "socks";
import { SocksProxyAgent } from "socks-proxy-agent";
import { fileURLToPath } from "url";
import minimist from 'minimist';

export class ProxyServer {
    constructor({ listenPort, proxy }) {
        this.options = {
            listenHost: "127.0.0.1",
            listenPort: parseInt(listenPort),
            proxy,
            timeout: 30000,
            statsInterval: 30000,  // 每30秒打印统计
        };

        this.connections = new Set();
    }

    /**
     * 处理 HTTP 请求
     */
    async handleRequest(uReq, uRes) {
    const requestId = Symbol('request');

    // 只在开始时增加连接数
    if (!this.connections.has(requestId)) {
        this.connections.add(requestId);
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

            this.connections.delete(requestId);
        });

        // 请求错误处理
        pReq.on("error", (error) => {
            console.error(`[${this.options.listenPort}] 请求错误:`, uReq.url, error);
            if (!uRes.headersSent) {
                uRes.writeHead(500, { "Content-Type": "text/plain" });
                uRes.end("Connection error\n");
            }
        });

        // 请求超时处理
        pReq.on("timeout", () => {
            console.error(`[${this.options.listenPort}] 请求超时:`, uReq.url);
            pReq.destroy(new Error("Request timeout"));
        });

        // 传输请求数据
        uReq.pipe(pReq);

    } catch (error) {
        console.error(`[${this.options.listenPort}] 请求处理错误:`, error);
        if (!uRes.headersSent) {
            uRes.writeHead(500, { "Content-Type": "text/plain" });
            uRes.end("Internal server error\n");
        }
    }
}

    /**
     * 处理 HTTPS 请求（CONNECT 方法）
     */
    async handleConnect(uReq, uSocket, uHead) {
    const connId = Symbol('connection');

    // 只在开始时增加连接数
    if (!this.connections.has(connId)) {
        this.connections.add(connId);
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
            this.connections.delete(connId);
        });

        // 创建SOCKS连接
        const { socket } = await SocksClient.createConnection(options);

        // 代理连接错误处理
        socket.on('error', (error) => {
            console.error(`[${this.options.listenPort}] 代理连接错误:`, error);
            this.connections.delete(connId);
            uSocket?.destroy();
        });

        // 数据传输统计
        socket.on('data', (chunk) => {
        });
        uSocket.on('data', (chunk) => {
        });

        // 建立双向管道
        socket.pipe(uSocket);
        uSocket.pipe(socket);

        // 发送连接成功响应
        uSocket.write(`HTTP/${uReq.httpVersion} 200 Connection established\r\n\r\n`);

        // console.log(`[${this.options.listenPort}] CONNECT成功:`, uReq.url);
        this.connections.delete(connId);

    } catch (error) {
        console.error(`[${this.options.listenPort}] CONNECT失败:`, error);
        uSocket?.write(`HTTP/${uReq.httpVersion} 500 Connection error\r\n\r\n`);
        uSocket?.destroy();
    }
}

    /**
     * 启动代理服务器
     */
    async start() {
    this.server = http.createServer();  // 保存服务器实例

    // 处理CONNECT请求
    this.server.on("connect", (req, socket, head) => {
        this.handleConnect(req, socket, head);
    });

    // 处理HTTP请求
    this.server.on("request", (req, res) => {
        this.handleRequest(req, res);
    });

    // 服务器错误处理
    this.server.on("error", (error) => {
        console.error(`[${this.options.listenPort}] 服务器错误:`, error);
    });

    // 启动服务器
    return new Promise((resolve) => {
        this.server.listen(this.options.listenPort, this.options.listenHost, () => {
            console.log(`[${this.options.listenPort}] 代理服务器已启动`);
            resolve(this.server);  // 返回服务器实例
        });
    });
}

    /**
     * 安全关闭代理服务器
     */
    async shutdown() {
    if (!this.server) {
        console.log(`[${this.options.listenPort}] 代理服务器未启动`);
        return;
    }

    return new Promise((resolve) => {
        // 停止接收新的连接
        this.server.close(() => {
            console.log(`[${this.options.listenPort}] 代理服务器已停止监听`);
        });

        // 关闭所有现有连接
        for (const connection of this.connections) {
            try {
                // 尝试优雅关闭连接
                connection.end();
                connection.destroy();
                this.connections.delete(connection);
            } catch (error) {
                console.error(`[${this.options.listenPort}] 关闭连接失败:`, error);
            }
        }

        // 设置超时，确保所有连接都能正常关闭
        setTimeout(() => {
            // 强制关闭剩余连接
            for (const connection of this.connections) {
                try {
                    connection.destroy();
                    this.connections.delete(connection);
                } catch (error) {
                    console.error(`[${this.options.listenPort}] 强制关闭连接失败:`, error);
                }
            }

            console.log(`[${this.options.listenPort}] 代理服务器已完全关闭`);
            this.server = null;
            resolve();
        }, 5000); // 给5秒时间让连接正常关闭
    });
}
}

// 解析命令行参数
const parseArgs = () => {
    const argv = minimist(process.argv.slice(2));
    return {
        listenPort: argv.port || 20001, // 默认端口
        proxy: argv.proxy // 新增代理配置参数
    };
};

const startProxyServer = async () => {
    try {
        const config = parseArgs();
        const proxyServer = new ProxyServer(config);

        await proxyServer.start();

        console.log(`代理服务器已启动`);

    } catch (error) {
        console.error('启动代理服务器失败:', error);
        process.exit(1);
    }
};

// 直接运行时启动服务器
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    startProxyServer();
}