import fs from 'fs';
import { promisify } from 'util';
import { exec } from "child_process";

const execAsync = promisify(exec); // 将 exec 转换为 Promise 风格

/**
 * 从 1Password 中读取指定路径的令牌。
 * @param {string} tokenPath - 令牌在 1Password 中的路径。
 * @returns {Promise<string>} - 返回解析后的令牌。
 * @throws {Error} - 如果读取令牌时发生错误，将抛出包含错误信息的异常。
 */
export async function parseToken(tokenPath) {
    try {
        const opRead = `op read ${tokenPath}`;  // 构建命令以读取令牌
        const { stdout, stderr } = await execAsync(opRead); // 执行命令并等待结果
        if (stderr) { throw new Error(`1Password CLI error: ${stderr}`); } // 抛出包含错误信息的异常
        const token = stdout.trim();  // 去除令牌两端的空白字符
        return token; // 返回解析后的令牌
    } catch (error) {
        throw new Error(`Error: ${error.message}`); // 捕获并抛出错误
    }
}

/**
 * 解析指定文件并将内容注入到 1Password CLI。
 * @param {string} file - 要读取的文件路径。
 * @returns {Promise<Object>} - 返回解析后的数据对象。
 * @throws {Error} - 如果读取文件或执行命令时发生错误，将抛出包含错误信息的异常。
 */
export async function parseFile(file) {
    try {
        const template = await fs.promises.readFile(file, 'utf8'); // 读取文件内容
        const opInject = `op inject`; // 构建命令以注入内容

        // 使用 execAsync 执行命令并将模板内容作为输入
        const { stdout, stderr } = await execAsync(opInject, { input: template }); // 将 template 作为输入
        if (stderr) { throw new Error(`1Password CLI error: ${stderr}`); } // 抛出包含错误信息的异常
        // 将标准输出解析为 JSON 对象
        const data = JSON.parse(stdout);
        return data; // 返回解析后的数据对象
    } catch (error) {
        throw new Error(`Error: ${error.message}`); // 捕获并抛出错误
    }
}