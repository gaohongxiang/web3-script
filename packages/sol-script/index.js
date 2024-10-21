import fs from 'fs';
import 'dotenv/config';
import bs58 from 'bs58';

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { createTransferInstruction } from '@solana/spl-token';

import { deCryptText } from '../crypt-module/crypt.js';

// 获取环境变量
const quickNodeKey = process.env.quickNodeKey;
const heliusKey = process.env.heliusKey;

// 创建连接函数
export async function createConnection() {
    // 定义 RPC 提供者
    const rpcProviders = [
        { url: `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`, name: 'Helius' },
        { url: `https://snowy-shy-hill.solana-mainnet.quiknode.pro/${quickNodeKey}`, name: 'QuickNode' }
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
// 发送交易，就是构建 Instructions 数组，然后构造 Message，再放到 Transaction 里面，做签名并进行发送。
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

