# RPA 模块使用指南

RPA (Robotic Process Automation) 模块提供了一系列自动化工具，用于浏览器自动化操作，支持多种浏览器环境。

## 浏览器环境配置系统

为了避免代码重复并简化开发，我们提供了统一的浏览器环境配置系统。这允许不同的工具类轻松地支持多种浏览器环境，如Chrome和BitBrowser。

### 基本使用

在创建工具类时，使用共享的浏览器配置来简化代码。

```javascript
import { createBrowserUtil } from '../../rpa-module/browserConfig.js';

// 使用统一的创建函数来获取浏览器实例
const browserUtil = await createBrowserUtil({ 
    browserType: 'chrome',  // 或 'bitbrowser'
    browserId: 1            // Chrome实例编号或BitBrowser ID
});
```

### 创建支持多浏览器环境的工具类

以下是创建支持多浏览器环境的工具类模板：

```javascript
import { createBrowserUtil } from '../../rpa-module/browserConfig.js';

export class MyToolClass {
    constructor(browserUtil) {
        this.browserUtil = browserUtil;
        this.page = browserUtil.page;
        this.context = browserUtil.context;
    }

    static async create({ browserType = 'chrome', browserId, ...otherParams }) {
        try {
            // 使用共享的浏览器工具创建函数
            const browserUtil = await createBrowserUtil({ browserType, browserId });

            // 创建工具类实例
            const instance = new MyToolClass(browserUtil);
            
            // 进行其他初始化...
            
            return instance;
        } catch (error) {
            console.error('创建实例失败:', error);
            throw error;
        }
    }

    // 实现其他方法...
}
```

### 添加新的浏览器类型支持

如果需要添加新的浏览器类型支持，只需在 `browserConfig.js` 文件中的 `browserConfigs` 对象中添加新的配置：

```javascript
// 在 browserConfig.js 中
export const browserConfigs = {
    chrome: {
        baseClass: ChromeBrowserUtil,
        createParams: (browserId) => ({ chromeNumber: browserId })
    },
    bitbrowser: {
        baseClass: BitBrowserUtil,
        createParams: (browserId) => ({ browserId })
    },
    // 添加新的浏览器类型
    newBrowser: {
        baseClass: NewBrowserUtil,
        createParams: (browserId) => ({ yourParamName: browserId })
    }
};
```

## 现有工具类

### ChromeBrowserUtil

基于Playwright的Chrome浏览器自动化工具。

```javascript
const chrome = await ChromeBrowserUtil.create({ chromeNumber: 1 });
```

### BitBrowserUtil

基于BitBrowser的浏览器自动化工具。

```javascript
const bitBrowser = await BitBrowserUtil.create({ browserId: 'your-browser-id' });
```

### OkxWalletUtil

OKX钱包工具类，支持Chrome和BitBrowser环境。

```javascript
// Chrome环境
const okxWalletChrome = await OkxWalletUtil.create({ 
    browserType: 'chrome',
    browserId: 1
});

// BitBrowser环境
const okxWalletBit = await OkxWalletUtil.create({ 
    browserType: 'bitbrowser',
    browserId: 'your-browser-id'
});
```

## 最佳实践

1. 使用共享的浏览器配置，而不是在每个工具类中重复定义浏览器配置逻辑
2. 将与特定工具相关的配置（如钱包ID）单独保存，不要混入通用的浏览器配置
3. 尽可能使用统一的接口方法命名和参数传递方式
4. 在工具类的静态create方法中处理错误，提供有意义的错误信息 


## 学习资料
- 新兴爬虫利器 Playwright 的基本用法:https://cuiqingcai.com/36045.html
- Playwright自动化测试工具-微软出品-支持三大浏览器:https://www.jianshu.com/p/744d5491fd66
- Python如何爬虫？玩转新一代爬虫神器Playwright！:https://zhuanlan.zhihu.com/p/493300801
- Playwright: 比 Puppeteer 更好用的浏览器自动化工具:https://yifei.me/note/2226

playwright基本概念
- browser(浏览器)：支持多种浏览器：Chromium（chrome、edge）、Firefox、WebKit（Safari），一般每一种浏览器只需要创建一个browser实例。
- context(上下文)：一个浏览器实例可以有多个context，将浏览器分割成不同的上下文，以实现会话的分离，如需要不同用户登录同一个网页，不需要创建多个浏览器实例，只需要创建多个context即可。
- page(页面)：一个context下可以有多个page，一个page就代表一个浏览器的标签页或弹出窗口，用于进行页面操作。
- frame一个页面至少包含一个主frame，新的frame通过iframe标签定义，frame之间可以进行嵌套，只有先定位到frame才能对frame里面的元素进行定位和操作。playwright默认使用page进行的元素操作会重定向到主frame上。
