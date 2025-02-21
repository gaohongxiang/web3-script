import fsp from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { FingerprintGenerator } from 'fingerprint-generator';
import { createCanvas, loadImage } from 'canvas';
import { formatNumber } from '../../../utils-module/utils.js';
import { BASE_CONFIG } from './config.js';
import { getPathFromCurrentDir } from '../../../utils-module/path.js';

/**
 * Chrome自动化管理类
 * 用于创建和管理Chrome浏览器实例的配置文件
 */
export class ChromeAutomation {
  /**
   * 初始化Chrome自动化实例
   * @param {number} chromeNumber - Chrome实例编号
   * @throws {Error} 如果chromeNumber无效则抛出错误
   */
  constructor(chromeNumber) {
    this.chromeNumber = chromeNumber;
    this.formatChromeNumber = formatNumber(chromeNumber);
    this.CHROME_PATH = BASE_CONFIG.CHROME_PATH;
    this.AUTOMATION_CHROME_PATH = BASE_CONFIG.getChromeInstancePath(this.formatChromeNumber);
    this.CHROME_DEFAULT_DIR = BASE_CONFIG.getChromeDefaultDir(this.formatChromeNumber);
    this.FINGERPRINT_PATH = BASE_CONFIG.getFingerprintPath(this.formatChromeNumber);
  }

  /**
   * 创建完整的Chrome配置文件
   * 包括创建应用副本和生成浏览器指纹
   * @returns {Promise<void>}
   * @throws {Error} 如果创建过程失败则抛出错误
   */
  async createChromeProfile() {
    await this.createChromeApp();
    await this.createFingerprint();
  }

  /**
   * 创建Chrome应用副本
   * 使用ditto命令复制原始Chrome应用到新位置
   * @returns {Promise<void>}
   * @throws {Error} 如果复制过程失败则抛出错误
   */
  async createChromeApp() {
    try {
      // 检查自动化Chrome是否已存在
      try {
        await fsp.access(this.AUTOMATION_CHROME_PATH);
        console.log(`Chrome${this.formatChromeNumber} app已存在`);
        return;
      } catch {
        console.log(`正在创建Chrome${this.formatChromeNumber} app...`);
      }
      // 复制Chrome应用
      execSync(`ditto "${this.CHROME_PATH}" "${this.AUTOMATION_CHROME_PATH}"`);
      console.log(`Chrome${this.formatChromeNumber} app创建成功`);
    } catch (error) {
      console.error(`Chrome${this.formatChromeNumber} app创建失败:`, error);
      throw error;
    }
  }

  /**
   * 生成并保存浏览器指纹配置
   * @returns {Promise<void>}
   * @throws {Error} 如果指纹生成或保存失败则抛出错误
   */
  async createFingerprint() {
    try {
      // 确保目录存在
      const dir = path.dirname(this.FINGERPRINT_PATH);
      await fsp.mkdir(dir, { recursive: true });

      // 生成并写入指纹数据
      const fingerprintData = await generateFingerprint();
      await fsp.writeFile(this.FINGERPRINT_PATH, JSON.stringify(fingerprintData, null, 2));

      console.log(`Chrome${this.formatChromeNumber} 指纹创建成功`);
    } catch (error) {
      console.error('创建指纹失败:', error);
      throw error;
    }
  }

  /**
   * 替换Chrome用户头像
   * 将默认头像替换为带数字的自定义头像
   * @returns {Promise<boolean>} 成功返回true，失败返回false
   * @throws {Error} 如果头像替换过程失败则抛出错误
   */
  async replaceAvatar() {
    const avatarPath = path.join(this.CHROME_DEFAULT_DIR, 'Google Profile Picture.png');
    try {
      // 1. 检查文件是否存在
      await fsp.access(avatarPath, fsp.constants.F_OK);

      // 2. 生成新头像
      const imageBuffer = await generateNumberAvatar(this.chromeNumber);

      // 3. 写入新头像
      await fsp.writeFile(avatarPath, imageBuffer);

      console.log(`成功更新Chrome${this.formatChromeNumber}头像`);
      return true;

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`错误: Google Profile Picture.png 不存在,请先登录Chrome账户`);
      } else {
        console.error(`更新头像失败:`, error.message);
      }
      return false;
    }
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
 * 生成带数字的圆形头像
 * @param {number} chromeNumber - 要显示在头像中的数字
 * @param {string} [savePath='image/avatar'] - 头像保存路径
 * @returns {Promise<Buffer>} 生成的PNG图像buffer
 * @throws {Error} 如果头像生成失败则抛出错误
 */
