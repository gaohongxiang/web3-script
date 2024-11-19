import fs from 'fs';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse';

/**
 * 获取指定代币的信息，包括地址、ABI 和小数位数。
 *
 * @param {string} token - 代币名称。
 * @param {Object} options - 可选参数对象。
 * @param {string} [options.tokenFile='./data/token.json'] - 包含代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * @returns {Promise<Object>} - 返回一个包含代币地址、ABI 和小数位数的对象。
 */
export function getTokenInfo({ token, chain, tokenFile = './data/token.json' }) {
    try {
        token = token.toUpperCase();
        chain = chain.toLowerCase();
        const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        const tokenInfo = data[chain][token];
        return tokenInfo;
    } catch (error) {
        console.error(`错误: ${token} 代币信息 在 ${chain} 网络中不存在，请先添加。\n${error}`);
        return null;
    }
}

/**
 * 从指定的 CSV 文件中读取数据并返回解析后的结果。第一行的第一个标点符号作为分隔符
 * @param {string} csvFile - 要读取的 CSV 文件路径（必填）。
 * @returns {Promise<Array<Object>|null>} - 返回一个 Promise，解析为包含每一行数据的对象数组。如果读取失败，则返回 null。
 */
export async function getCsvData(csvFile) {
    try {

        const fileStream = fs.createReadStream(csvFile);

        // 读取第一行以确定分隔符
        const firstLine = await new Promise((resolve, reject) => {
            let line = '';
            fileStream.on('data', chunk => {
                line += chunk;
                const lines = line.split('\n');
                if (lines.length > 1) {
                    fileStream.destroy(); // 读取到第二行后停止读取
                    resolve(lines[0]); // 返回第一行
                }
            });
            fileStream.on('error', reject);
            fileStream.on('end', () => resolve(line)); // 如果文件结束，返回读取的内容
        });
        // 获取第一行的第一个标点符号作为分隔符
        const sep = firstLine.match(/[:|,]/) ? firstLine.match(/[:|,]/)[0] : ','; // 默认分隔符为逗号

        const results = [];
        const parser = fs.createReadStream(csvFile).pipe(parse({
            columns: true, // 第一行为列名
            delimiter: sep, // 分隔符为sep，默认逗号
            skip_empty_lines: true, // 跳过空行
            escape: false, // 用于转义的单个字符。它仅适用于与 匹配的字符
            quote: false, // 用于包围字段的字符，该字段周围是否存在引号是可选的，并且会自动检测。false禁用引号检测（abi很多引号，不需要检测）
        }));

        let index = 1; // 初始化 indexId 的值
        for await (const row of parser) {
            // 检查是否存在 indexId 字段，如果不存在，则添加 indexId，并递增。后面各个文件数据通过indexId来拼接
            if (!row.indexId) {
                const indexId = index++;
                row.indexId = indexId.toString();
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
 * 从指定的 CSV 文件中读取数据，提取指定列的内容，并可选择将数据保存到临时文件。
 * @param {Object} options - 函数的配置选项。
 * @param {string} options.csvFile - 要读取的 CSV 文件路径。
 * @param {string} options.columnName - 要提取的列名。
 * @param {boolean} [options.saveToFile=false] - 是否将提取的数据保存到临时文件，默认为 false。
 * @param {string} [options.tempFile='./data/temp.csv'] - 临时文件的路径，用于存储提取的数据（如果 saveToFile 为 true）。
 */
export async function getCsvDataByColumnName({ csvFile, columnName, saveToFile = false, tempFile = './data/temp.csv' }) {
    try {
        const fileStream = fs.createReadStream(csvFile);

        // 读取第一行以确定分隔符
        const firstLine = await new Promise((resolve, reject) => {
            let line = '';
            fileStream.on('data', chunk => {
                line += chunk;
                const lines = line.split('\n');
                if (lines.length > 1) {
                    fileStream.destroy(); // 读取到第二行后停止读取
                    resolve(lines[0]); // 返回第一行
                }
            });
            fileStream.on('error', reject);
            fileStream.on('end', () => resolve(line)); // 如果文件结束，返回读取的内容
        });
        // 获取第一行的第一个标点符号作为分隔符
        const sep = firstLine.match(/[:|,]/) ? firstLine.match(/[:|,]/)[0] : ','; // 默认分隔符为逗号

        // 检查第一行是否包含 columnName
        const columnNames = firstLine.split(sep); // 根据分隔符分割列名
        if (!columnNames.includes(columnName)) {
            console.error(`列名 "${columnName}" 不存在于文件中.`);
            return; // 如果不存在，返回
        }

        const parser = fs.createReadStream(csvFile).pipe(parse({
            delimiter: sep, // 分隔符为sep，默认逗号
            columns: true, // 第一行为列名
            skip_empty_lines: true, // 跳过空行
            escape: false, // 用于转义的单个字符。它仅适用于与 匹配的字符
            quote: false, // 用于包围字段的字符，该字段周围是否存在引号是可选的，并且会自动检测。false禁用引号检测（abi很多引号，不需要检测）
        }));
        const allData = [];
        for await (const row of parser) {
            let data = row[columnName];
            allData.push(data);
        }
        // 仅在 saveToFile 为 true 时存储所有数据
        if (saveToFile) {
            // 将 allData 数组的内容写入 tempFile
            await fs.promises.writeFile(tempFile, allData.join('\n') + '\n');
        }
        return allData;
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
    indexId: '序号', // 将 '序号' 映射为 'index_id'
    browserId: 'ID', // 将 'ID' 映射为 'browser_id'
    userAgent: 'User Agent', // 将 'User Agent' 映射为 'user_agent'
} } = {}) {
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
            newRow.indexId = newRow.indexId.toString(); // 转换为字符串
            return newRow;
        });

        // 排序数据
        const sortedData = filteredData.sort((a, b) => a.indexId - b.indexId);
        return sortedData;
    } catch (error) {
        console.error('读取Excel文件失败:', error); // 错误处理
        return null
    }
}

