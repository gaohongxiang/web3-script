import * as bitcoin from 'bitcoinjs-lib';
/**
 * 加密相关的库
 * bip39 实现了 BIP39（助记词生成）标准，允许用户通过一组助记词（通常是 12、15、18、21 或 24 个单词）来生成种子。这个种子可以用于生成密钥对
 * bip32 实现了 BIP32（分层确定性钱包）标准，允许用户从一个种子生成一系列的私钥和公钥。它支持生成子密钥，适用于创建分层结构的密钥管理系统。
 * tiny-secp256k1 用于处理椭圆曲线加密的库，特别是 secp256k1 曲线。它常用于加密货币（如比特币）中的密钥生成、签名和验证。
 * ecpair 用于创建和管理椭圆曲线密码学（ECC）密钥对
**/
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

import { deCryptText } from '../../crypt-module/crypt.js';

//将 tiny-secp256k1 库初始化为比特币库（bitcoinjs-lib）所使用的椭圆曲线加密库。即 bitcoinjs-lib 库将能够利用 tiny-secp256k1 进行加密操作。
bitcoin.initEccLib(ecc);

// 调用getNetwork的时候会赋值，后面函数用
let baseURl, network;

/**
 * 根据提供的网络类型，返回相应的 API 基本 URL 和比特币网络配置。
 * 
 * @param {string} chain - 网络类型。
 * @returns {Object} - 返回一个对象，包含以下属性：
 *   - {string} baseURl - 该网络的 API 基本 URL。
 *   - {Object} network - 比特币网络配置对象。
 * @throws {Error} - 如果提供的网络类型无效，则抛出错误。
 */
export function getNetwork(chain){
    chain = chain.toUpperCase();
    if (['BITCOIN', 'BTC'].includes(chain)) {
        baseURl = 'https://mempool.space/api';
        network = bitcoin.networks.bitcoin;
    } else if (['FRACTAL', 'FB', 'FRACTALBITCOIN'].includes(chain)) {
        baseURl = 'https://mempool.fractalbitcoin.io/api'
        network = bitcoin.networks.bitcoin;
    } else {
        throw new Error('无效的网络类型');
    }
    return { network, baseURl }
}

/**
 * 获取当前的 gas 费率。
 * 该函数从指定的 API 获取推荐的交易费用，并根据设定的 gas 速度调整费用。
 * 
 * @param {Object} options - 选项对象。
 * @param {string} [options.GasSpeed='high'] - 交易的 gas 速度，默认为 'high'。
 * @param {number} [options.highGasRate=1.1] - 高速交易的 gas 费率，默认为 1.1。
 * 
 * @returns {Promise<number>} - 返回一个 Promise，解析为当前的 gas 费率（以 satoshis per byte 为单位）。
 * fastestFee、halfHourFee、hourFee、economyFee、minimumFee
 * 
 * @throws {Error} - 如果请求失败或返回的数据格式不正确，则抛出错误。
 */
export async function getGas({ GasSpeed='high', highGasRate=1.1 }) {
    const response = await fetch(`${baseURl}/v1/fees/recommended`);
    let gas = await response.json();
    switch (GasSpeed) {
        case 'high':
            if (highGasRate) {
                gas = Math.ceil(gas.fastestFee * highGasRate); //推荐的最高gas的utxoHighGasRate倍
            } else {
                gas = gas.fastestFee; // 使用默认的 fastestFee
            }
            break;
        case 'medium':
            gas = gas.halfHourFee; // 使用 halfHourFee
            break; 
        case 'low':
            gas = gas.hourFee; // 使用 hourFee
            break;
        default:
            throw new Error('无效gas速率'); // 处理无效的 utxoGasSpeed
    }
    return gas;
}

/**
 * 估算手续费(未验证)
 */
export function estimateTransactionFee(psbt, feeRate) {
    const virtualSize = psbt.extractTransaction().virtualSize();
    return Math.ceil(virtualSize * feeRate);
}

