# utxo-script
基于utxo模型的公链（btc、fractal等）脚本

## 免责声明

本脚本只作为学习用途，使用时切记先小额尝试。风险自负！

## 注意事项

- 本脚本目前只支持`p2tr类型`的地址（`bc1p`开头的）
- 本脚本目前只支持`CPFP`类型加速交易
- 本脚本依赖 crypt-module 加解密模块，使用详情查看：https://github.com/gaohongxiang/crypt-module
- 本脚本依赖 util-module 工具库模块，使用详情查看：https://github.com/gaohongxiang/utils-module

## 快速开始

#### 1、克隆并安装依赖
```
git clone https://github.com/gaohongxiang/utxo-script.git
cd utxo-script

npm install
```

#### 2、配置文件

`.env-example`是示例配置文件。需要在同目录下创建`.env`文件，根据实际情况修改。

#### 3、数据文件

项目目录下创建`data`目录，此目录下创建两个文件，分别用于发送代币和接收代币。

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

#### 4、加密助记词
```
import { initialize, enCryptColumn } from 'ghx-crypt-module';
import { config } from 'dotenv';
// 获取环境变量
const { parsed } = config();
// 初始化personalToken
await initialize(parsed.personalToken);
// 批量加密文本
await enCryptColumn('./data/fromWallet.csv', 'enBtcMnemonic');
```

#### 5、使用示例

```
import { getCsvData } from 'ghx-utils-module';
import { transfer, speedUp, splitUTXO } from './index.js';

const fromAddresses = await getCsvData('./data/fromWallet.csv');
// 用第几个地址发送代币
const fromAddress = fromAddresses[0]
const enBtcMnemonic = fromAddress.enBtcMnemonic

// 发送交易（引申：如果toWallet文件中有多个相同地址，即是拆分utxo）
await transfer(enBtcMnemonic, { filterMinUTXOSize : 10000, csvFile : './data/toWallet.csv' } )

// 加速交易
await speedUp(enBtcMnemonic, '要加速的txid', { filterMinUTXOSize:1000 });

// 拆分utxo
await splitUTXO(enBtcMnemonic, { filterMinUTXOSize: 10000, splitNum: 2 });
```

## 基础知识

#### 地址类型

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

#### 交易基础

预估交易大小：https://bitcoinops.org/en/tools/calc-size/

比特币技术基础（包括公私钥、地址、签名、交易结构等基础知识）：https://docs.mvclabs.io/zh-CN/docs/category/basic-bitcoin-concepts


#### 加速

加速分为 RBF 和 CPFP 两种方式。

RBF（Replace-By-Fee）是一种比特币交易的替换机制，允许用户在交易未被确认的情况下，通过支付更高的交易费用来替换原有交易。这种机制旨在提高交易的确认速度，尤其是在网络拥堵时。

CPFP(子支付父交易) 的基本思想是创建一个新的交易（子交易），它使用未确认的交易（父交易）的输出，并附带更高的手续费。这样，矿工在将子交易打包到区块时，也会打包父交易，因为子交易依赖于父交易的确认。

优缺点比较

- RBF是新的高gas交易会替换旧的低gas交易，只有一笔交易，更省钱，但是需要开启RBF，只能交易发送方能加速交易。
- CPFP是发送一笔新的高gas子交易，让父交易gas提升，有两笔交易，相对费钱。但是发送方和接收方都可以加速交易。

#### 工具

- 铭文铭刻工具：https://ordinals.ybot.io/#
- 加速服务：https://mct.xyz/fractal/speedup

#### 参考

- https://github.com/ByteJason/BTC-Script