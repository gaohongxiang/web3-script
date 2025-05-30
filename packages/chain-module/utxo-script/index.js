// 用于与比特币区块链进行交互
import * as bitcoin from 'bitcoinjs-lib';
import {
    getGas,
    getNetwork,
    signInputs,
    broadcastTx,
    convertToXOnly,
    getTransaction,
    addInputsToPsbt,
    estimateTransactionSize,
    getKeyPairAndAddressInfo,
    findAdjustedDividendWithRemainder,

} from './function.js';

const exchangeRate = 1e8; // 1 BTC = 100,000,000 satoshis

/**
 * 获取指定地址的余额。
 * 该函数从指定的 API 获取给定比特币地址的余额信息，并返回该地址的余额（以比特币为单位）。
 * 
 * @param {Object} params - 参数对象。
 * @param {string} params.address - 要查询余额的比特币地址（必填）。
 * @param {string} [params.chain='btc'] - 要查询的区块链类型，默认为 'btc'。
 * 
 * @returns {Promise<number|null>} - 返回一个 Promise，解析为地址的余额（以比特币为单位），
 * 如果发生错误则返回 null。
 * 
 * @throws {Error} - 如果获取余额失败，则抛出错误。
 */
export async function getBalance({ address, chain = 'btc' }) {
    try {
        // 后面函数需要用到baseURL、network，需要首先获取
        const { baseURl } = getNetwork(chain);
        const response = await fetch(`${baseURl}/address/${address}`);
        const data = await response.json();
        // console.log(data);
        const balance = data.chain_stats.funded_txo_sum / 100000000;
        console.log(`Address ${address} ${chain}链 余额: ${balance}`);
        return balance;
    } catch (error) {
        console.error('Error fetching address balance:', error.message);
        return null;
    }
}

/**
 * 获取指定地址的 UTXO（未花费交易输出）。
 * 该函数从指定的 API 获取给定比特币地址的所有 UTXO，并根据可选参数过滤 UTXO。
 * 
 * @param {Object} params - 参数对象。
 * @param {string} params.address - 要查询 UTXO 的比特币地址（必填）。
 * @param {string} [params.chain='btc'] - 要查询的区块链类型，默认为 'btc'。
 * @param {number|null} [params.filterMinUTXOSize=0] - 过滤的最小 UTXO 大小，默认为 0，表示不进行过滤。
 * 
 * @returns {Promise<Object>} - 返回一个 Promise，解析为一个对象，包含以下属性：
 *   - {Array} allUTXOs - 所有 UTXO 的数组。
 *   - {Array} filteredUTXOs - 过滤后的 UTXO 数组（大于 filterMinUTXOSize 的 UTXO）。
 *   - {Array} unconfirmedUTXOs - 未确认的 UTXO 数组。
 * 
 * @throws {Error} - 如果获取 UTXO 失败，则抛出错误。
 */
export async function getAddressUTXOs({ address, chain = 'btc', filterMinUTXOSize = 0 }) {
    try {
        const { baseURl } = getNetwork(chain);
        const response = await fetch(`${baseURl}/address/${address}/utxo`);
        let allUTXOs = await response.json();
        // console.log(allUTXOs)    
        let filteredUTXOs = [];
        let unconfirmedUTXOs = [];
        for (const utxo of allUTXOs) {
            // 未确认的utxo
            // 应该通过utxo.status.confirmed来判断交易是否确认。不知为啥为确认的交易返回的也是true。只好通过block_height来判断，未确认的交易block_height为0
            if (!utxo.status.block_height) {
                unconfirmedUTXOs.push(utxo)
            }
            // 过滤聪，低于filterMinUTXOSize的聪过滤掉，避免误烧和金额不够
            if (filterMinUTXOSize && utxo.value > filterMinUTXOSize && utxo.status.block_height) {
                filteredUTXOs.push(utxo);
            }
        }
        // 按 utxo.value 从大到小排序
        allUTXOs.sort((a, b) => b.value - a.value);
        filteredUTXOs.sort((a, b) => b.value - a.value);
        unconfirmedUTXOs.sort((a, b) => b.value - a.value);

        // console.log(`地址 ${address} 所有utxos: ${JSON.stringify(allUTXOs)}`);
        // console.log(`地址 ${address} 过滤${filterMinUTXOSize}以下聪后utxos: ${JSON.stringify(filteredUTXOs)}`);
        // console.log(`地址 ${address} 未确认utxos: ${JSON.stringify(unconfirmedUTXOs)}`);
        return { allUTXOs, filteredUTXOs, unconfirmedUTXOs };
    } catch (error) {
        console.error('获取utxo出错:', error.message);
        return { allUTXOs: null, filteredUTXOs: null, unconfirmedUTXOs: null };
    }
}

