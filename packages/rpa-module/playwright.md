- 新兴爬虫利器 Playwright 的基本用法:https://cuiqingcai.com/36045.html
- Playwright自动化测试工具-微软出品-支持三大浏览器:https://www.jianshu.com/p/744d5491fd66
- Python如何爬虫？玩转新一代爬虫神器Playwright！:https://zhuanlan.zhihu.com/p/493300801
- Playwright: 比 Puppeteer 更好用的浏览器自动化工具:https://yifei.me/note/2226

playwright基本概念
- browser(浏览器)：支持多种浏览器：Chromium（chrome、edge）、Firefox、WebKit（Safari），一般每一种浏览器只需要创建一个browser实例。
- context(上下文)：一个浏览器实例可以有多个context，将浏览器分割成不同的上下文，以实现会话的分离，如需要不同用户登录同一个网页，不需要创建多个浏览器实例，只需要创建多个context即可。
- page(页面)：一个context下可以有多个page，一个page就代表一个浏览器的标签页或弹出窗口，用于进行页面操作。
- frame一个页面至少包含一个主frame，新的frame通过iframe标签定义，frame之间可以进行嵌套，只有先定位到frame才能对frame里面的元素进行定位和操作。playwright默认使用page进行的元素操作会重定向到主frame上。
