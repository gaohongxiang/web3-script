import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fsp from 'fs/promises';


// 获取相对于项目根目录的路径并确保目录存在
export async function getPathFromRoot(...paths) {
    // 获取项目根目录
    const __filename = fileURLToPath(import.meta.url);
    const rootDir = dirname(dirname(dirname(__filename))); // 从当前文件往上3层到根目录
    const fullPath = join(rootDir, ...paths);
    await fsp.mkdir(dirname(fullPath), { recursive: true });
    return fullPath;
}

// 获取相对于当前文件目录的路径并确保目录存在
export async function getPathFromCurrentDir(importMetaUrl, ...relativePaths) {
    const currentDir = dirname(fileURLToPath(importMetaUrl));
    const fullPath = relativePaths.length ? join(currentDir, ...relativePaths) : currentDir;
    await fsp.mkdir(dirname(fullPath), { recursive: true });
    return fullPath;
}