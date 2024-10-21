
## 注意事项
- 配置`.env`文件，添加需要的rpc节点
- 加密私钥查看`crypt-module`模块
- spl代币信息存储在`./data/token.json`文件,需要的token信息可自行添加

## 示例
```
// 路径根据文件的位置自行调整
import { getBalance as solanaGetBalance, transfer as solanaTransfer } from './packages/sol-script/index.js'

// 获取地址余额
// 参数：{ address, token='SOL', tokenFile = './data/token.json' }
// const balance = await solanaGetBalance({ address: 'HgkB9gJH58zxauqwLqgGVgoHH5FWNdiiVrUsXjTFVukx', token: 'sol', tokenFile = './data/token.json' })

// 几个数据就是发送给几个
const toData = [
    ['HgkB9gJH58zxauqwLqgGVgoHH5FWNdiiVrUsXjTFVukx', 0.01],
    ['Fv5rwEsDoWfqC7xn6QPxZtoz73YN563rRAtCSyuX2xxy', 0.01],
]

// 发送代币
// 参数：{ enPrivateKey, toData, token, tokenFile='./data/token.json' }
solanaTransfer({ enPrivateKey: 'xxxxxxxxxx', toData, token:'sol', tokenFile:'./data/token.json' })
```

## 参考

- 官方库:https://github.com/solana-labs/solana-web3.js/tree/master
- 官方交易示例：https://github.com/solana-labs/solana-web3.js/blob/30f9254a9c67313f82b7bdd03f73b7543e78fc1b/examples/transfer-lamports/src/example.ts#L140
- quickNode solana 文档：https://www.quicknode.com/guides/solana-development/getting-started/solana-fundamentals-reference-guide
- 崔棉大师 Solana 文档：https://www.solana-cn.com/SolanaDocumention/clients/javascript-reference.html
- solana中文开发课程：https://www.solanazh.com/
- solana中文开发课程：https://decert.me/tutorial/sol-dev/
- 如何自己写一个pump.fun狙击枪:https://chainbuff.com/d/12
- 笨方法学 Solana 合约交互(gm365):https://x.com/gm365/status/1797502378230603962
- Solana Web3.js 2.0：Solana 开发的新篇章：https://blog.quicknode.com/solana-web3-js-2-0-a-new-chapter-in-solana-development/


社区

- https://soldev.cn/topics/node1
- https://t.me/solanadevcamp