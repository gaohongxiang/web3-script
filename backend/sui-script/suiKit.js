import { SuiKit } from '@scallop-io/sui-kit';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { deCryptText } from '../crypt-module/crypt.js';
import { getTokenInfo } from '../utils-module/utils.js';

const rpc = [
  'https://fullnode.mainnet.sui.io:443',
  'https://mainnet.suiet.app',
  'https://rpc-mainnet.suiscan.xyz',
  'https://mainnet.sui.rpcpool.com',
  'https://sui-mainnet.nodeinfra.com',
  'https://mainnet-rpc.sui.chainbase.online',
  'https://sui-mainnet-ca-1.cosmostation.io',
  'https://sui-mainnet-ca-2.cosmostation.io',
  'https://sui-mainnet-us-1.cosmostation.io',
  'https://sui-mainnet-us-2.cosmostation.io',
]

export async function getBalance({ address, token = 'SUI', tokenFile = './backend/data/token.json' }) {
  try {
    token = token.toUpperCase();
    const tokenInfo = getTokenInfo({ token, chain: 'sui', tokenFile });
    if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
    const { coinType, decimals: coinDecimals } = tokenInfo;
    const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
    const response = await client.getBalance({ owner: address, coinType });
    const balance = response.totalBalance / 10 ** coinDecimals;
    const coinObjectCount = response.coinObjectCount;
    console.log(`地址 ${address} ${token} 余额: ${balance}, 包含 ${coinObjectCount} 个对象。`);
    return balance;
  } catch (error) { throw error; }
}

// // suiKit库查询余额用的是私钥，不太方便。该用官方库实现方式
// export async function getBalance({ enPrivateKey, token = "SUI", tokenFile = './backend/data/token.json' }) {
//   try {
//     token = token.toUpperCase();
//     const secretKey = await deCryptText(enPrivateKey);
//     const suiKit = new SuiKit({ secretKey, fullnodeUrls: rpc });

//     const tokenInfo = getTokenInfo({token, chain:'sui', tokenFile});
//     if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
//     const { coinType, decimals: coinDecimals } = tokenInfo;
//     const address = await suiKit.getAddress(secretKey);

//     const response = await suiKit.getBalance(coinType, secretKey);
//     const balance = response.totalBalance / 10 ** coinDecimals;
//     const coinObjectCount = response.coinObjectCount;
//     console.log(`地址 ${address} ${token} 余额: ${balance}, 包含 ${coinObjectCount} 个对象。`);
//   } catch (error) { throw error; }
// }

export async function transfer({ enPrivateKey, toData, token = "SUI", tokenFile = './backend/data/token.json' }) {
  try {
    token = token.toUpperCase();
    const tokenInfo = getTokenInfo({ token, chain: 'sui', tokenFile });
    if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
    const { coinType, decimals: coinDecimals } = tokenInfo;

    // 分解成两个数组
    const addresses = toData.map(item => item[0]); // 提取地址
    let amounts = toData.map(item => item[1]);   // 提取数量
    amounts = amounts.map(amount => amount * 10 ** coinDecimals);

    const secretKey = await deCryptText(enPrivateKey);
    const suiKit = new SuiKit({ secretKey, fullnodeUrls: rpc });

    if (token === "SUI") {
      const response = await suiKit.transferSuiToMany(addresses, amounts);
      console.log(`交易成功, 交易哈希: ${response.digest}`);
    } else {
      const response = await suiKit.transferCoinToMany(addresses, amounts, coinType);
      console.log(`交易成功, 交易哈希: ${response.digest}`);
    }
  } catch (error) { throw error; }
}
