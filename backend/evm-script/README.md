# evm系交互脚本

## 注意事项
- 本脚本使用infura的rpc服务，需要自己申请，将apiKey配置到.env文件
- 创建钱包文件，并加密私钥、助记词数据
- erc20代币信息存储在`./backend/data/token.json`文件,需要的token信息可自行添加

## 使用示例
```
import { transfer as evmTransfer, getBalance as evmGetBalance, listenContract } from "./packages/evm-script/index.js";

// 获取地址余额
// 参数：{ address, token, chain, proxy = null(socks5格式), tokenFile = './backend/data/token.json' }
const balance = await evmGetBalance({ address: '0x28C6c06298d514Db089934071355E5743bf21d60', token: 'eth', chain: 'arb', proxy = null });

// 发送代币
//参数：{ enPrivateKey, toAddress, token, value, chain, proxy = null(socks5格式), tokenFile = './backend/data/token.json' }
await evmTransfer({ enPrivateKey:'加密的私钥', toAddress: '接收地址，比如交易所收款地址', token: 'usdt', value: 5, chain: 'arb', proxy = null });

// 监听
//参数： { listenAddress, listenToken, chain, proxy = null(socks5格式), tokenFile = './backend/data/token.json', direction = 'in' }
await listenContract({ listenAddress:'0x28C6c06298d514Db089934071355E5743bf21d60', listenToken:'usdt', chain:'eth', proxy = null, direction : 'in' }) ;

```

## 参考

- https://github.com/WTFAcademy/WTF-Ethers