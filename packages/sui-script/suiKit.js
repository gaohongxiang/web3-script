import fs from 'fs';
import { SuiKit } from '@scallop-io/sui-kit';
import { deCryptText } from '../crypt-module/crypt.js';

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


function getTokenInfo(token = 'SUI', tokenFile = './data/token.json') {
  try {
    token = token.toUpperCase();
    const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    const tokenInfo = data['sui'][token];
    const coinType = tokenInfo.coinType;
    const coinDecimals = tokenInfo.decimals;
    return { coinType, coinDecimals };
  } catch {
    console.log(`错误: ${token} 代币信息 在 sui 网络中不存在，请先添加。`);
    return;
  }
}

export async function getBalance({ enPrivateKey, token = "SUI", tokenFile = './data/token.json' }) {
  try {
    token = token.toUpperCase();
    const secretKey = await deCryptText(enPrivateKey);
    const suiKit = new SuiKit({ secretKey, fullnodeUrls: rpc });

    const tokenInfo = getTokenInfo(token, tokenFile);
    if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
    const { coinType, coinDecimals } = tokenInfo;
    const address = await suiKit.getAddress(secretKey);

    const response = await suiKit.getBalance(coinType, secretKey);
    const balance = response.totalBalance / 10 ** coinDecimals;
    const coinObjectCount = response.coinObjectCount;
    console.log(`地址 ${address} ${token} 余额: ${balance}, 包含 ${coinObjectCount} 个对象。`);
  } catch (error) { console.log(error); }
}

export async function transfer({ enPrivateKey, toData, token = "SUI", tokenFile = './data/token.json' }) {
  try {
    token = token.toUpperCase();
    const secretKey = await deCryptText(enPrivateKey);
    const suiKit = new SuiKit({ secretKey, fullnodeUrls: rpc });

    const tokenInfo = getTokenInfo(token, tokenFile);
    if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
    const { coinType, coinDecimals } = tokenInfo;

    // 分解成两个数组
    const addresses = toData.map(item => item[0]); // 提取地址
    let amounts = toData.map(item => item[1]);   // 提取数量
    amounts = amounts.map(amount => amount * 10 ** coinDecimals);

    if (token === "SUI") {
      await suiKit.transferSuiToMany(addresses, amounts);
      console.log('交易成功');
    } else {
      await suiKit.transferCoinToMany(addresses, amounts, coinType);
      console.log('交易成功');
    }
  } catch (error) { console.log(error); }
}