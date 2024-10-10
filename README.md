# web3-script

币圈交互系列脚本

本系列脚本分为 
- crypt-module(加解密模块)
- utils-module(工具库模块)
- exchange-script(交易所脚本)
- utxo-script(utxo系交互脚本)
- evm-script(evm系交互脚本)

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

`.env-example`是示例配置文件，实际使用中需要同目录下创建`.env`文件，内容根据实际情况修改。

#### 3、数据文件

数据文件全部放在`data`目录下。根据用到的模块随时添加相应的文件。主要用到三种格式文件：`.csv`、`.json`、`.xlsx`

##### 交易所文件,如 `binance.json`、`okx.json`。
```
{
    "币安api示例账户":{
        "main":{
            "apiKey": "加密后的key，如何加密看exchange-script示例",
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

##### 钱包文件，如`ethWallet.csv`、`btcWallet.csv`等

此类文件采用csv类型，存放地址，第一个字段统一为indexId，方便后续多文件组合数据，如果不加此字段，程序读取文件时会自动添加。

基本字段如下所示，根据实际情况增删。助记词、私钥等敏感字段必须加密存储，如何加密请看crypt-module部分。

```
indexId,address,enPrivateKey,enMnemonic
1,xxx,xxx,xxx
2,xxx,xxx,xxx
3,xxx,xxx,xxx
...
```

##### `token.json`

此文件是一些常用的evm系token的合约信息，如address、abi、decimals，详见`data/token.json`。可以自行添加token。

## 各模块使用示例

根目录新建一个js文件，示例都在此文件里进行

----------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------

### crypt-module 加解密模块

本模块通过结合1password，用于加解密文本。之所以采用1password，是因为加解密时可以用指纹操作，解锁1password，获取存储的密码，然后执行加解密操作，避免了每次手输密码的繁琐。兼顾安全和便捷。

加解密使用`crypto`库的`aes-256-gcm`算法，使用随机初始化向量，确保数据在传输或存储过程中的唯一性、保密性和完整性。此模式提供了高效的认证和加密，因此被认为是最好的加密模式之一。

> 1password中的密码切不可泄露，否则等于没加密！

#### 1password

1、默认你已经熟悉使用1password密码管理器了，客户端需要勾选`设置->开发者->与1Password CLI 集成`选项。如果没有1password，可在此处了解:https://1password.com

2、创建一个密码，复制路径。


#### 使用示例

1、加解密文本

```
import { enCryptText, deCryptText, enCryptColumn, deCryptColumn } from './packages/crypt-module/crypt.js';

const text = 'hello web3';
// 加密(相同文本每次加密结果也不同)
const enText = await enCryptText(text);
console.log(enText);
//解密
const text = await deCryptText(enText);
console.log(text);
```

2、加密某列文本

假设有一个`wallet.csv`文件，存放地址、私钥等信息，很显然，私钥不能明文存储。这个时候就需要给私钥这一列数据加密
```
id,address,enPrivateKey
1,bc1p0xlw9r7f63m5k4q8z8v49q35t9q0,L1k3wqhiuguv1Ki3pLnuiybr0vm
2,bc1p34x5y9x9q6u9w57h8j9z53l8z7xg,Pkmnuhfh7hbidcuin8877g2b1ns
3,bc1p34x5y9x9q6u9w57h8j9z53l8z7xg,Pkmnuhfh7hbidcuin8877g2b1ns
...
```

执行加密操作
```
await enCryptColumn('./crypt_module/wallet.csv', 'enPrivateKey');
```

加密过后，`wallet.csv`文件内容如下。
```
id,address,enPrivateKey
1,bc1p0xlw9r7f63m5k4q8z8v49q35t9q0,6f74035f8943b525741079695031c2aad826a013e4534dd132fa3852a72ec91bb37156e4a2775792ba1bc66186546bb5f188618614b858
2,bc1p34x5y9x9q6u9w57h8j9z53l8z7xg,a7002ad8dfd7451fe1f53579b87900917a901e84215c579534814e36f749d7dfaff4d9550a7bbde77832a7db4bc0fae7cb53db1b5ebf1c
3,bc1p34x5y9x9q6u9w57h8j9z53l8z7xg,4eba6f49beeed4ac67fc41e60072a887e1ebfc4044618d84ad09e6d558bcc11fdb11025bc488b070979730bf6fa4635bb7e36fc0903fc0
...
```

>tips：通过第2、3条enPrivateKey数据可知，就算相同的数据加密出来也是不一样的，提高安全性。

目前大的应用场景就是使用`enCryptColumn`批量加密钱包文件的私钥、助记词等字段，安全存储。使用的时候用到哪个就用`deCryptText`解密。

----------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------

### utils-module 工具库模块

使用示例
```
import { generateEthWallet, generateBtcWallet } from './packages/utils-module/generateWallet.js'
import { getCsvData, getCsvDataByColumnName } from './packages/utils-module/utils.js'

