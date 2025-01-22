# 交易所脚本

## api注意事项

- api权限，一般需要允许现货和杠杆交易，允许提现（根据自己需求增删权限）
- 添加ip地址白名单，只允许白名单里的ip访问api
- okx/bybit提现需要把提现地址添加进免验证提币地址白名单里才可以(不能通过api添加)
    - okx举例：EVM地址可以使用okx提供的模版批量上传，一次最多50
        - evm地址可以设置成：EVM地址、EVM币种、永久有效期
        - sol地址可以设置成：通用地址、solana网络、永久有效期

## 文件示例

交易所api文件（敏感数据加密，加密方法详见crypt-module模块）
```
{
    "币安/bybit api示例账户":{
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


## 使用示例

- 提现多少金额到账多少金额，手续费从发送方扣除
- binance只支持通过 充值地址 提现到内部账户（api不能传递uid邮箱等，需要对方的充值地址，输入充值地址api会自动判断为内部地址）
- ok支持只通过 邮箱 提现到内部地址（api支持邮箱、手机号。手机号还需要多一个手机区号参数，我没写这种方式）
- bybit只支持通过 uid 提现到内部地址(api只支持uid)
- 不支持带标签（tag?memo?comment?）的地址提现
- 没有提现的链可自行添加。只测试了用的最多的EVM系和solana系，其他链可自行测试。
- 先小额测试，没问题再大额提现。

```
import { withdraw as binanceWithdraw } from "./binance.js";
import { withdraw as okxWithdraw } from "./okx.js";
import { withdraw as bybitWithdraw } from "./bybit.js";

// binance转账
// 参数：{ account, chain, toAddress, coin, amount, apiFile='./data/exchange/binance.json' }
await binanceWithdraw({
    account: '你的binance交易所账户，跟api文件里要对应',
    chain: 'optimism',
    toAddress: '接收地址',
    coin: 'usdt',
    amount: 5,
    apiFile: './data/exchange/binance.json'
})

// okx转账
// 参数：{ account, chain, toAddress, coin, amount, withdrawType = 'out', apiFile = './data/exchange/okx.json' }
await okxWithdraw({ 
    account: '你的okx交易所账户，跟api文件里要对应',
    chain: 'optimism',
    toAddress: '接收地址',
    coin: 'usdt',
    amount: 5,
    withdrawType: 'out',
    apiFile: './data/exchange/okx.json'
})

// bybit转账
// 参数：{ account, chain, toAddress, coin, amount, withdrawType = 'out', apiFile = './data/exchange/bybit.json' }
await bybitWithdraw({
    account: '你的okx交易所账户，跟api文件里要对应',
    chain: 'optimism',
    toAddress:'接收地址',
    coin: 'usdt',
    amount: 5,
    withdrawType: 'out',
    apiFile: './data/exchange/bybit.json'
})
```

### 官方文档
- ccxt：https://docs.ccxt.com/#/
- ccxt中文文档：https://www.wuzao.com/document/ccxt/
- 币安api：https://developers.binance.com/docs/zh-CN/wallet/capital/withdraw
- 欧意api：https://www.okx.com/docs-v5/zh/#overview
- Bybit api：https://bybit-exchange.github.io/docs/zh-TW/api-explorer/v5/category

获取币种信息：
- 币安：https://developers.binance.com/docs/zh-CN/wallet/capital
- 欧意：https://www.okx.com/docs-v5/zh/#funding-account-rest-api-get-currencies
- Bybit：https://bybit-exchange.github.io/docs/zh-TW/v5/asset/coin-info

提现：
- 币安：https://developers.binance.com/docs/zh-CN/wallet/capital/withdraw
- 欧意：https://www.okx.com/docs-v5/zh/#funding-account-rest-api-withdrawal
- Bybit：https://bybit-exchange.github.io/docs/zh-TW/v5/asset/withdraw