/**
 * 进行比特币转账操作。
 * 
 * @param {string} enBtcMnemonicOrWif - 发送方的加密后比特币助记词或 WIF 私钥（必填）。
 * @param {Array} toData - 目标地址和对应转账金额的数组，格式为 [['地址1', 金额1], ['地址2', 金额2], ...]。
 * @param {string} [chain='btc'] - 使用的区块链类型，默认为 'btc'。
 * @param {number} [filterMinUTXOSize=10000] - 过滤的最小 UTXO 大小，默认为 10000聪，防止烧资产。
 * @param {string} [scriptType='P2TR'] - 脚本类型（P2PKH、P2WPKH、P2TR）。
 * @param {string} [GasSpeed='high'] - 交易的 gas 速度，默认为 'high'。
 * @param {number} [highGasRate=1.1] - 高速交易的 gas 费率，默认为 1.1。只有GasSpeed='high'时才生效。
 * 
 * @returns {Promise<void>} - 返回一个 Promise，表示转账操作的完成。
 */
export async function transfer({ enBtcMnemonicOrWif, toData, chain = 'btc', filterMinUTXOSize = 10000, scriptType = 'P2TR', GasSpeed = 'high', highGasRate = 1.1 }) {
    // 后面函数需要用到baseURL、network，需要首先获取
    const { network } = getNetwork(chain);
    //发送方
    const { keyPair, address: fromAddress, output: outputScript } = await getKeyPairAndAddressInfo(enBtcMnemonicOrWif, scriptType)
    const { filteredUTXOs, unconfirmedUTXOs } = await getAddressUTXOs({ address: fromAddress, chain, filterMinUTXOSize });
    if (unconfirmedUTXOs.length != 0) { console.log(`地址 ${fromAddress} 有未确认交易`); return }
    if (filteredUTXOs.length == 0) { console.log(`地址 ${fromAddress} 无可用utxos`); return }

    // 获取需要发送的amount总量
    const outputValue = toData.reduce((acc, [, amount]) => acc + (amount * exchangeRate), 0);

    const gas = await getGas({ GasSpeed, highGasRate });
    //这里交易大小是根据所有可用的utxo作为输入预估的，肯定比实际的大
    // 输出数量 + 1 是为了防止有找零，导致size变大，总fee不变，速率降低，可能无法及时过块
    const estimateSize = estimateTransactionSize({ inputCount: filteredUTXOs.length, outputCount: (toData.length + 1), scriptType });
    const estimateFee = Math.ceil(gas * estimateSize);

    // 创建一个新的交易构建器实例。这个构建器用于构建比特币交易，包括添加输入、输出和设置交易的其他参数。
    const psbt = new bitcoin.Psbt({ network });

    // 创建交易输入
    const inputValue = addInputsToPsbt({ psbt, UTXOs: filteredUTXOs, value: outputValue + estimateFee, outputScript, keyPair, scriptType });

    // 创建交易输出
    for (let [address, amount] of toData) {
        psbt.addOutput({
            address, // 接收方地址
            value: amount * exchangeRate, // 金额
        });
    }

    // 设置 gas费
    const size = estimateTransactionSize({ inputCount: psbt.data.inputs.length, outputCount: (toData.length + 1), scriptType });
    const fee = Math.ceil(gas * size);
    // console.log(`交易大小：${size}`);
    // console.log(`交易手续费：${fee}`);

    // 找零输出
    const changeValue = inputValue - outputValue - fee;

    // 找零
    if (changeValue > 0) {
        psbt.addOutput({
            address: fromAddress,
            value: changeValue,
        });
    }

    // console.log(psbt)
    // console.log(psbt.data.inputs)
    // console.log(psbt.data.outputs)

    // 签名所有输入
    signInputs(psbt, keyPair, scriptType);

    // 终结所有输入，表示签名完成
    psbt.finalizeAllInputs();

    // 提取交易事务
    const psbtHex = psbt.extractTransaction().toHex();
    console.log(`正在广播交易 hex: ${psbtHex}`);
    await broadcastTx(psbtHex)
}

