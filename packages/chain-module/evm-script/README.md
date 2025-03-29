# EVM链交互脚本

## 注意事项
- 本脚本支持多个RPC提供商（Infura、Alchemy、公共节点等），私有节点需要在.env文件中配置相应的API密钥
- 创建钱包文件，并加密私钥、助记词数据
- erc20代币信息存储在`./data/token.json`文件,需要的token信息可自行添加

## 使用示例

```js
import { evmClient } from "./index.js";

// 创建客户端实例（支持自定义链配置）
// 方式1: 使用现有的链和现有RPC提供商
const client = await evmClient.create({ 
  chain: 'eth',                        // 链名称，支持多种别名，如'eth'/'ethereum'/'erc20'
  rpcProvider: 'infura',               // RPC提供商名称，可选值：infura、alchemy、public等（取决于链支持）
  enPrivateKey: '加密私钥',             // 通过加密模块加密过的私钥
  socksProxyUrl: null,                 // 可选，代理URL，默认null
  tokenFile: './data/token.json'       // 可选，代币信息文件，存储代币address、abi、decimals等，默认'./data/token.json'。根据你的数据文件位置改
});

// 方式2: 使用现有的链和自定义RPC（可以不传nativeToken）
const client = await evmClient.create({
  chain: 'eth',
  customChainOptions: {
    rpc: 'https://your-custom-rpc-url.com',  // 自定义RPC URL，优先级高于rpcProvider
  }
  ...
});

// 方式3: 使用自定义链和自定义RPC
const client = await evmClient.create({
  chain: 'custom_chain_name',               // 自定义链名称
  customChainOptions: {
    rpc: 'https://your-custom-rpc-url.com', // 使用自定义链时必须提供自定义RPC
    nativeToken: 'token'                    // 使用自定义链时必须提供原生token
  }
  ...
});



// 获取地址余额
const balance = await client.getBalance({ 
  address: '0x...',           // 要查询的地址
  token: 'ETH'               // 代币名称，如 ETH/USDT/WETH 等
});

// 发送代币
const txHash = await client.transfer({ 
  toAddress: '0x...',        // 接收地址
  token: 'ETH',              // 代币名称，如 ETH/USDT/WETH 等
  value: 0.1,                // 转账数量(数字类型)
  gasOptions: {              // [可选] gas设置
    multiplier: 1.1,         // gas价格乘数，用于加速交易
    useEIP1559: true         // 是否使用EIP-1559交易类型
  }
});

// 授权代币
await client.checkAndApproveToken({
  token: 'USDT',             // 代币名称，如 USDT/WETH 等（ETH无需授权）
  amount: 100,               // 交易金额(数字类型)
  permit2Amount: 1000,       // [可选] 授权给permit2的金额，应大于amount
  targetContract: '0x...',   // 目标合约地址
  gasOptions: {              // [可选] gas设置
    multiplier: 1.1,         // gas价格乘数，用于加速交易
    useEIP1559: true         // 是否使用EIP-1559交易类型
  }
});

// 监听代币转账
const contract = await client.listenContract({ 
  listenAddress: '0x...',    // 要监听的地址
  listenToken: 'USDT',       // 要监听的代币名称
  direction: 'in'            // 监听方向：'in'=转入，'out'=转出
});
```

