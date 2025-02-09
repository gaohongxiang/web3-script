import path from 'path';

export const BASE_CONFIG = {
  // Chrome应用路径
  CHROME_PATH: '/Applications/Google Chrome.app',
  CHROME_MULTI_DIR: '/Applications/Chrome多开',
  
  // 数据目录
  DATA_DIR: path.join(process.env.HOME, 'Chrome多开'),
  
  // 端口配置
  DEBUG_BASE_PORT: 10000, // 调试端口,playwright使用
  LISTEN_BASE_PORT: 20000, // 监听端口,代理使用
  
  // 获取Chrome实例路径
  getChromeInstancePath: (chromeId) => {
    return path.join(BASE_CONFIG.CHROME_MULTI_DIR, `Chrome${chromeId}.app`);
  },
  
  // 获取Chrome数据目录
  getProfileDataDir: (chromeId) => {
    return path.join(BASE_CONFIG.DATA_DIR, `Chrome${chromeId}`);
  },
  
  // 获取Chrome可执行文件路径
  getChromeExecutable: (chromeId) => {
    return path.join(BASE_CONFIG.getChromeInstancePath(chromeId), 'Contents/MacOS/Google Chrome');
  },
  
  // 获取Chrome配置文件路径
  getChromePlist: (chromeId) => {
    return path.join(BASE_CONFIG.getChromeInstancePath(chromeId), 'Contents/Info.plist');
  },
  
  // 获取Local State路径
  getLocalStatePath: (chromeId) => {
    return path.join(BASE_CONFIG.getProfileDataDir(chromeId), 'Local State');
  },
  
  // 获取指纹文件路径
  getFingerprintPath: (chromeId) => {
    return path.join(BASE_CONFIG.getProfileDataDir(chromeId), 'fingerprint.json');
  },
  
  // 获取调试端口
  getDebugPort: (chromeId) => {
    return BASE_CONFIG.DEBUG_BASE_PORT + parseInt(chromeId);
  },

  getListenPort: (chromeId) => {
    return BASE_CONFIG.LISTEN_BASE_PORT + parseInt(chromeId);
  }
};