/**
 * 进行比特币多地址归集操作。
 * 
 * @param {Array} fromData - 源地址信息数组，支持两种格式：
 * 1. 简单格式（全部使用P2TR）：['加密助记词或WIF私钥1', '加密助记词或WIF私钥2', ...]
 * 2. 指定脚本格式：[['加密助记词或WIF私钥1', 'P2TR'], ['加密助记词或WIF私钥2'], ['加密助记词或WIF私钥3', 'P2WPKH'], ...]
 *    如果不指定脚本类型，默认使用'P2TR'
 * @param {string} toAddress - 归集目标地址
 * @param {string} [chain='btc'] - 使用的区块链类型，默认为 'btc'
 * @param {number} [filterMinUTXOSize=10000] - 过滤的最小 UTXO 大小，默认为 10000聪，防止烧资产
 * @param {string} [GasSpeed='high'] - 交易的 gas 速度，默认为 'high'
 * @param {number} [highGasRate=1.1] - 高速交易的 gas 费率，默认为 1.1。只有GasSpeed='high'时才生效
 * 
 * @returns {Promise<void>} - 返回一个 Promise，表示归集操作的完成
 * 
 * 具体执行流程：
 * 1. 收集所有源地址的UTXO(大于filterMinUTXOSize的UTXO)：
 *    - 遍历每个源地址
 *    - 获取每个地址的所有可用UTXO

 * 2. 计算总金额和gas：
 *    inputValue = 所有UTXO的总和
 *    gas = 根据输入数量计算预估gas费
 *   
 * 3. 创建交易：
 *   输入：所有地址的所有UTXO
 *   输出：目标地址，金额为(inputValue - gas)
 *   
 * 4. 签名：
 *    - 使用每个地址对应的私钥
 *    - 对其拥有的UTXO进行签名
 */
