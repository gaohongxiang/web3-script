import fsPromises from 'node:fs/promises';
import path from 'node:path';
import xlsx from 'xlsx';
import { getCsvDataByColumnName } from './utils.js';
import { notificationManager } from '../notification-module/notification.js';

/**
 * 检查地址中奖情况
 * @param {Object} params - 参数对象
 * @param {string} params.winFilePath - 中奖文件路径，支持以下格式:
 *   1. JSON格式: {"address1": 3000, "address2": 2000}
 *   2. TXT格式（只处理前两列数据，剩下的列忽略。第一列地址，第二列数量，数量列可没有，支持逗号、竖线、空格分隔） : address,amount
 *   3. Excel格式（只处理前两列数据，剩下的列忽略。第一列地址，第二列数量，数量列可没有） : address,amount
 * @param {string} params.ourCsvPath - 我们的地址CSV文件路径
 * @param {string} params.columnName - 我们CSV文件中的地址列名
 * @returns {Array<Object>} 返回中奖结果数组，每个对象包含地址和金额(如果有)
 */
export async function check({
    winFilePath, 
    ourCsvPath, 
    columnName
}) {
    try {
        const fileType = path.extname(winFilePath).toLowerCase();
        let winningData = {};

        switch (fileType) {
            case '.json':
                const jsonData = await fsPromises.readFile(winFilePath, 'utf-8');
                const jsonParsed = JSON.parse(jsonData);
                
                // 检查是否为对象格式
                if (typeof jsonParsed !== 'object' || Array.isArray(jsonParsed)) {
                    console.error('目前只能处理{"address1": amount1, "address2": amount2, ...}格式');
                    return;
                }

                // 检查是否为空
                if (Object.keys(jsonParsed).length === 0) {
                    console.error('文件为空');
                    return;
                }

                // 直接使用解析后的对象
                winningData = jsonParsed;
                break;

            case '.txt':
                const txtData = await fsPromises.readFile(winFilePath, 'utf-8');
                const lines = txtData.split('\n').filter(Boolean);
                if (lines.length === 0) {
                    console.error('文件为空');
                    return;
                }
                
                // 检查第一行格式
                const firstLine = lines[0];
                const separator = firstLine.includes(',') ? ',' : 
                                 firstLine.includes('|') ? '|' : 
                                 /\s+/;
                const fields = firstLine.trim().split(separator);

                // 检查字段数量并给出提示
                if (fields.length === 1) {
                    console.log('提示：中奖文件只包含地址字段');
                } else if (fields.length === 2) {
                    console.log('提示：默认中奖文件第一列为地址，第二列为金额');
                } else if (fields.length > 2) {
                    console.log('提示：中奖文件包含多列数据，将只处理前两列（第一列为地址，第二列为金额）');
                }

                // 处理数据行
                for (let i = 1; i < lines.length; i++) {
                    const parts = lines[i].trim().split(separator);
                    const address = parts[0];  // 始终取第一列作为地址
                    if (address) {
                        if (parts.length >= 2) {
                            const amount = parseFloat(parts[1]) || 0;  // 只有当有第二列时才处理金额
                            winningData[address] = amount;
                        } else {
                            winningData[address] = undefined;  // 只有地址时不设置金额
                        }
                    }
                }
                break;

            case '.xlsx':
            case '.xls':
                const workbook = xlsx.readFile(winFilePath);
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const excelData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });  // 使用数组格式
                
                if (excelData.length === 0) {
                    console.error('文件为空');
                    return;
                }

                // 检查字段数量并给出提示
                const columnCount = excelData[0].length;
                if (columnCount === 1) {
                    console.log('提示：中奖文件只包含地址字段');
                } else if (columnCount === 2) {
                    console.log('提示：默认中奖文件第一列为地址，第二列为金额');
                } else if (columnCount > 2) {
                    console.log('提示：中奖文件包含多列数据，将只处理前两列（第一列为地址，第二列为金额）');
                }

                // 处理数据行
                for (let i = 1; i < excelData.length; i++) {
                    const row = excelData[i];
                    const address = row[0];  // 始终取第一列作为地址
                    if (address) {
                        if (row.length >= 2) {
                            const amount = parseFloat(row[1]) || 0;  // 只有当有第二列时才处理金额
                            winningData[address] = amount;
                        } else {
                            winningData[address] = undefined;  // 只有地址时不设置金额
                        }
                    }
                }
                break;

            default:
                console.error(`不支持的文件类型: ${fileType}，目前支持: .json, .txt, .xlsx, .xls`);
                return;
        }

        // 将中奖数据转换为小写格式
        const winnerSet = new Set();  // 用于快速判断是否中奖
        const winnerAmounts = new Map();  // 用于存储中奖金额

        for (const [address, amount] of Object.entries(winningData)) {
            const lowerAddress = address.toLowerCase();
            winnerSet.add(lowerAddress);
            winnerAmounts.set(lowerAddress, amount);
        }

        // 获取并检查我们的地址
        const ourAddresses = await getCsvDataByColumnName({csvFile:ourCsvPath, columnName});
        if (!ourAddresses || !Array.isArray(ourAddresses)) {
            throw new Error('读取我们的地址数据失败');
        }

        // 统计结果
        let totalWinners = 0;
        let totalAmount = 0;
        const results = [];
        const allResults = [];
        const hasAmounts = [...winnerAmounts.values()].some(amount => amount !== undefined);

        // 检查每个地址
        for (const address of ourAddresses) {
            const lowerAddress = address.toLowerCase();
            const isWinner = winnerSet.has(lowerAddress);
            const amount = isWinner ? winnerAmounts.get(lowerAddress) : undefined;
            
            // 保存所有结果用于打印
            allResults.push({
                address,  // 保持原始大小写显示
                won: isWinner,
                ...(hasAmounts && amount !== undefined && { amount })
            });

            // 只保存中奖结果用于返回
            if (isWinner) {
                results.push({
                    address,  // 保持原始大小写显示
                    ...(hasAmounts && amount !== undefined && { amount })
                });
                totalWinners++;
                if (hasAmounts && amount !== undefined) {
                    totalAmount += amount;
                }
            }
        }

        // 打印统计信息
        notificationManager.info(`中奖统计 [总地址数 ${ourAddresses.length}] [中奖数 ${totalWinners}] [中奖率 ${((totalWinners / ourAddresses.length) * 100).toFixed(2)}%]`);
        if (hasAmounts) {
            notificationManager.info(`[总中奖金额 ${totalAmount}]`);
        }
        
        // 打印详细信息
        notificationManager.info(`\n=== 详细地址情况 ===`);
        allResults.forEach((result, index) => {
            notificationManager.info(`[序号 ${index + 1}] [地址 ${result.address}]`);
            if (result.won) {
                notificationManager.success(`[状态 🎉 中奖]${hasAmounts && result.amount !== undefined ? ` [金额 ${result.amount}]` : ''}`);
            } else {
                notificationManager.error(`[状态 ❌ 未中奖]`);
            }
        });

        // 只返回中奖结果
        return results;

    } catch (error) {
        notificationManager.error(`检查中奖失败 [原因 ${error.message}]`);
        return;
    }
}