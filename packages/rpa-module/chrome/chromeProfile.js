import fsp from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { AVATAR_NAMES, getExistingProfiles, formatNumber, replaceAvatar, generateFingerprint } from './utils.js';
import { BASE_CONFIG } from './config.js';

// const SYSTEM_AVATARS_DIR = path.join(CHROME_DATA_DIR, 'Avatars');

export class ChromeAutomation {
  constructor(chromeNumber) {
    this.chromeNumber = formatNumber(chromeNumber);
    this.CHROME_PATH = BASE_CONFIG.CHROME_PATH;
    this.AUTOMATION_CHROME_PATH = BASE_CONFIG.getChromeInstancePath(this.chromeNumber);
    this.AUTOMATION_CHROME_EXECUTABLE = BASE_CONFIG.getChromeExecutable(this.chromeNumber);
    this.AUTOMATION_CHROME_INFO_PLIST = BASE_CONFIG.getChromePlist(this.chromeNumber);
    this.AUTOATION_CHROME_DATA_DIR = BASE_CONFIG.getProfileDataDir(this.chromeNumber);
    this.AUTOMATION_CHROME_LOCAL_STATE = BASE_CONFIG.getLocalStatePath(this.chromeNumber);
    this.FINGERPRINT_PATH = BASE_CONFIG.getFingerprintPath(this.chromeNumber);
  }

  async createChromeProfile() {
    await this.createChromeApp();
    await this.createFingerprint();
  }

  /**
   * 创建Chrome副本（如果不存在）
   */
  async createChromeApp() {
    try {
      // 检查自动化Chrome是否已存在
      try {
        await fsp.access(this.AUTOMATION_CHROME_PATH);
        console.log('自动化Chrome已存在');
        return;
      } catch {
        console.log('正在创建自动化Chrome...');
      }

      // 复制Chrome应用
      execSync(`ditto "${this.CHROME_PATH}" "${this.AUTOMATION_CHROME_PATH}"`);

      console.log('自动化Chrome创建成功');
    } catch (error) {
      console.error('创建自动化Chrome失败:', error);
      throw error;
    }
  }

  async createFingerprint() {
    const fingerprintData = await generateFingerprint(this.chromeNumber);
    await fsp.writeFile(this.FINGERPRINT_PATH, JSON.stringify(fingerprintData, null, 2));
    console.log('指纹创建成功');
  }
} 

export async function createChromeProfile(profileNumber, useCustomAvatar = true) {
  try {
    // 检查是否超过50个用户
    if (useCustomAvatar && profileNumber > 50) {
      console.error('使用自定义头像时最多创建50个用户');
      process.exit(1);
    }

    // 确保Chrome未运行
    try {
      execSync('pgrep "Google Chrome"', { stdio: 'ignore' });
      console.error('请先关闭所有Chrome实例');
      process.exit(1);
    } catch (e) { /* 没有进程运行 */ }

    // 读取或初始化Local State
    let localState = { profile: { info_cache: {}, last_used: 'Default' } };
    try {
      const data = await fsp.readFile(LOCAL_STATE_PATH, 'utf8');
      localState = JSON.parse(data);
    } catch { }

    const existing = getExistingProfiles(localState);
    profileNumber = existing.length > 0 ? Math.max(...existing) + 1 : 1;

    // 生成配置标识
    const formattedNumber = formatNumber(profileNumber);
    const profileId = `Profile${formattedNumber}`;
    const profileName = `Profile${formattedNumber}`;
    const profilePath = path.join(CHROME_DATA_DIR, profileId);

    // 创建目录结构
    await fsp.mkdir(profilePath, { recursive: true });
    await fsp.mkdir(path.join(profilePath, 'Extensions'), { recursive: true });
    const prefsPath = path.join(profilePath, 'Preferences');
    const fingerprintPath = path.join(profilePath, 'fingerprint.json');

    // 获取头像信息
    const avatarIndex = useCustomAvatar ?
      (profileNumber === 26 ? 51 : profileNumber) : // 使用自定义头像时，避开26号
      Math.floor(Math.random() * 56); // 不使用自定义头像时，随机选择0-55
    const systemAvatarName = AVATAR_NAMES[avatarIndex];

    // 根据选项决定是否替换头像
    if (useCustomAvatar) {
      await replaceAvatar(SYSTEM_AVATARS_DIR, profileNumber, systemAvatarName);
    }

    // 生成基础配置
    const prefs = {
      profile: {
        name: profileName,
        avatar_icon: `chrome://theme/IDR_PROFILE_AVATAR_${avatarIndex}`,
      },
      browser: {
        enable_webgl: true,
        enable_canvas: true
      }
    };

    // 写入Preferences文件（仅保留必要配置）
    await fsp.writeFile(prefsPath, JSON.stringify(prefs, null, 2));

    // 更新Local State
    localState.profile.info_cache[profileId] = {
      name: profileName,
      user_name: profileName,
      is_consented_primary_account: true,
      avatar_icon: `chrome://theme/IDR_PROFILE_AVATAR_${avatarIndex}`,
    };
    localState.profile.last_used = profileId;

    // 写入配置文件
    await fsp.writeFile(LOCAL_STATE_PATH, JSON.stringify(localState, null, 2));

    // 生成指纹并保存到profile目录
    const fingerprintData = await generateFingerprint(profileNumber);
    await fsp.writeFile(fingerprintPath, JSON.stringify(fingerprintData, null, 2));

    // 修改控制台输出
    console.log(`✅ 已创建 ${profileName}
      路径: ${profilePath}
      ${useCustomAvatar ? '自定义' : '系统'}头像: ${systemAvatarName}
      启动方式: 请使用Playwright启动器加载动态配置`);

  } catch (error) {
    console.error('创建配置文件时出错:', error);
    return;
  }
}

