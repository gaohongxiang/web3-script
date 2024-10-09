import { getCsvData, getExcelData } from './packages/utils-module/utils.js';

const csvFiles = [
    './data/wallet_eth.csv',
    './data/wallet_btc.csv',
    './data/wallet_cosmos.csv',
    './data/wallet_sol.csv',
    './data/wallet_argent.csv',
    './data/wallet_braavos.csv',
    './data/wallet_eth_tugou.csv',
    './data/wallet_eth_fuzhu.csv',
    './data/wallet_password.csv',

    './data/binance_address.csv',
    './data/okx_address.csv',

    './data/email.csv',
    './data/twitter.csv',
    './data/discord.csv',

    './data/bitbrowser.xlsx',

    './data/ip.csv',
];

// 整合多个 CSV 文件为一个 JSON 对象
export async function myFormatData(startNum, endNum=null) {
    // 不传endNum即表示查询一个账户
    if (endNum === null) {
        endNum = startNum;
    }
    if (parseInt(startNum) <= 0 || parseInt(endNum) <= 0) {
        console.log('账号必须大于0');
        return;
    }
    if (parseInt(startNum) > parseInt(endNum)) {
        console.log('开始账号必须小于或等于结束账号');
        return;
    }
    const allData = [];

    for (const filePath of csvFiles) {
        let records;

        // 读取 CSV 或 Excel 文件
        if (filePath.endsWith('.csv')) {
            records = await getCsvData(filePath); // 读取 CSV 文件
        } else if (filePath.endsWith('.xlsx')) {
            records = await getExcelData(filePath); // 读取 Excel 文件
        } else {
            console.log(`不支持的文件类型: ${filePath}`);
            continue; // 跳过不支持的文件类型
        }

        records.forEach(record => {
            const id = parseInt(record.indexId); // 使用每个文件中的 indexId 字段并转换为整数
            
            // 只处理在 startNum 和 endNum 范围内的 ID
            if (id >= startNum && id <= endNum) {
                // 处理 ip.csv 文件的代理字符串
                if (filePath.includes('ip.csv')) {
                    const proxy = `${record.proxyIp}:${record.proxyPort}:${record.proxyUsername}:${record.proxyPassword}`;
                    record.proxy = proxy; // 将拼接后的代理字符串添加到记录中
                    // // 删除原始的代理字段
                    // delete record.proxyIp;
                    // delete record.proxyPort;
                    // delete record.proxyUsername;
                    // delete record.proxyPassword;
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
    }

    return allData;
}