// 批量生成eth地址，字段：indexId,ethAddress,enEthPrivateKey,enEthMnemonic。敏感字段加密存储
await generateEthWallet();
// 批量生成eth地址，字段：indexId,btcAddress,enBtcPrivateKey,enBtcMnemonic。敏感字段加密存储
await generateBtcWallet();

// 从指定的 CSV 文件中读取数据并返回解析后的结果
await getCsvData('./data/wallet.csv');

// 从指定的 CSV 文件中读取数据，并将指定列的数据转存到临时文件。
// 参数；csvFile, columnName, tempFile='./data/temp.csv'
await getCsvDataByColumnName('./data/wallet.csv', 'address');
```


----------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------

### exchange-script 交易所脚本

#### 注意事项

- 交易所创建api时添加ip地址白名单，只允许白名单里的ip访问api
- okx提现需要把提现地址添加进免验证提币地址白名单里才可以

#### 1、创建交易所api文件，并加密api各数据

查看crypt-module加解密模块示例


#### 2、使用示例
```
import { withdraw as binanceWithdraw } from "./packages/exchange-script/binance.js";
import { withdraw as okxWithdraw } from "./packages/exchange-script/okx.js";

// binance转账
// 参数：{ account, chain, toAddress, coin, amount, apiFile='./data/binance.json' }
await binanceWithdraw({ account:'你的binance交易所账户，跟api文件里要对应', chain:'optimism', toAddress:'接收地址', coin:'usdt', amount:5 });

// okx转账
// 参数：{ account, chain, toAddress, coin, amount, apiFile='./data/okx.json' }
await okxWithdraw({ account:'你的okx交易所账户，跟api文件里要对应', chain:'optimism', toAddress:'接收地址', coin:'usdt', amount:5 });

```

----------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------

### utxo-script utxo系交互脚本

#### 注意事项

- 本脚本目前只支持`p2tr类型`的地址（`bc1p`开头的）
- 本脚本目前只支持`CPFP`类型加速交易

#### 1、创建数据文件，并加密敏感字段，分别用于发送和接收代币。

`fromWallet.csv`
```
indexId,fromAddress,enBtcMnemonic
1,xxx,xxx
2,xxx,xxx
...
```

`toWallet.csv`
```
indexId,toAddress,amount
1,xxx,xxx
2,xxx,xxx
...
```

#### 2、使用示例

```
import { getCsvData } from './packages/utils-module/utils.js';
import { transfer, speedUp, splitUTXO } from './packages/utxo-script/index.js';

const fromAddresses = await getCsvData('./data/fromWallet.csv');
// 用第几个地址发送代币
const fromAddress = fromAddresses[0];
const enBtcMnemonic = fromAddress.enBtcMnemonic;

// 发送交易（引申：如果toWallet文件中有多个相同地址，即是拆分utxo）
// 参数：{ enBtcMnemonic, chain = 'btc', filterMinUTXOSize = 10000, GasSpeed='high', highGasRate=1.1, csvFile = './data/wallet.csv' } 
await transfer({ enBtcMnemonic, chain : 'fractal', filterMinUTXOSize : 10000, csvFile : './data/toWallet.csv' } );

