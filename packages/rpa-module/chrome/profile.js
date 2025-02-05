import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { createCanvas } from 'canvas';

const CHROME_DATA_DIR = path.join(process.env.HOME, 'Library', 'Application Support', 'Google', 'Chrome');
const LOCAL_STATE_PATH = path.join(CHROME_DATA_DIR, 'Local State');

// Chrome默认头像名称映射表
const AVATAR_NAMES = {
  1: "avatar_generic_aqua.png",
  2: "avatar_generic_blue.png",
  3: "avatar_generic_green.png",
  4: "avatar_generic_orange.png",
  5: "avatar_generic_purple.png",
  6: "avatar_generic_red.png",
  7: "avatar_generic_yellow.png",
  8: "avatar_secret_agent.png",
  9: "avatar_superhero.png",
  10: "avatar_volley_ball.png",
  11: "avatar_businessman.png",
  12: "avatar_ninja.png",
  13: "avatar_alien.png",
  14: "avatar_awesome.png",
  15: "avatar_flower.png",
  16: "avatar_pizza.png",
  17: "avatar_soccer.png",
  18: "avatar_burger.png",
  19: "avatar_cat.png",
  20: "avatar_cupcake.png",
  21: "avatar_dog.png",
  22: "avatar_horse.png",
  23: "avatar_margarita.png",
  24: "avatar_note.png",
  25: "avatar_sun_cloud.png",
  26: "", //这个是默认灰色头像，无法获取到名字。不用它
  27: "avatar_origami_cat.png",
  28: "avatar_origami_corgi.png",
  29: "avatar_origami_dragon.png",
  30: "avatar_origami_elephant.png",
  31: "avatar_origami_fox.png",
  32: "avatar_origami_monkey.png",
  33: "avatar_origami_panda.png",
  34: "avatar_origami_penguin.png",
  35: "avatar_origami_pinkbutterfly.png",
  36: "avatar_origami_rabbit.png",
  37: "avatar_origami_unicorn.png",
  38: "avatar_illustration_basketball.png",
  39: "avatar_illustration_bike.png",
  40: "avatar_illustration_bird.png",
  41: "avatar_illustration_cheese.png",
  42: "avatar_illustration_football.png",
  43: "avatar_illustration_ramen.png",
  44: "avatar_illustration_sunglasses.png",
  45: "avatar_illustration_sushi.png",
  46: "avatar_illustration_tamagotchi.png",
  47: "avatar_illustration_vinyl.png",
  48: "avatar_abstract_avocado.png",
  49: "avatar_abstract_cappuccino.png",
  50: "avatar_abstract_icecream.png",
  51: "avatar_abstract_icewater.png",
};

// 获取头像名称
function getAvatarName(index) {
  return AVATAR_NAMES[index] || 'avatar_generic.png';
}

function getExistingProfiles(localState) {
  return Object.keys(localState.profile.info_cache)
    .filter(id => /^Profile\d+$/.test(id))  // 精确匹配Profile后面紧跟数字的格式
    .map(id => parseInt(id.match(/^Profile(\d+)$/)[1]))  // 提取数字部分
    .filter(num => !isNaN(num));
}

// 格式化数字为3位数
function formatNumber(num) {
  return num.toString().padStart(3, '0');
}

// 生成数字头像
async function generateNumberAvatar(number) {
  try {
    // 创建画布
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');

    // 绘制白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 256, 256);

    // 使用统一的格式化函数
    const formattedNumber = formatNumber(number);

    // 绘制数字
    ctx.font = 'bold 120px Arial Black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';

    // 添加描边使数字看起来更粗
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.strokeText(formattedNumber, 128, 128);
    ctx.fillText(formattedNumber, 128, 128);

    // 返回图像buffer
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('生成头像失败:', error);
    throw error;
  }
}

// 替换头像
async function replaceAvatar(profileNumber, systemAvatarName) {
  const avatarsDir = path.join(CHROME_DATA_DIR, 'Avatars');
  const avatarPath = path.join(avatarsDir, systemAvatarName);

  // 生成数字头像
  const imageBuffer = await generateNumberAvatar(profileNumber);

  try {
    // 检查Avatars目录是否存在
    await fs.access(avatarsDir);
    // 目录存在，检查并替换头像
    try {
      await fs.access(avatarPath);
      await fs.writeFile(avatarPath, imageBuffer);
      // console.log(`已替换现有头像: ${systemAvatarName}`);
    } catch {
      await fs.writeFile(avatarPath, imageBuffer);
      // console.log(`已在现有目录创建头像: ${systemAvatarName}`);
    }
  } catch {
    // Avatars目录不存在，创建目录和头像
    await fs.mkdir(avatarsDir, { recursive: true });
    await fs.writeFile(avatarPath, imageBuffer);
    // console.log(`已创建目录和头像: ${systemAvatarName}`);
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
      const data = await fs.readFile(LOCAL_STATE_PATH, 'utf8');
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
    await fs.mkdir(profilePath, { recursive: true });
    await fs.mkdir(path.join(profilePath, 'Extensions'), { recursive: true });

    // 获取头像信息
    const avatarIndex = useCustomAvatar ?
      (profileNumber === 26 ? 51 : profileNumber) : // 使用自定义头像时，避开26号
      Math.floor(Math.random() * 56); // 不使用自定义头像时，随机选择0-55
    const systemAvatarName = getAvatarName(avatarIndex);

    // 根据选项决定是否替换头像
    if (useCustomAvatar) {
      await replaceAvatar(profileNumber, systemAvatarName);
    }

    // 更新Local State
    localState.profile.info_cache[profileId] = {
      name: profileName,
      user_name: profileName,
      is_consented_primary_account: true,
      avatar_icon: `chrome://theme/IDR_PROFILE_AVATAR_${avatarIndex}`,
    };
    localState.profile.last_used = profileId;

    // 写入配置文件
    await fs.writeFile(LOCAL_STATE_PATH, JSON.stringify(localState, null, 2));

    console.log(`✅ 已创建 ${profileName}\n路径: ${profilePath}\n${useCustomAvatar ? '自定义' : '系统'}头像: ${systemAvatarName}`);
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
      const data = await fs.readFile(LOCAL_STATE_PATH, 'utf8');
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
      await fs.rm(profilePath, { recursive: true, force: true });
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
          const avatarName = getAvatarName(avatarIndex);
          const avatarPath = path.join(CHROME_DATA_DIR, 'Avatars', avatarName);
          await fs.unlink(avatarPath).catch(() => { });
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
      await fs.writeFile(LOCAL_STATE_PATH, JSON.stringify(localState, null, 2));
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