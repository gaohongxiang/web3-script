import fs from 'fs';
import dns from 'dns';
import ccxt from 'ccxt';
import { deCryptText } from '../crypt-module/crypt.js';

// 奇怪，这里要强制 Node.js 使用 IPv4，才能跑通请求。为啥默认是 IPv6？之前使用也没出现这个问题。先这么解决，后续再研究。
dns.setDefaultResultOrder('ipv4first');  // 优先使用 IPv4

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
    } else if (['BSC', 'BNB'].includes(upperChain)) {
        return 'BSC';
    } else if (['APT', 'APTOS'].includes(upperChain)) {
        return 'Aptos';
    } else if (['AVAL', 'AVALANCHE', 'AVAX'].includes(upperChain)) {
        return 'Avalanche C-Chain';
    } else if (['ARB', 'ARBITRUM', 'ARBITRUM ONE'].includes(upperChain)) {
        return 'Arbitrum One';
    } else if (['OP', 'OPTIMISM'].includes(upperChain)) {
        return 'Optimism';
    } else if (['ZKS', 'ZKSYNC', 'ERA'].includes(upperChain)) {
        return 'zkSync Era';
    } else if (['STK', 'STARKNET', 'STRK'].includes(upperChain)) {
        return 'Starknet';
    } else if (['SOL', 'SOLANA'].includes(upperChain)) {
        return 'Solana';
    } else if (['LINEA'].includes(upperChain)) {
        return 'Linea';
    } else if (['BASE'].includes(upperChain)) {
        return 'Base';
    } else if (['SUI'].includes(upperChain)) {
        return 'Sui';
    } else {
        // 如果输入的链名称不被支持，抛出错误
        throw new Error(`${chain} 链不支持，请重新选择`);
    }
}

/**
 * 创建并配置一个交易所实例。
 * @param {Object} params - 创建交易所的参数对象（必填）。
 * @param {string} params.account - 要使用的账户名称，用于选择正确的API密钥（必填）。
 * @param {string} [params.apiFile='./data/exchange/okx.json'] - 存储账户信息的 JSON 文件路径。
 * @returns {Promise<Object>} - 返回一个 Promise，解析为配置好的 OKX 交易所实例。
 * @throws {Error} 当读取API文件失败、API密钥解密失败或创建实例失败时抛出错误。
 */
async function createExchange({ account, apiFile = './data/exchange/okx.json' }) {

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
 * @param {Object} params - 提取参数对象（必填）。
 * @param {string} params.account - 要使用的账户名称。
 * @param {string} params.chain - 提取的区块链类型，如 'ETH'、'BSC' 等。
 * @param {string} params.toAddress - 提取的目标地址。如果 withdrawType 为 'in'，必须是邮箱地址。
 * @param {string} params.coin - 要提取的加密货币类型，如 'BTC'、'ETH' 等。
 * @param {number} params.amount - 要提取的数量。
 * @param {'in'|'out'} [params.withdrawType='out'] - 提现类型。'in' 表示内部转账，'out' 表示链上提现。
 * @param {string} [params.apiFile='./data/exchange/okx.json'] - 存储账户信息的 JSON 文件路径。
 * 
 * @returns {Promise<void>} - 提现操作不返回值，但会在控制台输出操作结果。
 * 
 * @throws {Error} 在以下情况会抛出错误：
 * - 链名称不支持
 * - 提现类型不正确
 * - 内部转账地址格式错误
 * - 余额不足
 * - 提现金额小于最小提现额度
 * - API 调用失败
 */
export async function withdraw({ account, chain, toAddress, coin, amount, withdrawType = 'out', apiFile = './data/exchange/okx.json' }) {

    try {
        coin = coin.toUpperCase()
        amount = parseFloat(amount);
        chain = normalizeChain(chain)
        let dest, handlingFee, coinBalance, outMinWithdrawAmount, inMinWithdrawAmount; // dest=3代表内部地址，4代表外部地址
        // 无需请求api的基本判断放在前面
        if (!['in', 'out'].includes(withdrawType)) { console.log('withdrawType 只能是 "in" 或 "out"'); return; }
        if (withdrawType === 'in' && !toAddress.includes('@')) { console.log('内部地址仅支持邮箱地址'); return; }
        if (withdrawType === 'out' && toAddress.includes('@')) { console.log('外部地址输入有误，请检查地址是否正确'); return; }

        const okx = await createExchange({ account, apiFile })

        try { // 获取余额
            const allBalance = await okx.fetchBalance({ "type": "funding" }) // funding 表示资金账户
            // console.log(allBalance)
            coinBalance = allBalance[coin]?.free || 0.0;
            // console.log(typeof(coinBalance))
            console.log(`${account} 资金账户现有 ${coinBalance} ${coin}`);
        } catch (error) {
            console.log('获取余额失败，请检查账户是否正确.', error)
            return;
        }

        try { // 获取币种信息
            const currencyInfo = await okx.privateGetAssetCurrencies({ ccy: coin });
            // console.log(currencyInfo['data'])
            const currencyData = currencyInfo['data'].find(data => data.chain === `${coin}-${chain}`);
            // console.log(currencyData)
            handlingFee = parseFloat(currencyData.minFee);
            outMinWithdrawAmount = parseFloat(currencyData.minWd);
            inMinWithdrawAmount = parseFloat(currencyData.minInternal);
            // 提币精度（如果需要）withdrawPrecision = parseInt(currencyData.wdTickSz);
        } catch (error) {
            console.log('获取币种信息失败，请检查链名称或币名称是否正确.', error)
            return;
        }

        if (withdrawType === 'out') {
            if (amount < outMinWithdrawAmount) {
                console.log(`${chain} 链转账 ${coin} 到外部地址 ${toAddress} 最小提现数量为 ${outMinWithdrawAmount} ${coin}`);
                return;
            }
            dest = 4;
            console.log(`${chain} 链转账 ${coin} 到外部地址 ${toAddress} 手续费为 ${handlingFee} ${coin}`);
        } else if (withdrawType === 'in') {
            if (amount < inMinWithdrawAmount) {
                console.log(`${chain} 链转账 ${coin} 到内部地址 ${toAddress} 最小提现数量为 ${inMinWithdrawAmount} ${coin}`);
                return;
            }
            dest = 3;
            handlingFee = 0;
            console.log(`${chain} 链转账 ${coin} 到内部地址 ${toAddress} 手续费为 ${handlingFee} ${coin}`);
        };

        if (amount + handlingFee > coinBalance) {
            console.log('提现金额超出余额，请先充值或者减少提现数量');
            return;
        }

        // 执行提现操作
        await okx.withdraw(coin, amount, toAddress, undefined, {
            dest, // 3代表内部地址，4代表外部地址
            network: chain,
            fee: handlingFee,
            password: '', //提现funding密码，没有，留空
        });
        console.log(`账户 ${account} 通过 ${chain} 链 提现 ${amount} ${coin} 到地址 ${toAddress} 请求已提交，等待确认。手续费为 ${handlingFee} ${coin}`);
    } catch (error) {
        console.error(`提现错误: ${error}`);
    }
}