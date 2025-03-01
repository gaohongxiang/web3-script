# Chrome多开管理系统

基于Node.js的Chrome多实例管理解决方案，支持独立配置、指纹隔离和代理服务。

>注意：只适用于mac系统，环境是Apple M2 Max Ventura 13.6.2。其他环境未测试。

## 主要功能
✅ 多实例管理 - 同时运行多个独立Chrome实例  
✅ 指纹隔离 - 每个实例拥有独特浏览器指纹  
✅ 代理集成 - 自动绑定独立代理服务器  
✅ 自动化部署 - 一键创建/删除实例


### config.js

此文件是配置文件，配置了chrome的应用安装路径、chrome可执行文件路径、指纹文件路径、监听端口、代理端口等。

### 多实例管理

多个独立Chrome实例，每个实例一套用户数据，拥有独立的指纹和代理配置。

#### 添加实例

创建chrome应用、指纹文件。
```js
import { ChromeAutomation } from './chromeProfile.js';

// 创建Chrome用户 参数代表第几个账号
const chromeAutomation = new ChromeAutomation(1);
await chromeAutomation.createChromeProfile();
```

#### 打开实例

```js
import { ChromeBrowserUtil } from './chromeBrowser.js';

// 参数1：实例编号 参数2：代理配置，格式：socks5://host:post@username:password
const chrome = new ChromeBrowserUtil(chromeId, proxy);          
await chrome.start();
```

#### chrome应用图标
chrome图标一样的话，多实例管理不好区分。 下面这个教程可以修改图标，让每个图标编号都不一样，比如chrome1、chrome2。`image`目录下是我做好的一些图标，可以直接用。
- 手动修改应用图标：https://blog.csdn.net/tekin_cn/article/details/140003742
- 图标不规则不好看？手把手教你绘制苹果官方圆角图标：https://www.zhihu.com/zvideo/1656756405129486337?utm_id=0

1、生成带数字的chrome图标
```js
import { generateNumberedChromeIcon } from './chromeProfile.js';

// 参数1: chromeNumber = 1,实例编号 参数2: savePath = 'image/icons/png'图标保存路径
await generateNumberedChromeIcon(1);
```

2、使用`Image2Icon`工具将png图片转换为icons图标

3、找到应用图标，右键选择 显示简介，复制上一步生成的icons图标，简介页面点击图标，替换chrome应用图标

