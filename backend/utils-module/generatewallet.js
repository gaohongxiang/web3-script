import fsp from 'fs/promises'; // 使用 promises API，并将导入名称更改为 fsp
import bs58 from 'bs58';

import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import * as bitcoin from 'bitcoinjs-lib';

import { ethers } from 'ethers';

import solanaWeb3 from '@solana/web3.js';

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { getCurrentTime, generateRandomString } from './utils.js';
import { enCryptText } from '../crypt-module/crypt.js';

/**
 * 创建指定数量的以太坊钱包，并将其信息加密存储到 CSV 文件中。
 * @param {number} num - 要创建的钱包数量，默认为 10。
 */
export async function generateEthWallet(num = 10) {
  const currentTime = getCurrentTime();
  const walletfile = `./backend/data/walletEth-${currentTime}.csv`; // 生成文件名

  // 判断文件是否存在
  try {
    await fsp.access(walletfile);
  } catch {
    // 文件不存在则创建文件并写入标题行
    const header = 'indexId,ethAddress,enEthPrivateKey,enEthMnemonic\n';
    await fsp.writeFile(walletfile, header);
  }

  const file = await fsp.open(walletfile, 'a');

  for (let i = 1; i <= num; i++) {
    const wallet = ethers.Wallet.createRandom();
    const enPrivateKey = await enCryptText(wallet.privateKey);
    const enMnemonic = await enCryptText(wallet.mnemonic.phrase);
    const rowData = `${i},${wallet.address},${enPrivateKey},${enMnemonic}\n`;

    // 文件存在则追加
    await file.appendFile(rowData);
  }

  await file.close();
  console.log(`已将 ${num} 个钱包存储到 ${walletfile}`);
}

/**
 * 创建指定数量的比特币钱包，并将其信息加密存储到 CSV 文件中。
 * @param {number} num - 要创建的钱包数量，默认为 10。
 */
export async function generateBtcWallet(num = 10) {
  //将 tiny-secp256k1 库初始化为比特币库（bitcoinjs-lib）所使用的椭圆曲线加密库。即 bitcoinjs-lib 库将能够利用 tiny-secp256k1 进行加密操作。
  bitcoin.initEccLib(ecc);

  // Taproot 地址需要的公钥是 32 字节的哈希值（即 x 值），而不是 33 字节的压缩公钥（需要去掉压缩公钥的前缀字节（如0x02））
  const convertToXOnly = (pubKey) => pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);

  const currentTime = getCurrentTime();
  const walletfile = `./backend/data/walletBtc-${currentTime}.csv`; // 生成文件名

  // 判断文件是否存在
  try {
    await fsp.access(walletfile);
  } catch {
    // 文件不存在则创建文件并写入标题行
    const header = 'indexId,btcAddress,enBtcPrivateKey,enBtcMnemonic\n';
    await fsp.writeFile(walletfile, header);
  }

  const file = await fsp.open(walletfile, 'a');

  for (let i = 1; i <= num; i++) {
    const network = bitcoin.networks.bitcoin; // 指定比特币网络
    // 生成助记词
    const mnemonic = bip39.generateMnemonic(); // 生成 12 个单词的助记词
    const seed = bip39.mnemonicToSeedSync(mnemonic); // 将助记词转换为种子
    const root = bip32.BIP32Factory(ecc).fromSeed(seed); // 通过种子生成根秘钥
    const child = root.derivePath("m/86'/0'/0'/0/0"); // 根据 BIP86 生成密钥对
    const privateKeyBuffer = Buffer.from(child.privateKey); // 将 child.privateKey 从 Uint8Array格式 转换为 Buffer
    const keyPair = ECPairFactory(ecc).fromPrivateKey(privateKeyBuffer, { network }); // 通过私钥创建一个 keyPair 密钥对
    const { address } = bitcoin.payments.p2tr({ internalPubkey: convertToXOnly(keyPair.publicKey), network });
    const privateKey = keyPair.toWIF(); // 将privateKey转换为WIF格式
    // console.log(address)
    // console.log(mnemonic)
    // console.log(privateKey)
    const enPrivateKey = await enCryptText(privateKey);
    const enMnemonic = await enCryptText(mnemonic);
    const rowData = `${i},${address},${enPrivateKey},${enMnemonic}\n`;

    // 文件存在则追加
    await file.appendFile(rowData);
  }

  await file.close();
  console.log(`已将 ${num} 个钱包存储到 ${walletfile}`);
}