export async function collect({ fromData, toAddress, chain = 'btc', filterMinUTXOSize = 10000, GasSpeed = 'high', highGasRate = 1.1 }) {
    // 获取network信息
    const { network } = getNetwork(chain);

    // 创建PSBT实例
    const psbt = new bitcoin.Psbt({ network });

    // 1. 收集所有地址的UTXO和签名信息
    let totalInputValue = 0;
    const signingData = []; // 存储每个输入的签名信息

    // 处理fromData数组
    const processFromData = (fromData) => {
        // 判断是否是简单格式（检查第一个元素是否为数组）
        const isSimpleFormat = !Array.isArray(fromData[0]);

        if (isSimpleFormat) {
            // 简单格式：转换为标准格式，全部使用P2TR
            return fromData.map(enBtcMnemonicOrWif => [enBtcMnemonicOrWif, 'P2TR']);
        }

        // 标准格式：补充默认的脚本类型
        return fromData.map(([enBtcMnemonicOrWif, scriptType = 'P2TR']) => [enBtcMnemonicOrWif, scriptType]);
    };

    // 在函数中使用
    const standardFromData = processFromData(fromData);

    // 创建一个处理单个地址的异步函数
    async function processAddress(enBtcMnemonicOrWif, scriptType) {
        // 获取地址信息
        const { keyPair, address, output: outputScript } = await getKeyPairAndAddressInfo(enBtcMnemonicOrWif, scriptType);

        // 获取地址的UTXO
        const { filteredUTXOs, unconfirmedUTXOs } = await getAddressUTXOs({
            address,
            chain,
            filterMinUTXOSize
        });

        // 检查未确认交易
        if (unconfirmedUTXOs.length !== 0) {
            throw new Error(`地址 ${address} 有未确认交易，终止归集操作`);
        }

        // 如果没有可用UTXO，返回空结果
        if (filteredUTXOs.length === 0) {
            console.log(`地址 ${address} 无可用utxos，跳过该地址`);
            return {
                inputs: [],
                signingInfos: [],
                value: 0
            };
        }

        // 处理所有UTXO
        const inputs = [];
        const signingInfos = [];
        let value = 0;

        for (const utxo of filteredUTXOs) {
            const input = {
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: outputScript,
                    value: utxo.value,
                }
            };

            if (scriptType.toUpperCase() === 'P2TR') {
                input.tapInternalKey = convertToXOnly(keyPair.publicKey);
            }

            inputs.push(input);
            signingInfos.push({ keyPair, scriptType });
            value += utxo.value;
        }

        return { inputs, signingInfos, value };
    }

    try {
        // 并行处理所有地址
        const results = await Promise.all(
            standardFromData.map(([enBtcMnemonicOrWif, scriptType]) =>
                processAddress(enBtcMnemonicOrWif, scriptType)
            )
        );

        // 合并所有结果
        for (const result of results) {
            // 添加所有输入到psbt
            result.inputs.forEach(input => psbt.addInput(input));
            // 合并签名信息
            signingData.push(...result.signingInfos);
            // 累加总值
            totalInputValue += result.value;
        }

        // 2. 计算gas费
        const gas = await getGas({ GasSpeed, highGasRate });
        // 只有一个输出（目标地址），不需要找零
        const size = estimateTransactionSize({
            inputCount: psbt.data.inputs.length,
            outputCount: 1,
            scriptType: 'P2TR' // 使用最大的脚本类型估算
        });
        const fee = Math.ceil(gas * size);

        // 3. 添加输出（归集地址）
        const outputValue = totalInputValue - fee;
        if (outputValue <= 0) {
            console.log('归集金额太小，不足以支付gas费');
            return;
        }

        psbt.addOutput({
            address: toAddress,
            value: outputValue
        });

        // 4. 使用对应的私钥签名每个输入
        for (let i = 0; i < psbt.data.inputs.length; i++) {
            const { keyPair, scriptType } = signingData[i];

            // 只签名当前输入
            if (scriptType.toUpperCase() === 'P2TR') {
                const tweakedChildNode = keyPair.tweak(
                    bitcoin.crypto.taggedHash('TapTweak', convertToXOnly(keyPair.publicKey))
                );
                psbt.signInput(i, tweakedChildNode);
            } else {
                psbt.signInput(i, keyPair);
            }
        }

        // 5. 完成所有签名
        psbt.finalizeAllInputs();

        // 6. 广播交易
        const psbtHex = psbt.extractTransaction().toHex();
        console.log(`正在广播归集交易 hex: ${psbtHex}`);
        await broadcastTx(psbtHex);
    } catch (error) {
        console.log(error)
        console.error(error.message);
        return;
    }
}

/**
 * 将比特币 UTXO 拆分为多个较小的 UTXO。
 * 
 * @param {string} enBtcMnemonicOrWif - 发送方的加密后比特币助记词或 WIF 私钥（必填）。
 * @param {string} [chain='btc'] - 使用的区块链类型，默认为 'btc'。
 * @param {number} [filterMinUTXOSize=10000] - 过滤的最小 UTXO 大小，默认为 10000聪，防止烧资产。
 * @param {number} [splitNum=3] - 拆分的 UTXO 数量，默认为 3。
 * @param {string} [scriptType='P2TR'] - 脚本类型（P2PKH、P2WPKH、P2TR）。
 * @param {string} [GasSpeed='high'] - 交易的 gas 速度，默认为 'high'。
 * @param {number} [highGasRate=1.1] - 高速交易的 gas 费率，默认为 1.1。只有GasSpeed='high'时才生效。
 * 
 * @returns {Promise<void>} - 返回一个 Promise，表示拆分操作的完成。
 */
