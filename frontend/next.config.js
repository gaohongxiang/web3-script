const path = require('path');
const dotenv = require('dotenv');

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