// 删除Chrome用户配置文件
export async function deleteChromeProfile(profileNumber) {
  try {
    // 确保Chrome未运行
    try {
      execSync('pgrep "Google Chrome"', { stdio: 'ignore' });
      console.error('请先关闭所有Chrome实例');
      process.exit(1);
    } catch (e) { /* 没有进程运行 */ }

    // 读取Local State
    let localState = { profile: { info_cache: {}, last_used: 'Default' } };
    try {
      const data = await fsp.readFile(LOCAL_STATE_PATH, 'utf8');
      localState = JSON.parse(data);
    } catch (error) {
      console.error('读取Local State失败:', error);
      throw error;
    }

    // 格式化配置文件ID
    const formattedNumber = formatNumber(profileNumber);
    const profileId = `Profile${formattedNumber}`;
    const profilePath = path.join(CHROME_DATA_DIR, profileId);

    // 检查配置文件是否存在
    if (!localState.profile.info_cache[profileId]) {
      console.error(`配置文件 ${profileId} 不存在`);
      return false;
    }

    // 删除配置文件目录
    try {
      await fsp.rm(profilePath, { recursive: true, force: true });
      console.log(`已删除目录: ${profilePath}`);
    } catch (error) {
      console.error(`删除目录失败: ${profilePath}`, error);
      throw error;
    }

    // 删除头像文件（如果存在）
    try {
      const avatarInfo = localState.profile.info_cache[profileId];
      if (avatarInfo && avatarInfo.avatar_icon) {
        const avatarMatch = avatarInfo.avatar_icon.match(/IDR_PROFILE_AVATAR_(\d+)/);
        if (avatarMatch) {
          const avatarIndex = parseInt(avatarMatch[1]);
          const avatarName = AVATAR_NAMES[avatarIndex];
          const avatarPath = path.join(CHROME_DATA_DIR, 'Avatars', avatarName);
          await fsp.unlink(avatarPath).catch(() => { });
          console.log(`已删除头像: ${avatarName}`);
        }
      }
    } catch (error) {
      // 忽略头像删除失败的错误
      console.log('头像文件可能不存在或已被删除');
    }

    // 从Local State中删除配置信息
    delete localState.profile.info_cache[profileId];

    // 如果删除的是当前使用的配置文件，将last_used设置为Default
    if (localState.profile.last_used === profileId) {
      localState.profile.last_used = 'Default';
    }

    // 更新Local State文件
    try {
      await fsp.writeFile(LOCAL_STATE_PATH, JSON.stringify(localState, null, 2));
      console.log(`✅ 已删除配置文件: ${profileId}`);
      return true;
    } catch (error) {
      console.error('更新Local State失败:', error);
      throw error;
    }
  } catch (error) {
    console.error(`删除配置文件 ${profileNumber} 失败:`, error);
    throw error;
  }
}

export async function updateFingerprint(profileNumber) {
  try {
    // 验证配置文件存在
    const formattedNumber = formatNumber(profileNumber);
    const profileId = `Profile${formattedNumber}`;
    const profilePath = path.join(CHROME_DATA_DIR, profileId);

    // 检查配置文件目录
    try {
      await fsp.access(profilePath);
    } catch {
      throw new Error(`配置文件 ${profileId} 不存在`);
    }

    // 确保Chrome未运行
    try {
      execSync('pgrep "Google Chrome"', { stdio: 'ignore' });
      throw new Error('请先关闭所有Chrome实例');
    } catch (e) { /* 正常情况 */ }

    // 生成新指纹
    const newFingerprint = generateFingerprint(profileNumber);

    // 更新指纹文件
    const fingerprintPath = path.join(profilePath, 'fingerprint.json');
    await fsp.writeFile(fingerprintPath, JSON.stringify(newFingerprint, null, 2));

    console.log(`✅ 已更新 ${profileId} 指纹
      存储路径: ${fingerprintPath}`);

    return true;
  } catch (error) {
    console.error(`更新指纹失败: ${error.message}`);
    throw error;
  }
}