// 加速交易
// 参数：{ enBtcMnemonic, txid, chain = 'btc', filterMinUTXOSize = 10000, GasSpeed='high', highGasRate=1.1 }
await speedUp({ enBtcMnemonic, chain : 'fractal', txid : '要加速的txid', filterMinUTXOSize : 1000 });

// 拆分utxo
// 参数：{ enBtcMnemonic, chain = 'btc', filterMinUTXOSize = 10000, splitNum = 3, GasSpeed='high', highGasRate=1.1 }
await splitUTXO({ enBtcMnemonic, chain : 'fractal', filterMinUTXOSize : 10000, splitNum : 2 });
```

#### 3、基础知识

##### 地址类型

- "m/86'/0'/0'/0/0" ---P2TR（bc1p开头）
- "m/84'/0'/0'/0/0" ---P2WPKH（bc1q开头）
- "m/49'/0'/0'/0/0" ---P2SH（3开头）
- "m/44'/0'/0'/0/0" ---P2PKH（1开头）

路径介绍
- m：根密钥。
- 44'：BIP44 标准，用于多币种和多账户管理。
- 0'：比特币主网的币种类型。
- 0'：第一个账户（通常用于接收来自外部的比特币）。
- 0：外部链，用于生成接收地址。
- 0：该外部链上的第一个地址。

##### 交易基础

预估交易大小：https://bitcoinops.org/en/tools/calc-size/

比特币技术基础（包括公私钥、地址、签名、交易结构等基础知识）：https://docs.mvclabs.io/zh-CN/docs/category/basic-bitcoin-concepts


##### 加速

加速分为 RBF 和 CPFP 两种方式。

RBF（Replace-By-Fee）是一种比特币交易的替换机制，允许用户在交易未被确认的情况下，通过支付更高的交易费用来替换原有交易。这种机制旨在提高交易的确认速度，尤其是在网络拥堵时。

CPFP(子支付父交易) 的基本思想是创建一个新的交易（子交易），它使用未确认的交易（父交易）的输出，并附带更高的手续费。这样，矿工在将子交易打包到区块时，也会打包父交易，因为子交易依赖于父交易的确认。

优缺点比较

- RBF是新的高gas交易会替换旧的低gas交易，只有一笔交易，更省钱，但是需要开启RBF，只能交易发送方能加速交易。
- CPFP是发送一笔新的高gas子交易，让父交易gas提升，有两笔交易，相对费钱。但是发送方和接收方都可以加速交易。

##### 工具

- 铭文铭刻工具：https://ordinals.ybot.io/#
- 加速服务：https://mct.xyz/fractal/speedup

----------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------

### evm-script evm系交互脚本

#### 注意事项
- 本脚本使用infura的rpc服务，需要自己申请，将apiKey配置到.env文件

#### 2、使用示例
```
import { transfer as evmTransfer, getBalance as evmGetBalance, listenContract } from "./packages/evm-script/index.js";

// 获取地址余额
// 参数：{ address, token, chain, tokenFile = './data/token.json' }
const balance = await evmGetBalance({ address: '0x28C6c06298d514Db089934071355E5743bf21d60', token: 'eth', chain: 'base' });

// 发送代币
//参数：{ enPrivateKey, toAddress, token, value, chain, tokenFile = './data/token.json' }
await evmTransfer({ enPrivateKey, toAddress: 'xxxxxx', token: 'bnb', value: 0.002, chain: 'bsc' });

// 监听
//参数： { listenAddress, listenToken, chain, tokenFile = './data/token.json', direction = 'in' }
await listenContract({ listenAddress:'0x28C6c06298d514Db089934071355E5743bf21d60', listenToken:'usdt', chain:'eth', direction : 'in' }) ;

```

----------------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------------

## 参考

- https://github.com/WTFAcademy/WTF-Ethers
- https://github.com/ByteJason/BTC-Script