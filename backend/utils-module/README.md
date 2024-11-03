# 工具库模块

## 创建钱包文件 `generateWallet.js`

创建的钱包文件存储在data目录下，敏感字段自动加密存储，文件名称（以btc示例）：`walletEth-2024-10-24_06-24-08.csv`。添加时间是为了防止已经存在同名文件，生成的新地址会追加到存在的文件中，将文件数据搞乱。实际使用中文件名称需要跟`filesConfig.json`中保持一致。

```
import { generateBtcWallet, generateEthWallet, generateSolWallet, generateSuiWallet } from './packages/utils-module/generateWallet.js';

// 批量生成eth地址（默认生成10个地址）字段：indexId,ethAddress,enEthPrivateKey,enEthMnemonic。
generateBtcWallet(num = 50);
generateEthWallet(num = 50);
generateSolWallet(num = 50);
generateSuiWallet(num = 50);
```

## 格式化数据文件 `formatdata.js`

此文件配合`filesConfig.json`文件用来格式化数据，是将所有准备好的数据文件按照`indexId`组合到一起，方便使用。

```
import { myFormatData } from './packages/utils-module/formatdata.js';

myFormatData(1, 2)

```

结果如下
```
[
  {
    indexId: '1',
    btcAddress: '地址1',
    enBtcMnemonic: '加密后的助记词',
    enBtcPrivateKey: '加密后的私钥',
    ethAddress: '地址1',
    enEthMnemonic: '加密后的助记词',
    enEthPrivateKey: '加密后的私钥',
    solAddress: '地址1',
    enSolMnemonic: '加密后的助记词',
    enSolPrivateKey: '加密后的私钥',
    suiAddress: '地址1',
    enSuiPrivateKey: '加密后的私钥',
    binanceEthAddress: '地址1',
    okxEthAddress: '地址1',
    okxBtcAddress: '地址1',
    okxSolAddress: '地址1',
    okxStarknetAddress: '地址1',
    proxy: 'socks5://xxx:xxx@xxx:xxx',
    ......
  },
  {
    indexId: '2',
    indexId: '2',
    btcAddress: '地址2',
    enBtcMnemonic: '加密后的助记词',
    enBtcPrivateKey: '加密后的私钥',
    ethAddress: '地址2',
    enEthMnemonic: '加密后的助记词',
    enEthPrivateKey: '加密后的私钥',
    solAddress: '地址2',
    enSolMnemonic: '加密后的助记词',
    enSolPrivateKey: '加密后的私钥',
    suiAddress: '地址2',
    enSuiPrivateKey: '加密后的私钥',
    binanceEthAddress: '地址2',
    okxEthAddress: '地址2',
    okxBtcAddress: '地址2',
    okxSolAddress: '地址2',
    okxStarknetAddress: '地址2',
    proxy: 'socks5://xxx:xxx@xxx:xxx',
    ......
  },
    ......
]
```

## 工具库函数示例
```
import { getCsvData, getCsvDataByColumnName } from './packages/utils-module/utils.js';

// 从指定的 CSV 文件中读取数据并返回解析后的结果
await getCsvData('./backend/data/wallet.csv');

// 从指定的 CSV 文件中读取数据，并将指定列的数据转存到临时文件。
// 参数；csvFile, columnName, tempFile='./backend/data/temp.csv'
await getCsvDataByColumnName('./backend/data/wallet.csv', 'address');
```