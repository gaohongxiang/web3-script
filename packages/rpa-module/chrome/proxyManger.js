#!/usr/bin/env node

import { ProxyServer } from './proxyServer.js';
import { myFormatData } from '../../utils-module/formatData.js';
import { BASE_CONFIG } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';

// 获取项目根目录并切换到该目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
process.chdir(projectRoot);

// 启动代理
const startProxy = async (...inputs) => {
    try {
        const data = await myFormatData(...inputs);
        for (const d of data) {
            const listenPort = BASE_CONFIG.getListenPort(d['indexId']);
            const proxyServer = new ProxyServer({ listenPort, proxy: d['proxy'] });
            await proxyServer.start();
            console.log(`实例 ${d['indexId']} 的代理已启动`);
        }
    } catch (error) {
        console.error(`代理运行失败:`, error);
    }
};

// 停止代理
const stopProxy = async (...inputs) => {
    try {
        const data = await myFormatData(...inputs);
        for (const d of data) {
            const listenPort = BASE_CONFIG.getListenPort(d['indexId']);
            const proxyServer = new ProxyServer({ listenPort, proxy: 'dummy' });
            await proxyServer.shutdown();
            console.log(`实例 ${d['indexId']} 的代理已停止`);
        }
    } catch (error) {
        console.error(`停止代理失败:`, error);
    }
};

// 解析命令行参数
const argv = minimist(process.argv.slice(2));
const command = argv._[0];  // 获取命令（start/stop）
const instances = argv._.slice(1).map(arg => {
    // 如果参数包含逗号，解析为范围
    if (typeof arg === 'string' && arg.includes(',')) {
        const [start, end] = arg.split(',').map(Number);
        return [start, end];
    }
    // 否则转换为数字
    return Number(arg);
});

if (!command || instances.length === 0) {
    console.log('使用方法: ');
    console.log('  启动代理: node proxyManager.js start 1 2 3,5');
    console.log('  停止代理: node proxyManager.js stop 1 2 3,5');
} else {
    switch (command) {
        case 'start':
            startProxy(...instances);
            break;
        case 'stop':
            stopProxy(...instances);
            break;
        default:
            console.log('未知命令，请使用 start 或 stop');
    }
}