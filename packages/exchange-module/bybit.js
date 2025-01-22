import fs from 'fs';
import ccxt from 'ccxt';
import { deCryptText } from '../crypt-module/crypt.js';

/**
 * 根据输入的链名称返回标准化的链名称。
 * 支持的链名称包括 ETH/ERC20, TRC/TRC20, POLYGON/MATIC, BSC, AVAX 等，
 * 如果输入的链名称不被支持，则抛出错误。
 * 
 * @param {string} chain - 输入的链名称。
 * @returns {string} 标准化后的链名称。
 * @throws {Error} 当输入的链名称不被支持时抛出错误。
 * 
 * @example
 * normalizeChain('ETH') // 返回 'ETH'
 * normalizeChain('BSC') // 返回 'BSC'
 * normalizeChain('MATIC') // 返回 'MATIC'
 */
function normalizeChain(chain) {
    const upperChain = chain.toUpperCase();

    if (['ETH', 'ERC20', 'ETH MAINNET', 'ETHEREUM'].includes(upperChain)) {
        return 'ETH';
    } else if (['TRC', 'TRC20'].includes(upperChain)) {
        return 'TRX';
    } else if (['POLYGON', 'MATIC'].includes(upperChain)) {
        return 'MATIC';
    } else if (['AVAL', 'AVALANCHE', 'AVAX'].includes(upperChain)) {
        return 'CAVAX';
    } else if (['ARB', 'ARBITRUM', 'ARBITRUM ONE'].includes(upperChain)) {
        return 'ARBI';
    } else if (['OP', 'OPTIMISM'].includes(upperChain)) {
        return 'OP';
    } else if (['BSC', 'BNB', 'BNB Smart Chain'].includes(upperChain)) {
        return 'BSC';
    } else if (['ZKS', 'ZKSYNC', 'ERA'].includes(upperChain)) {
        return 'ZKV2';
    } else if (['STK', 'STARKNET', 'STRK'].includes(upperChain)) {
        return 'STARKNET';
    } else if (['SOL', 'SOLANA'].includes(upperChain)) {
        return 'SOL';
    } else if (['LINEA'].includes(upperChain)) {
        return 'LINEA';
    } else if (['BASE'].includes(upperChain)) {
        return 'BASE';
    } else if (['SUI'].includes(upperChain)) {
        return 'SUI';
    } else if (['APTOS', 'APTOS MAINNET', 'APT'].includes(upperChain)) {
        return 'APTOS';
    } else {
        throw new Error(`${chain} 链不支持，请重新选择`);
    }
}

/**
 * 创建并配置一个 Bybit 交易所实例。
 * 
 * @param {Object} params - 创建交易所的参数对象（必填）。
 * @param {string} params.account - 要使用的账户名称，用于选择正确的API密钥（必填）。
 * @param {string} [params.apiFile='./data/exchange/bybit.json'] - 存储账户信息的 JSON 文件路径。
 * @returns {Promise<Object>} - 返回一个 Promise，解析为配置好的 Bybit 交易所实例。
 * @throws {Error} 在以下情况会抛出错误：
 * - 读取API文件失败
 * - API密钥解密失败
 * - 创建实例失败
 * - 代理连接失败
 */
async function createExchange({ account, apiFile = './data/exchange/bybit.json' }) {
    // 读取并解析 JSON 文件
    const accountApis = JSON.parse(fs.readFileSync(apiFile, 'utf-8'));
    const proxys = accountApis[account]['main']['apiProxy'];
    const randomproxy = proxys[Math.floor(Math.random() * proxys.length)];

    // 创建并配置 Bybit 交易所实例
    const bybit = new ccxt.bybit({
        'apiKey': await deCryptText(accountApis[account]['main']['apiKey']),
        'secret': await deCryptText(accountApis[account]['main']['apiSecret']),
        'enableRateLimit': true,
        'options': { 'adjustForTimeDifference': true },
        'socksProxy': randomproxy,
    });

    return bybit;
}

/**
 * 提现函数，从指定账户提取加密货币到指定地址。
 * 
 * @param {Object} params - 提取参数对象（必填）。
 * @param {string} params.account - 要使用的账户名称。
 * @param {string} params.chain - 提取的区块链类型，如 'ETH'、'BSC' 等。
 * @param {string} params.toAddress - 提取的目标地址。如果 withdrawType 为 'in'，必须是6-10位纯数字UID。
 * @param {string} params.coin - 要提取的加密货币类型，如 'BTC'、'ETH' 等。
 * @param {number} params.amount - 要提取的数量。
 * @param {'in'|'out'} [params.withdrawType='out'] - 提现类型。'in' 表示内部转账，'out' 表示链上提现。
 * @param {string} [params.apiFile='./data/exchange/bybit.json'] - 存储账户信息的 JSON 文件路径。
 * 
 * @returns {Promise<Object>} - 返回一个 Promise，解析为提现操作的结果。
 * 
 * @throws {Error} 在以下情况会抛出错误：
 * - 链名称不支持
 * - 提现类型不正确
 * - 内部转账UID格式错误（必须是6-10位纯数字）
 * - 余额不足
 * - 提现金额小于最小提现额度
 * - API 调用失败
 */