![dock显示栏](https://raw.githubusercontent.com/gaohongxiang/images/master/编程/google/dock显示栏.jpg)

#### chrome网页图标

方案1是通过修改内置头像间接显示chrome编号。缺点是内置头像只有56个，浏览器实例超出数量的话就没法继续编号了

方案2通过启动一个自定义网页来显示chrome编号。缺点是每次启动浏览器都要多打开一个网页

##### 最终方案，登录chrome账号，然后替换头像
1、登录chrome账号，系统会在数据目录下生成一个`Google Profile Picture.png`图片。

2、生成一个数字图片替换上一步的图片
```js
import { ChromeAutomation } from './chromeProfile.js';

// 参数1：实例编号
const chromeAutomation = new ChromeAutomation(1);
await chromeAutomation.replaceAvatar();
```

![网页图标](https://raw.githubusercontent.com/gaohongxiang/images/master/编程/google/网页图标.jpg)

#### 插件

目前方案是使用rpa下载插件

```js
import { ChromeBrowserUtil } from './chromeBrowser.js';

// 参数1：实例编号 参数2：代理配置，格式：socks5://host:post@username:password
const chrome = new ChromeBrowserUtil(1, 'your-proxy');
await chrome.start();
// 安装okx插件
await chrome.installExtension('https://chromewebstore.google.com/detail/%E6%AC%A7%E6%98%93-web3-%E9%92%B1%E5%8C%85/mcohilncbfahbmgdjkbpemcciiolgcge');
```

#### 退出实例
mac版chrome手动关闭浏览器无法完全退出，比较麻烦。退出有3种方式
- command + q 退出
- 右键点击dock图标 退出
- 脚本 退出
- 参考：如何停止谷歌Chrome在后台运行：https://www.chrome64.com/skill/729.html

```js
import { ChromeBrowserUtil } from './chromeBrowser.js';

const chrome = new ChromeBrowserUtil(1, 'your-proxy');
await chrome.shutdownChrome();
```

### 指纹隔离

指纹是创建多实例时同步创建的，使用的是`fingerprint-generator`库，指纹文件在各实例数据目录下`fingerprint.json`。

使用时是通过`fingerprint-injector`库直接注入浏览器里的

### 代理集成

买的代理一般是带认证的socks5代理，chrome不支持socks5认证，所以需要本地中转一下，浏览器启动时添加了参数 `--proxy-server=127.0.0.1:listenPort`，使用代理服务器转发流量到socks代理处理。

```
浏览器 -> 代理服务器 -> SOCKS5代理 -> 目标网站
浏览器 -> localhost:20001 -> 67.100.105.107:7686 -> 目标网站
```

#### 开始代理服务

package.json配置了代理管理器
```js
"bin": {
    "proxy-manager": "./packages/rpa-module/chrome/chromeBrowser/proxyManger.js"
  }
```

第一次使用先执行以下命令

```shell
# 确保在项目根目录下
cd 你的路径/web3-script

# 链接
sudo npm link

# 检查链接(看看路径对不对)
which proxy-manager

# 检查文件权限
ls -l packages/rpa-module/chrome/chromeBrowser/proxyManger.js

# 如果需要，添加执行权限
chmod +x packages/rpa-module/chrome/chromeBrowser/proxyManger.js
```

后续使用可以单独使用一个终端来执行以下命令
```shell
# 逗号连接的表示范围，比如3,5表示3、4、5
proxy-manager start 1,10 # 开启10个代理服务
proxy-manager start 1 2 3,5 # 开启5个代理服务，1、2、3、4、5
``` 

#### 停止代理服务

停止代理服务直接 ctrl + c 即可


### 一些常用命令
```shell
# 查看端口进程
sudo lsof -t -i :端口号 

# 强制解除端口占用
sudo kill -9 $(sudo lsof -t -i :端口号)

# 获取浏览器版本
curl -s http://localhost:端口号/json/version | jq .webSocketDebuggerUrl
```

## 快速开始

1. 创建多个chrome实例
2. 修改chrome图标
3. 启动代理服务
4. 启动浏览器
5. 登录chrome账号，替换头像
6. 安装插件
7. 关闭浏览器
8. 停止代理服务



## 参考

- 资源汇总：https://github.com/zhaotoday/fingerprint-browser?tab=readme-ov-file
- 开源的谷歌多开管理器
    - Chrome Power：https://github.com/zmzimpl/chrome-power-app
    - VirtualBrowser：https://github.com/Virtual-Browser/VirtualBrowser
    - toolBoxClient：https://github.com/web3ToolBoxDev/toolBoxClient
    - XChrome：https://github.com/chanawudi/XChrome/?tab=readme-ov-file
- 使用 NodeJS 实现 IP 和指纹独立的 Chrome 多开管理程序
    - https://blog.ulsincere.com/multiple-chrome
    - https://github.com/zmzimpl/chrome-power-chromium
- 撸毛群控：https://github.com/fabius8/chromeAuto
- mac多开chrome（多应用）：https://juejin.cn/post/7370895432567816242
- MacOS系统 多开 Google Chrome（同应用不同用户数据）：https://www.youtube.com/watch?v=UHCao7JhH-A
- MacOS系统 多开 Google Chrome：https://x.com/dnvvgjyp/status/1793845106656890962
- MacOS系统 多开 Google Chrome：https://x.com/ariel_sands_dan/status/1816498255792058394
- MacOS系统 多开 Google Chrome：https://x.com/necaluo/status/1785214239793438774
- Mac关闭和禁止Chrome自动更新方法：https://juejin.cn/post/7411187555776118819
- 如何使用Chrome浏览器，打包生成自己的插件（crx格式文件）：https://www.cnblogs.com/Galesaur-wcy/p/15748799.html
- 同步器（目前只有windows版）：https://github.com/devilflasher/Chrome-Manager

检测指纹网站：
- https://zhuanlan.zhihu.com/p/654468171
- https://www.browserscan.net/
- https://fingerprintjs.github.io/fingerprintjs/

