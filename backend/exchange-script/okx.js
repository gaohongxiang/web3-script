import fs from 'fs';
import ccxt from 'ccxt';
import { deCryptText } from '../crypt-module/crypt.js';

/**
 * 根据输入的链名称返回标准化的链名称。
 * 支持的链名称包括 ETH/ERC20, TRC/TRC20, POLYGON/MATIC 等，
 * 如果输入的链名称不被支持，则抛出错误。
 * 
 * @param {string} chain - 输入的链名称。
 * @returns {string} 标准化后的链名称。
 */
function normalizeChain(chain) {
    const upperChain = chain.toUpperCase(); // 将输入转换为大写以忽略大小写差异

    // 检查输入的链名称是否属于已知的链名称，并返回相应的标准化名称
    if (['ETH', 'ERC20'].includes(upperChain)) {
        return 'ERC20';
    } else if (['TRC', 'TRC20'].includes(upperChain)) {
        return 'TRC20';
    } else if (['POLYGON', 'MATIC'].includes(upperChain)) {
        return 'Polygon';
    } else if (['AVAL', 'AVALANCHE'].includes(upperChain)) {
        return 'Avalanche C-Chain';
    } else if (['ARB', 'ARBITRUM', 'ARBITRUM ONE'].includes(upperChain)) {
        return 'Arbitrum One';
    } else if (['OP', 'OPTIMISM'].includes(upperChain)) {
        return 'Optimism';
    } else if (['ZKS', 'ZKSYNC', 'ERA'].includes(upperChain)) {
        return 'zkSync Era';
    }else if (['STK', 'STARKNET', 'STRK'].includes(upperChain)) {
        return 'Starknet';
    }else if (['SOL', 'SOLANA'].includes(upperChain)) {
        return 'Solana';
    }else if (['LINEA'].includes(upperChain)) {
        return 'Linea';
    }else if (['BASE'].includes(upperChain)) {
        return 'Base';
    }else if (['SUI'].includes(upperChain)) {
            return 'Sui';
    }else {
        // 如果输入的链名称不被支持，抛出错误
        throw new Error(`${chain} 链不支持，请重新选择`);
    }
}

/**
 * 创建并配置一个交易所实例。
 * @param {Object} params - 创建交易所的参数对象（必填）。
 * @param {string} params.account - 要使用的账户名称，用于选择正确的API密钥。（必填）。
 * @param {string} [params.apiFile='./backend/data/binance.json'] - 存储账户信息的 JSON 文件路径，默认为 './backend/data/okx.json'。
 * @returns {Promise<Object>} - 返回一个 Promise，解析为配置好的 Binance 交易所实例。
 */
async function createExchange({ account, apiFile='./backend/data/okx.json' }) {

    // 异步读取文件并解析JSON
    const accountApis = JSON.parse(fs.readFileSync(apiFile, 'utf-8'));
    const proxys = accountApis[account]['main']['apiProxy']
    const randomproxy = proxys[Math.floor(Math.random() * proxys.length)];
    // 创建并配置okx交易所实例
    const okx = new ccxt.okx({
        'apiKey': await deCryptText(accountApis[account]['main']['apiKey']),
        'secret': await deCryptText(accountApis[account]['main']['apiSecret']),
        'password': await deCryptText(accountApis[account]['main']['apiPassword']),
        'enableRateLimit': true, // 启用请求速率限制
        'options': { 'adjustForTimeDifference': true }, // 自动调整时间戳以适应本地计算机的时区差异
        'socksProxy': randomproxy, // 使用提供的代理
    });

    return okx;
}

/**
 * 提现函数，从指定账户提取加密货币到指定地址。
 * 
 * 该函数使用 Binance API 从用户的账户中提取指定数量的加密货币到目标地址。
 * 
 * @param {Object} params - 提取参数对象（必填）。
 * @param {string} params.account - 要使用的账户名称。
 * @param {string} params.chain - 提取的区块链类型，例如 'BTC'、'ETH' 等。
 * @param {string} params.toAddress - 提取的目标地址。
 * @param {string} params.coin - 要提取的加密货币类型，例如 'BTC'、'ETH' 等。
 * @param {number} params.amount - 要提取的数量。
 * @param {string} [apiFile='./backend/data/binance.json'] - 存储账户信息的 JSON 文件路径，默认为 './backend/data/okx.json'。
 * @returns {Promise<Object>} - 返回一个 Promise，解析为提取操作的结果。
 */
export async function withdraw({ account, chain, toAddress, coin, amount, apiFile='./backend/data/okx.json' }) {

    try {
        const okx = await createExchange({ account, apiFile })
        coin = coin.toUpperCase()
        amount = parseFloat(amount);
        chain = normalizeChain(chain)
        // console.log(chain);
        const allBalance = await okx.fetchBalance({"type": "funding"}) // funding 表示资金账户
        // console.log(allBalance)
        const coinBalance = allBalance[coin]?.free || 0.0;
        // console.log(typeof(coinBalance))
        console.log(`账户 ${account} 现有 ${coinBalance} ${coin}`);

        let addressType, coinTransactionFeeOfChain;

        //内部先不要用，直接手动转吧
        if (toAddress.includes('@')) {
            addressType = '内部地址';
            // 假设内部地址以邮箱形式给出，获取存款地址并设置手续费为0
            const depositAddress = await okx.fetchDepositAddress(coin);
            // console.log(depositAddress)
            toAddress = depositAddress.address;
            // console.log(address)
            coinTransactionFeeOfChain = 0.0;
            
        } else {
            addressType = '外部地址';
            // 获取提币手续费
            const referenceCurrencies = await okx.privateGetAssetCurrencies({ ccy: coin });
            // console.log(referenceCurrencies)
            const currencyData = referenceCurrencies['data'].find(data => data.chain === `${coin}-${chain}`);
            if (currencyData) {
                coinTransactionFeeOfChain = parseFloat(currencyData.minFee);
                // 提币精度（如果需要）withdrawPrecision = parseInt(currencyData.wdTickSz);
                console.log(`${chain} 链转账 ${coin} 到外部地址 ${toAddress} 手续费为 ${coinTransactionFeeOfChain} ${coin}`);
            }else{
                throw new Error('获取手续费失败，请检查链名称或币名称是否正确.')
            }
        }

        if (amount + coinTransactionFeeOfChain > coinBalance) {
            console.log('提现金额超出余额，请先充值或者减少提现数量');
            return;
        }
        
        // 执行提现操作
        await okx.withdraw(coin, amount, toAddress, undefined, {
            password:'', //提现funding密码，没有，留空
            network: chain,
            fee: coinTransactionFeeOfChain,//手续费从转出方扣除
            transactionFeeFlag: true //提现到内部地址，免手续费，transactionFeeFlag设置为true手续费归资金接收方; 设置为false手续费归资金转出方. 默认false,设置为true可以将转出方提干净
        });

        console.log(`账户 ${account} 通过 ${chain} 链 提现 ${amount} ${coin} 到 ${addressType} ${toAddress} 请求已提交，等待确认。手续费为 ${coinTransactionFeeOfChain} ${coin}`);
    } catch (error) {
        console.error(`提现错误: ${error}`);
    }
}