/**
 * 获取当前时间并格式化为 YYYY-MM-DD_HH-MM-SS 格式的字符串。
 * 
 * 该函数返回一个字符串，表示当前的时间，适用于文件命名或日志记录等场景。
 * 
 * @returns {string} - 返回格式化后的当前时间字符串。
 */
export function getCurrentTime() {
    // 获取当前时间并格式化为 YYYY-MM-DD_HH-MM-SS
    const now = new Date();
    const currentTime = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0]; // 格式化时间
    return currentTime;
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

/**
 * 生成一个包含大小写字母、数字和特殊符号的随机字符串。
 * @param {number} length - 生成的字符串的长度。
 * @returns {string} - 生成的随机字符串。
 */
export function generateRandomString(length) {
    const uppercaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseLetters = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specialSymbols = '.!@#$%^&*()-_=+';
    const allCharacters = uppercaseLetters + lowercaseLetters + numbers + specialSymbols;
    let result = '';

    // 随机选择至少 3 个大写字母
    for (let i = 0; i < 3; i++) {
        result += uppercaseLetters.charAt(Math.floor(Math.random() * uppercaseLetters.length));
    }

    // 随机选择至少 3 个小写字母
    for (let i = 0; i < 3; i++) {
        result += lowercaseLetters.charAt(Math.floor(Math.random() * lowercaseLetters.length));
    }

    // 随机选择至少 3 个数字
    for (let i = 0; i < 3; i++) {
        result += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }

    // 随机选择至少 3 个特殊符号
    for (let i = 0; i < 3; i++) {
        result += specialSymbols.charAt(Math.floor(Math.random() * specialSymbols.length));
    }

    // 随机选择剩余字符，直到达到指定长度
    for (let i = result.length; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * allCharacters.length);
        result += allCharacters.charAt(randomIndex);
    }

    // 将生成的字符随机排序
    const array = result.split('');
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    result = array.join('');
    // console.log(result);
    return result;
}