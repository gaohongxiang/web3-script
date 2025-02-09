import fsp from 'fs/promises';
import path from 'path';
import { createCanvas } from 'canvas';
import { FingerprintGenerator } from 'fingerprint-generator'
import axios from 'axios';

// Chrome默认头像名称映射表
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

export function getExistingProfiles(localState) {
    return Object.keys(localState.profile.info_cache)
        .filter(id => /^Profile\d+$/.test(id))  // 精确匹配Profile后面紧跟数字的格式
        .map(id => parseInt(id.match(/^Profile(\d+)$/)[1]))  // 提取数字部分
        .filter(num => !isNaN(num));
}

// 格式化数字为3位数
export function formatNumber(num) {
    return num.toString().padStart(3, '0');
}

// 替换头像
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

// 生成数字头像
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

/**
 * 生成浏览器指纹
 * @param {Object} options 配置选项
 * @param {Object} options.version Chrome主版本号相关配置
 * @param {string} options.version.major 主版本号(例如: "133")
 * @param {string} options.version.minPatch 最小补丁版本(例如: "5672.0")
 * @param {string} options.version.maxPatch 最大补丁版本(例如: "5672.999")
 * @param {Object} options.screen 屏幕尺寸
 * @param {number} options.screen.width 屏幕宽度
 * @param {number} options.screen.height 屏幕高度
 */
export function generateFingerprint({
    version = {
        minVersion: 130,
        maxVersion: 133,
    },
    screen = { width: 1440, height: 1220 }
} = {}) {
    try {
        const width = screen.width + Math.floor(Math.random() * 100);
        const height = screen.height + Math.floor(Math.random() * 100);
        const generator = new FingerprintGenerator({
            browsers: [{
                name: 'chrome',
                minVersion: version.minVersion,
                maxVersion: version.maxVersion
            }],
            devices: ['desktop'],
            operatingSystems: ['macos'],
            screen: {
                width: width,
                height: height,
                availWidth: width,
                availHeight: height
            },
            viewport: {
                width: width,
                height: height
            },
            locales: ['en-US'],
            experimentalWebgl: true,
            httpHeaders: true,
            randomizeFingerprint: true,
            strict: false        // 关键！关闭严格模式

        });

        const fingerprintWithHeaders = generator.getFingerprint();
        // console.log('生成的Chrome版本:', fingerprintWithHeaders.fingerprint.navigator.userAgent);
        // console.log('屏幕尺寸:', screen.width, 'x', screen.height);
        return fingerprintWithHeaders;
    } catch (error) {
        console.error('指纹生成失败:', error);
        throw error;
    }
}