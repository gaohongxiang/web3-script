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

import { deCryptText } from '../crypt-module/crypt.js';

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

// Taproot 地址需要的公钥是 32 字节的哈希值（即 x 值），而不是 33 字节的压缩公钥（需要去掉压缩公钥的前缀字节（如0x02））
export const convertToXOnly = (pubKey) => pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);

/**
 * 从加密的助记词或 WIF 私钥生成密钥对和 Taproot 地址。
 * 
 * 该函数解密给定的助记词或私钥，生成种子，并通过种子生成密钥对和 Taproot 地址。
 * 
 * @param {string} enMnemonicOrWif - 加密的比特币助记词或 WIF 私钥，私钥仅支持WIF格式。
 * @returns {Promise<Object>} - 返回一个 Promise，解析为包含以下属性的对象：
 *   - {Object} keyPair - 生成的密钥对对象。
 *   - {string} address - 生成的 Taproot 地址（p2tr 格式）。
 *   - {Buffer} output - 锁定脚本的输出。
 * @throws {Error} - 如果助记词解密或生成过程中发生错误，则抛出错误。
 */
export async function getKeyPairAndTaprootInfo(enMnemonicOrWif) {
    try{
        // 解密输入的助记词或私钥
        const decryptedKey = await deCryptText(enMnemonicOrWif);
        let keyPair;
        // 判断输入是助记词还是私钥
        if(bip39.validateMnemonic(decryptedKey)){
            // 通过助记词生成种子
            const seed = await bip39.mnemonicToSeed(decryptedKey);
            // 通过种子生成根秘钥
            const root = bip32.BIP32Factory(ecc).fromSeed(seed, network);
            // 通过路径生成密钥对
            const child = root.derivePath("m/86'/0'/0'/0/0"); 
            // 将 child.privateKey 从 Uint8Array格式 转换为 Buffer
            const privateKeyBuffer = Buffer.from(child.privateKey);
            // 通过私钥创建一个 keyPair 密钥对
            keyPair = ECPairFactory(ecc).fromPrivateKey(privateKeyBuffer, {network});
        }else{
            keyPair = ECPairFactory(ecc).fromWIF(decryptedKey, network);
        }
        // 发送方地址 p2trtaproot格式，bc1p
        const { address, output } = bitcoin.payments.p2tr({internalPubkey: convertToXOnly(keyPair.publicKey), network});
        // console.log('密钥对', keyPair)
        // console.log('taprootAddress:', address)
        // console.log('锁定脚本', output)
        return { keyPair, address, output };
    } catch (error) {
        // 处理错误并抛出自定义错误信息
        throw new Error(`生成密钥对和 Taproot 地址时发生错误: ${error.message}`);
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