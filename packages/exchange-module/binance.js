import fs from 'fs';
import ccxt from 'ccxt';
import { deCryptText } from '../crypt-module/crypt.js';
import { dingdingNotifier } from '../notification-module/notifier.js';

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
    const upperChain = chain.toUpperCase(); // 将输入转换为大写以忽略大小写差异
    // 检查输入的链名称是否属于已知的链名称，并返回相应的标准化名称
    if (['ETH', 'ERC20'].includes(upperChain)) {
        return 'ETH';
    } else if (['TRC', 'TRC20', 'TRX'].includes(upperChain)) {
        return 'TRX';
    } else if (['BSC', 'BEP20'].includes(upperChain)) {
        return 'BSC';
    } else if (['POLYGON', 'MATIC'].includes(upperChain)) {
        return 'MATIC';
    } else if (['AVAL', 'AVALANCHE', 'AVAX'].includes(upperChain)) {
        return 'AVAX';
    } else if (['ARB', 'ARBITRUM', 'ARBITRUM ONE'].includes(upperChain)) {
        return 'ARBITRUM';
    } else if (['OP', 'OPTIMISM'].includes(upperChain)) {
        return 'OPTIMISM';
    } else if (['ZKS', 'ZKSYNC', 'ERA'].includes(upperChain)) {
        return 'ZKSYNCERA';
    } else if (['STK', 'STARKNET', 'STRK'].includes(upperChain)) {
        return 'STARKNET';
    } else if (['SOL', 'SOLANA'].includes(upperChain)) {
        return 'SOL';
    } else if (['LINEA'].includes(upperChain)) {
        return 'LINEA';
    } else if (['BASE'].includes(upperChain)) {
        return 'BASE';
    } else if (['OPBNB'].includes(upperChain)) {
        return 'OPBNB';
    } else if (['OSMO', 'OSMOSIS'].includes(upperChain)) {
        return 'OSMO';
    } else if (['SUI'].includes(upperChain)) {
        return 'SUI';
    } else {
        // 如果输入的链名称不被支持，抛出错误
        throw new Error(`${chain} 链不支持，请重新选择`);
    }
}

/**
 * 创建并配置一个 Binance 交易所实例。
 * 
 * @param {Object} params - 创建交易所的参数对象（必填）。
 * @param {string} params.account - 要使用的账户名称，用于选择正确的API密钥（必填）。
 * @param {string} [params.apiFile='./data/exchange/binance.json'] - 存储账户信息的 JSON 文件路径。
 * @returns {Promise<Object>} - 返回一个 Promise，解析为配置好的 Binance 交易所实例。
 * @throws {Error} 在以下情况会抛出错误：
 * - 读取API文件失败
 * - API密钥解密失败
 * - 创建实例失败
 * - 代理连接失败
 * - IP限制或API权限不足
 */
async function createExchange({ account, apiFile = './data/exchange/binance.json' }) {

    // 异步读取文件并解析JSON
    const accountApis = JSON.parse(fs.readFileSync(apiFile, 'utf-8'));
    // console.log(accountApis)
    const proxys = accountApis[account]['main']['apiProxy']
    const randomproxy = proxys[Math.floor(Math.random() * proxys.length)];
    // 创建并配置okx交易所实例
    const binance = new ccxt.binance({
        'apiKey': await deCryptText(accountApis[account]['main']['apiKey']),
        'secret': await deCryptText(accountApis[account]['main']['apiSecret']),
        'enableRateLimit': true, // 启用请求速率限制
        'options': { 'adjustForTimeDifference': true }, // 自动调整时间戳以适应本地计算机的时区差异
        'socksProxy': randomproxy, // 使用提供的代理
    });
    
    return binance;
}

