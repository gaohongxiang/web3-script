import fs from 'fs';  // 同步操作
import fsPromises from 'fs/promises';  // 异步操作
import { createReadStream } from 'fs';  // 流操作
import XLSX from 'xlsx';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';

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
 * 从CSV文件中读取第一行并确定分隔符
 * @param {string} csvFile - CSV文件路径
 * @returns {Promise<{firstLine: string, sep: string}>} - 返回第一行内容和分隔符
 */
async function getFirstLineAndSeparator(csvFile) {
    const fileStream = createReadStream(csvFile);

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

    return { firstLine, sep };
}

/**
 * 从指定的 CSV 文件中读取数据并返回解析后的结果。第一行的第一个标点符号作为分隔符
 * @param {string} csvFile - 要读取的 CSV 文件路径（必填）。
 * @returns {Promise<Array<Object>|null>} - 返回一个 Promise，解析为包含每一行数据的对象数组。如果读取失败，则返回 null。
 */
export async function getCsvData(csvFile) {
    try {
        const { sep } = await getFirstLineAndSeparator(csvFile);

        const results = [];
        const parser = createReadStream(csvFile).pipe(parse({
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
        const { firstLine, sep } = await getFirstLineAndSeparator(csvFile);

        // 检查第一行是否包含 columnName
        const columnNames = firstLine.split(sep); // 根据分隔符分割列名
        if (!columnNames.includes(columnName)) {
            console.error(`列名 "${columnName}" 不存在于文件中.`);
            return; // 如果不存在，返回
        }

        const parser = createReadStream(csvFile).pipe(parse({
            delimiter: sep, // 分隔符为sep，默认逗号
            columns: true, // 第一行为列名
            skip_empty_lines: true, // 跳过空行
            escape: false, // 用于转义的单个字符。它仅适用于与 匹配的字符
            quote: false, // 用于包围字段的字符，该字段周围是否存在引号是可选的，并且会自动检测。false禁用引号检测（abi很多引号，不需要检测）
        }));

        const allData = [];
        for await (const row of parser) {
            allData.push(row[columnName]);
        }
        // 仅在 saveToFile 为 true 时存储所有数据
        if (saveToFile) {
            await fsPromises.writeFile(tempFile, allData.join('\n') + '\n');
        }
        return allData;
    } catch (error) {
        console.error(error)
    }
}

/**
 * 根据匹配字段更新CSV文件中的指定字段值
 * @param {Object} options - 函数的配置选项
 * @param {string} options.csvFile - CSV文件路径
 * @param {string} options.matchField - 用于匹配的字段名（例如：'email'）
 * @param {string} options.matchValue - 用于匹配的字段值（例如：'example@gmail.com'）
 * @param {string} options.targetField - 要更新的目标字段名（例如：'refreshToken'）
 * @param {string} options.targetValue - 要更新的新值
 * @returns {Promise<boolean>} - 更新成功返回true，失败返回false
 */
export async function updateCsvFieldValueByMatch({ csvFile, matchField, matchValue, targetField, targetValue }) {
    try {
        // 检查文件是否存在
        if (!fs.existsSync(csvFile)) {
            console.error(`文件不存在: ${csvFile}`);
            return false;
        }

        const { sep, firstLine } = await getFirstLineAndSeparator(csvFile);
        // console.log(sep, firstLine)

        if (!firstLine) {
            console.error('CSV文件为空');
            return false;
        }

        // 检查匹配字段是否存在
        const headers = firstLine.split(sep);
        if (!headers.includes(matchField)) {
            console.error(`匹配字段 "${matchField}" 不存在于文件中`);
            return false;
        }

        // 检查目标字段是否存在，如果不存在则先添加该字段
        if (!headers.includes(targetField)) {
            try {
                console.log(`目标字段 "${targetField}" 不存在，将添加新字段`);
                headers.push(targetField);

                const allRows = await fsPromises.readFile(csvFile, 'utf8');
                const rows = allRows.split('\n');

                rows[0] = headers.join(sep);

                // 只给非空行添加分隔符，保留空行
                for (let i = 1; i < rows.length; i++) {
                    if (rows[i]) {  // 非空行添加分隔符
                        rows[i] = rows[i] + sep;
                    }
                }

                await fsPromises.writeFile(csvFile, rows.join('\n'));
            } catch (error) {
                console.error('添加新字段失败:', error);
                return false;
            }
        }

        // 读取并更新数据
        const rows = [];
        try {
            const parser = createReadStream(csvFile).pipe(
                parse({
                    delimiter: sep, // 分隔符为sep，默认逗号
                    columns: true, // 自动将第一行作为列名
                    skip_empty_lines: true,  // 跳过空行
                    trim: true // 添加trim选项处理空格
                })
            );

            for await (const row of parser) {
                rows.push(row);
            }
        } catch (error) {
            console.error('读取CSV内容失败:', error);
            return false;
        }

        // 更新匹配的数据
        let found = false;
        const updatedRows = rows.map(row => {
            if (row[matchField] === matchValue) {
                found = true;
                return {
                    ...row,
                    [targetField]: targetValue
                };
            }
            return row;
        });

        if (!found) {
            console.log(`未找到匹配的记录: ${matchField}=${matchValue}`);
            return false;
        }

        // 写回文件
        try {
            const csvContent = stringify(updatedRows, {
                header: true,
                columns: headers, // 使用保存的headers确保列顺序一致
                delimiter: sep, // 使用原文件的分隔符
                skip_empty_lines: true  // 跳过空行
            });

            await fsPromises.writeFile(csvFile, csvContent);
            console.log(`匹配项: ${matchField} = ${matchValue} , 更新项: ${targetField} = ${maskValue(targetValue)}`);
            return true;
        } catch (error) {
            console.error('写入文件失败:', error);
            return false;
        }

    } catch (error) {
        console.error('更新CSV文件失败:', error);
        return false;
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
 * 获取指定时区的当前时间
 * @param {number} [timezone=8] - 时区，默认为8（UTC+8北京时间）
 * @param {boolean} [showTimezone=true] - 是否显示时区信息
 * @returns {string} 格式化的时间字符串 YYYY-MM-DD_HH-MM-SS (UTC+X)
 * 
 * @example
 * getCurrentTime()      // "2024-01-20_14-30-45 (UTC+8)"
 * getCurrentTime(0)     // "2024-01-20_06-30-45 (UTC+0)"
 * getCurrentTime(-5)    // "2024-01-20_01-30-45 (UTC-5)"
 * getCurrentTime(9)     // "2024-01-20_15-30-45 (UTC+9)"
 * getCurrentTime(8, false) // "2024-01-20_14-30-45"
 */
export function getCurrentTime(timezone = 8, showTimezone = true) {
    // 获取当前时间
    const now = new Date();

    // 转换为指定时区
    const targetTime = new Date(now.getTime() + (timezone * 60 * 60 * 1000));

    // 格式化时间
    const year = targetTime.getUTCFullYear();
    const month = String(targetTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(targetTime.getUTCDate()).padStart(2, '0');
    const hours = String(targetTime.getUTCHours()).padStart(2, '0');
    const minutes = String(targetTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(targetTime.getUTCSeconds()).padStart(2, '0');

    const timeStr = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;

    // 根据showTimezone参数决定是否显示时区信息
    return showTimezone
        ? `${timeStr} (UTC${timezone >= 0 ? '+' : ''}${timezone})`
        : timeStr;
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

/**
 * 对敏感信息进行部分隐藏处理
 * @param {string|number} value - 需要处理的原始值（支持字符串和数字类型）
 * @param {number} [startKeep=6] - 开头保留的字符数（默认保留6位）
 * @param {number} [endKeep=6] - 结尾保留的字符数（默认保留6位）
 * @returns {string} 处理后的字符串，中间部分用***替代
 * 
 * @example
 * maskValue('1234567890ABCDEF')       // "123456***ABCDEF"
 * maskValue('1234567890ABCDEF', 4)    // "1234***DEF"
 * maskValue('1234567890ABCDEF', 2, 4) // "12***DEF"
 * maskValue('1234', 3, 3)            // "1234"（总长度不足时返回原值）
 * maskValue(123456789)                // "123456***"（处理数字类型）
 * maskValue('')                       // ""（空值直接返回）
 */
export function maskValue(value, startKeep = 6, endKeep = 6) {
    if (typeof value !== 'string') {
        value = String(value);
    }

    // 边界情况处理：空值或长度不足时直接返回
    if (value.length === 0 || value.length <= startKeep + endKeep) {
        return value;
    }

    // 分别保留前后指定位数，中间统一用3个*替代
    const start = value.slice(0, startKeep); // 截取前N位
    const end = value.slice(-endKeep); // 截取前N位
    const mask = '***'; // 固定3个*作为掩码
    const result = `${start}${mask}${end}`;
    // console.log(result)
    return result;
}

/**
 * 解析混合参数为实例编号数组
 * @param {...(number|string|Array<number>)} inputs - 可接受多种参数格式：
 *   代码中使用:
 *   - 单个数字：5 → [5]
 *   - 多个数字：1,3,5 → [1,3,5]
 *   - 单元素数组：[1] → [1]
 *   - 范围数组：[4,7] → [4,5,6,7]
 *   - 混合参数：1, [3,5], 7 → [1,3,4,5,7]
 * 
 *   命令行使用:
 *   - 单个数字：5 → [5]
 *   - 范围参数：3,5 → [3,4,5]
 *   - 混合参数：1 3,5 7 → [1,3,4,5,7]
 * 
 * @returns {number[]} 处理后的有序且去重的实例编号数组
 * @example
 * // 代码中使用
 * parseInstanceNumbers(1)          // → [1]
 * parseInstanceNumbers([1])        // → [1]
 * parseInstanceNumbers(1, [3,5])   // → [1,3,4,5]
 * 
 * // 命令行使用
 * proxy-manager start 1 3,5 7    // → [1,3,4,5,7]
 */
export function parseInstanceNumbers(...inputs) {
    return inputs
        // 第一步：展开所有参数
        .flatMap(input => {
            // 处理范围数组
            if (Array.isArray(input)) {
                // 如果是单元素数组，直接返回该元素
                if (input.length === 1) {
                    return [Number(input[0])];
                }
                // 如果是双元素数组，处理为范围
                if (input.length === 2) {
                    const [start, end] = input.sort((a, b) => a - b);
                    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                }
            }
            // 处理字符串范围（支持 "3,5" 或 3,5 格式）
            const inputStr = input.toString();
            if (inputStr.includes(',')) {
                const [start, end] = inputStr.split(',').map(Number);
                if (!isNaN(start) && !isNaN(end)) {
                    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                }
            }
            // 处理数字或数字字符串
            const num = Number(input);
            if (!isNaN(num)) {
                return [num];
            }
            // 过滤无效参数
            return [];
        })
        // 第二步：过滤有效数字
        .filter(n => Number.isInteger(n) && n > 0)
        // 第三步：去重并排序
        .reduce((acc, curr) => {
            if (!acc.includes(curr)) acc.push(curr);
            return acc;
        }, [])
        .sort((a, b) => a - b);
}