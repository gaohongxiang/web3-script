import fs from 'fs';
import path from 'path';
import { getPathFromRoot } from './path.js';
import { getCsvData, getExcelData, parseInstanceNumbers, formatNumber } from './utils.js';

// 整合多个 CSV 文件为一个 JSON 对象
export async function myFormatData(...inputs) {
    const instanceNumbers = parseInstanceNumbers(...inputs);
    if (instanceNumbers.length === 0) {
        console.log('至少输入一个账号');
        return;
    }

    const allData = [];

    // 读取配置文件
    const config = JSON.parse(fs.readFileSync(getPathFromRoot('filesConfig.json'), 'utf-8'));
    const dataFiles = config.dataFiles;

    for (const relativePath of dataFiles) {
        // 将相对路径转换为绝对路径
        const filePath = getPathFromRoot(relativePath);
        let records;
        try {
            // 读取 CSV 或 Excel 文件
            if (filePath.endsWith('.csv')) {
                records = await getCsvData(filePath);  // 读取 CSV 文件
            } else if (filePath.endsWith('.xlsx')) {
                records = await getExcelData(filePath);  // 读取 Excel 文件
            } else {
                console.log(`不支持的文件类型: ${filePath}`);
                continue; // 跳过不支持的文件类型
            }

            records.forEach(record => {
                const id = parseInt(record.indexId); // 使用每个文件中的 indexId 字段并转换为整数
                // 只处理在 instanceNumbers 数组中的 ID
                if (instanceNumbers.includes(id)) {
                    if (filePath.includes('ip.csv')) {
                        record.baseProxy = `${record.proxyUsername}:${record.proxyPassword}@${record.proxyIp}:${record.proxyPort}`;
                        record.socksProxyUrl = `socks5://${record.baseProxy}`;
                        record.httpProxyUrl = `http://${record.baseProxy}`;
                        record.httpsProxyUrl = `https://${record.baseProxy}`;
                    }

                    // 查找是否已经存在该 indexId 的记录
                    const existingRecord = allData.find(item => item.indexId === id.toString());
                    if (existingRecord) {
                        // 如果存在，合并数据
                        Object.assign(existingRecord, record); // 合并当前记录到已存在的记录中
                    } else {
                        // 如果不存在，添加新记录，并将 indexId 放在第一个字段
                        const newRecord = { indexId: id.toString(), ...record }; // 创建新记录
                        allData.push(newRecord); // 将当前记录添加到 allData 数组中
                    }
                }
            });
        } catch (error) {
            console.error(`处理文件 ${filePath} 时出错:`, error);
        }
    }

    // 添加指纹文件内容
    for (const id of instanceNumbers) {
        const chromeDir = `Chrome${formatNumber(id, 3)}`;
        const basePath = config.fingerprintConfig.basePath.replace('$HOME', process.env.HOME);
        const fingerprintPath = path.join(basePath, chromeDir, config.fingerprintConfig.fileName);
        
        const existingRecord = allData.find(item => item.indexId === id.toString());
        if (existingRecord) {
            try {
                if (fs.existsSync(fingerprintPath)) {
                    // 读取并解析指纹文件内容
                    const fingerprintContent = JSON.parse(fs.readFileSync(fingerprintPath, 'utf8'));
                    
                    // 提取关键信息
                    existingRecord.fingerprint = {
                        // 基本浏览器信息
                        userAgent: fingerprintContent.fingerprint.navigator.userAgent,
                        // 请求头信息
                        headers: fingerprintContent.headers,
                        // 屏幕信息（可能有用）
                        screen: fingerprintContent.fingerprint.screen,
                        // WebGL信息（反爬可能会用到）
                        videoCard: fingerprintContent.fingerprint.videoCard,
                        // 音频编解码器支持情况
                        audioCodecs: fingerprintContent.fingerprint.audioCodecs,
                        // 字体列表
                        fonts: fingerprintContent.fingerprint.fonts
                    };
                } else {
                    console.warn(`警告: 指纹文件不存在 ${fingerprintPath}`);
                }
            } catch (error) {
                console.error(`读取指纹文件失败 ${fingerprintPath}:`, error);
            }
        }
    }
    // console.log(allData);
    return allData;
}