/**
 * 动态估算交易大小
 * @param {number} inputCount - 输入 UTXO 的数量
 * @param {number} outputCount - 输出 UTXO 的数量
 * @param {string} [scriptType='P2TR'] - 脚本类型，默认为 'P2TR'
 * @param {string} [GasSpeed='high'] - 交易的 gas 速度，默认为 'high'
 * @param {number} [highGasRate=1.1] - 高速交易的 gas 费率，默认为 1.1
 * @returns {Promise<number>} - 估算的交易费用
 * 
 * 交易大小预估网站：https://bitcoinops.org/en/tools/calc-size/
 */
export function estimateTransactionSize({ inputCount, outputCount, scriptType = 'P2TR' }) {
    let baseSize; // 基础大小
    let inputSize; // 每个输入的平均大小
    let outputSize; // 每个输出的平均大小
    const lockTimeSize = 4; // 锁定时间大小

    // 根据类型设置基础大小和输入/输出大小
    switch (scriptType.toUpperCase()) {
        case 'P2TR': // 地址以 bc1p 开头
            baseSize = 10.5; 
            inputSize = 57.5;
            outputSize = 43;
            break;
        case 'P2WPKH': // 地址以 bc1q 开头
            baseSize = 10.5;
            inputSize = 68;
            outputSize = 31;
            break;
        case 'P2PKH': // 地址以 1 开头
            baseSize = 10;
            inputSize = 148;
            outputSize = 34;
            break;
        default:
            throw new Error(`不支持的脚本类型: ${type}`); // 处理不支持的类型
    }

    // 估算交易大小
    const estimateSize = baseSize + (inputCount * inputSize) + (outputCount * outputSize);
    
    return estimateSize;
}

// Taproot 地址需要的公钥是 32 字节的哈希值（即 x 值），而不是 33 字节的压缩公钥（需要去掉压缩公钥的前缀字节（如0x02））
export const convertToXOnly = (pubKey) => pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);

/**
 * 生成密钥对和指定类型的比特币地址。
 * 
 * 该函数根据输入的助记词或 WIF 私钥生成一个密钥对，并根据指定的脚本类型（P2TR、P2WPKH 或 P2PKH）生成相应的比特币地址和锁定脚本。
 * 
 * @param {string} enMnemonicOrWif - 加密后的助记词或 WIF 私钥。
 * @param {string} [scriptType='P2TR'] - 脚本类型（P2TR、P2WPKH、P2PKH）。
 * 
 * @returns {Promise<Object>} - 返回一个 Promise，解析为一个对象，包含以下属性：
 *   - {Object} keyPair - 生成的密钥对。
 *   - {string} address - 生成的比特币地址。bc1p(P2TR) | bc1q(P2WPKH) | 1(P2PKH)
 *   - {Buffer} output - 生成的锁定脚本。
 * 
 * @throws {Error} - 如果生成密钥对或地址时发生错误，则抛出错误。
 */
