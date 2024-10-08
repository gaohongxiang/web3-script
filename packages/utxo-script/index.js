// 用于与比特币区块链进行交互
import * as bitcoin from 'bitcoinjs-lib';
import { getCsvData } from '../utils-module/utils.js'
import { 
    getGas,
    getNetwork,
    getAddressUTXOs,
    getTransaction,
    broadcastTx,
    convertToXOnly,
    findAdjustedDividendWithRemainder,
    generateKeyPairAndTaprootAddressFromMnemonic,
} from './function.js';

const exchangeRate = 1e8; // 1 BTC = 100,000,000 satoshis

/**
 * 进行比特币转账操作。
 * 
 * @param {string} enBtcMnemonic - 发送方的比特币助记词（必填）。
 * @param {string} [chain='btc'] - 使用的区块链类型，默认为 'btc'。
 * @param {number} [filterMinUTXOSize=10000] - 过滤的最小 UTXO 大小，默认为 10000聪，防止烧资产。
 * @param {string} [GasSpeed='high'] - 交易的 gas 速度，默认为 'high'。
 * @param {number} [highGasRate=1.1] - 高速交易的 gas 费率，默认为 1.1。只有GasSpeed='high'时才生效。
 * @param {string} [csvFile='./data/wallet.csv'] - 接收方信息的 CSV 文件路径，默认为 './data/wallet.csv'。
 * 
 * @returns {Promise<void>} - 返回一个 Promise，表示转账操作的完成。
 */
export async function transfer({ enBtcMnemonic, chain = 'btc', filterMinUTXOSize = 10000, GasSpeed='high', highGasRate=1.1, csvFile = './data/wallet.csv' } ) {
    // 后面函数需要用到baseURL、network，需要首先获取
    const { network } = getNetwork(chain);
    //发送方
    const { keyPair, address: fromAddress, output: outputScript } = await generateKeyPairAndTaprootAddressFromMnemonic(enBtcMnemonic)
    const { filteredUTXOs, unconfirmedUTXOs } = await getAddressUTXOs(fromAddress, { filterMinUTXOSize });
    if (unconfirmedUTXOs.length != 0) { console.log(`地址 ${fromAddress} 有未确认交易`); return }
    if (filteredUTXOs.length == 0) { console.log(`地址 ${fromAddress} 无可用utxos`); return }

    // 接收方
    const toData = await getCsvData(csvFile)
    // 获取需要发送的amount总量
    let outputValue = 0; // 初始化总量
    for (let data of toData) {
        // 累加每个 data 的 data.amount如果是字符串，乘以exchangeRate会隐式转换为number
        outputValue += parseInt(data.amount * exchangeRate);
    }
    // console.log('Total Amount:', outputValue); // 输出总量

    const gas = await getGas({ GasSpeed, highGasRate }); 

    // 交易大小预估网站：https://bitcoinops.org/en/tools/calc-size/
    //这里交易大小是根据所有可用的utxo作为输入预估的，肯定比实际的大
    // 输出数量 + 1 是为了防止有找零，导致size变大，总fee不变，速率降低，可能无法及时过块
    const estimateSize = 10.5 + filteredUTXOs.length * 57.5 + (toData.length + 1) * 43;
    const estimateFee = Math.ceil(gas * estimateSize) // 向上取整，避免出现小数

    // 创建一个新的交易构建器实例。这个构建器用于构建比特币交易，包括添加输入、输出和设置交易的其他参数。
    const psbt = new bitcoin.Psbt({ network });

    // 创建交易输入
    let inputValue = 0;
    let i = 1;
    for (const utxo of filteredUTXOs) {
        if (inputValue < outputValue + estimateFee) {
            const utxoHash = utxo.txid;
            // console.log(utxoHash)
            const input = {
                index: utxo.vout, // UTXO 的输出索引
                hash: utxoHash, // UTXO 的交易哈希
                witnessUtxo: {
                    script: outputScript, // UTXO 的输出脚本
                    value: utxo.value, // UTXO 的金额
                },
                tapInternalKey: convertToXOnly(keyPair.publicKey), // 添加 Taproot 内部密钥
            };
            psbt.addInput(input);
            i++;
            inputValue += utxo.value;
        } else {
            break; // 如果 inputValue 大于等于 outputValue + estimateFee，退出循环
        }
    }
    // 创建交易输出
    for (let data of toData) {
        psbt.addOutput({
            address: data.toAddress, // 接收方地址
            value: parseInt(data.amount * exchangeRate), // 金额
        });
    }

    // 设置 gas费
    const size = (10.5 + psbt.data.inputs.length * 57.5 + (toData.length + 1) * 43);
    const fee = Math.ceil(gas * size);
    // 找零输出
    const changeValue = inputValue - outputValue - fee;

    if (changeValue < 0) {
        console.log('可用 UTXO 不足');
        return;
    } else if (changeValue > 0) {
        // 找零
        psbt.addOutput({
            // 接收方地址
            address: fromAddress,
            // 金额
            value: changeValue,
        });
    }

    // console.log(psbt)
    // console.log(psbt.data.inputs)
    // console.log(psbt.data.outputs)

    // 生成一个经过调整的子密钥（tweaked child key），用于 Taproot 交易的签名。
    const tweakedChildNode = keyPair.tweak(
        bitcoin.crypto.taggedHash('TapTweak', convertToXOnly(keyPair.publicKey)),
    );

    // 签名所有输入
    psbt.data.inputs.forEach((input, index) => {
        psbt.signInput(index, tweakedChildNode);
    });

    // 终结所有输入，表示签名完成
    psbt.finalizeAllInputs();

    // 提取交易事务
    const psbtHex = psbt.extractTransaction().toHex();
    console.log(`正在广播交易 hex: ${psbtHex}`);
    await broadcastTx(psbtHex)
}