/**
 * 提现函数，从指定账户提取加密货币到指定地址。
 * 
 * @param {Object} params - 提取参数对象（必填）。
 * @param {string} params.account - 要使用的账户名称。
 * @param {string} params.chain - 提取的区块链类型，如 'ETH'、'BSC' 等。
 * @param {string} params.toAddress - 提取的目标地址。
 * @param {string} params.coin - 要提取的加密货币类型，如 'BTC'、'ETH' 等。
 * @param {number} params.amount - 要提取的数量。
 * @param {string} [params.apiFile='./data/exchange/binance.json'] - 存储账户信息的 JSON 文件路径。
 * 
 * @returns {Promise<void>} - 提现操作不返回值，但会在控制台输出操作结果。
 * 
 * @throws {Error} 在以下情况会抛出错误：
 * - 链名称不支持
 * - 余额不足
 * - 提现金额小于最小提现额度
 * - API 调用失败
 * - IP限制或API权限不足
 */
export async function withdraw({ account, chain, toAddress, coin, amount, apiFile = './data/exchange/binance.json' }) {
    /**
     * ccxt统一api: 
            fetchBalance(): 查询账户信息
            fetchCurrencies(): 获取币种信息
            withdraw(): 提现
     */
    try {
        coin = coin.toUpperCase()
        amount = parseFloat(amount);
        chain = normalizeChain(chain)
        const binance = await createExchange({ account, apiFile })

        let coinBalance, handlingFee, outMinWithdrawAmount, inMinWithdrawAmount;;

        try { // 获取余额
            const allBalance = await binance.fetchBalance() //默认查询现货账户
            // console.log(allBalance)
            coinBalance = allBalance[coin]['free']
            console.log(`${account} 资金账户现有 ${coinBalance} ${coin}`);
        } catch (error) {
            console.log('获取余额失败，请检查账户是否正确.', error)
            return;
        }

        try {
            // GET /sapi/v1/capital/config/getall
            const currencyInfo = await binance.fetchCurrencies();
            const currencyData = currencyInfo[coin]['info']['networkList'].find(data => data.network === chain)
            // console.log(currencyData)
            outMinWithdrawAmount = parseFloat(currencyData.withdrawMin);
            handlingFee = parseFloat(currencyData.withdrawFee);
            console.log(`${chain} 链转账 ${coin} 到外部地址 ${toAddress} 手续费为 ${handlingFee} ${coin}`);
        } catch (error) {
            console.log('获取提币手续费失败，请检查账户是否正确.', error)
            return;
        }

        if (amount < outMinWithdrawAmount) {
            console.log(`${chain} 链转账 ${coin} 到外部地址 ${toAddress} 最小提现数量为 ${outMinWithdrawAmount} ${coin}`);
            return;
        }

        if (amount + handlingFee > coinBalance) {
            console.log('提现金额超出余额，请先充值或者减少提现数量');
            return;
        }

        // 执行提现操作
        await binance.withdraw(coin, amount + handlingFee, toAddress, undefined, {
            network: chain,
            transactionFeeFlag: false //提现到内部地址，免手续费，transactionFeeFlag设置为true手续费归资金接收方; 设置为false手续费归资金转出方. 默认false,设置为true可以将转出方提干净
        });

        console.log(`账户 ${account} 通过 ${chain} 链 提现 ${amount} ${coin} 到地址 ${toAddress} 请求已提交，等待确认。手续费为 ${handlingFee} ${coin}`);
    } catch (error) {
        console.error(`提现错误: ${error}`);
    }
}

/**
 * 价格预警循环函数
 * @param {Object} params - 预警参数对象
 * @param {string} [params.symbol='BTC/USDT'] - 交易对
 * @param {number} [params.price=100000] - 预警价格
 * @param {number} [params.waitTime=600] - 检查间隔时间(秒)
 * @param {string} [params.direction='down'] - 价格方向，'up'表示涨到，'down'表示跌到
 * @param {number} [params.reconnectInterval=3600] - 重新连接间隔(秒)，默认1小时
 * @returns {Promise<void>}
 */