export async function getKeyPairAndAddressInfo(enMnemonicOrWif, scriptType = 'P2TR') {
    try{
        // 解密输入的助记词或私钥
        const decryptedKey = await deCryptText(enMnemonicOrWif);
        let keyPair, address, output;
        // 判断输入是助记词还是私钥
        if(bip39.validateMnemonic(decryptedKey)){
            // 通过助记词生成种子
            const seed = await bip39.mnemonicToSeed(decryptedKey);
            // 通过种子生成根秘钥
            const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
            let child;
            // 通过路径生成密钥对
            // 根据地址类型选择派生路径
            switch (scriptType.toUpperCase()) {
                case 'P2TR':
                    child = root.derivePath("m/86'/0'/0'/0/0"); // bc1p
                    break;
                case 'P2WPKH':
                    child = root.derivePath("m/84'/0'/0'/0/0"); // bc1q
                    break;
                case 'P2PKH':
                    child = root.derivePath("m/44'/0'/0'/0/0"); // 1
                    break;
                default:
                    throw new Error(`不支持的脚本类型: ${scriptType}`);
            }
            const privateKeyBuffer = Buffer.from(child.privateKey);
            // 通过私钥创建一个 keyPair 密钥对
            keyPair = ECPairFactory(ecc).fromPrivateKey(privateKeyBuffer, {network});
        }else{
            console.log('确保传入的是scriptType类型的wif, 否则会导致超预期的密钥对!');
            keyPair = ECPairFactory(ecc).fromWIF(decryptedKey, network);
        }
        // 生成地址和输出
        switch (scriptType.toUpperCase()) {
            case 'P2TR':
                ({ address, output } = bitcoin.payments.p2tr({internalPubkey: convertToXOnly(keyPair.publicKey),network}));
                break;
            case 'P2WPKH':
                ({ address, output } = bitcoin.payments.p2wpkh({pubkey: keyPair.publicKey,network}));
                break;
            case 'P2PKH':
                ({ address, output } = bitcoin.payments.p2pkh({pubkey: keyPair.publicKey,network}));
                break;
            default:
                throw new Error(`不支持的脚本类型: ${scriptType}`);
        }
        // console.log('密钥对', keyPair)
        // console.log('taprootAddress:', address)
        // console.log('锁定脚本', output)
        return { keyPair, address, output };
    } catch (error) {
        // 处理错误并抛出自定义错误信息
        throw new Error(`生成密钥对和地址时发生错误: ${error.message}`);
    }
}

/**
 * 将可用的 UTXO 添加到 PSBT（部分签名交易）中。
 * 
 * 该函数遍历提供的 UTXO 列表，并根据目标转账金额和估算的手续费添加输入。
 * 如果未提供目标金额，则将所有可用的 UTXO 添加到 PSBT 中。
 * 
 * @param {Object} psbt - PSBT 实例，用于构建和管理部分签名交易。
 * @param {Array} UTXOs - 可用的 UTXO 列表，每个 UTXO 应包含 txid、vout 和金额等信息。
 * @param {number} [value] - 目标转账金额加上估算的手续费。如果未提供，则将所有 UTXO 添加到 PSBT。
 * @param {Buffer} outputScript - 输出脚本，定义了接收方的地址和转账条件。
 * @param {Object} keyPair - 发送方的密钥对，用于签名交易。
 * @param {string} [scriptType='P2TR'] - 脚本类型（P2PKH、P2WPKH、P2TR）。
 * 
 * @returns {number} - 返回添加到 PSBT 的输入的总金额（以聪为单位）。
 * 
 * @throws {Error} - 如果可用 UTXO 不足以满足目标金额，则抛出错误。
 */
export function addInputsToPsbt({ psbt, UTXOs, value, outputScript, keyPair, scriptType = 'p2tr' }) {
    let inputValue = 0;

    for (const utxo of UTXOs) {
        // 如果传递了 value，检查是否已达到所需的输入值
        if (value !== undefined && inputValue >= value) {
            break; // 如果 inputValue 大于等于 value，退出循环
        }

        const input = {
            index: utxo.vout, // UTXO 的输出索引
            hash: utxo.txid, // UTXO 的交易哈希
            witnessUtxo: {
                script: outputScript, // UTXO 的输出脚本
                value: utxo.value,
            },
        };

        // 根据脚本类型添加特定的输入信息
        if (scriptType.toUpperCase() === 'P2TR') {
            input.tapInternalKey = convertToXOnly(keyPair.publicKey); // 添加 Taproot 内部密钥
        }

        psbt.addInput(input);
        inputValue += utxo.value;
    }

    // 检查可用 UTXO 是否足够
    if (value !== undefined && inputValue < value) {
        console.log('可用 UTXO 不足');
        return; // 这里可以考虑抛出错误或返回特定值
    }

    return inputValue;
}