/**
 * 将比特币 UTXO 拆分为多个较小的 UTXO。
 * 
 * @param {string} enBtcMnemonic - 发送方的比特币助记词（必填）。
 * @param {string} [chain='btc'] - 使用的区块链类型，默认为 'btc'。
 * @param {number} [filterMinUTXOSize=10000] - 过滤的最小 UTXO 大小，默认为 10000聪，防止烧资产。
 * @param {number} [splitNum=3] - 拆分的 UTXO 数量，默认为 3。
 * @param {string} [GasSpeed='high'] - 交易的 gas 速度，默认为 'high'。
 * @param {number} [highGasRate=1.1] - 高速交易的 gas 费率，默认为 1.1。只有GasSpeed='high'时才生效。
 * 
 * @returns {Promise<void>} - 返回一个 Promise，表示拆分操作的完成。
 */
export async function splitUTXO({ enBtcMnemonic, chain = 'btc', filterMinUTXOSize = 10000, splitNum = 3, GasSpeed='high', highGasRate=1.1 } ) {
    // 后面函数需要用到baseURL、network，需要首先获取
    const { network } = getNetwork(chain);
    //发送方
    const { keyPair, address: fromAddress, output: outputScript } = await generateKeyPairAndTaprootAddressFromMnemonic(enBtcMnemonic)
    const { filteredUTXOs, unconfirmedUTXOs } = await getAddressUTXOs(fromAddress, { filterMinUTXOSize });
    if (unconfirmedUTXOs.length != 0) { console.log(`地址 ${fromAddress} 有未确认交易`); return }
    if (filteredUTXOs.length == 0) { console.log(`地址 ${fromAddress} 无可用utxos`); return }
    // console.log(filteredUTXOs)

    // 创建一个新的交易构建器实例。这个构建器用于构建比特币交易，包括添加输入、输出和设置交易的其他参数。
    const psbt = new bitcoin.Psbt({ network });

    // 创建交易输入
    let inputValue = 0;
    for (const utxo of filteredUTXOs) {
        const utxoHash = utxo.txid;
        const input = {
            index: utxo.vout, // UTXO 的输出索引
            hash: utxoHash, // UTXO 的交易哈希
            witnessUtxo: {
                script: outputScript, // UTXO 的输出脚本
                value: utxo.value, // UTXO 的金额
            },
            tapInternalKey: convertToXOnly(keyPair.publicKey), // 添加 Taproot 内部密钥
        };
        psbt.addInput(input);
        inputValue += utxo.value;
    }

    const gas = await getGas({ GasSpeed, highGasRate }); 
    // 输入确定，输出有可能有个找零，所以加1
    const estimateSATS = 10.5 + psbt.data.inputs.length * 57.5 + (splitNum + 1) * 43;
    const fee = Math.ceil(gas * estimateSATS);
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

    // 生成一个经过调整的子密钥（tweaked child key），用于 Taproot 交易的签名。
    const tweakedChildNode = keyPair.tweak(
        bitcoin.crypto.taggedHash('TapTweak', convertToXOnly(keyPair.publicKey)),
    );

    // 签名所有输入
    psbt.data.inputs.forEach((input, index) => {
        psbt.signInput(index, tweakedChildNode);
    });

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
 * @param {string} enBtcMnemonic - 发送方的比特币助记词（必填）。
 * @param {string} txid - 需要加速的交易 ID（必填）。
 * @param {string} [chain='btc'] - 使用的区块链类型，默认为 'btc'。
 * @param {number} [filterMinUTXOSize=10000] - 过滤的最小 UTXO 大小，默认为 10000聪，防止烧资产。
 * @param {string} [GasSpeed='high'] - 交易的 gas 速度，默认为 'high'。
 * @param {number} [highGasRate=1.1] - 高速交易的 gas 费率，默认为 1.1。只有GasSpeed='high'时才生效。
 * 
 * @returns {Promise<void>} - 返回一个 Promise，表示加速操作的完成。
 */
export async function speedUp({ enBtcMnemonic, txid, chain = 'btc', filterMinUTXOSize = 10000, GasSpeed='high', highGasRate=1.1 } ) {
    // 后面函数需要用到baseURL、network，需要首先获取
    const { network } = getNetwork(chain);
    const { keyPair, address: fromAddress, output: outputScript } = await generateKeyPairAndTaprootAddressFromMnemonic(enBtcMnemonic)
    const { filteredUTXOs } = await getAddressUTXOs(fromAddress, { filterMinUTXOSize });
    if (filteredUTXOs.length == 0) { console.log(`地址 ${fromAddress} 无可用utxos`); return }
    // 获取当前交易信息
    const transaction = await getTransaction(txid);
    if (transaction.status.confirmed) {console.log('交易已确认，无需加速');return;}

    const unconfirmedVout = transaction.vout.find(item => item.scriptpubkey_address === fromAddress);
    if (!unconfirmedVout) { console.log(`地址 ${fromAddress} 不在交易的输出里, 无法使用CPFP加速。`); return; }
    const unconfirmedVoutIndex = transaction.vout.findIndex(item => item.scriptpubkey_address === fromAddress);
    // console.log(unconfirmedVout)
    // console.log(unconfirmedVoutIndex);

    // 创建一个新的交易构建器实例。这个构建器用于构建比特币交易，包括添加输入、输出和设置交易的其他参数。
    const psbt = new bitcoin.Psbt({ network });

    const gas = await getGas({ GasSpeed, highGasRate }); 
    // 输入就是filteredUTXOs.length和父交易的未花费utxo。输出是父交易的未花费utxo和扣除gas费之后的找零
    const estimateSize = 10.5 + (filteredUTXOs.length + 1) * 57.5 + 2 * 43;
    const estimateFee = Math.ceil((2 * gas - transaction.adjustedFeePerVsize) * estimateSize);

    // 创建交易输入
    let inputValue = 0;
    let i = 1;
    for (const utxo of filteredUTXOs) {
        if (inputValue < estimateFee) {
            const utxoHash = utxo.txid;
            // console.log(utxoHash)
            const input = {
                index: utxo.vout, // UTXO 的输出索引
                hash: utxoHash, // UTXO 的交易哈希
                witnessUtxo: {
                    script: outputScript, // UTXO 的输出脚本
                    value: utxo.value, // UTXO 的金额
                },
                tapInternalKey: convertToXOnly(keyPair.publicKey), // 添加 Taproot 内部密钥
            };
            psbt.addInput(input);
            i++;
            inputValue += utxo.value;
        } else {
            break; // 如果 inputValue 大于等于 outputValue + estimateFee，退出循环
        }
    }

    psbt.addInput({
        index: unconfirmedVoutIndex, // UTXO 的输出索引
        hash: transaction.txid, // UTXO 的交易哈希
        witnessUtxo: {
            script: outputScript, // UTXO 的输出脚本
            value: unconfirmedVout.value, // UTXO 的金额
        },
        tapInternalKey: convertToXOnly(keyPair.publicKey), // 添加 Taproot 内部密钥
    });

    const size = 10.5 + psbt.data.inputs.length * 57.5 + 2 * 43;
    const fee = Math.ceil((2 * gas - transaction.adjustedFeePerVsize) * size);

    if ((inputValue - fee) < 0) { console.log('可用utxo不足'); return }
    // 创建交易输出
    psbt.addOutput({
        address: fromAddress, // 接收方地址
        value: inputValue - fee, // 金额
    });

    psbt.addOutput({
        address: fromAddress, // 接收方地址
        value: unconfirmedVout.value, // 金额
    });

    // 生成一个经过调整的子密钥（tweaked child key），用于 Taproot 交易的签名。
    const tweakedChildNode = keyPair.tweak(
        bitcoin.crypto.taggedHash('TapTweak', convertToXOnly(keyPair.publicKey)),
    );

    // 签名所有输入
    psbt.data.inputs.forEach((input, index) => {
        psbt.signInput(index, tweakedChildNode);
    });

    // 终结所有输入，表示签名完成
    psbt.finalizeAllInputs();

    // 提取交易事务
    const psbtHex = psbt.extractTransaction().toHex();
    console.log(`正在广播交易 hex: ${psbtHex}`);
    await broadcastTx(psbtHex)
}