export async function withdraw({ account, chain, toAddress, coin, amount, withdrawType = 'out', apiFile = './data/exchange/bybit.json' }) {
    try {
        const bybit = await createExchange({ account, apiFile });
        coin = coin.toUpperCase();
        amount = parseFloat(amount);
        chain = normalizeChain(chain);

        let forceChain, handlingFee, coinBalance, outMinWithdrawAmount, inMinWithdrawAmount;
        // 无需请求api的基本判断放在前面
        if (!['in', 'out'].includes(withdrawType)) { console.log('withdrawType 只能是 "in" 或 "out"'); return; }
        const isValidBybitUID = (uid) => /^\d{6,10}$/.test(uid);
        if (withdrawType === 'in' && !isValidBybitUID(toAddress)) { console.log('内部地址仅支持UID(6-10位纯数字)'); return; }
        if (withdrawType === 'out' && isValidBybitUID(toAddress)) { console.log('外部地址输入有误，请检查地址是否正确'); return; }

        try { // 获取余额
            // 使用bybit的api：GET /v5/asset/transfer/query-account-coins-balance也可以获取地址余额，transferBalance字段
            // const bal = await bybit.privateGetV5AssetTransferQueryAccountCoinsBalance({ accountType: 'FUND', coin: 'USDC' });
            const allBalance = await bybit.fetchBalance({ "type": "funding" }); // funding 表示资金账户
            // console.log(allBalance)
            coinBalance = allBalance[coin]?.free || 0.0;
            console.log(`${account} 资金账户现有 ${coinBalance} ${coin}`);
        } catch (error) {
            console.log('获取余额失败，请检查账户是否正确.', error)
            return;
        }

        try { // 获取币种信息
            const currencies = await bybit.privateGetV5AssetCoinQueryInfo({ coin });
            const coinInfo = currencies.result.rows[0].chains;
            const coinInfoOfChain = coinInfo.find(row => row.chain === chain);
            const withdrawFee = parseFloat(coinInfoOfChain.withdrawFee);
            outMinWithdrawAmount = parseFloat(coinInfoOfChain.withdrawMin);
            inMinWithdrawAmount = parseFloat(coinInfoOfChain.chainWithdraw); // 问了客服，内部转账api没有最小提币额的对应字段，我根据页面检查了一下，chainWithdraw这个字段挺符合的，暂时用这个
            const withdrawPercentageFee = parseFloat(coinInfoOfChain.withdrawPercentageFee);
            if (withdrawPercentageFee != 0) {
                handlingFee = amount / (1 - withdrawPercentageFee) * withdrawPercentageFee + withdrawFee;
            } else {
                handlingFee = withdrawFee;
            }
        } catch (error) {
            console.log('获取手续费失败，请检查账户是否正确.', error)
            return;
        }

        if (withdrawType === 'out') {
            if (amount < outMinWithdrawAmount) {
                console.log(`${chain} 链转账 ${coin} 到外部地址 ${toAddress} 最小提现数量为 ${outMinWithdrawAmount} ${coin}`);
                return;
            }
            forceChain = 0;
            console.log(`${chain} 链转账 ${coin} 到外部地址 ${toAddress} 手续费为 ${handlingFee} ${coin}`);
        } else if (withdrawType === 'in') {
            if (amount < inMinWithdrawAmount) {
                console.log(`${chain} 链转账 ${coin} 到内部地址 ${toAddress} 最小提现数量为 ${inMinWithdrawAmount} ${coin}`);
                return;
            }
            forceChain = 2;
            handlingFee = 0;
            console.log(`${chain} 链转账 ${coin} 到内部地址 ${toAddress} 手续费为 ${handlingFee} ${coin}`);
        };

        if (amount + handlingFee > coinBalance) {
            console.log('提现金额超出余额，请先充值或者减少提现数量');
            return;
        }

        const response = await bybit.withdraw(coin, amount, toAddress, undefined, {
            chain,
            accountType: 'FUND', // 统一账户2.0 出金用资金账户
            feeType: 0, // 0: （默认）提现多少到账多少，需要考虑手续费中，账户余额要 >= 提现金额+手续费, 1: 到账金额为提现金额减手续费(手续费系统自动计算)
            forceChain, // 0（默认）：如果地址解析出是内部地址，则内部转账（仅限Bybit主账户）1：强制提现发生在链上 2: 使用UID提现
        });

        console.log(`账户 ${account} 通过 ${chain} 链 提现 ${amount} ${coin} 到地址 ${toAddress} 请求已提交，等待确认。手续费为 ${handlingFee} ${coin}`);
        return response;

    } catch (error) {
        console.error(`提现错误: ${error.message}`);
        throw error;
    }
}