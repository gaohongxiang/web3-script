出处：https://x.com/web3luo/status/1944718336723673447

# 🎯 Yala NFT 抢打复盘 - 从0到1的技术分析

---

## 🔍 前期侦察

已知信息很少：

- 网站：https://claimnft.yala.org/
- 时间：2025/7/14 18:00

在开打前半小时就把网站打开，F12 准备分析。

---

## 💡 分析思路

### 方法一：时间穿越（失败）

最开始尝试修改电脑时间到 18:00，看能不能提前触发 mint，结果失败了。这招在很多项目上有时能用，但这次不行。

### 方法二：源码挖掘

直接 F12 打开 Sources 面板，用以下关键词搜索（option+command+F 全局搜索）：

- `claim`
- `mint`
- `transfer`
- `"0x`

用 `"0x` 搜到了合约地址：

`0x89216d5C5EDEb318f298c536f0b1EB691aFf1d83`

0x开头的有很多，发现有NFT_TOKEN，我们就是关于nft的，点进去看到有很多合约地址，根据经验YETI_SEASON_0这个字段有‘赛季’字样，大概率就是这次的合约地址。

![yala项目逆向_查找合约](https://raw.githubusercontent.com/gaohongxiang/images/master/编程/blockchain/yala项目逆向_查找合约.png)

```json
prod: {
    NEXT_PUBLIC_ENV: "prod",
    NEXT_PUBLIC_BACKEND_API: "https://api.yala.org",
    SWAP_LP_TOKEN_HREF: "https://app.uniswap.org/add/v2/0xbbd3edd4d3b519c0d14965d9311185cfac8c3220/0xcb856bc5aa2664e47c9cadce6ff65117c5201a1c",
    NFT_HERF: "https://testnets.opensea.io/collection/dddd-53",
    NFT_TOKEN: "0x8bbCB1216863c810C52b2ad7346b496088658474",
    NFT_STAKE: "0x6AE371DDde3A74a74b401741c6e8eCE1dD8BABDB",
    YETI: "0xe9C6Ab2095ddA22718D970Ec72c7FE96d9AAeb42",
    YETI_SEASON_0: "0x89216d5C5EDEb318f298c536f0b1EB691aFf1d83",
    BUY_YU_HREF: "https://app.uniswap.org/explore/pools/ethereum/0xB7DD85fE94686A9b5CA04fBc49E0CCc2746D50a2",
}
```

根据以上信息得到两个有用信息
- api请求地址：https://api.yala.org
- mint nft合约地址：0x89216d5C5EDEb318f298c536f0b1EB691aFf1d83
---

## 🔗 合约分析

打开 etherscan 查看该地址，发现没有开源。
https://etherscan.io/address/0x89216d5C5EDEb318f298c536f0b1EB691aFf1d83#code

继续查找

prod结构附近多找找，发现了testInner结构，跟prod基本一致，只是这是测试网的，项目上线前肯定会先测试，那么这个YETI_SEASON_0字段的地址就是测试网的mint合约地址

```json
testInner: {
    NEXT_PUBLIC_ENV: "testInner",
    NEXT_PUBLIC_BACKEND_API: "https://2ejpnc8qpxbc5k6f4fd6b5msbd-test3.yala.org",
    SWAP_LP_TOKEN_HREF: "https://app.uniswap.org/add/v2/0xbca305303d79c0e3217e4045cd3cbe40e8f734c5/0x536bfc2f68f0ff18379d36a09998f7b7d5986039",
    NFT_HERF: "https://testnets.opensea.io/collection/dddd-53",
    NFT_TOKEN: "0x3ABCf9F585EcD3C951184CBd0678926fFa5Ea56B",
    NFT_STAKE: "0x25B69AEF51f36F9205d5719aaDd302c52E3b98f9",
    YETI: "0xaD6783ab20d739850A48DE15c808c8e92E8ABa25",
    YETI_SEASON_0: "0xc0989F6974967E65E88b50B63A3c151D8537D211",
    BUY_YU_HREF: "https://app.uniswap.org/swap?chain=mainnet&inputCurrency=0xdac17f958d2ee523a2206206994597c13d831ec7&outputCurrency=0xF0f05968D1609aE869Cda4C8A3aEdf4CC5E7E995",
}
```
去测试网浏览器查看合约情况，发现测试网合约已经开源！
https://sepolia.etherscan.io/address/0xc0989F6974967E65E88b50B63A3c151D8537D211

从测试网合约看到调用的函数是 `claim`，有两个参数：

- `signature`
- `signedTimestamp`

老司机都知道，这类参数类似白名单机制，一般从 API 返回。

---

## 🎯 现在线索齐了

- 合约：`0x89216d5C5EDEb318f298c536f0b1EB691aFf1d83`
- 函数：`claim`
- 参数：`signature` + `signedTimestamp`（从 API 获取）

---

## 🔎 寻找 API

找参数的方法有很多：

- 搜 `.claim(`
- 搜 `signature`
- 找 API URL

还是在Sources 面板里全局搜索 api/，发现有好几个api
- /api/account/challenge
- /api/account/login
- /api/sign/proof

![yala项目逆向_查找api](https://raw.githubusercontent.com/gaohongxiang/images/master/编程/blockchain/yala项目逆向_查找api.png)
---

## 🔐 登录机制

这个 API 需要登录 token，登录流程如下：

1. `POST /api/account/challenge` - 获取挑战
![yala项目逆向_challenge](https://raw.githubusercontent.com/gaohongxiang/images/master/编程/blockchain/yala项目逆向_challenge.png)

参数很简单就是钱包地址和chainid，返回`hmac`、`expires`、`tips`

2. `POST /api/account/login` - 登录获取 token
![yala项目逆向_login](https://raw.githubusercontent.com/gaohongxiang/images/master/编程/blockchain/yala项目逆向_login.png)

参数就是钱包地址、chain、上一步获得的`hmac`、`expires`，还有一个signature，这个signature是根据`tips`的钱包签名。返回的`tokenAccess`就是访问api必须用的token。

登录成功后，使用postman调用 proof 接口，能完美返回需要的两个参数！

![yala项目逆向_proof](https://raw.githubusercontent.com/gaohongxiang/images/master/编程/blockchain/yala项目逆向_proof.png)

> 注意：18 点前接口返回：
> 
> ```json
> {"code": 2200, "msg": "Not started yet"}
> ```
> 
> 说明时间控制就在这个接口。

---

## 💻 技术实现

现在逻辑闭环了：

1. 登录获取 token
2. 调用 proof API 拿参数
3. 合约调用 claim 函数

---

## ⚡ 实战

时间到直接开冲，多给点 gas 确保成功。

---

## 📚 总结

本次主要用到的技巧：

- F12 源码搜索关键词
- 测试网合约分析
- API 逆向工程
- 多线程 + 代理池

每个项目都不一样，没有固定套路，主要靠思路和经验。