export async function priceAlertLoop({ 
    symbol = 'BTC/USDT', 
    price = 100000, 
    waitTime = 600, 
    direction = 'down',
    reconnectInterval = 3600 
}) {
    symbol = symbol.toUpperCase();
    let lastReconnectTime = Date.now();
    let binance = null;

    while (true) {
        try {
            // 检查是否需要重新创建实例
            const now = Date.now();
            if (!binance || (now - lastReconnectTime) > reconnectInterval * 1000) {
                console.log('创建或更新交易所连接...');
                binance = await new ccxt.binance({'enableRateLimit': true});
                lastReconnectTime = now;
            }

            const ticker = await binance.fetchTicker(symbol);
            const tokenPrice = parseFloat(ticker.last);
            
            // 根据方向判断是否触发预警
            const isAlertTriggered = direction === 'up' 
                ? tokenPrice > parseFloat(price)  // 涨到价格时触发
                : tokenPrice < parseFloat(price); // 跌到价格时触发
            
            if (isAlertTriggered) {
                const directionText = direction === 'up' ? '涨到' : '跌到';
                const context = `binance交易所 ${symbol} 价格已${directionText}预警线 ${price}，最新成交价：${tokenPrice}`;
                await dingdingNotifier(context);
                // break; // 发送一次后退出，如果需要持续监控可以去掉这行
            }
            
            // 等待指定时间后再次检查
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            
        } catch (error) {
            console.error('监控出错:', error);
            
            // 如果是网络错误或API错误，强制下次重新创建实例
            if (error.name === 'NetworkError' || 
                error.name === 'ExchangeError' || 
                error.name === 'AuthenticationError') {
                binance = null;
            }
            
            // 出错后等待一段时间再重试
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
    }
}

/**
 * 价格区间预警循环函数
 * @param {Object} params - 预警参数对象
 * @param {string} [params.symbol='BTC/USDT'] - 交易对
 * @param {number} [params.minPrice=90000] - 区间下限价格
 * @param {number} [params.maxPrice=110000] - 区间上限价格
 * @param {number} [params.waitTime=600] - 检查间隔时间(秒)
 * @param {number} [params.reconnectInterval=3600] - 重新连接间隔(秒)，默认1小时
 * @returns {Promise<void>}
 */
export async function priceRangeAlertLoop({ 
    symbol = 'BTC/USDT', 
    minPrice = 90000, 
    maxPrice = 110000, 
    waitTime = 600,
    reconnectInterval = 3600 
}) {
    symbol = symbol.toUpperCase();
    let lastReconnectTime = Date.now();
    let binance = null;

    while (true) {
        try {
            // 检查是否需要重新创建实例
            const now = Date.now();
            if (!binance || (now - lastReconnectTime) > reconnectInterval * 1000) {
                console.log('创建或更新交易所连接...');
                binance = await new ccxt.binance({'enableRateLimit': true});
                lastReconnectTime = now;
            }

            const ticker = await binance.fetchTicker(symbol);
            const tokenPrice = parseFloat(ticker.last);
            
            // 判断价格是否在区间外
            if (tokenPrice < minPrice || tokenPrice > maxPrice) {
                let alertType = tokenPrice < minPrice ? '低于' : '高于';
                let alertPrice = tokenPrice < minPrice ? minPrice : maxPrice;
                
                const context = `binance交易所 ${symbol} 价格已${alertType}预警线 ${alertPrice}\n` +
                                `当前价格: ${tokenPrice}\n` +
                                `预设区间: ${minPrice} - ${maxPrice}`;
                              
                await dingdingNotifier(context);
            }
            
            // 等待指定时间后再次检查
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            
        } catch (error) {
            console.error('监控出错:', error);
            
            // 如果是网络错误或API错误，强制下次重新创建实例
            if (error.name === 'NetworkError' || 
                error.name === 'ExchangeError' || 
                error.name === 'AuthenticationError') {
                binance = null;
            }
            
            // 出错后等待一段时间再重试
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
    }
}