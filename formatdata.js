import { getCsvData, getExcelData } from './packages/utils-module/utils.js';

const csvFiles = [
    // 各种钱包文件
    './data/walletEth.csv',
    './data/walletEthTugou.csv',
    './data/walletEthFuzhu.csv',
    './data/walletBtc.csv',
    './data/walletCosmos.csv',
    './data/walletSol.csv',
    './data/walletSui.csv',    
    './data/walletArgent.csv',
    './data/walletBraavos.csv',
    
    // 密码文件。可以做到每个指纹里的钱包用不同的密码。
    './data/walletPassword.csv',

    // 存放交易所的接收地址
    './data/addressBinance.csv',
    './data/addressOkx.csv',

    // 社交文件
    './data/email.csv',
    './data/twitter.csv',
    './data/discord.csv',

    // ip文件
    './data/ip.csv',

    // 指纹浏览器文件
    './data/bitbrowser.xlsx',
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
                    const proxy = `socks5://${record.proxyUsername}:${record.proxyPassword}@${record.proxyIp}:${record.proxyPort}`;
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

