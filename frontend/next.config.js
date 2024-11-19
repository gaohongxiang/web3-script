const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

const tokenJsonPath = path.resolve(__dirname, '../data/token.json');
const publicTokenPath = path.resolve(__dirname, 'public/token.json');

// 确保 public 目录存在
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// 初始复制
if (fs.existsSync(tokenJsonPath)) {
  fs.copyFileSync(tokenJsonPath, publicTokenPath);
}

// 监听文件变化
fs.watch(tokenJsonPath, (eventType) => {
  if (eventType === 'change') {
    fs.copyFileSync(tokenJsonPath, publicTokenPath);
    console.log('token.json updated');
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    // 从根目录的 .env 加载环境变量
    ...dotenv.config({ path: path.resolve(__dirname, '../.env') }).parsed
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 