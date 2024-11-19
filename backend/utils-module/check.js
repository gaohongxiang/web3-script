import fs from 'node:fs/promises';
import path from 'node:path';
import { getCsvDataByColumnName } from './utils.js';

/**
 * 比较给定文件中的地址与我们的数据，找出匹配的地址及其数量
 * 
 * @param {string} givenFilePath - 给定文件的路径（支持 .json 和 .txt 格式）
 * @param {string} ourCsvPath - 我们的 CSV 文件路径
 * @param {string} columnName - CSV 文件中的列名
 * @returns {Promise<Array<{address: string, amount: number}>>} 返回匹配的地址和数量数组
 * 
 * @example
 * // JSON 文件格式：
 * // {"address1": amount1, "address2": amount2, ...}
 * const matches = await check('./data/addresses.json', './data/our-addresses.csv', 'address');
 * 
 * // TXT 文件格式（支持空格或逗号分隔）：
 * // address1 amount1
 * // address2 amount2
 * // 或
 * // address1,amount1
 * // address2,amount2
 * const matches = await check('./data/addresses.txt', './data/our-addresses.csv', 'address');
 */
export async function check(givenFilePath, ourCsvPath, columnName) {
    try {
        // 读取我们的地址数组并转小写
        const ourAddresses = await getCsvDataByColumnName({csvFile:ourCsvPath, columnName});
        if (!ourAddresses || !Array.isArray(ourAddresses)) {
            throw new Error('读取我们的地址数据失败');
        }

        // 创建地址集合（转小写以实现大小写不敏感的比较）
        const ourAddressSet = new Set(ourAddresses.map(addr => addr.toLowerCase()));
        
        // 通过文件后缀判断类型
        const fileType = path.extname(givenFilePath).toLowerCase();
        let givenAddresses;

        switch (fileType) {
            // 处理 JSON 格式：{"address1":amount1,"address2":amount2,...}
            case '.json':
                const jsonData = await fs.readFile(givenFilePath, 'utf-8');
                const parsedData = JSON.parse(jsonData);
                givenAddresses = Object.entries(parsedData).map(([address, amount]) => ({
                    address,
                    amount: Number(amount)
                }));
                break;

            // 处理 TXT 格式（支持空格或逗号分隔）
            case '.txt':
                const txtData = await fs.readFile(givenFilePath, 'utf-8');
                givenAddresses = txtData
                    .split('\n')
                    .filter(Boolean)  // 过滤空行
                    .map(line => {
                        // 支持逗号分隔或空格分隔
                        const parts = line.includes(',') 
                            ? line.trim().split(',')  // 逗号分隔
                            : line.trim().split(/\s+/);  // 空格分隔
                        
                        return {
                            address: parts[0],
                            amount: parts.length > 1 ? parseFloat(parts[1]) || 0 : 0
                        };
                    });
                break;

            default:
                throw new Error(`不支持的文件类型: ${fileType}`);
        }

        // 找出匹配的地址（大小写不敏感）
        const matches = givenAddresses.filter(item => 
            ourAddressSet.has(item.address.toLowerCase())
        );

        // 输出匹配结果
        console.log(`找到 ${matches.length} 个匹配地址`);
        
        // 打印详细的匹配数据
        if (matches.length > 0) {
            console.log('\n匹配的地址和数量:');
            matches.forEach((item, index) => {
                console.log(`${index + 1}. ${item.address} ${item.amount ? `(数量: ${item.amount})` : ''}`);
            });
            console.log(); // 空行
        }

        return matches;
    } catch (error) {
        console.error('比较数据时发生错误:', error);
        throw error;
    }
}