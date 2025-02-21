import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fsp from 'fs/promises';

// 获取项目根目录路径
function getRootDir() {
    const __filename = fileURLToPath(import.meta.url);
    return dirname(dirname(dirname(__filename))); // 从当前文件往上3层到根目录
}

// 获取相对于项目根目录的路径
export function getPathFromRoot(...paths) {
    return join(getRootDir(), ...paths);
}

// 获取相对于当前文件目录的路径 importMetaUrl 是当前文件的import.meta.url
export function getPathFromCurrentDir(importMetaUrl, ...relativePaths) {
    const currentDir = dirname(fileURLToPath(importMetaUrl));
    return relativePaths.length ? join(currentDir, ...relativePaths) : currentDir;
}

// 检查路径是否存在
export async function pathExists(path) {
    try {
        await fsp.access(path);
        return true;
    } catch {
        return false;
    }
}

// 确保目录存在
export async function makeSureDirExists(filePath) {
    try {
        const dir = dirname(filePath);
        await fsp.mkdir(dir, { recursive: true });
    } catch (error) {
        console.error('创建目录失败:', error);
        throw error;
    }
}