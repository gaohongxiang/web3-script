# web3-script

币圈交互系列脚本

本系列脚本分为 
- crypt-module(加解密模块)
- utils-module(工具库模块)
- exchange-script(交易所脚本)
- utxo-script(utxo系交互脚本)
- evm-script(evm系交互脚本)
- sol-script(sol链交互脚本)
- sui-script(sui链交互脚本)

持续完善中。。。

## 免责声明

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

交易所api文件
```
{
    "币安api示例账户":{
        "main":{
            "apiKey": "加密后的key",
            "apiSecret": "加密后的secret",
            "apiProxy": ["socks5代理,不加密。创建api时设置只允许受信任的api访问,增加安全性","socks5://xxx:xxx@xxx:xxx"]
        },
        "sub1":{
            "apiKey": "加密后的key",
            "apiSecret": "加密后的secret",
            "apiProxy": ["socks5代理,不加密。创建api时设置只允许受信任的api访问,增加安全性","socks5://xxx:xxx@xxx:xxx"]
        }
    },



    "欧意api示例账户":{
        "main":{
            "apiKey": "加密后的key",
            "apiSecret": "加密后的secret",
            "apiPassword": "加密后的密码",
            "apiProxy": ["socks5代理,不加密。创建api时设置只允许受信任的api访问,增加安全性","socks5://xxx:xxx@xxx:xxx"]
        },
        "sub1":{
            "subAccountName":"xxxxxx",
            "apiKey": "加密后的key",
            "apiSecret": "加密后的secret",
            "apiPassword": "加密后的密码",
            "apiProxy": ["socks5代理,不加密。创建api时设置只允许受信任的api访问,增加安全性","socks5://xxx:xxx@xxx:xxx"]
        }
    }
}
```

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

根目录新建一个js文件，示例都在此文件里进行。

基础使用示例详见各模块文档。

### 一对一转账示例

此场景主要为防女巫。通过交易所中转，地址一对一转账，避免关联。同时也可以配合使用不同ip，进一步避免关联。

>交易所 -> 链上地址 -> 进行链上活动 -> 交易所

```
import { withdraw as binanceWithdraw } from "./packages/exchange-script/binance.js";
import { withdraw as okxWithdraw } from "./packages/exchange-script/okx.js";
import { transfer as evmTransfer, getBalance as evmGetBalance } from "./packages/evm-script/index.js";
import { myFormatData } from "./packages/utils-module/formatdata.js";

async function mainEvm({startNum, endNum}){
    try{
        const data = await myFormatData(startNum, endNum);
        for(const d of data) {
            console.log(`第${d['indexId']}个账号`)

            // okx转账到链上evm系地址
            // 参数：{ account, chain, toAddress, coin, amount, apiFile='./backend/data/okx.json' }
            // await okxWithdraw({ account: 'okx api账户', chain: 'arb', toAddress: d['ethAddress'], coin: 'usdt', amount: 5 })

            // 获取地址余额
            // 参数：{ address, token, chain, proxy=null, tokenFile = './backend/data/token.json' }
            // const balance = await evmGetBalance({ address: d['ethAddress'], token: 'usdt', chain: 'arb', proxy:d['proxy'] })

            // evm系发送代币到okx交易所evm系地址
            //参数：{ enPrivateKey, toAddress, token, value, chain, proxy=null, tokenFile = '.backend/data/token.json' }
            // await evmTransfer({ enPrivateKey: d['enEthPrivateKey'], toAddress: 'd['okxEthAddress']', token: 'usdt', value: 1, chain: 'arb', proxy:d['proxy'] })

        }
    }catch(error){console.log(error)}
}

mainEvm({startNum:1, endNum:2})
```

### 一对多转账示例

>交易所 -> 链上地址 -> 批量发送到多个地址 -> 链上活动 -> 链上地址或交易所地址

```
import { withdraw as okxWithdraw } from "./packages/exchange-script/okx.js";
import { getBalance as solanaGetBalance, transfer as solanaTransfer } from './packages/sol-script/index.js';
import { getCsvDataByColumnName } from './packages/utils-module/utils.js';


const fromAddress = xxxxxx
const enfromPrivateKey = xxxxxx

// okx转账
// 参数：{ account, chain, toAddress, coin, amount, apiFile='./backend/data/okx.json' }
// await okxWithdraw({ account: 'gaohongxiang69@gmail.com', chain: 'solana', toAddress: fromAddress, coin: 'sol', amount: 0.1 })


// 组装toData数据

// 方法1: 直接组装数据
const toData = [
    ['DkdFPsdnoGfPN5ACRf2pxCHcQdfgFdYg87DnXVpb9xG6', 0.01],
    ['HyQxTMcUC7oudaSedzNUUBXt4jJPRyLgNkSYa65Je6Bb', 0.01],
]

// 方法2: 从文件中获取数据
async function getToData(num = 10){
    // 参数 {csvFile, columnName, saveToFile = false, tempFile='./backend/data/temp.csv'}
    let toAddresses = await getCsvDataByColumnName({csvFile:'./backend/data/walletSol.csv', columnName:'solAddress'});
    console.log(toAddresses)
    toAddresses = toAddresses.slice(0, num);
    const amounts = toAddresses.map(() => 0.01); // 这里可以根据需要修改金额
    // const amounts = toAddresses.map(() => (Math.random() * (1.00 - 0.01) + 0.01).toFixed(2)); // 保留两位小数
    // 使用 map 方法组合成所需的格式
    const toData = toAddresses.map((address, index) => [address, amounts[index]]);
    return toData;
}
// const toData = await getToData(2);
// console.log(toData);

// 一对多分发代币
// 参数：{ enPrivateKey, toData, token, tokenFile='./backend/data/token.json' }
// solanaTransfer({ enPrivateKey: enfromPrivateKey, toData, token:'sol', tokenFile:'./backend/data/token.json' });


// 获取地址余额
// 参数：{ address, token='SOL', tokenFile = './backend/data/token.json' }
// const balance = await solanaGetBalance({ address: d['solAddress'], token: 'sol', tokenFile : './backend/data/token.json' })


// 归集代币
const collectData = [fromAddress, 0.01];
const data = await myFormatData(startNum, endNum);
for(const d of data) {
    console.log(`第${d['indexId']}个账号`)
    // 发送代币
    // 参数：{ enPrivateKey, toData, token, tokenFile='./backend/data/token.json' }
    solanaTransfer({ enPrivateKey: d['enSolPrivateKey'], toDat: collectData, token:'sol', tokenFile:'./backend/data/token.json' });
}
```

