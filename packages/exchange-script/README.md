# exchange-script
交易所脚本

## 免责声明

本脚本只作为学习用途，使用时切记先小额尝试。风险自负！

## 注意事项

- 本脚本依赖 crypt-module 模块（加解密模块），使用详情查看：https://github.com/gaohongxiang/crypt-module
- 交易所创建api时添加ip地址白名单，只允许白名单里的ip访问api
- okx提现需要把提现地址添加进免验证提币地址白名单里才可以

## 快速开始

#### 1、克隆并安装依赖
```
git clone https://github.com/gaohongxiang/exchange-script.git
cd exchange-script

npm install
```

#### 2、配置文件

`.env-example`是 crypt-module 模块（加解密模块）使用的示例配置文件，存放密钥在1password中的路径。需要在同目录下创建`.env`文件，密钥路径根据自己的实际情况修改。

`api-example.json`是交易所api示例配置文件，存放加密过的交易所api。需要在同目录下创建`data`目录，然后在此目录下分别创建各交易所的api文件，如`binance.json`、`okx.json`

#### 3、加密api各数据
```
import { initialize, enCryptText } from 'ghx-crypt-module';
import { config } from 'dotenv';
// 获取环境变量
const { parsed } = config();
// 初始化personalToken
await initialize(parsed.personalToken);
// 加密文本（各个数据分别加密），加密完成后此文本记得删除
const enText = await enCryptText(text);
// 将打印的数据存储到api文件里
console.log(enText)
```

#### 4、使用示例
```
import { withdraw as okxWithdraw } from "./okx.js";
import { withdraw as binanceWithdraw } from "./binance.js";

// binance转账
await binanceWithdraw({ account:'你的binance交易所账户，跟api文件里要对应', chain:'optimism', toAddress:'接收地址', coin:'usdt', amount:5 })

// okx转账
await okxWithdraw({ account:'你的okx交易所账户，跟api文件里要对应', chain:'optimism', toAddress:'接收地址', coin:'usdt', amount:5 })

```