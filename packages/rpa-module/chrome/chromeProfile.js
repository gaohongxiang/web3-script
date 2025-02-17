import fsp from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { FingerprintGenerator } from 'fingerprint-generator';
import { createCanvas } from 'canvas';
import { formatNumber } from '../../utils-module/utils.js';
import { BASE_CONFIG } from './config.js';

export class ChromeAutomation {
  /**
   * Chrome自动化配置管理类
   * @param {number} chromeNumber - 浏览器实例编号
   */
  constructor(chromeNumber) {
    this.chromeNumber = formatNumber(chromeNumber);
    this.CHROME_PATH = BASE_CONFIG.CHROME_PATH;
    this.AUTOMATION_CHROME_PATH = BASE_CONFIG.getChromeInstancePath(this.chromeNumber);
    this.AUTOMATION_CHROME_EXECUTABLE = BASE_CONFIG.getChromeExecutable(this.chromeNumber);
    this.AUTOATION_CHROME_DATA_DIR = BASE_CONFIG.getProfileDataDir(this.chromeNumber);
    this.FINGERPRINT_PATH = BASE_CONFIG.getFingerprintPath(this.chromeNumber);
  }

  /**
   * 创建完整的Chrome配置文件
   * 包含应用副本和指纹生成
   */
  async createChromeProfile() {
    await this.createChromeApp();
    await this.createFingerprint();
  }

  /**
   * 创建Chrome应用副本
   * 使用ditto命令复制原始Chrome应用
   * @throws {Error} 复制失败时抛出错误
   */
  async createChromeApp() {
    try {
      // 检查自动化Chrome是否已存在
      try {
        await fsp.access(this.AUTOMATION_CHROME_PATH);
        console.log(`Chrome${this.chromeNumber} app已存在`);
        return;
      } catch {
        console.log(`正在创建Chrome${this.chromeNumber} app...`);
      }

      // 复制Chrome应用
      execSync(`ditto "${this.CHROME_PATH}" "${this.AUTOMATION_CHROME_PATH}"`);

      console.log(`Chrome${this.chromeNumber} app创建成功`);
    } catch (error) {
      console.error(`Chrome${this.chromeNumber} app创建失败:`, error);
      throw error;
    }
  }

  /**
   * 生成并保存浏览器指纹
   * @throws {Error} 生成或写入失败时抛出错误
   */
  async createFingerprint() {
    try {
      // 确保目录存在
      const dir = path.dirname(this.FINGERPRINT_PATH);
      await fsp.mkdir(dir, { recursive: true });

      // 生成并写入指纹数据
      const fingerprintData = await generateFingerprint(this.chromeNumber);
      await fsp.writeFile(this.FINGERPRINT_PATH, JSON.stringify(fingerprintData, null, 2));
      
      console.log(`Chrome${this.chromeNumber} 指纹创建成功`);
    } catch (error) {
      console.error('创建指纹失败:', error);
      throw error;
    }
  }
}

/**
 * 生成浏览器指纹配置
 * @param {Object} options - 指纹配置选项
 * @param {Object} options.version - 版本范围配置
 * @param {number} [options.version.minVersion=130] - 最小主版本号
 * @param {number} [options.version.maxVersion=133] - 最大主版本号
 * @param {Object} options.screen - 屏幕配置
 * @param {number} [options.screen.width=1680] - 基础宽度
 * @param {number} [options.screen.height=1050] - 基础高度
 * @returns {Promise<Object>} 包含完整指纹和请求头的对象
 */
export async function generateFingerprint({
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
      // console.log(fingerprintWithHeaders)
      return fingerprintWithHeaders;
  } catch (error) {
      console.error('指纹生成失败:', error);
      throw error;
  }
}

/**
 * Chrome默认头像文件名映射表
 * key为头像编号，value为对应的文件名
 */
export const AVATAR_NAMES = {
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

/**
 * 获取已存在的配置文件编号列表
 * @param {Object} localState - Chrome本地状态数据
 * @returns {number[]} 已存在的配置文件编号数组
 */
export function getExistingProfiles(localState) {
  return Object.keys(localState.profile.info_cache)
      .filter(id => /^Profile\d+$/.test(id))  // 精确匹配Profile后面紧跟数字的格式
      .map(id => parseInt(id.match(/^Profile(\d+)$/)[1]))  // 提取数字部分
      .filter(num => !isNaN(num));
}

/**
 * 替换或创建用户头像
 * @param {string} avatarsDir - 头像存储目录路径
 * @param {number} profileNumber - 配置文件编号
 * @param {string} systemAvatarName - 系统预设头像文件名
 */
export async function replaceAvatar(avatarsDir, profileNumber, systemAvatarName) {
  const avatarPath = path.join(avatarsDir, systemAvatarName);

  // 生成数字头像
  const imageBuffer = await generateNumberAvatar(profileNumber);

  try {
      // 检查Avatars目录是否存在
      await fsp.access(avatarsDir);
      // 目录存在，检查并替换头像
      try {
          await fsp.access(avatarPath);
          await fsp.writeFile(avatarPath, imageBuffer);
          // console.log(`已替换现有头像: ${systemAvatarName}`);
      } catch {
          await fsp.writeFile(avatarPath, imageBuffer);
          // console.log(`已在现有目录创建头像: ${systemAvatarName}`);
      }
  } catch {
      // Avatars目录不存在，创建目录和头像
      await fsp.mkdir(avatarsDir, { recursive: true });
      await fsp.writeFile(avatarPath, imageBuffer);
      // console.log(`已创建目录和头像: ${systemAvatarName}`);
  }
}

/**
 * 生成带编号的默认头像
 * @param {number} number - 要显示在头像中的编号
 * @returns {Buffer} PNG格式的图片Buffer
 * @throws {Error} 图片生成失败时抛出错误
 */
export async function generateNumberAvatar(number) {
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