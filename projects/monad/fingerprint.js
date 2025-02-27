import { FingerprintGenerator } from 'fingerprint-generator';
import fsp from 'fs/promises';
import { getPathFromCurrentDir, makeSureDirExists, pathExists } from '../../packages/utils-module/path.js';

export async function getOrCreateFingerprint(number = 1, reuse = true) {
    try {
        let fingerprint;
        // 构建文件路径
        const filePath = getPathFromCurrentDir(
            import.meta.url, 
            'fingerprint', 
            `fingerprint${number}.json`
        );

        // 检查文件是否存在
        if (await pathExists(filePath) && reuse) {
            // 复用现有指纹
            console.log(`复用现有指纹文件: ${filePath}`);
            const data = await fsp.readFile(filePath, 'utf8');
            fingerprint = JSON.parse(data);
        } else {
            // 生成新指纹
            console.log(`生成新指纹...`);
            fingerprint = await generateFingerprint();
            
            // 确保目录存在并保存
            await makeSureDirExists(filePath);
            await fsp.writeFile(
                filePath,
                JSON.stringify(fingerprint, null, 2),
                'utf8'
            );
        }

        // console.log(`新指纹已保存到: ${filePath}`);
        return fingerprint;

    } catch (error) {
        console.error('指纹操作失败:', error);
        throw error;
    }
}

/**
 * 生成浏览器指纹配置
 * @param {Object} options - 指纹生成配置选项
 * @param {Object} [options.version] - Chrome版本范围配置
 * @param {number} [options.version.minVersion=130] - 最小版本号
 * @param {number} [options.version.maxVersion=133] - 最大版本号
 * @param {Object} [options.screen] - 屏幕分辨率配置
 * @param {number} [options.screen.width=1680] - 屏幕宽度
 * @param {number} [options.screen.height=1050] - 屏幕高度
 * @returns {Promise<Object>} 生成的指纹数据对象
 * @throws {Error} 如果指纹生成失败则抛出错误
 */
export async function generateFingerprint( {
    version = {
        minVersion: 130,
        maxVersion: 133
    },
    screen = { width: 1680, height: 1050 }
} = {}) {
    try {
        // 使用选定的版本生成最终指纹
        const generator = new FingerprintGenerator({
            browsers: [{
                name: 'chrome',
                minVersion: version.minVersion,
                maxVersion: version.maxVersion
            }],
            devices: ["desktop"],
            operatingSystems: ["macos"],
            // experimentalWebgl: true,     // 用于控制WebGL指纹生成的参数。当设置为true时，会生成更详细但可能不稳定的WebGL参数
            httpHeaders: true,              // 带headers
            // 我ip是日本的，语言和时区应该保持一致，日语看不懂，语言用中文
            locales: ['zh-CN'],             // 浏览器用中文显示
            timezone: {
                id: 'Asia/Tokyo',           // 日本东京时区
                offset: 540                 // UTC+9
            },
            screen: {
                width: screen.width,
                height: screen.height,
                randomize: true,            // 必须显式启用随机
                maxRandomDifference: 100    // 最大随机偏移量
            },
            randomization: {
                versionWeight: 1,       // 提高版本权重 (0-1, 1表示完全随机)
                attributeCorrelation: 0 // 降低属性相关性
            },
            randomizeFingerprint: true,    // 开启整体随机化
        });

        const fingerprintWithHeaders = generator.getFingerprint();
        //   console.log(fingerprintWithHeaders)
        return fingerprintWithHeaders;

    } catch (error) {
        console.error('指纹生成失败:', error);
        throw error;
    }
}