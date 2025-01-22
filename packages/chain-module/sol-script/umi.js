import 'dotenv/config';
import bs58 from 'bs58';

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
    createSignerFromKeypair,
    signerIdentity,
    publicKey,
    transactionBuilder,
    sol,
} from '@metaplex-foundation/umi';
import {
    TokenStandard,
    mplTokenMetadata,
    fetchDigitalAsset,
    findTokenRecordPda,
    transferV1,
} from '@metaplex-foundation/mpl-token-metadata';
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';

import { deCryptText } from '../../crypt-module/crypt.js';

/**
 * 创建 Umi 实例并设置签名者。
 * 
 * 该函数初始化 Umi 实例，连接到可用的 RPC 节点，并设置签名者身份。
 * 它会尝试连接多个 RPC 提供者，直到找到一个可用的连接。
 * 
 * @param {string} enPrivateKey - 加密的私钥
 * @returns {Promise<Object>} 返回包含 umi 实例和签名者的对象
 * @throws {Error} 如果所有 RPC 提供者都无法连接，则抛出错误
 */
async function createUmiAndSigner(enPrivateKey) {
    // 定义 RPC 提供者
    const rpcProviders = [
        { url: `https://mainnet.helius-rpc.com/?api-key=${process.env.heliusKey}`, name: 'Helius' },
        { url: `https://snowy-shy-hill.solana-mainnet.quiknode.pro/${process.env.quickNodeKey}`, name: 'QuickNode' }
    ];
    let umi;
    for (const provider of rpcProviders) {
        try {
            umi = createUmi(provider.url)
                .use(mplTokenMetadata())
                .use(dasApi());

            // 测试连接
            await umi.rpc.getLatestBlockhash();
            console.log(`成功连接到 ${provider.name} RPC`);
            break;
        } catch (error) {
            console.warn(`无法连接到 ${provider.name} RPC:`, error.message);
            if (provider === rpcProviders[rpcProviders.length - 1]) {
                throw new Error('所有 RPC 提供者都无法连接');
            }
        }
    }

    const privateKey = await deCryptText(enPrivateKey);
    const keypair = umi.eddsa.createKeypairFromSecretKey(bs58.decode(privateKey));
    const signer = createSignerFromKeypair(umi, keypair);
    umi.use(signerIdentity(signer));
    return { umi, signer };
}

/**
 * 转移 NFT 到指定地址。
 * 
 * 该函数处理 NFT 的转移操作，支持标准 NFT 和可编程 NFT (pNFT)。
 * 它会根据 NFT 的名称查找对应的资产，并处理转移所需的所有步骤。
 * 
 * @param {Object} params - 函数参数对象
 * @param {string} params.enPrivateKey - 加密的发送方私钥
 * @param {string} params.toAddress - 接收方地址
 * @param {string} params.nftName - 要转移的 NFT 名称
 * @returns {Promise<string>} 返回交易签名
 * @throws {Error} 如果找不到指定的 NFT 或转移过程中出现错误
 * 
 * 主要步骤：
 * 1. 创建 Umi 实例和签名者
 * 2. 根据 NFT 名称查找对应资产
 * 3. 获取 NFT 详细信息和代币标准
 * 4. 查找源和目标关联令牌账户
 * 5. 根据 NFT 类型（标准/可编程）准备转移参数
 * 6. 创建并发送转移交易
 */
export async function transferNft({ enPrivateKey, toAddress, nftName }) {
    // 创建 Umi 实例和签名者
    const { umi, signer } = await createUmiAndSigner(enPrivateKey);
    const fromPublicKey = signer.publicKey;
    const toPublicKey = publicKey(toAddress);

    console.log(`尝试从 ${fromPublicKey} 向 ${toPublicKey} 转账 NFT: ${nftName}`);

    // 查找指定名称的 NFT
    const assets = await umi.rpc.getAssetsByOwner({ owner: fromPublicKey });
    const matchingNft = assets.items.find(asset => asset.content.metadata.name === nftName);

    if (!matchingNft) {
        throw new Error(`NFT with name "${nftName}" not found in the wallet`);
    }

    const mint = matchingNft.id;
    console.log(`找到 NFT, Mint 地址: ${mint}`);

    // 获取 NFT 详细信息和代币标准
    const asset = await fetchDigitalAsset(umi, mint);
    const tokenStandard = asset.metadata.tokenStandard.value;

    // 查找源和目标关联令牌账户
    const sourceToken = findAssociatedTokenPda(umi, { mint, owner: fromPublicKey });
    const destinationToken = findAssociatedTokenPda(umi, { mint, owner: toPublicKey });
    const tokenAccount = await umi.rpc.getAccount(destinationToken);

    // 准备基本转移参数
    const transferParams = {
        mint,
        authority: signer,
        tokenOwner: fromPublicKey,
        destinationOwner: toPublicKey,
        sourceToken,
        destinationToken,
        tokenStandard,
    };

    // 如果是可编程 NFT，添加额外的转移参数
    if (tokenStandard === TokenStandard.ProgrammableNonFungible) {
        transferParams.sourceTokenRecord = findTokenRecordPda(umi, { mint, token: sourceToken });
        transferParams.destinationTokenRecord = findTokenRecordPda(umi, { mint, token: destinationToken });
        transferParams.authorizationRules = null; // 如果有授权规则，这里需要修改
    }

    // 创建转移指令并构建交易
    const transferInstruction = transferV1(umi, transferParams);
    const latestBlockhash = await umi.rpc.getLatestBlockhash();
    const tx = transactionBuilder()
        .add(transferInstruction)
        .setFeePayer(signer)
        .setBlockhash(latestBlockhash);

    // 发送交易并等待确认
    try {
        const result = await tx.sendAndConfirm(umi);
        const signature = bs58.encode(result.signature);
        console.log(`NFT 转移成功! 交易哈希: ${signature}`);
        return signature;
    } catch (error) {
        console.error("NFT 转移过程中发生错误:", error);
        throw error;
    }
}
