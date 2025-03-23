# web3交互系列脚本

<table>
  <thead>
    <tr>
      <th align="center">模块类别</th>
      <th align="center">模块内容</th>
      <th align="center">功能描述</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><strong>🔐 加解密模块</strong></td>
      <td align="center">crypt</td>
      <td align="center">数据加密与解密功能</td>
    </tr>
    <tr>
      <td rowspan="3" align="center"><strong>💱 交易所模块</strong></td>
      <td align="center">binance</td>
      <td align="center">币安交易所API交互</td>
    </tr>
    <tr>
      <td align="center">okx</td>
      <td align="center">OKX交易所API交互</td>
    </tr>
    <tr>
      <td align="center">bybit</td>
      <td align="center">Bybit交易所API交互</td>
    </tr>
    <tr>
      <td rowspan="2" align="center"><strong>🤖 RPA模块</strong></td>
      <td align="center">bitbrowser</td>
      <td align="center">BitBrowser指纹浏览器自动化操作</td>
    </tr>
    <tr>
      <td align="center">chrome</td>
      <td align="center">本地Chrome浏览器多开与控制</td>
    </tr>
    <tr>
      <td rowspan="4" align="center"><strong>⛓️ 链上交互模块</strong></td>
      <td align="center">utxo-script</td>
      <td align="center">比特币等UTXO模型链交互</td>
    </tr>
    <tr>
      <td align="center">evm-script</td>
      <td align="center">以太坊等EVM兼容链交互</td>
    </tr>
    <tr>
      <td align="center">sol-script</td>
      <td align="center">Solana链交互</td>
    </tr>
    <tr>
      <td align="center">sui-script</td>
      <td align="center">Sui链交互</td>
    </tr>
    <tr>
      <td rowspan="3" align="center"><strong>🌐 社交自动化</strong></td>
      <td align="center">X</td>
      <td align="center">X自动化操作</td>
    </tr>
    <tr>
      <td align="center">gmail</td>
      <td align="center">Gmail自动化操作</td>
    </tr>
    <tr>
      <td align="center">galxe</td>
      <td align="center">Galxe自动化操作</td>
    </tr>
    <tr>
      <td rowspan="2" align="center"><strong>📢 通知模块</strong></td>
      <td align="center">notification</td>
      <td align="center">消息通知与日志记录</td>
    </tr>
    <tr>
      <td align="center">notifier</td>
      <td align="center">钉钉机器人提醒</td>
    </tr>
     <tr>
      <td rowspan="5" align="center"><strong>🛠️ 工具库模块</strong></td>
      <td align="center">generatewallet</td>
      <td align="center">多链钱包生成工具</td>
    </tr>
    <tr>
      <td align="center">captcha</td>
      <td align="center">验证码自动识别与解决</td>
    </tr>
    <tr>
      <td align="center">otp</td>
      <td align="center">两因素认证(2FA)工具</td>
    </tr>
    <tr>
      <td align="center">formatdata</td>
      <td align="center">数据格式化与处理</td>
    </tr>
    <tr>
      <td align="center">其他</td>
      <td align="center">一些细碎的辅助工具</td>
    </tr>
  </tbody>
</table>

持续完善中。。。

## 免责声明

鉴于能力有限，后续不排除有大幅度的改动，请谨慎使用。

本脚本只作为学习用途，使用风险自负！

## 准备工作

#### 1、克隆并安装依赖
```
git clone https://github.com/gaohongxiang/web3-script.git
cd web3-script

sudo npm install -g pnpm
pnpm install
```

包管理器从npm迁移至pnpm
- 支持同一依赖的多个版本并存，解决版本冲突问题
- 严格的依赖树结构，杜绝幽灵依赖
- 硬链接共享依赖，节省磁盘空间
- 更快的并行安装速度

比如我的代码里用的ethersV6版本，而uniswap的sdk还用的ethersV5版本，那么就会产生冲突。可以如下解决
```json
{
    "dependencies": {
        "ethers-v5": "npm:ethers@5.8.0",
        "ethers-v6": "npm:ethers@^6.13.5",
        "@uniswap/permit2-sdk": "1.3.0",
        "@uniswap/universal-router-sdk": "4.19.5",
    },
    "pnpm": {
        "overrides": {
            "@uniswap/universal-router-sdk>ethers": "5.8.0",
            "@uniswap/permit2-sdk>ethers": "5.8.0"
        }
    }
}
```
查一下所有依赖包中使用的 ethers 版本。--depth=10 表示显示依赖树的深度为10层
```
pnpm list ethers --depth=10
```

结果如下，可以看到uniswap的sdk使用ethersV5版本，而我自己的代码中通过`import { ethers } from 'ethers-v6';`导入即可用V6版本。
```
@uniswap/permit2-sdk 1.3.0
└── ethers 5.8.0
@uniswap/universal-router-sdk 4.19.5
├─┬ @uniswap/permit2-sdk 1.3.0
│ └── ethers 5.8.0
└── ethers 5.8.0
ethers 5.8.0
ethers 6.13.5
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

此文件存放ip信息，自动处理成各协议需要的格式，根据需要使用。详情查看`utils-module`文档。
```
proxyIp:proxyPort:proxyUsername:proxyPassword
xxxxxx:xxxxxx:xxxxxx:xxxxxx
xxxxxx:xxxxxx:xxxxxx:xxxxxx
......
```

## 各模块使用示例

使用示例详见各模块文档。


如果觉得本脚本对您有帮助，欢迎支持，您的鼓励是我持续更新的动力！☕☕☕

```
BTC: bc1pvw4w2kj6f97kqkfsalfk804tv60lwrx5pqlf34c595m2pggwyfysr3l4ld

EVM: 0xbc7fe470be2a5a1ea8db55be44e234b0224b3198

SOL: 8yJyYESPppRDb67GUzC4brCaY8UVVZU3JzBJ4DtkMc45