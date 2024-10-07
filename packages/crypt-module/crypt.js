import fs from 'fs';
import crypto from 'crypto';
import { config } from 'dotenv';
import { promisify } from 'util';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { parseToken } from './onepassword.js';

/**
 * 使用crypto的aes-256-gcm算法（等同于python的cryptography库的AESGCM模式）对敏感数据加解密,确保数据在传输或存储过程中的保密性和完整性。此模式提供了高效的认证和加密, 因此被认为是最好的加密模式之一。
 * 需要三个参数
 * 1、密钥
 * crypto.createHash('sha256') 哈希函数将密码转换成一个固定长度的 32 字节(256 位)哈希值。这使得我们可以用一个恒定长度的密钥来执行加密和解密操作。
 *
 * 2、初始化向量iv
 * iv的主要目的是提高加密过程的随机性,使用不同的iv,确保每个加密操作的输出都是唯一的。因此相同的明文也会加密成不同的密文。可防止对加密消息进行重放攻击。
 * 一个加密文本需要一个iv,一个比较好的实践是iv跟密文一起存储,解密时分离。将iv与密文一起存储不会影响加密的安全性。因为iv的主要目的是提高加密过程的随机性,而不是保持机密。因此,即使攻击者知道iv,他们仍然无法破解加密数据,除非他们获得了密钥。
 *
 * 3、authTag
 * 加密过程中自动生成authTag。需要存储到密文中，解密用。一个完整的密文是：iv + encrypted + authTag
 * 解密时拆开，authTag来验证数据的完整性。
 */

const { parsed } = config();
const tokenPath = parsed.personalToken;

/** 
 * 使用 AES-256-GCM 对字符串进行加密
 * @param {string} text  需要加密的文本
 * @returns {string} 返回加密后的密文
*/
export async function enCryptText(text) {
    try {                                                
        // 如果 KEY 还没有设置,获取 KEY 密钥           
        if(!process.env.KEY) {                    
            process.env.KEY = await parseToken(tokenPath);
        }
        // 使用密钥字符串获取密钥字节数组
        const passwordBytes = crypto.createHash('sha256').update(process.env.KEY).digest();                
        // 生成随机的 12 字节 IV                  
        const iv = crypto.randomBytes(12);             
        // 使用密钥和 IV 创建加密器            
        const cipher = crypto.createCipheriv('aes-256-gcm',passwordBytes, iv);                          
        // 更新加密内容,转换为 Hex 字符串           
        let encrypted = cipher.update(text, 'utf8','hex');                  
        // 结束加密,获取最终结果      
        encrypted += cipher.final('hex');      
         // 获取 authTag        
        const authTag = cipher.getAuthTag();           
        // 拼接密文格式: IV + 密文 + authTag      
        const encryptedData = `${iv.toString('hex')}${encrypted}${authTag.toString('hex')}`;     
        // 返回密文字符串           
        return encryptedData;
    } catch(error) {
        console.log('加密失败', error)
        return null         
    }      
}

/**
 * 使用 AES-256-GCM算法对密文进行解密
 * @param {string} encryptedText 密文 
 * @returns {string} 明文
 */
export async function deCryptText(encryptedText) {
    try { 
        // 获取密钥 
        if(!process.env.KEY) {
            process.env.KEY = await parseToken(tokenPath);
        }
        // 使用密钥字符串获取密钥字节数组
        const passwordBytes = crypto.createHash('sha256').update(process.env.KEY).digest();
        // 提取 IV
        const iv = Buffer.from(encryptedText.slice(0, 24), 'hex'); 
        // 提取密文
        const encrypted = encryptedText.slice(24, -32); 
        // 提取 authTag  
        const authTag = Buffer.from(encryptedText.slice(-32), 'hex'); 
        // 创建解密器,使用 IV 和密钥   
        const decipher = crypto.createDecipheriv('aes-256-gcm', passwordBytes, iv);
        // 设置 authTag ,用于验证密文的完整性  
        decipher.setAuthTag(authTag); 
        // 执行解密操作      
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        // 返回解密后的明文
        return decrypted;
    } catch(error) {
        console.log('解密失败', error)
        return null
    }
}

/**
 * 对 CSV 文件的某一列加密。
 *
 * @param {string} filePath - CSV 文件的路径。
 * @param {string} columnName - 要加密的列名。
 */
export async function enCryptColumn(filePath, columnName) {
    // 读取文件并解析 CSV 数据
    const fileStream = fs.createReadStream(filePath);
    const parser = fileStream.pipe(parse({
        columns: true, // 第一行为列名
        skip_empty_lines: true // 跳过空行
    }));

    // 对指定列进行加密
    const results = [];
    for await (const row of parser) {
        row[columnName] = await enCryptText(row[columnName]); // 加密指定列
        results.push(row); // 将处理后的行推入结果数组
    }
    
    // 将 stringify 转换为 Promise 风格
    const stringifyAsync = promisify(stringify); 
    // 将结果数组转换为 CSV 格式
    const csvContent = await stringifyAsync(results, { header: true });
    // 将处理后的数据保存回原文件
    await fs.promises.writeFile(filePath, csvContent);
}

/**
 * 对 CSV 文件的某一列解密。
 *
 * @param {string} filePath - CSV 文件的路径。
 * @param {string} columnName - 要解密的列名。
 */
export async function deCryptColumn(filePath, columnName) {
    // 读取文件并解析 CSV 数据
    const fileStream = fs.createReadStream(filePath);
    const parser = fileStream.pipe(parse({
        columns: true, // 第一行为列名
        skip_empty_lines: true // 跳过空行
    }));

    // 对指定列进行解密
    const results = [];
    for await (const row of parser) {
        row[columnName] = await deCryptText(row[columnName]); // 加密指定列
        results.push(row); // 将处理后的行推入结果数组
    }
    
    // 将 stringify 转换为 Promise 风格
    const stringifyAsync = promisify(stringify); 
    // 将结果数组转换为 CSV 格式
    const csvContent = await stringifyAsync(results, { header: true });
    // 将处理后的数据保存回原文件
    await fs.promises.writeFile(filePath, csvContent);
}