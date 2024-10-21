import fs from 'fs';
import 'dotenv/config';
import bs58 from 'bs58';

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { createTransferInstruction } from '@solana/spl-token';

import { deCryptText } from '../crypt-module/crypt.js';

/**
 * 创建与 Solana 网络的连接。
 * 
 * 该函数尝试连接到多个 RPC 提供者，并返回第一个成功的连接。
 * 
 * @returns {Promise<Connection>} - 返回一个与 Solana 网络的连接对象。
 * 
 * @throws {Error} - 如果所有 RPC 提供者都无法连接，将抛出错误。
 */
export async function createConnection() {
    // 定义 RPC 提供者
    const rpcProviders = [
        { url: `https://mainnet.helius-rpc.com/?api-key=${process.env.heliusKey}`, name: 'Helius' },
        { url: `https://snowy-shy-hill.solana-mainnet.quiknode.pro/${process.env.quickNodeKey}`, name: 'QuickNode' }
    ];
    for (const provider of rpcProviders) {
        try {
            const connection = new Connection(provider.url, 'confirmed');
            // 测试连接
            await connection.getEpochInfo();
            console.log(`使用 ${provider.name} 作为 SOL-RPC 提供者`);
            return connection;
        } catch (error) {
            console.error(`连接到 ${provider.name} 失败:`, error);
        }
    }
    throw new Error('所有 RPC 提供者都无法连接');
}

const connection = await createConnection();

/**
 * 获取指定代币的信息，包括代币地址和小数位数。
 * 
 * 该函数从指定的 JSON 文件中读取代币信息，并返回与给定代币名称相关的地址和小数位数。
 * 
 * @param {string} token - 要查询的代币名称（例如 'USDC'）。
 * @param {string} [tokenFile='./data/token.json'] - 存储代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * 
 * @returns {Object|undefined} - 返回一个包含代币地址和小数位数的对象，格式为 { tokenAddr, tokenDecimals }。
 *                               如果代币信息不存在或发生错误，则返回 undefined。
 */
function getTokenInfo(token, tokenFile = './data/token.json'){
    try{
        token = token.toUpperCase();
        const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        const tokenInfo = data['solana'][token];
        const tokenAddr = tokenInfo.address;
        const tokenDecimals = tokenInfo.decimals;
        return { tokenAddr, tokenDecimals };
    }catch(error){
        console.log(error);
        console.log(`错误: ${token} 代币信息 在 solana 网络中不存在，请先添加。`);
        return;
    }
}

/**
 * 获取指定用户的关联代币账户地址（ATA）。
 * 
 * 该函数根据提供的用户地址和代币地址，计算并返回该用户与特定代币关联的代币账户地址。spl代币的余额都是存在此地址里。
 * 
 * @param {string} owner - 用户的公钥地址，表示代币账户的所有者。
 * @param {string} tokenAddr - 代币的公钥地址，表示要查询的代币类型。
 * 
 * @returns {Promise<string>} - 返回用户与指定代币关联的代币账户地址（ATA）。
 */
