# sui脚本

Sui TypeScript SDK 有两个版本，一个是官方版，一个是社区版。社区版使用比较简单

## 注意事项
- 创建钱包文件，并加密私钥、助记词数据
- sui代币信息存储在`./backend/data/token.json`文件,需要的token信息可自行添加

```
const toData = [
    ['0xfe91445a41fbbce5d5b278cd89d6c2081f0a6697148296ce5f9ffd5155f223e6', 0.01],
  ];
  
  // { address, token='SUI', tokenFile = './backend/data/token.json' }
  // getBalance({ address:'0xfe91445a41fbbce5d5b278cd89d6c2081f0a6697148296ce5f9ffd5155f223e6', token:'usdc', tokenFile : './backend/data/token.json' })

  // { enPrivateKey, toData, token = "SUI", tokenFile = './backend/data/token.json' }
  transfer({ enPrivateKey:'加密的私钥', toData, token:"usdc", tokenFile:'./backend/data/token.json' })
```

## 参考
- Sui TypeScript SDK 快速入门:https://sdk.mystenlabs.com/typescript
- Sui TypeScript SDK 文档：https://sdk.mystenlabs.com/typescript/transaction-building/basics
- 官方 TypeScript SDK：https://github.com/MystenLabs/sui/tree/main/sdk/typescript
- 社区 TypeScript SDK：https://github.com/scallop-io/sui-kit
- 如何合并和转移 2k sui coin 对象 #18254:https://github.com/MystenLabs/sui/discussions/18254?sort=new