### uniswap V3 通用路由兑换代币示例
```js
import { tradeClient } from "./trade.js";

// 创建客户端实例
const trade = await tradeClient.create({ 
  chain: 'eth',                        // 链名称
  rpcProvider: 'infura',               // RPC提供商名称，可选值：infura、alchemy、public(公共节点）)
  enPrivateKey: '加密私钥',             // 通过加密模块加密过的私钥
  socksProxyUrl: null,                 // 可选，代理URL，默认null
  tokenFile: './data/token.json'       // 可选，代币信息文件，存储代币address、abi、decimals等，默认'./data/token.json'。根据你的数据文件位置改
});

// 执行代币兑换（暂不支持原生代币与包装代币互换，因为直接用WETH合约就行了，不走uniswap路由）
const tx = await trade.uniswapUniversalRouterV3Swap({
  tokenIn: 'ETH',           // 输入代币名称，如 ETH/USDT/WETH 等
  tokenOut: 'USDT',         // 输出代币名称，如 ETH/USDT/WETH 等
  amountIn: 0.1,            // 输入金额(数字类型，使用代币精度单位)
  permit2AllowanceAmount: 1, // [可选] 授权给permit2的金额，应 >= amountIn
  slippage: 0.5,            // [可选] 滑点百分比，默认0.5%
  permitDeadline: 10,       // [可选] 授权过期时间(分钟)，默认10分钟
  gasOptions: {             // [可选] gas设置
    multiplier: 1.1,        // gas价格乘数，用于加速交易
    useEIP1559: true        // 是否使用EIP-1559交易类型
  }
});
```

uniswap通用路由的写法比较灵活，但是需要自己组装命令，用到permit2签名。

>路径：代币授权给permit2合约 -> permit2签名后将代币转移给路由合约 -> 组装命令 -> 路由合约执行兑换交易
      
理论上代币可以无限授权给permit2合约，然后每次permit2合约签名（有作用域、有有效期）后将代币转移给路由合约，因为签名不需要上链，所以就省了一笔gas费。但是正因为签名不上链，有些无感，如果被骗permit2签名，那么签名的资金就会被盗。所以最好代币不要无限授权给permit2合约，可以设置一个相对够用的量，这些量内只需要一笔gas就可以完成交易，相对也安全。兼顾效率和安全。

如有报错无法找到原因可以去`https://dashboard.tenderly.co/explorer/simulations`模拟交易，需要路由地址+交易数据（错误信息里有）。Tenderly是一个专门面向Web3开发者的开发、监控和测试平台。

Uniswap各个SDK的主要作用
- sdk-core：最基础的SDK，提供核心功能。包含Token、Price、Route等基础类，其他SDK都依赖于这个核心SDK
- v2-sdk：Uniswap V2协议的SDK。处理V2的配对交易、流动性添加/移除等，适用于想使用V2协议的开发者
- v3-sdk：Uniswap V3协议的SDK。处理V3的集中流动性、多费率池等特性，提供更复杂的定价和流动性管理功能
- v4-sdk：Uniswap V4协议的SDK（新版本）。处理V4的新特性，目前还在开发中
- permit2-sdk：处理代币授权的SDK。实现EIP-2612标准的permit功能，允许用户用签名而不是交易来授权代币
- universal-router-sdk：统一的路由SDK。可以同时处理V2、V3的交易，支持跨协议的最优路径查找

参考
- uniswap在各链部署的合约：https://docs.uniswap.org/contracts/v3/reference/deployments/
- uniswap通用路由各命令：https://docs.uniswap.org/contracts/universal-router/technical-reference#transfer
- permit2文档：https://docs.uniswap.org/contracts/permit2/overview
- uniswap报价：https://docs.uniswap.org/sdk/v3/guides/swaps/quoting、https://github.com/Uniswap/examples/blob/main/v3-sdk/quoting/src/libs/quote.ts
- uniswapV3单路径交易示例：https://docs.uniswap.org/contracts/v3/guides/swaps/single-swaps、https://www.quicknode.com/guides/defi/dexs/how-to-swap-tokens-on-uniswap-v3
- uniswap各sdk：https://docs.uniswap.org/sdk/v3/guides/web3-development-basics#the-uniswap-development-suite
- 参考示例：
  - https://github.com/saad-s/uniswap-uni-router-permit2/blob/main/src/index.js
  - https://github.com/Uniswap/universal-router/blob/main/test/integration-tests/UniversalRouter.test.ts
  - https://github.com/0xMaka/w3py/blob/main/uniswapv3/v3exactOutput.py
  - https://github.com/CodeWithJoe2020/UniswapUniversalRouter/blob/main/sell_token_ur.py

WTF-Ethers教程
- https://github.com/WTFAcademy/WTF-Ethers

调试网站
- https://dashboard.tenderly.co/

