import 'dotenv/config';
import bs58 from 'bs58';

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createTransferInstruction, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

import { deCryptText } from '../../crypt-module/crypt.js';
import { getTokenInfo } from '../../utils-module/utils.js';

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
            // console.log(`使用 ${provider.name} 作为 SOL-RPC 提供者`);
            return connection;
        } catch (error) {
            console.error(`连接到 ${provider.name} 失败:`, error);
        }
    }
    throw new Error('所有 RPC 提供者都无法连接');
}

/**
 * 获取定用户的关联代币账户地址（ATA）。 使用web3.js的findProgramAddressSync方法
 * 
 * 该函数根据提供的用户地址和代币地址，计算并返回该用户与特定代币关联的代币账户地址。spl代币的余额都是存在此地址里。
 * 
 * @param {string} owner - 用户的公钥地址，表示代币账户的所有者。
 * @param {string} tokenAddr - 代币的公钥地址，表示要查询的代币类型。
 * 
 * @returns {Promise<string>} - 返回用户与指定代币关联的代币账户地址（ATA）。
 */
export function getAtaAddress(owner, tokenAddr) {
    const OWNER = new PublicKey(owner);
    const MINT = new PublicKey(tokenAddr);

    // TOKEN_PROGRAM_ID 是 Solana 的 SPL Token 程序（创建和管理代币的智能合约）的地址。该程序提供了创建、转移销毁代币的功能，所有的 SPL 代币操作（如转账、铸造等）都需要通过这个程序进行。
    // ASSOCIATED_TOKEN_PROGRAM_ID 是关联代币程序的地址。这个程序用于为每个用户的代币账户创建和管理关联账户。关联代币程序允许用户为每个代币创建一个标准化的代币账户，简化了代币账户的管理。通过这个程序，用户可以轻松地获取与特定代币相关联的账户地址。
    const [address] = PublicKey.findProgramAddressSync(
        [OWNER.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), MINT.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    // console.log(`ATA 地址: ${address.toBase58()}`); // 输出 Base58 编码的地址
    // 返回的是publicKey类型地址
    // console.log(address)
    return address;
}

/**
 * 获取指定钱包地址的所有代币账户信息。
 * 
 * 这个函数查询并显示与给定钱包地址相关联的所有 SPL 代币账户的信息。
 * 它使用 Solana 的 getParsedProgramAccounts 方法来获取与 TOKEN_PROGRAM_ID 相关的账户数据。
 *
 * @param {string} wallet - 要查询的钱包地址（公钥）
 * @returns {Promise<void>} - 这个函数不返回值，但会在控制台打印查找到的代币账户信息
 */
export async function getTokenAccounts(wallet) {
    const connection = await createConnection();
    const filters = [
        {
            dataSize: 165,    //size of account (bytes)
        },
        {
            memcmp: {
                offset: 32,     //location of our query in the account (bytes)
                bytes: wallet,  //our search criteria, a base58 encoded string
            },
        }];
    const accounts = await connection.getParsedProgramAccounts(
        TOKEN_PROGRAM_ID, //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
        { filters: filters }
    );
    // console.log(accounts)
    console.log(`Found ${accounts.length} token account(s) for wallet ${wallet}.`);
    accounts.forEach((account, i) => {
        //Parse the account data
        const parsedAccountInfo = account.account.data;
        console.log(parsedAccountInfo)
        const mintAddress = parsedAccountInfo["parsed"]["info"]["mint"];
        const tokenBalance = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
        //Log results
        console.log(`Token Account No. ${i + 1}: ${account.pubkey.toString()}`);
        console.log(`--Token Mint: ${mintAddress}`);
        console.log(`--Token Balance: ${tokenBalance}`);
    });
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
export async function getBalance({ address, token = 'SOL', tokenFile = './data/token.json' }) {
    try {
        token = token.toUpperCase();
        const connection = await createConnection();
        let balance;
        if (token === 'SOL') {
            balance = await connection.getBalance(new PublicKey(address));
            balance = balance / LAMPORTS_PER_SOL;
        } else {
            const tokenInfo = getTokenInfo({ token, chain: 'solana', tokenFile });
            if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
            const { address: tokenAddr } = tokenInfo;
            const ataAddress = getAtaAddress(address, tokenAddr);
            const info = await connection.getTokenAccountBalance(ataAddress);
            balance = info.value.uiAmount;
        }
        console.log(`地址 ${address} ${token} 余额: ${balance}`);
        return balance;
    } catch (error) { throw error }
}

/**
 * 发送代币交易到多个地址。
 * 
 * 该函数根据提供的私钥、目标地址和转账金额，构建并发送一个包含多个转账指令的交易。
 * 
 * @param {string} enPrivateKey - 加密的私钥，用于生成发送方的密钥对。
 * @param {Array<Array<string>>} toData - 目标地址和对应转账金额的数组，格式为 [['地址1', 金额1], ['地址2', 金额2], ...]。
 * @param {string} token - 要转账的代币类型（例如 'SOL' 或 'USDC'）。
 * @param {string} [tokenFile='./data/token.json'] - 存储代币信息的 JSON 文件路径，默认 './data/token.json'。
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
export async function transfer({ enPrivateKey, toData, token, tokenFile = './data/token.json' }) {
    try {
        token = token.toUpperCase();
        const connection = await createConnection();

        let totalAmount = 0;
        for (const [, amount] of toData) {
            totalAmount += parseFloat(amount); // 计算总转账金额
        }

        // 从私钥生成密钥对
        const privateKey = await deCryptText(enPrivateKey);
        const keyPair = Keypair.fromSecretKey(bs58.decode(privateKey));
        const fromAddress = keyPair.publicKey.toString();

        // 估算统一的交易费用
        const unifiedFee = await estimateTransactionFee(connection, keyPair.publicKey);
        console.log(`估算的统一费用: ${unifiedFee / LAMPORTS_PER_SOL} SOL`);

        // 创建一个新的交易
        const tx = new Transaction();

        if (token === 'SOL') {
            // 获取 SOL 余额
            const balance = await connection.getBalance(keyPair.publicKey);
            const requiredLamports = BigInt(totalAmount * LAMPORTS_PER_SOL) + BigInt(unifiedFee);

            if (BigInt(balance) < requiredLamports) {
                console.log(`余额不足，当前余额: ${balance / LAMPORTS_PER_SOL} SOL, 所需: ${Number(requiredLamports) / LAMPORTS_PER_SOL} SOL`);
                return;
            }

            // 批量转账 SOL
            for (const [toAddress, amount] of toData) {
                tx.add(SystemProgram.transfer({
                    fromPubkey: keyPair.publicKey,
                    toPubkey: new PublicKey(toAddress),
                    lamports: Number(amount) * LAMPORTS_PER_SOL, 
                }));
                console.log(`从 ${fromAddress} 向 ${toAddress} 转账 ${amount} SOL`);
            }
        } else {
            const tokenInfo = getTokenInfo({ token, chain: 'solana', tokenFile });
            if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
            const { address: tokenAddr, decimals: tokenDecimals } = tokenInfo;
            const mint = new PublicKey(tokenAddr);
            const fromAta = await getOrCreateAssociatedTokenAccount(connection, keyPair, mint, keyPair.publicKey);
            const info = await connection.getTokenAccountBalance(fromAta.address);
            const requiredAmount = BigInt(totalAmount * 10 ** tokenDecimals);

            if (BigInt(info.value.amount) < requiredAmount) {
                console.log(`${token} 余额不足，当前余额: ${info.value.uiAmount} ${token}，所需: ${requiredAmount} ${token}`);
                return;
            }

            // 检查 SOL 余额是否足够支付费用
            const solBalance = await connection.getBalance(keyPair.publicKey);
            if (solBalance < unifiedFee) {
                console.log(`SOL 余额不足以支付交易费用，当前余额: ${solBalance / LAMPORTS_PER_SOL} SOL, 所需: ${unifiedFee / LAMPORTS_PER_SOL} SOL`);
                return;
            }

            // 批量转账 SPL
            await Promise.all(toData.map(async ([toAddress, amount]) => {
                const owner = new PublicKey(toAddress);
                const toAta = await getOrCreateAssociatedTokenAccount(connection, keyPair, mint, owner);
                // createTransferInstruction参数：source, destination, owner, amount, multiSigners = [], programId = TOKEN_PROGRAM_ID
                tx.add(createTransferInstruction(
                    fromAta.address,
                    toAta.address,
                    keyPair.publicKey,
                    BigInt(Number(amount) * 10 ** tokenDecimals),
                ));
                console.log(`从 ${fromAddress} 向 ${toAddress} 转账 ${amount} ${token}`);
            }));
        }

        const latestBlockHash = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = await latestBlockHash.blockhash;
        // maxRetries重试次数。skipPreflight跳过预检查
        const signature = await sendAndConfirmTransaction(connection, tx, [keyPair], { commitment: 'confirmed', maxRetries: 5, skipPreflight: false });
        console.log(`交易成功!🎉, 交易哈希: ${signature}`);
    } catch (error) {
        console.error('转账过程中发生错误:', error);
        throw error;
    }
}

/**
 * 将多个地址的 SOL 或 SPL 代币归集到一个地址。
 * 
 * @param {Object} params - 函数参数对象
 * @param {Array<string>} params.enPrivateKeys - 加密的私钥数组
 * @param {string} params.toAddress - 归集目标地址
 * @param {string} params.token - 代币类型（'SOL' 或 SPL 代币名称）
 * @param {string} [params.tokenFile='./data/token.json'] - 代币信息文件路径
 * @returns {Promise<string|null>} 返回交易签名，如果没有执行交易则返回 null
 */
export async function consolidateFunds({ enPrivateKeys, toAddress, token, tokenFile = './data/token.json' }) {
    const connection = await createConnection();
    token = token.toUpperCase();
    const toPublicKey = new PublicKey(toAddress);
    let tx = new Transaction();
    const signers = [];

    // 估算统一的交易费用
    const firstPrivateKey = await deCryptText(enPrivateKeys[0]);
    const firstKeyPair = Keypair.fromSecretKey(bs58.decode(firstPrivateKey));
    const unifiedFee = await estimateTransactionFee(connection, firstKeyPair.publicKey);
    console.log(`估算的统一费用: ${unifiedFee / LAMPORTS_PER_SOL} SOL`);

    for (const enPrivateKey of enPrivateKeys) {
        try {
            const privateKey = await deCryptText(enPrivateKey);
            const keyPair = Keypair.fromSecretKey(bs58.decode(privateKey));
            const fromAddress = keyPair.publicKey.toString();

            if (token === 'SOL') {
                const balance = await connection.getBalance(keyPair.publicKey);
                const transferAmount = Math.max(balance - unifiedFee, 0);
                if (transferAmount > 0) {
                    tx.add(SystemProgram.transfer({
                        fromPubkey: keyPair.publicKey,
                        toPubkey: toPublicKey,
                        lamports: transferAmount,
                    }));
                    signers.push(keyPair);
                    console.log(`从 ${fromAddress} 归集 ${transferAmount / LAMPORTS_PER_SOL} SOL 到 ${toAddress}`);
                } else {
                    console.log(`${fromAddress} SOL 余额不足以支付交易费用和保持账户活跃`);
                }
            } else {
                // SPL token 逻辑
                const tokenInfo = getTokenInfo({ token, chain: 'solana', tokenFile });
                if (!tokenInfo) {
                    console.log('没有此代币信息，请先添加');
                    continue;
                }
                const mint = new PublicKey(tokenInfo.address);
                const fromAta = await getOrCreateAssociatedTokenAccount(connection, keyPair, mint, keyPair.publicKey);
                const toAta = await getOrCreateAssociatedTokenAccount(connection, keyPair, mint, toPublicKey);

                const tokenBalance = await connection.getTokenAccountBalance(fromAta.address);
                const transferAmount = tokenBalance.value.amount;

                if (parseInt(transferAmount) > 0) {
                    // 检查 SOL 余额是否足够支付费用
                    const solBalance = await connection.getBalance(keyPair.publicKey);
                    if (solBalance < unifiedFee) {
                        console.log(`${fromAddress} SOL 余额不足以支付交易费用`);
                        continue;
                    }

                    tx.add(createTransferInstruction(
                        fromAta.address,
                        toAta.address,
                        keyPair.publicKey,
                        BigInt(transferAmount)
                    ));
                    signers.push(keyPair);
                    console.log(`从 ${fromAddress} 归集 ${transferAmount / (10 ** tokenInfo.decimals)} ${token} 到 ${toAddress}`);
                } else {
                    console.log(`${fromAddress} ${token} 余额为零`);
                }
            }
        } catch (error) {
            console.error(`处理账户时发生错误:`, error);
        }
    }

    if (tx.instructions.length > 0) {
        try {
            const signature = await sendAndConfirmTransaction(connection, tx, signers, {
                commitment: 'confirmed',
                maxRetries: 5,
                skipPreflight: false
            });
            console.log(`归集成功! 交易哈希: ${signature}`);
            return signature;
        } catch (error) {
            console.error('发送交易时发生错误:', error);
            console.error('错误详情:', error.logs);
            // 不要抛出错误，而是返回 null
            return null;
        }
    } else {
        console.log('没有可归集的余额');
        return null;
    }
}

async function estimateTransactionFee(connection, payer) {
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer;

    // 创建一个临时指令来估算费用（使用SOL转账作为基准）
    const tempInstruction = SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: payer, // 转给自己，只是为了估算
        lamports: 1000, // 使用一个固定的小额来估算
    });

    tx.add(tempInstruction);
    const estimatedFee = await connection.getFeeForMessage(tx.compileMessage(), 'confirmed');

    if (estimatedFee.value === null) {
        throw new Error('无法估算交易费用');
    }

    const RENT_EXEMPTION_FEE = await connection.getMinimumBalanceForRentExemption(0);
    const SAFETY_MARGIN = 0.00001 * LAMPORTS_PER_SOL; // 0.00001 SOL 作为安全边际

    // 返回一个统一的费用，包含了估算的交易费用、租金豁免费用和安全边际
    return estimatedFee.value + RENT_EXEMPTION_FEE + SAFETY_MARGIN;
}