/**
 * 创建指定数量的 Solana 钱包，并将其信息加密存储到 CSV 文件中。
 * @param {number} num - 要创建的钱包数量，默认为 10。
 */
export async function generateSolWallet(num = 10) {
  const currentTime = getCurrentTime();
  const walletfile = `./backend/data/walletSol-${currentTime}.csv`; // 生成文件名

  // 判断文件是否存在
  try {
    await fsp.access(walletfile);
  } catch {
    // 文件不存在则创建文件并写入标题行
    const header = 'indexId,solAddress,enSolPrivateKey\n';
    await fsp.writeFile(walletfile, header);
  }

  const file = await fsp.open(walletfile, 'a');

  for (let i = 1; i <= num; i++) {
    const keyPair = solanaWeb3.Keypair.generate();
    const address = keyPair.publicKey.toString();
    const secretKey = keyPair.secretKey;
    const base58EncodedKey = bs58.encode(secretKey);
    const enPrivateKey = await enCryptText(base58EncodedKey);

    const rowData = `${i},${address},${enPrivateKey}\n`;
    // 文件存在则追加
    await file.appendFile(rowData);
  }

  await file.close();
  console.log(`已将 ${num} 个钱包存储到 ${walletfile}`);
}

/**
 * 创建指定数量的 Sui 钱包，并将其信息加密存储到 CSV 文件中。
 * @param {number} num - 要创建的钱包数量，默认为 10。
 */
export async function generateSuiWallet(num = 10) {
  const currentTime = getCurrentTime();
  const walletfile = `./backend/data/walletSui-${currentTime}.csv`; // 生成文件名

  // 判断文件是否存在
  try {
    await fsp.access(walletfile);
  } catch {
    // 文件不存在则创建文件并写入标题行
    const header = 'indexId,suiAddress,enSuiPrivateKey\n';
    await fsp.writeFile(walletfile, header);
  }

  const file = await fsp.open(walletfile, 'a');

  for (let i = 1; i <= num; i++) {
    const keypair = new Ed25519Keypair();
    const address = keypair.getPublicKey().toSuiAddress();
    const enPrivateKey = await enCryptText(keypair.getSecretKey());
    const rowData = `${i},${address},${enPrivateKey}\n`;

    // 文件存在则追加
    await file.appendFile(rowData);
  }

  await file.close();
  console.log(`已将 ${num} 个钱包存储到 ${walletfile}`);
}

/**
 * 生成指定数量的随机密码，并将其加密后存储到 CSV 文件中。
 * @param {number} num - 要生成的密码数量，默认为 10。
 */
export async function generatePassword(num = 10) {
  const currentTime = getCurrentTime();
  const walletfile = `./backend/data/walletPassword-${currentTime}.csv`; // 生成文件名

  // 判断文件是否存在
  try {
    await fsp.access(walletfile);
  } catch {
    // 文件不存在则创建文件并写入标题行
    const header = 'indexId,enPassword\n';
    await fsp.writeFile(walletfile, header);
  }

  const file = await fsp.open(walletfile, 'a');

  for (let i = 1; i <= num; i++) {
    const randomPassword = generateRandomString(18);
    // console.log(randomPassword);
    const enPassword = await enCryptText(randomPassword);
    const rowData = `${i},${enPassword}\n`;

    // 文件存在则追加
    await file.appendFile(rowData);
  }

  await file.close();
  console.log(`已将 ${num} 个钱包存储到 ${walletfile}`);
}

/**
 * 在现有的 CSV 文件中添加新列（加密密码）并补全值，并将结果写回到现有的 CSV 文件中。
 * @param {string} filePath - 要读取和更新的现有 CSV 文件路径。
 * @param {string} newColumnName - 要添加的新列的列名。
 */
export async function addColumnAndPopulate(filePath, newColumnName) {
  try {
    const data = await fsp.readFile(filePath, 'utf8');

    // 解析 CSV 文件内容
    const rows = data.split('\n');
    const header = rows.shift().split(',');

    // 添加新列名
    header.push(newColumnName);

    // 更新每一行的值
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].split(',');
      const randomPassword = generateRandomString(18);
      const enPassword = await enCryptText(randomPassword);
      row.push(enPassword);
      rows[i] = row.join(',');
    }

    // 生成更新后的 CSV 文件内容
    const updatedContent = [header.join(','), ...rows].join('\n');

    // 写回到现有的 CSV 文件
    await fsp.writeFile(filePath, updatedContent, 'utf8');
    console.log('成功添加新列');
  } catch (err) {
    console.error('添加新列失败：', err);
  }
}