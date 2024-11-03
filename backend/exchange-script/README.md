# 交易所脚本

## 注意事项

- 交易所创建api时添加ip地址白名单，只允许白名单里的ip访问api
- okx提现需要把提现地址添加进免验证提币地址白名单里才可以
- 创建交易所api文件，并加密api各数据
- 创建交易所收款地址文件，并加密私钥、助记词数据


## 2、使用示例
```
import { withdraw as binanceWithdraw } from "./packages/exchange-script/binance.js";
import { withdraw as okxWithdraw } from "./packages/exchange-script/okx.js";

// binance转账
// 参数：{ account, chain, toAddress, coin, amount, apiFile='./backend/data/binance.json' }
await binanceWithdraw({ account:'你的binance交易所账户，跟api文件里要对应', chain:'optimism', toAddress:'接收地址', coin:'usdt', amount:5 });

// okx转账
// 参数：{ account, chain, toAddress, coin, amount, apiFile='./backend/data/okx.json' }
await okxWithdraw({ account:'你的okx交易所账户，跟api文件里要对应', chain:'optimism', toAddress:'接收地址', coin:'usdt', amount:5 });

```