export async function splitUTXO({ enBtcMnemonicOrWif, chain = 'btc', filterMinUTXOSize = 10000, splitNum = 3, scriptType = 'P2TR', GasSpeed = 'high', highGasRate = 1.1 }) {
    // 后面函数需要用到baseURL、network，需要首先获取
    const { network } = getNetwork(chain);
    //发送方
    const { keyPair, address: fromAddress, output: outputScript } = await getKeyPairAndAddressInfo(enBtcMnemonicOrWif, scriptType)
    const { filteredUTXOs, unconfirmedUTXOs } = await getAddressUTXOs({ address: fromAddress, chain, filterMinUTXOSize });
    if (unconfirmedUTXOs.length != 0) { console.log(`地址 ${fromAddress} 有未确认交易`); return }
    if (filteredUTXOs.length == 0) { console.log(`地址 ${fromAddress} 无可用utxos`); return }
    // console.log(filteredUTXOs)

    // 创建一个新的交易构建器实例。这个构建器用于构建比特币交易，包括添加输入、输出和设置交易的其他参数。
    const psbt = new bitcoin.Psbt({ network });

    // 创建交易输入
    const inputValue = addInputsToPsbt({ psbt, UTXOs: filteredUTXOs, outputScript, keyPair, scriptType });

    const gas = await getGas({ GasSpeed, highGasRate });
    // 输入确定，输出有可能有个找零，所以加1
    const size = estimateTransactionSize({ inputCount: psbt.data.inputs.length, outputCount: (splitNum + 1), scriptType });
    const fee = Math.ceil(gas * size);

    const outputValue = inputValue - fee;
    const { adjustedDividend: adjustedOutputValue, remainder } = findAdjustedDividendWithRemainder(outputValue, splitNum)
    const eachOutputValue = adjustedOutputValue / splitNum;
    if (eachOutputValue < 0) { console.log(`需要拆分的utxo值太小,请添加utxo`); return }
    // 创建交易输出
    const toAddress = fromAddress
    for (let i = 0; i < splitNum; i++) {
        psbt.addOutput({
            address: toAddress, // 接收方地址
            value: eachOutputValue, // 金额
        });
    }
    // 余数不为0说明除不尽，余下的value返回给toAddress
    if (remainder != 0) {
        psbt.addOutput({
            address: toAddress, // 接收方地址
            value: outputValue - adjustedOutputValue, // 金额
        });
    }

    // 签名所有输入
    signInputs(psbt, keyPair, scriptType);

    // 终结所有输入，表示签名完成
    psbt.finalizeAllInputs();

    // 提取交易事务
    const psbtHex = psbt.extractTransaction().toHex();
    console.log(`正在广播交易 hex: ${psbtHex}`);
    await broadcastTx(psbtHex)
}

/**
 * 加速比特币交易的确认过程。
 * 
 * @param {string} enBtcMnemonicOrWif - 发送方的加密后比特币助记词或 WIF 私钥（必填）。
 * @param {string} txid - 需要加速的交易 ID（必填）。
 * @param {string} [chain='btc'] - 使用的区块链类型，默认为 'btc'。
 * @param {number} [filterMinUTXOSize=10000] - 过滤的最小 UTXO 大小，默认为 10000聪，防止烧资产。
 * @param {string} [scriptType='P2TR'] - 脚本类型（P2PKH、P2WPKH、P2TR）。
 * @param {string} [GasSpeed='high'] - 交易的 gas 速度，默认为 'high'。
 * @param {number} [highGasRate=1.1] - 高速交易的 gas 费率，默认为 1.1。只有GasSpeed='high'时才生效。
 * 
 * @returns {Promise<void>} - 返回一个 Promise，表示加速操作的完成。
 */
