# utxo系交互脚本

## 注意事项

- 本脚本目前只支持`p2tr类型`的地址（`bc1p`开头的）
- 本脚本目前只支持`CPFP`类型加速交易
- 本脚本目前只支持`WIF`类型私钥
- 创建钱包文件，并加密私钥、助记词数据

#### 2、使用示例

```
import { getAddressUTXOs, getBalance as getBtcBalance, transfer as utxoTransfer, speedUp, splitUTXO } from './packages/utxo-script/index.js';

// 获取地址余额
// 参数： { address, chain = 'btc' }
// await getBtcBalance({address:'地址', chain:'fb'});

const toData = [
    ['bc1pn6dzd2a4509kwlf2vtlnmr7w8nfltd9zcrxeznn9g4hw8ernzsjq8cleeg', 0.01],
    ['bc1p2nh0peenas49guh6jqpzfxt9cup2vhpwv2ndvs60tz04h2prlglqufvy3p', 0.01],
]
// 发送交易（引申：如果toData中有多个相同地址，即是拆分utxo）
// 参数：{ enBtcMnemonicOrWif, toData, chain = 'btc', filterMinUTXOSize = 10000, GasSpeed = 'high', highGasRate = 1.1 }
// await utxoTransfer({ enBtcMnemonicOrWif: d['enBtcPrivateKey'], toData, chain: 'fractal', filterMinUTXOSize: 10000 })

// 加速交易
// 参数：{ enBtcMnemonicOrWif, txid, chain = 'btc', filterMinUTXOSize = 10000, GasSpeed='high', highGasRate=1.1 }
// await speedUp({ enBtcMnemonicOrWif: d['enBtcPrivateKey'], chain: 'fractal', txid: 'c9476ad8d752342d1b768397f0183fd8e0c30d75b48c9ee12b710ab02d2224f5', filterMinUTXOSize: 1000 });

// 获取地址utxo
// 参数：{ address, chain = 'btc', filterMinUTXOSize = 0 }
// const { allUTXOs, filteredUTXOs, unconfirmedUTXOs } = await getAddressUTXOs({address: d['btcAddress'], chain:'fb', filterMinUTXOSize: 10000 });
// console.log(`地址 ${d['btcAddress']} 所有utxos: ${JSON.stringify(allUTXOs)}`);
// console.log(`地址 ${d['btcAddress']} 过滤聪后utxos: ${JSON.stringify(filteredUTXOs)}`);
// console.log(`地址 ${d['btcAddress']} 未确认utxos: ${JSON.stringify(unconfirmedUTXOs)}`);

// 拆分utxo
// 参数：{ enBtcMnemonicOrWif, chain = 'btc', filterMinUTXOSize = 10000, splitNum = 3, GasSpeed='high', highGasRate=1.1 }
// await splitUTXO({ enBtcMnemonicOrWif: d['enBtcPrivateKey'], chain: 'fractal', filterMinUTXOSize: 10000, splitNum: 2 });
```

## 3、基础知识

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

## 参考

- https://github.com/ByteJason/BTC-Script