/**
 * 签名所有输入
 * @param {Object} psbt - PSBT 实例
 * @param {Object} keyPair - 发送方的密钥对
 * @param {string} scriptType - 脚本类型（P2PKH、P2WPKH、P2TR）
 * @returns {void}
 */
export function signInputs(psbt, keyPair, scriptType) {
    // 根据脚本类型生成相应的签名
    if (scriptType.toUpperCase() === 'P2TR') {
        // 生成一个经过调整的子密钥（tweaked child key），用于 Taproot 交易的签名。
        const tweakedChildNode = keyPair.tweak(
            bitcoin.crypto.taggedHash('TapTweak', convertToXOnly(keyPair.publicKey))
        );

        // 签名所有输入
        psbt.data.inputs.forEach((input, index) => {
            psbt.signInput(index, tweakedChildNode);
        });
    } else {
        // 对于 P2PKH 和 P2WPKH，使用原始私钥进行签名
        psbt.data.inputs.forEach((input, index) => {
            psbt.signInput(index, keyPair);
        });
    }
}

/**
 * 广播交易到区块链网络。
 * 该函数将给定的交易十六进制字符串发送到指定的 API，以广播交易。
 * @param {string} psbtHex - 交易的十六进制表示（必填）。
 * @returns {Promise<string>} - 返回一个 Promise，解析为交易 ID。
 * @throws {Error} - 如果发送交易时发生错误，则抛出错误。
 */
export async function broadcastTx(psbtHex) {
    try {
        const response = await fetch(`${baseURl}/tx`, {
            "method": 'POST',
            "body": psbtHex,
        });
        // console.log(response)
        const tx = await response.text(); 
        console.log('Transaction ID:', tx);
        return tx; // 返回响应数据
    } catch (error) {
        console.error('发送交易时出错:', error);
        throw error; // 抛出错误以便调用者处理
    }
}

/**
 * 获取指定交易的详细信息。
 * 该函数从指定的 API 获取给定交易 ID 的交易信息，并返回交易对象。
 * @param {string} txid - 要查询的交易 ID（必填）。
 * @returns {Promise<Object>} - 返回一个 Promise，解析为交易对象。
 * @throws {Error} - 如果交易未找到或无效，则抛出错误。
 */
export async function getTransaction(txid){
    const response = await fetch(`${baseURl}/v1/tx/${txid}`);
    const transaction = await response.json();
    // console.log(transaction)
    if (!transaction || !transaction.vout) {
        throw new Error('交易未找到或无效');
    }
    return transaction;
}

/**
 * 查找调整后的被除数及余数。
 * 该函数计算给定被除数和除数的调整后的被除数（最接近的能整除的数）及余数。
 * @param {number} dividend - 被除数（必填）。
 * @param {number} divisor - 除数（必填）。
 * @returns {Object} - 返回一个对象，包含以下属性：
 *   - {number} adjustedDividend - 调整后的被除数（最接近的能整除的数）。
 *   - {number} remainder - 余数。
 * @throws {Error} - 如果除数为 0，则抛出错误。
 */
export function findAdjustedDividendWithRemainder(dividend, divisor) {
    // 首先检查除数是否为0，以避免除以0的错误
    if (divisor === 0) {
      throw new Error('除数不能为0');
    }

    let adjustedDividend, remainder;
    // 判断是否能整除
    if (dividend % divisor === 0) {
        // console.log(`${dividend} 能被 ${divisor} 整除`);
        adjustedDividend = dividend;
        remainder = 0;
    } else {
        // 不能整除时，找到最接近的能整除的数
        // 计算商并向下取整
        const quotient = Math.floor(dividend / divisor);
        // 计算最接近的能整除的数
        adjustedDividend = quotient * divisor;
        // console.log(`最接近的能整除的数是 ${adjustedDividend}`);
        remainder = dividend - adjustedDividend;
    }
  
    // 返回调整后的被除数及余数
    return { adjustedDividend, remainder };
  }