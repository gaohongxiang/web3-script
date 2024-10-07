import fs from 'fs';
import XLSX from 'xlsx';
import { parse } from 'csv-parse';  

/**
 * 从指定的 CSV 文件中读取数据并返回解析后的结果。
 * @param {string} csvFile - 要读取的 CSV 文件路径（必填）。
 * @param {Object} [options={}] - 可选参数对象。
 * @param {string} [options.sep=','] - 用于分隔字段的字符，默认为逗号。
 * @returns {Promise<Array<Object>|null>} - 返回一个 Promise，解析为包含每一行数据的对象数组。如果读取失败，则返回 null。
 */
export async function getCsvData(csvFile, { sep=',' } = {} ) {
    try{
        const results = [];
        const fileStream = fs.createReadStream(csvFile);
        const parser = fileStream.pipe(parse({
            columns:true, // 第一行为列名
            delimiter: sep, // 分隔符为sep，默认逗号
            skip_empty_lines: true, // 跳过空行
            escape: false, // 用于转义的单个字符。它仅适用于与 匹配的字符
            quote: false, // 用于包围字段的字符，该字段周围是否存在引号是可选的，并且会自动检测。false禁用引号检测（abi很多引号，不需要检测）
        }));

        let index = 1; // 初始化 index_id 的值
        for await (const row of parser) {
            // 检查是否存在 index_id 字段，如果不存在，则添加 index_id，并递增。后面各个文件数据通过index_id来拼接
            if (!row.indexId) {
                row.indexId = index++;
            }
            results.push(row);
        }
        // console.log(results)
        return results;
    } catch (error) {
        console.error('读取csv文件失败:', error)
        return null
    }
}

/**
 * 从指定的 CSV 文件中读取数据，并将指定列的数据转存到临时文件。
 * @param {string} csvFile - 要读取的 CSV 文件路径（必填）。
 * @param {string} columnName - 要提取的列名（必填）。
 * @param {string} tempFile - 临时文件的路径（必填）。
 * @param {string} [sep=','] - CSV 文件的分隔符，默认为逗号。
 * @returns {Promise<void>} - 返回一个 Promise，表示操作的完成。
 */
export async function getCsvDataByColumnName(csvFile, columnName, tempFile, { sep=',' } = {} ) {
    try{
        const fileStream = fs.createReadStream(csvFile);
        const parser = fileStream.pipe(parse({
            delimiter: sep, // 分隔符为sep，默认逗号
            columns: true, // 第一行为列名
            skip_empty_lines: true, // 跳过空行
            escape: false, // 用于转义的单个字符。它仅适用于与 匹配的字符
            quote: false, // 用于包围字段的字符，该字段周围是否存在引号是可选的，并且会自动检测。false禁用引号检测（abi很多引号，不需要检测）
        }));

        for await (const row of parser) {
            let data = row[columnName];
            await fs.promises.appendFile(tempFile, `${data}\n`);
        }
    } catch (error) {
        console.error(error)
    }
}

/**
 * 从指定的 Excel 文件中读取数据，并根据字段映射进行重命名和排序，返回处理后的数据。
 * @param {string} excelFile - 要读取的 Excel 文件路径（必填）。
 * @param {Object} [options={}] - 可选参数对象。
 * @param {number} [options.sheetIndex=0] - 要读取的工作表索引，默认为 0（第一个工作表）。
 * @param {Object} [options.fieldMappings] - 字段映射对象，用于将 Excel 列名映射为返回对象的键名。
 * @returns {Promise<Array<Object>|null>} - 返回一个 Promise，解析为处理后的数据数组。如果读取失败，则返回 null。
 * @param {string} options.fieldMappings.index_id - 映射原始列名 '序号' 为新字段名 'index_id'。
 * @param {string} options.fieldMappings.browser_id - 映射原始列名 'ID' 为新字段名 'browser_id'。
 * @param {string} options.fieldMappings.user_agent - 映射原始列名 'User Agent' 为新字段名 'user_agent'。
 */
export async function getExcelData(excelFile, { sheetIndex = 0, fieldMappings = {
    index_id: '序号', // 将 '序号' 映射为 'index_id'
    browser_id: 'ID', // 将 'ID' 映射为 'browser_id'
    user_agent: 'User Agent', // 将 'User Agent' 映射为 'user_agent'
}} = {} ) {
    try {
        const workbook = XLSX.readFile(excelFile); // 读取 Excel 文件
        const sheetName = workbook.SheetNames[sheetIndex]; // 获取第 sheetIndex 个工作表的名称
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]); // 将工作表转换为 JSON

        // 映射和过滤数据
        const filteredData = sheetData.map(row => {
            const newRow = {};
            for (const [newKey, oldKey] of Object.entries(fieldMappings)) {
                newRow[newKey] = row[oldKey]; // 使用 mappings 进行重命名
            }
            return newRow;
        });

        // 排序数据
        const sortedData = filteredData.sort((a, b) => a.index_id - b.index_id);
        return sortedData;
    } catch (error) {
        console.error('读取Excel文件失败:', error); // 错误处理
        return null
    }
}

/**
 * 创建一个延迟的 Promise，暂停执行指定的时间。
 * @param {number} seconds - 要暂停的时间（以秒为单位，必填）。
 * @returns {Promise<void>} - 返回一个 Promise，表示延迟操作的完成。
 */
export function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * 生成一个随机等待时间的异步函数，用于模拟在指定范围内的随机等待。
 * @param {number} [minSeconds=0] - 最小等待时间（单位：秒）
 * @param {number} [maxSeconds=10] - 最大等待时间（单位：秒）
 * @returns {Promise<void>} - 表示等待完成的 Promise
 */
export function randomWait(minSeconds = 0, maxSeconds = 10) {
    const randomSeconds = Math.random() * (maxSeconds - minSeconds) + minSeconds;
    console.log(`等待 ${randomSeconds} 秒`);
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, randomSeconds * 1000);
    });
}