export async function speedUp({ enBtcMnemonicOrWif, txid, chain = 'btc', filterMinUTXOSize = 10000, scriptType = 'P2TR', GasSpeed = 'high', highGasRate = 1.1 }) {
    // 后面函数需要用到baseURL、network，需要首先获取
    const { network } = getNetwork(chain);
    const { keyPair, address: fromAddress, output: outputScript } = await getKeyPairAndAddressInfo(enBtcMnemonicOrWif, scriptType)
    const { filteredUTXOs } = await getAddressUTXOs({ address: fromAddress, chain, filterMinUTXOSize });
    if (filteredUTXOs.length == 0) { console.log(`地址 ${fromAddress} 无可用utxos`); return }
    // 获取当前交易信息
    const transaction = await getTransaction(txid);
    if (transaction.status.confirmed) { console.log('交易已确认，无需加速'); return; }

    const unconfirmedVout = transaction.vout.find(item => item.scriptpubkey_address === fromAddress);
    if (!unconfirmedVout) { console.log(`地址 ${fromAddress} 不在交易的输出里, 无法使用CPFP加速。`); return; }
    const unconfirmedVoutIndex = transaction.vout.findIndex(item => item.scriptpubkey_address === fromAddress);
    // console.log(unconfirmedVout)
    // console.log(unconfirmedVoutIndex);

    // 创建一个新的交易构建器实例。这个构建器用于构建比特币交易，包括添加输入、输出和设置交易的其他参数。
    const psbt = new bitcoin.Psbt({ network });

    const gas = await getGas({ GasSpeed, highGasRate });
    // 输入就是filteredUTXOs.length和父交易的未花费utxo。输出是父交易的未花费utxo和扣除gas费之后的找零
    const estimateSize = estimateTransactionSize({ inputCount: (filteredUTXOs.length + 1), outputCount: 2, scriptType });
    const estimateFee = Math.ceil((2 * gas - transaction.adjustedFeePerVsize) * estimateSize);

    // 创建交易输入，用于提供加速费用
    const inputValue = addInputsToPsbt({ psbt, UTXOs: filteredUTXOs, value: estimateFee, outputScript, keyPair, scriptType });

    // 添加为确认的交易输出作为输入
    const unconfirmedUtxo = {
        index: unconfirmedVoutIndex, // UTXO 的输出索引
        hash: transaction.txid, // UTXO 的交易哈希
        witnessUtxo: {
            script: outputScript, // UTXO 的输出脚本
            value: unconfirmedVout.value, // UTXO 的金额
        },
    }
    // 根据脚本类型添加特定的输入信息
    if (scriptType.toUpperCase() === 'P2TR') {
        unconfirmedUtxo.tapInternalKey = convertToXOnly(keyPair.publicKey); // 添加 Taproot 内部密钥
    }
    psbt.addInput(unconfirmedUtxo);

    const size = estimateTransactionSize({ inputCount: psbt.data.inputs.length, outputCount: 2, scriptType });
    const fee = Math.ceil((2 * gas - transaction.adjustedFeePerVsize) * size);

    // 创建交易输出
    psbt.addOutput({
        address: fromAddress, // 接收方地址
        value: inputValue - fee, // 金额
    });

    psbt.addOutput({
        address: fromAddress, // 接收方地址
        value: unconfirmedVout.value, // 金额
    });


    // 签名所有输入
    signInputs(psbt, keyPair, scriptType);

    // 终结所有输入，表示签名完成
    psbt.finalizeAllInputs();

    // 提取交易事务
    const psbtHex = psbt.extractTransaction().toHex();
    console.log(`正在广播交易 hex: ${psbtHex}`);
    await broadcastTx(psbtHex)
}