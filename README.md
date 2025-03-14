# web3-script

币圈交互系列脚本

本系列脚本分为 
- crypt-module(加解密模块)
- exchange-module(交易所模块)
- rpa-module(rpa模块)
    - bitbrowser(bitbrowser指纹浏览器模块)
    - chrome(本地chrome浏览器多开模块)
- chain-module(链上交互模块)
    - utxo-script(utxo系交互脚本)
    - evm-script(evm系交互脚本)
    - sol-script(sol链交互脚本)
    - sui-script(sui链交互脚本)
- utils-module(工具库模块)
- social-module(社交模块)
- notification-module(消息通知/日志模块)

持续完善中。。。

## 免责声明

鉴于能力有限，后续不排除有大幅度的改动，请谨慎使用。

本脚本只作为学习用途，使用风险自负！

## 准备工作

#### 1、克隆并安装依赖
```
git clone https://github.com/gaohongxiang/web3-script.git
cd web3-script
npm install
```
#### 2、配置文件

`.env-example`是示例配置文件，实际使用中需要同目录下创建`.env`文件，内容根据实际情况修改。用到哪个模块可查看模块文档增加配置。

`.filesConfig-example.json`是数据配置文件，实际使用中需要同目录下创建`.filesConfig.json`文件，内容根据实际使用到的数据文件增删。此文件是配合`utils-module/formatdata.js`来格式化数据的，将所有准备好的数据文件按照`indexId`组合到一起，方便使用。注意data目录下创建的数据文件名字需要跟此文件里的名字相同。

#### 3、数据文件

数据文件全部放在`data`目录下。根据用到的模块添加相应的文件。助记词、私钥、api数据等敏感字段必须加密存储（加密方法查看`crypt-module`模块）。主要用到三种格式文件：`.csv`、`.json`、`.xlsx`

##### 代币信息文件 `token-example.json`

此文件是一些常用的token信息，实际使用中需要同目录下创建`token.json`文件。可以自行添加token。


##### 钱包文件

此类文件存放链上地址，采用`.csv`格式，如`walletBtc.csv`、`walletEth.csv`等。基本字段如下所示，根据实际情况增删。

已存在的地址可以使用`crypt-module`模块加密敏感字段。未存在的地址可以直接使用`utils-module`模块生成，敏感字段会自动加密。

```
indexId,address,enPrivateKey,enMnemonic
1,地址1,加密后的私钥,加密后的助记词
2,地址2,加密后的私钥,加密后的助记词
3,地址3,加密后的私钥,加密后的助记词
...
```

>注意：csv文件第一个字段统一为indexId，方便后续多文件组合数据，如果不加此字段，程序读取文件时会自动添加。除了indexId字段，其他字段不准起相同的名字，防止多文件合并数据时漏数据。编辑器可以安装一下`Rainbow CSV`插件，每个字段用不同颜色显示，很容易阅读。

##### 交易所文件

交易所文件分为两类
- 一类是api文件，此类文件存放交易所api，用于转出。采用`.json`格式，如 `binance.json`、`okx.json`。
- 一类是地址文件，此类文件存放交易所的收款地址，用于转入。采用`.csv`格式，如`addressBinance.csv`、`addressOkx.csv`。

交易所api文件,见`exchange-module/README.md`

交易所地址文件。以ok为例，主账户和5个子账户都能生成20个地址
```
indexId,okxEthAddress,okxBtcAddress,okxSolAddress,okxSuiAddress,...
1,okx的eth地址1,okx的btc地址1,okx的sol地址1,okx的sui地址1,...
2,okx的eth地址2,okx的btc地址2,okx的sol地址2,okx的sui地址2,...
3,okx的eth地址3,okx的btc地址3,okx的sol地址3,okx的sui地址3,...
```

##### ip文件 `ip.csv`

此文件存放ip信息，使用时会处理成sock5格式 `socks5://username:password@ip:port`
```
proxyIp:proxyPort:proxyUsername:proxyPassword
xxxxxx:xxxxxx:xxxxxx:xxxxxx
xxxxxx:xxxxxx:xxxxxx:xxxxxx
......
```

## 各模块使用示例

使用示例详见各模块文档。