export async function generateNumberAvatar(chromeNumber, savePath = 'image/avatar') {
  try {
    // 创建画布
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');

    // 创建圆形裁剪路径
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // 绘制橙色背景
    ctx.fillStyle = '#FF7043';
    ctx.fillRect(0, 0, 256, 256);

    // 绘制白色数字，减小字重
    ctx.font = '600 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';

    // 添加较细的白色描边
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.strokeText(chromeNumber, 128, 128);
    ctx.fillText(chromeNumber, 128, 128);

    // 返回图像buffer
    const buffer = canvas.toBuffer('image/png');

    // // 保存到Chrome的images目录
    // const formatedNumber = formatNumber(chromeNumber);
    // const outputPath = getPathFromCurrentDir(import.meta.url, savePath, `Chrome${formatedNumber}.png`);
    // // 写入文件
    // await fsp.writeFile(outputPath, buffer);

    return buffer;

  } catch (error) {
    console.error('生成头像失败:', error);
    throw error;
  }
}

/**
 * 生成带数字标记的Chrome图标
 * 在Chrome图标底部添加带数字的橙色标记
 * @param {number} [chromeNumber=1] - 要显示的数字
 * @param {string} [savePath='image/icons/png'] - 图标保存路径
 * @returns {Promise<void>}
 * @throws {Error} 如果图标生成失败则抛出错误
 */
export async function generateNumberedChromeIcon(chromeNumber = 1, savePath = 'image/icons/png') {
  try {
    // 加载Chrome图标
    const chromeIcon = await loadImage(
      getPathFromCurrentDir(import.meta.url, 'image/icons/png/chrome.png')
    );

    const canvas = createCanvas(chromeIcon.width, chromeIcon.height);
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 绘制原图
    ctx.drawImage(chromeIcon, 0, 0, chromeIcon.width, chromeIcon.height);

    const scale = chromeIcon.width / 96;
    const iconCornerRadius = Math.round(12 * scale);

    // 调整徽章尺寸和位置
    const badgeHeight = Math.round(25 * scale);
    const badgeWidth = Math.round(chromeIcon.width * 0.8);
    const topRadius = Math.round(13 * scale);    // 顶部圆角半径
    const bottomRadius = Math.round(13 * scale); // 底部圆角半径

    // 整体向上移动的偏移量
    const offsetY = Math.round(9 * scale); // 增加这个值会使整个橙色区域向上移动

    // 计算位置
    const badgeX = (chromeIcon.width - badgeWidth) / 2;
    const badgeY = chromeIcon.height - badgeHeight - offsetY; // 向上偏移

    // 绘制橙色徽章
    ctx.fillStyle = '#FF7043';

    // 绘制徽章路径
    ctx.beginPath();
    // 左上角
    ctx.moveTo(badgeX + topRadius, badgeY);
    // 右上角
    ctx.lineTo(badgeX + badgeWidth - topRadius, badgeY);
    ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + topRadius);
    // 右侧直线
    ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - bottomRadius);
    // 右下角（添加圆角）
    ctx.quadraticCurveTo(
      badgeX + badgeWidth,
      badgeY + badgeHeight,
      badgeX + badgeWidth - bottomRadius,
      badgeY + badgeHeight
    );
    // 底部直线
    ctx.lineTo(badgeX + bottomRadius, badgeY + badgeHeight);
    // 左下角（添加圆角）
    ctx.quadraticCurveTo(
      badgeX,
      badgeY + badgeHeight,
      badgeX,
      badgeY + badgeHeight - bottomRadius
    );
    // 左侧直线
    ctx.lineTo(badgeX, badgeY + topRadius);
    // 左上角
    ctx.quadraticCurveTo(badgeX, badgeY, badgeX + topRadius, badgeY);
    ctx.closePath();
    ctx.fill();

    // 绘制数字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 ${Math.round(22 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      chromeNumber.toString(),
      chromeIcon.width / 2,
      badgeY + badgeHeight / 2
    );

    const buffer = canvas.toBuffer('image/png');

    // 保存图标
    const formatBadgeNumber = formatNumber(chromeNumber);
    const outputPath = getPathFromCurrentDir(import.meta.url, savePath, `Chrome${formatBadgeNumber}.png`);
    
    // 写入文件
    await fsp.writeFile(outputPath, buffer);
  } catch (error) {
    console.error('生成Chrome图标失败:', error);
    throw error;
  }
}

/**
 * Chrome默认头像名称映射
 * @type {Object.<number, string>}
 * @property {string} [key] - 头像编号
 * @property {string} value - 对应的头像文件名
 * @example
 * // 获取编号为1的头像文件名
 * const avatarName = AVATAR_NAMES[1]; // 返回 "avatar_generic_aqua.png"
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