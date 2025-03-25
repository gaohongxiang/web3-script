import { ethers } from 'ethers-v6';
import { CHAIN_TO_ADDRESSES_MAP } from '@uniswap/sdk-core';
import { AllowanceTransfer, PERMIT2_ADDRESS } from '@uniswap/permit2-sdk';
import { RoutePlanner, CommandType, UNIVERSAL_ROUTER_ADDRESS, UniversalRouterVersion } from '@uniswap/universal-router-sdk';
import { EVMClient } from './index.js';
import { notificationManager } from '../../notification-module/notification.js';

/**
 * 交易类
 * 继承自EVMClient基类
 */
export class TradeClient extends EVMClient {

    /**
     * 创建UniswapV3Client实例
     * @param {Object} options - 配置选项
     * @param {string} options.chain - 链名称
     * @param {string} [options.rpcProvider='infura'] - RPC提供商名称
     * @param {string} [options.enPrivateKey] - 加密的私钥
     * @param {string} [options.socksProxyUrl=null] - 代理URL
     * @param {string} [options.tokenFile='./data/token.json'] - 代币信息文件路径
     * @returns {Promise<TradeClient>} - 初始化完成的TradeClient实例
     */
    static async create(options) {
        // 调用父类的create方法创建实例
        const instance = await super.create(options);
        return instance;
    }