export async function getAtaAddress(owner, tokenAddr){
    // TOKEN_PROGRAM_ID 是 Solana 的 SPL Token 程序（创建和管理代币的智能合约）的地址。该程序提供了创建、转移和销毁代币的功能，所有的 SPL 代币操作（如转账、铸造等）都需要通过这个程序进行。
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    // ASSOCIATED_TOKEN_PROGRAM_ID 是关联代币程序的地址。这个程序用于为每个用户的代币账户创建和管理关联账户。关联代币程序允许用户为每个代币创建一个标准化的代币账户，简化了代币账户的管理。通过这个程序，用户可以轻松地获取与特定代币相关联的账户地址。
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    const OWNER = new PublicKey(owner); 
    const MINT = new PublicKey(tokenAddr);

    const [address] = PublicKey.findProgramAddressSync(
        [OWNER.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), MINT.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const ataAddress = address.toBase58();
    return ataAddress;
}

/**
 * 获取指定地址的余额。
 * 
 * 该函数根据提供的地址和代币类型，查询并返回该地址的余额。
 * 
 * @param {Object} params - 函数参数对象。
 * @param {string} params.address - 要查询余额的地址。
 * @param {string} [params.token='SOL'] - 要查询的代币类型，默认为 'SOL'。
 * @param {string} [params.tokenFile='./data/token.json'] - 存储代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * 
 * @returns {Promise<number>} - 返回指定地址的余额。
 * 
 * @throws {Error} - 如果代币信息缺失或余额为 null，将抛出相应的错误。
 */
export async function getBalance({ address, token='SOL', tokenFile = './data/token.json' }){
    token = token.toUpperCase();
    let balance;
    if(token === 'SOL'){
        balance = await connection.getBalance(new PublicKey(address));
        balance = balance / LAMPORTS_PER_SOL;        
    }else{
        const tokenInfo = getTokenInfo(token, tokenFile);
        if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
		const { tokenAddr } = tokenInfo;
        const ataAddress = await getAtaAddress(address, tokenAddr);
        const info = await connection.getTokenAccountBalance(new PublicKey(ataAddress));
        if (info.value.uiAmount == null) throw new Error('No balance found');
        balance = info.value.uiAmount;
    }
    console.log(`地址 ${address} ${token} 余额: ${balance}`);
    return balance;
}

/**
 * 发送代币交易到多个地址。
 * 
 * 该函数根据提供的私钥、目标地址和转账金额，构建并发送一个包含多个转账指令的交易。
 * 
 * @param {string} enPrivateKey - 加密的私钥，用于生成发送方的密钥对。
 * @param {Array<Array<string>>} toData - 目标地址和对应转账金额的数组，格式为 [['地址1', 金额1], ['地址2', 金额2], ...]。
 * @param {string} token - 要转账的代币类型（例如 'SOL' 或 'USDC'）。
 * @param {string} [tokenFile='./data/token.json'] - 存储代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * 
 * @throws {Error} 如果余额不足或代币信息缺失，将输出相应的错误信息并退出。
 * 
 * 发送交易，就是构建 Instructions 数组，然后构造 Message，再放到 Transaction 里面，做签名并进行发送。
 * 
 * 主要逻辑：
 * 1. 计算所有目标地址的总转账金额。
 * 2. 解密私钥并生成密钥对。
 * 3. 检查发送方的余额是否足够进行转账。
 * 4. 根据代币类型（SOL 或 SPL 代币）构建相应的转账指令。
 * 5. 将所有转账指令添加到交易中。
 * 6. 发送交易并确认。
 */
async function transfer({ enPrivateKey, toData, token, tokenFile='./data/token.json' }){
    try{
        token = token.toUpperCase();

        let totalAmount = 0;
        for (const [, amount] of toData) {
            totalAmount += parseFloat(amount); // 计算总转账金额
        }

        // 从私钥生成密钥对
        const privateKey = await deCryptText(enPrivateKey);
        const privateKeyBytes = bs58.decode(privateKey);
        const keyPair = Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));
        const fromAddress = keyPair.publicKey.toString();

        console.log(`从 ${fromAddress} 向多个地址转账 ${token}`);

        // 创建一个新的交易
        const tx = new Transaction();

        if(token === 'SOL'){
            // 获取 SOL 余额
            const balance = await connection.getBalance(keyPair.publicKey);
            const requiredLamports = totalAmount * LAMPORTS_PER_SOL;

            if (balance < requiredLamports) {
                console.log(`余额不足，当前余额: ${balance / LAMPORTS_PER_SOL} SOL, 所需: ${requiredLamports / LAMPORTS_PER_SOL} SOL`);
                return;
            }

            // 批量转账 SOL
            for (const [toAddress, amount] of toData) {
                const transferInstruction = SystemProgram.transfer({
                    fromPubkey: keyPair.publicKey,
                    toPubkey: new PublicKey(toAddress),
                    lamports: Number(amount) * LAMPORTS_PER_SOL, // 转换为 lamports
                });
                tx.add(transferInstruction);
            }
        }else {
            const tokenInfo = getTokenInfo(token, tokenFile);
            if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
            const { tokenAddr, tokenDecimals } = tokenInfo;
            const fromAtaAddress = await getAtaAddress(fromAddress, tokenAddr);

            const info = await connection.getTokenAccountBalance(new PublicKey(fromAtaAddress));
            const requiredAmount = BigInt(totalAmount * 10 ** tokenDecimals);

            if (BigInt(info.value.amount) < requiredAmount) {
                console.log(`余额不足，当前余额: ${balance.value.amount} ${token}，所需: ${requiredAmount}`);
                return;
            }

            // 批量转账 SPL
            for (const [toAddress, amount] of toData) {
                const toAtaAddress = await getAtaAddress(toAddress, tokenAddr);
                // 创建转账指令
                // createTransferInstruction参数：source, destination, owner, amount, multiSigners = [], programId = TOKEN_PROGRAM_ID
                const transferInstruction = createTransferInstruction(
                    new PublicKey(fromAtaAddress), // 发送方 ata 地址
                    new PublicKey(toAtaAddress), // 接收方 ata 地址
                    keyPair.publicKey, // 发送方 publicKey
                    BigInt(Number(amount) * 10 ** tokenDecimals), // 转换为 BigInt
                );
                tx.add(transferInstruction);
            }
        }
    
        const latestBlockHash = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = await latestBlockHash.blockhash;    
        const signature = await sendAndConfirmTransaction(connection,tx,[keyPair], { commitment: 'confirmed', timeout: 60000 });
        console.log(`交易成功!🎉, 交易哈希: ${signature}`);
    }catch(error){throw error};
}

