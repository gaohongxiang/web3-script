#!/usr/bin/env node

import { ProxyServer } from './proxyServer.js';
import { myFormatData } from '../../../utils-module/formatdata.js';
import { BASE_CONFIG } from './config.js';
import minimist from 'minimist';

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

// 主函数
const main = async () => {
    // 解析命令行参数
    const argv = minimist(process.argv.slice(2));
    const command = argv._[0];  // 获取命令（start/stop）
    const instances = argv._.slice(1);  // 获取实例编号参数

    if (!command || instances.length === 0) {
        console.log('使用方法: ');
        console.log('  启动代理: proxy-manager start 1 2 3,5');
        console.log('  停止代理: proxy-manager stop 1 2 3,5');
        return;
    }

    switch (command) {
        case 'start':
            await startProxy(...instances);
            break;
        case 'stop':
            await stopProxy(...instances);
            break;
        default:
            console.log('未知命令，请使用 start 或 stop');
    }
};

// 运行主函数
main().catch(error => {
    console.error('运行错误:', error);
    process.exit(1);
});