    /**
      * 执行代币兑换
      * @param {Object} params - 兑换参数
      * @param {string} params.tokenIn - 输入代币地址
      * @param {string} params.tokenOut - 输出代币地址
      * @param {string|number} params.amount - 输入金额
      * @param {string|number} params.permit2AllowanceAmount - 授权给permit2合约的额度
      * @param {number} [params.slippage=0.5] - 滑点百分比
      * @param {number} [params.permitDeadline=10] - 授权过期时间(分钟)
      * @param {Object} [params.gasOptions={ multiplier: 1.1, useEIP1559: false }] - 交易gas选项
      * @returns {Promise<ethers.ContractTransactionResponse>} 交易结果
      * 
      * 代币授权给permit2合约 -> permit2签名后将代币转移给路由合约 -> 路由合约执行兑换交易
      * 
      * 理论上代币可以无限授权给permit2合约，然后每次permit2合约签名（有作用域、有有效期）后将代币转移给路由合约，因为签名不需要上链，所以就省了一笔gas费。
      * 但是正因为签名不上链，有些无感，如果被骗permit2签名，那么签名的资金就会被盗。所以最好代币不要无限授权给permit2合约，可以设置一个相对够用的量，这些量内只需要一笔gas就可以完成交易，相对也安全。兼顾效率和安全。
      */
    async uniswapUniversalRouterV3Swap({
        tokenIn,
        tokenOut,
        amountIn,
        permit2AllowanceAmount = 100,
        slippage = 0.5,
        permitDeadline = 10,
        gasOptions = { multiplier: 1.0, useEIP1559: false }
    }) {
        try {
            tokenIn = tokenIn.toUpperCase();
            tokenOut = tokenOut.toUpperCase();
            // 原生代币和包装代币互换先忽略，因为不需要通过uniswap路由
            // 例如: ETH -> WETH 或 WETH -> ETH
            if (tokenIn === `W${tokenOut}` || tokenOut === `W${tokenIn}`) {
                console.log('原生代币和包装代币互换,暂时忽略');
                return null;
            }
            // 获取token信息
            let formattedTokenIn = tokenIn;
            let formattedTokenOut = tokenOut;
            if (this.isNativeToken(tokenIn)) { formattedTokenIn = `W${tokenIn}`; }
            if (this.isNativeToken(tokenOut)) { formattedTokenOut = `W${tokenOut}`; }
            const tokenInInfo = this.tokens[formattedTokenIn];
            const tokenOutInfo = this.tokens[formattedTokenOut];
            if (!tokenInInfo || !tokenOutInfo) { throw new Error(`${this.formattedChain}网络 没有${formattedTokenIn}或${formattedTokenOut}代币信息，请先添加`); }
            const { address: tokenInAddress, decimals: tokenInDecimals } = tokenInInfo;
            const { address: tokenOutAddress, decimals: tokenOutDecimals } = tokenOutInfo;

            // 检查输入代币余额
            const { tokenBalanceWei: tokenInBalanceWei } = await this.getBalance({ address: this.address, token: tokenIn });
            const amountInWei = ethers.parseUnits(amountIn.toString(), tokenInDecimals);
            if (tokenInBalanceWei < amountInWei) {
                throw new Error(`${tokenIn}余额不足`);
            }

            // 创建各合约实例
            const permit2Abi = [
                "function allowance(address, address, address) view returns (uint160, uint48, uint48)"
            ];
            const routerAddress = UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, this.chainId);
            const routerAbi = [
                "function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable",
            ];
            const quoterAddress = CHAIN_TO_ADDRESSES_MAP[this.chainId]['quoterAddress']; // Quoter V1
            const quoterAbi = [
                'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
            ];
            const permit2 = new ethers.Contract(PERMIT2_ADDRESS, permit2Abi, this.provider);
            const router = new ethers.Contract(routerAddress, routerAbi, this.wallet);
            const quoter = new ethers.Contract(quoterAddress, quoterAbi, this.provider);

            // 创建路由规划器
            const planner = new RoutePlanner();

            // 检查并授权代币给permit2合约。permit2Amount为授权额度，amount为交易额度。
            const permit2ApproveHash = await this.checkAndApproveToken({ token: formattedTokenIn, amount: amountIn, permit2Amount: permit2AllowanceAmount, targetContract: PERMIT2_ADDRESS, gasOptions })
            if (!permit2ApproveHash) { throw new Error('授权失败'); }

            // Permit2签名过期时间
            const deadline = Math.floor(Date.now() / 1000) + (permitDeadline * 60);
            // 获取当前 nonce
            const [, , nonce] = await permit2.allowance(
                this.address,   // 所有者地址 (ownerAddress)
                tokenInAddress, // 代币地址 (tokenAddress)
                routerAddress   // 接收者地址 (spenderAddress)
            );

            // permit2签名
            const permitSingle = {
                details: {
                    token: tokenInAddress,
                    amount: amountInWei,
                    expiration: deadline,
                    nonce
                },
                spender: routerAddress,
                sigDeadline: deadline
            };
            // 获取签名数据
            const permitData = AllowanceTransfer.getPermitData(
                permitSingle,
                PERMIT2_ADDRESS,
                this.chainId
            );
            const signature = await this.wallet.signTypedData(
                permitData.domain,
                permitData.types,
                permitData.values
            );
            // console.log('signature', signature);

            // 获取交易报价和路径
            const { minAmountOut, minAmountOutWei, fee } = await this.getSwapQuote(quoter, tokenInAddress, tokenOutAddress, tokenOutDecimals, amountInWei, slippage);
            const path = tokenInAddress + fee.toString(16).padStart(6, '0') + tokenOutAddress.slice(2);

            // 添加Permit2授权命令
            planner.addCommand(CommandType.PERMIT2_PERMIT, [
                permitSingle,   // 包含授权详情的结构体(token地址、数量、截止时间等)
                signature       // 用户对permitSingle签名的结果
            ]);
            // 如果输入代币是原生代币(如ETH),需要包装成WETH
            if (this.isNativeToken(tokenIn)) {
                planner.addCommand(CommandType.WRAP_ETH, [
                    routerAddress,  // WETH的接收地址(路由器地址)
                    amountInWei     // 要包装的ETH数量
                ]);
            } else {
                // erc20代币通过Permit2从用户转移到路由器
                planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
                    tokenInAddress,     // 要转移的代币地址
                    routerAddress,      // 代币接收地址(路由器地址)
                    amountInWei         // 要转移的代币数量
                ]);
            }
            // 在Uniswap V3上执行精确输入金额的代币兑换
            planner.addCommand(CommandType.V3_SWAP_EXACT_IN, [
                this.isNativeToken(tokenOut) ? routerAddress : this.address, // 如果输出是原生代币，接收者设为路由器(后续解包)；否则直接发送给用户
                amountInWei,        // 精确的输入代币数量
                minAmountOutWei,    // 可接受的最小输出代币数量(滑点保护)
                path,               // 交易路径编码(包含代币地址和费率)
                false               // false表示使用Permit2授权方式，true表示使用传统approve授权方式
            ]);
            // 如果输出代币是原生代币(如ETH)，需要将WETH解包
            if (this.isNativeToken(tokenOut)) {
                planner.addCommand(CommandType.UNWRAP_WETH, [
                    this.address,    // ETH的最终接收地址(用户地址)
                    minAmountOutWei     // 要解包的最小ETH数量
                ]);
            }
            // console.log('planner', planner)

            // 模拟交易，预估gaslimit，通常增加一些余量，避免因网络波动导致Gas不足
            const gasEstimate = await router.execute.estimateGas(
                planner.commands,
                planner.inputs,
                deadline,
                {
                    value: this.isNativeToken(tokenIn) ? amountInWei : 0
                }
            );
            const gasLimit = (gasEstimate * 120n) / 100n; // 增加20%余量 

            console.log(`[地址 ${this.address}] [网络 ${this.formattedChain}] [uniswap通用路由 v3池] 开始执行 [${tokenIn}(${amountIn}) -> ${tokenOut}(${minAmountOut})] 交易...`);

            const tx = await router.execute(
                planner.commands,
                planner.inputs,
                deadline,
                {
                    value: this.isNativeToken(tokenIn) ? amountInWei : 0,  // 如果输入是ETH，发送对应数量的ETH
                    ...gasOptions,
                    gasLimit
                }
            );
            notificationManager.success({
                "message": "交易成功",
                "context": {
                    "交易代币": `${tokenIn} -> ${tokenOut}`,
                    "交易金额": `${amountIn} -> ${minAmountOut}`,
                    "交易哈希": tx.hash
                }
            });
            return tx;
        } catch (error) {
            console.log('error', error);
            // 其中error.transaction是交易数据，路由地址+此数据可以在tenderly上模拟交易，用于调试
            // https://dashboard.tenderly.co/explorer/simulations
            const message = error.message || '未知错误';
            notificationManager.error({
                "message": "交易失败",
                "context": {
                    "交易代币": `${tokenIn} -> ${tokenOut}`,
                    "交易金额": amountIn,
                    "错误信息": message,
                }
            });
            return null;
        }
    }

    /**
     * 使用Quoter合约获取交易报价
     */
    async getSwapQuote(quoter, tokenInAddress, tokenOutAddress, tokenOutDecimals, amountInWei, slippage) {
        try {
            // 常用费率
            const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

            // 并行查询所有费率的报价
            const quotes = await Promise.all(
                FEE_TIERS.map(async (fee) => {
                    try {
                        // 向以太坊节点提交状态改变交易，但要求节点在本地模拟状态改变，而不是执行它，不花费gas
                        const amountOut = await quoter.quoteExactInputSingle.staticCall(
                            tokenInAddress,
                            tokenOutAddress,
                            fee,
                            amountInWei,
                            0 // sqrtPriceLimitX96
                        );
                        return {
                            fee,
                            amountOut,
                            formattedAmountOut: ethers.formatUnits(amountOut, tokenOutDecimals)
                        };
                    } catch (error) {
                        console.log(error)
                        // 这个费率的池子可能不存在或流动性不足
                        console.log(`费率 ${fee / 10000}% 池子不可用: ${error.message}`);
                        return null;
                    }
                })
            );
            // 过滤出有效的池子
            const existingQuotes = quotes.filter(p => p !== null);
            if (existingQuotes.length === 0) {
                throw new Error('找不到有效的交易路径');
            }

            // 按输出金额排序，选择最大的
            existingQuotes.sort((a, b) => {
                if (a.amountOut > b.amountOut) return -1;
                if (a.amountOut < b.amountOut) return 1;
                return 0;
            });

            const bestQuote = existingQuotes[0];

            // // 打印所有可用池子的报价，便于比较
            // console.log('所有可用池子的报价:');
            // existingQuotes.forEach(q => {
            //     console.log(`- 费率: ${q.fee / 10000}%, 预计输出: ${q.formattedAmountOut}`);
            // });

            // 计算最小输出金额（应用滑点）
            const minAmountOutWei = bestQuote.amountOut * BigInt(Math.floor((100 - slippage) * 1000)) / BigInt(100 * 1000);
            const minAmountOut = ethers.formatUnits(minAmountOutWei, tokenOutDecimals);
            console.log(`选择最佳池子: 费率 ${bestQuote.fee / 10000}%, 预计最小输出: ${minAmountOut}`);
            return {
                minAmountOut,
                minAmountOutWei,
                fee: bestQuote.fee,
            };
        } catch (error) {
            notificationManager.error({
                "message": "获取交易报价失败",
                "错误信息": error.message
            });
            return null;
        }
    }
}
export const tradeClient = TradeClient;