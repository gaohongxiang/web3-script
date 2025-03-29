import fs from 'fs';
import 'dotenv/config';
import { ethers } from 'ethers-v6';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { deCryptText } from '../../crypt-module/crypt.js';
import { maskValue } from '../../utils-module/utils.js';
import { notificationManager } from '../../notification-module/notification.js';

/**
 * EVM链客户端类，用于处理所有EVM链相关操作
 */
export class EVMClient {

	// 链配置映射
	static CHAIN_CONFIG = new Map([
		// 主网
		[['eth', 'ethereum', 'erc20'], {
			formattedChain: 'ethereum',
			nativeToken: 'ETH',
			rpcUrls: {
				infura: `https://mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://eth-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
				public: 'https://eth.llamarpc.com'
			}
		}],
		[['arb', 'arbitrum'], {
			formattedChain: 'arbitrum',
			nativeToken: 'ETH',
			rpcUrls: {
				infura: `https://arbitrum-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://arb-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['op', 'optimism'], {
			formattedChain: 'optimism',
			nativeToken: 'ETH',
			rpcUrls: {
				infura: `https://optimism-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://opt-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['zk', 'zks', 'zksync'], {
			formattedChain: 'zksync',
			nativeToken: 'ETH',
			rpcUrls: {
				infura: `https://zksync-mainnet.infura.io/v3/${process.env.infuraKey}`
			}
		}],
		[['base'], {
			formattedChain: 'base',
			nativeToken: 'ETH',
			rpcUrls: {
				infura: `https://base-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://base-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['linea'], {
			formattedChain: 'linea',
			nativeToken: 'ETH',
			rpcUrls: {
				infura: `https://linea-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://linea-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['blast'], {
			formattedChain: 'blast',
			nativeToken: 'ETH',
			rpcUrls: {
				infura: `https://blast-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://blast-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['scroll'], {
			formattedChain: 'scroll',
			nativeToken: 'ETH',
			rpcUrls: {
				infura: `https://scroll-mainnet.infura.io/v3/${process.env.infuraKey}`
			}
		}],
		[['bsc', 'bep20'], {
			formattedChain: 'bsc',
			nativeToken: 'BNB',
			rpcUrls: {
				infura: `https://bsc-mainnet.infura.io/v3/${process.env.infuraKey}`,
				custom: 'https://bsc-dataseed.binance.org/'
			}
		}],
		[['opbnb'], {
			formattedChain: 'opbnb',
			nativeToken: 'BNB',
			rpcUrls: {
				infura: `https://opbnb-mainnet.infura.io/v3/${process.env.infuraKey}`
			}
		}],
		[['matic', 'pol', 'polygon'], {
			formattedChain: 'polygon',
			nativeToken: 'POL',
			rpcUrls: {
				infura: `https://polygon-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['avax', 'avalanche', 'avax-c'], {
			formattedChain: 'avalanche',
			nativeToken: 'AVAX',
			rpcUrls: {
				infura: `https://avalanche-mainnet.infura.io/v3/${process.env.infuraKey}`
			}
		}]
	]);

	/**
	 * 创建EVM客户端实例
	 * @param {Object} options - 配置选项
	 * @param {string} options.chain - 链名称
	 * @param {string} [options.rpcProvider='infura'] - RPC提供商名称，如'infura'、'alchemy'、'public'等
	 * @param {Object} [options.customChainOptions={}] - 自定义链配置选项
	 * @param {string} [options.customChainOptions.rpc] - 自定义RPC URL
	 * @param {string} [options.customChainOptions.nativeToken] - 自定义链的原生代币符号
	 * @param {string} [options.socksProxyUrl=null] - 代理URL
	 * @param {string} [options.tokenFile='./data/token.json'] - 代币信息文件路径
	 */
	constructor({ chain, rpcProvider = 'infura', customChainOptions = {}, socksProxyUrl = null, tokenFile = './data/token.json' }) {
		this.wallet = null;
		this.address = null;
		this.chainId = null;

		// 初始化provider
		const { formattedChain, nativeToken, provider } = this.initializeChainConfig(chain, rpcProvider, customChainOptions, socksProxyUrl);
		this.formattedChain = formattedChain;
		this.nativeToken = nativeToken;
		this.provider = provider;

		// 读取保存的代币信息，包括地址、ABI和小数位数
		const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
		this.tokens = tokens[formattedChain];
	}

	/**
	 * 创建EVM客户端实例
	 * @param {Object} options - 配置选项
	 * @param {string} options.chain - 链名称
	 * @param {string} [options.rpcProvider='infura'] - RPC提供商名称
	 * @param {Object} [options.customChainOptions={}] - 自定义链配置选项
	 * @param {string} [options.customChainOptions.rpc] - 自定义RPC URL
	 * @param {string} [options.customChainOptions.nativeToken] - 自定义链的原生代币符号
	 * @param {string} [options.socksProxyUrl=null] - 代理URL
	 * @param {string} [options.tokenFile='./data/token.json'] - 代币信息文件路径
	 * @param {string} [options.enPrivateKey] - 加密的私钥，如果提供则自动连接钱包
	 * @returns {Promise<EVMClient>} - 初始化完成的EVM客户端实例
	 */
	static async create({ chain, rpcProvider = 'infura', customChainOptions = {}, enPrivateKey, socksProxyUrl = null, tokenFile = './data/token.json' }) {
		const instance = new this({ chain, rpcProvider, customChainOptions, socksProxyUrl, tokenFile });

		// 初始化chainId
		instance.chainId = await instance.getChainId();

		// 创建钱包并赋值
		const { wallet, address } = await instance.createWallet(enPrivateKey);
		instance.wallet = wallet;
		instance.address = address;

		// 3. 设置全局上下文
		notificationManager.setGlobalContext({
			"网络": instance.formattedChain,
			"地址": maskValue({ value: instance.address })
		});

		return instance;
	}

	/**
	 * 初始化链配置并获取提供者
	 * @private
	 * @param {string} chain - 链名称
	 * @param {string} [rpcProvider='infura'] - RPC提供商名称，仅在不使用自定义配置时有效
	 * @param {Object} [customChainOptions={}] - 自定义链配置选项
	 * @param {string} [customChainOptions.rpc] - 自定义RPC URL
	 * @param {string} [customChainOptions.nativeToken] - 自定义链的原生代币符号
	 * @param {string} [socksProxyUrl=null] - 代理URL
	 * @returns {Object} - 包含格式化链名称、原生代币符号和提供者实例的对象
	 * @throws {Error} 当链不存在且无自定义RPC时抛出错误
	 * @throws {Error} 当使用自定义链但未提供原生代币符号时抛出错误
	 */
	initializeChainConfig(chain, rpcProvider = 'infura', customChainOptions = {}, socksProxyUrl = null) {
		// 转为小写进行查找
		const chainLower = chain.toLowerCase();
		const customRpc = customChainOptions.rpc;
		
		// 查找链配置
		let chainConfig = null;
		for (const [aliases, config] of EVMClient.CHAIN_CONFIG) {
			if (aliases.includes(chainLower)) {
				chainConfig = config;
				break;
			}
		}
		
		// 确定最终使用的链名和RPC URL
		let formattedChain, rpcUrl, nativeToken;
		
		// 情况1: 现有链 + 现有RPC (最常见情况)
		if (chainConfig && !customRpc) {
			formattedChain = chainConfig.formattedChain;
			nativeToken = chainConfig.nativeToken;
			
			// 检查提供商是否支持该链
			if (!chainConfig.rpcUrls[rpcProvider]) {
				const supportedProviders = Object.keys(chainConfig.rpcUrls).join(', ');
				throw new Error(`${formattedChain}链没有 ${rpcProvider} 提供商。可用的提供商: ${supportedProviders}，或者可以提供自定义RPC URL`);
			}
			
			rpcUrl = chainConfig.rpcUrls[rpcProvider];
			// console.log(`使用链 ${formattedChain} 的 ${rpcProvider} RPC提供商，原生代币: ${nativeToken}`);
		}
		// 情况2: 现有链 + 自定义RPC
		else if (chainConfig && customRpc) {
			formattedChain = chainConfig.formattedChain;
			nativeToken = chainConfig.nativeToken;
			rpcUrl = customRpc;
			console.log(`为链 ${formattedChain} 使用自定义RPC URL ${customRpc}，原生代币: ${nativeToken}。请自行确保链配置的正确性`);
		}
		// 情况3: 自定义链 + 自定义RPC
		else if (!chainConfig && customRpc) {
			formattedChain = chainLower;
			
			// 检查是否提供了原生代币符号
			if (!customChainOptions.nativeToken) {
				throw new Error(`使用自定义链 ${formattedChain} 时必须提供原生代币符号(nativeToken)。请在customChainOptions中设置nativeToken属性。`);
			}
			
			nativeToken = customChainOptions.nativeToken;
			rpcUrl = customRpc;
			console.log(`使用完全自定义链 ${formattedChain} 和自定义RPC ${customRpc}，原生代币: ${nativeToken}。请自行确保链配置的正确性`);
		}
		// 错误情况: 自定义链但是没有自定义RPC
		else if (!chainConfig && !customRpc) {
			 // 获取所有支持的格式化链名
			 const supportedFormattedChains = Array.from(EVMClient.CHAIN_CONFIG.values())
			   .map(config => config.formattedChain).join(', ');
			throw new Error(`使用自定义链, 但是没有提供自定义RPC URL。您可以: 1) 使用支持的链名: ${supportedFormattedChains}，或 2) 为该自定义链提供自定义customChainOptions配置，包含rpc和nativeToken字段`);
		}
		
		// 确保原生代币符号为大写
		if (nativeToken) {
			nativeToken = nativeToken.toUpperCase();
		}
		
		// 统一创建provider
		let provider;
		try {
			if (socksProxyUrl) {
				const agent = new SocksProxyAgent(socksProxyUrl);
				ethers.FetchRequest.registerGetUrl(ethers.FetchRequest.createGetUrlFunc({ agent }));
				const ethFetchReq = new ethers.FetchRequest(rpcUrl);
				provider = new ethers.JsonRpcProvider(ethFetchReq);
			} else {
				provider = new ethers.JsonRpcProvider(rpcUrl);
			}
		} catch (error) {
			throw new Error(`创建Provider失败: ${error.message}。请检查RPC URL是否有效。`);
		}
		
		return { formattedChain, nativeToken, provider };
	}

	/**
	 * 使用私钥连接钱包
	 * @param {string} enPrivateKey - 加密的私钥
	 * @returns {Promise<Object>} - 返回{ wallet, address }
	 */
	async createWallet(enPrivateKey) {
		try {
			const privateKey = await deCryptText(enPrivateKey);
			const wallet = new ethers.Wallet(privateKey, this.provider);
			const address = await wallet.getAddress();
			return { wallet, address };
		} catch (error) {
			console.error('创建钱包失败:', error);
			return { wallet: null, address: null };
		}
	}

	/**
	 * 获取当前连接网络的链ID
	 * @returns {Promise<number>} 链ID
	 */
	async getChainId() {
		try {
			const netWork = await this.provider.getNetwork();
			const chainId = Number(netWork.toJSON().chainId);
			// console.log(`${this.formattedChain}网络 链ID: ${chainId}`);
			return chainId;
		} catch (error) {
			console.error(`${this.formattedChain}网络 获取链ID失败:`, error);
			return null;
		}
	}

	/**
	 * 设置gas价格
	 * @param {Object} options - 选项
	 * @param {number} [options.multiplier=1] - gas价格乘数
	 * @param {boolean} [options.useEIP1559=false] - 是否尝试使用EIP-1559
	 * @returns {Promise<Object>} - gas设置
	 */
	async setGasPrice({ multiplier = 1, useEIP1559 = false } = {}) {
		const feeData = await this.provider.getFeeData();

		// 如果用户选择使用EIP-1559并且链支持
		if (useEIP1559 && feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
			const adjustedMaxFeePerGas = feeData.maxFeePerGas * BigInt(Math.floor(multiplier * 100)) / 100n;
			const adjustedMaxPriorityFeePerGas = feeData.maxPriorityFeePerGas * BigInt(Math.floor(multiplier * 100)) / 100n;

			// console.log(`使用EIP-1559: maxFee=${ethers.formatUnits(adjustedMaxFeePerGas, "gwei")}gwei, priorityFee=${ethers.formatUnits(adjustedMaxPriorityFeePerGas, "gwei")}gwei`);

			return {
				maxFeePerGas: adjustedMaxFeePerGas,
				maxPriorityFeePerGas: adjustedMaxPriorityFeePerGas
			};
		} else {
			// 默认使用Legacy格式
			console.log(`不支持使用EIP-1559格式, 改用Legacy格式`);
			const adjustedGasPrice = feeData.gasPrice * BigInt(Math.floor(multiplier * 100)) / 100n;

			// console.log(`使用Legacy: gasPrice=${ethers.formatUnits(adjustedGasPrice, "gwei")}gwei`);

			return {
				gasPrice: adjustedGasPrice
			};
		}
	}

	/**
	 * 获取指定地址的合约字节码
	 * @param {string} tokenAddr - 合约地址
	 * @returns {Promise<string>} - 合约字节码
	 */
	async getBytecode(tokenAddr) {
		const code = await this.provider.getCode(tokenAddr).catch(err => { console.log(err); return null; });
		console.log(`地址${tokenAddr}合约bytecode: ${code}`);
		return code;
	}

	/**
	 * 判断是否是原生代币
	 */
	isNativeToken(token) {
		token = token.toUpperCase();
		return this.nativeToken === token ? true : false;
	}

	/**
	 * 获取指定地址的代币余额
	 * @param {Object} params - 参数对象
	 * @param {string} params.address - 要查询的地址
	 * @param {string} params.token - 代币名称
	 * @returns {Promise<string>} - 代币余额
	 */
	async getBalance({ address, token }) {
		try {
			token = token.toUpperCase();
			let tokenBalanceWei, tokenBalance;

			if (this.isNativeToken(token)) {
				tokenBalanceWei = await this.provider.getBalance(address).catch(err => { console.log(err); return null; });
				if (tokenBalanceWei === null) return null;
				tokenBalance = ethers.formatEther(tokenBalanceWei);
				console.log(`地址 ${address} ${this.formattedChain}网络 ${token}余额: ${tokenBalance}`);
			} else {
				const tokenInfo = this.tokens[token];
				if (!tokenInfo) throw new Error(`${this.formattedChain}网络 没有${token}代币信息，请先添加`);
				const { address: tokenAddr, abi: tokenAbi, decimals: tokenDecimals } = tokenInfo;
				const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, this.provider);
				tokenBalanceWei = await tokenContract.balanceOf(address).catch(err => { console.log(err); return null; });
				if (tokenBalanceWei === null) return null;

				tokenBalance = ethers.formatUnits(tokenBalanceWei, tokenDecimals);
				console.log(`地址 ${address} ${this.formattedChain}网络 ${token}余额: ${tokenBalance}`);
			}

			return { tokenBalanceWei, tokenBalance };
		} catch (error) {
			notificationManager.error({
				"message": "获取余额失败",
				"context": {
					"错误信息": error.message
				}
			});
			return null;
		}
	}

	/**
	 * 转账代币到指定地址
	 * @param {Object} params - 参数对象
	 * @param {string} params.toAddress - 接收地址
	 * @param {string} params.token - 代币名称
	 * @param {string|number} params.amount - 转账金额
	 * @param {Object} params.gasOptions - 可选参数
	 * @param {number} [params.gasOptions.multiplier=1] - gas价格乘数
	 * @param {boolean} [params.gasOptions.useEIP1559=false] - 是否尝试使用EIP-1559
	 * @returns {Promise<string>} - 交易哈希
	 */
	async transfer({ toAddress, token, amount, gasOptions = {} }) {
		try {
			token = token.toUpperCase();
			let hash;
			if (this.isNativeToken(token)) {
				// 主网币转账
				const amountWei = ethers.parseEther(amount.toString());
				const { tokenBalanceWei: beforeBalanceWei } = await this.getBalance({ address: this.address, token });
				console.log(`地址 ${this.address} ${this.formattedChain}网络 发送前 ${token} 余额: ${ethers.formatEther(beforeBalanceWei)}`);

				if (beforeBalanceWei < amountWei) {
					throw new Error('地址余额不足, 无法完成转账');
				}

				// 设置gas价格
				const gasPriceParams = await this.setGasPrice(gasOptions);

				// 构造交易请求
				const tx = {
					to: toAddress,
					value: amountWei,
					...gasPriceParams
				};

				// 发送交易
				const receipt = await this.wallet.sendTransaction(tx);
				console.log('等待交易在区块链确认...');
				await receipt.wait();
				hash = receipt.hash;
			} else {
				// ERC20代币转账
				const tokenInfo = this.tokens[token];
				if (!tokenInfo) throw new Error(`${this.formattedChain}网络 没有${token}代币信息，请先添加`);
				const { address: tokenAddr, abi: tokenAbi, decimals: tokenDecimals } = tokenInfo;
				const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, this.wallet);
				const amountWei = ethers.parseUnits(amount.toString(), tokenDecimals);

				const beforeBalanceWei = await tokenContract.balanceOf(this.address);
				console.log(`地址 ${this.address} ${this.formattedChain}网络 发送前 ${token} 余额: ${ethers.formatUnits(beforeBalanceWei, tokenDecimals)}`);

				if (beforeBalanceWei < amountWei) {
					throw new Error('地址余额不足, 无法完成转账');
				}

				// 设置gas价格
				const gasPriceParams = await this.setGasPrice(gasOptions);

				const receipt = await tokenContract.transfer(toAddress, amountWei, gasPriceParams);
				console.log('等待交易在区块链确认...');
				await receipt.wait();
				hash = receipt.hash;
			}
			notificationManager.success({
				"message": "转账成功",
				"context": {
					"代币": token,
					"金额": amount,
					"接收地址": maskValue({ value: toAddress }),
					"交易哈希": hash
				}
			});
			return hash;
		} catch (error) {
			notificationManager.error({
				"message": "转账失败",
				"context": {
					"代币": token,
					"金额": amount,
					"接收地址": maskValue({ value: toAddress }),
					"错误信息": error.message
				}
			});
			return null;
		}
	}

	/**
	 * 检查并授权代币给指定合约
	 * 如果设置了permit2Amount，则表示授权给permit2合约，permit2Amount为授权额度，amount为交易额度。
	 * @param {Object} params - 参数对象
	 * @param {string} params.token - 代币名称
	 * @param {string|number} params.amount - 授权金额
	 * @param {string} [params.permit2Amount=null] - 授权给Permit2的金额，若设置则覆盖amount
	 * @param {string} params.targetContract - 目标合约地址
	 * @param {Object} params.gasOptions - 可选的gas设置参数
	 * @param {number} [params.gasOptions.multiplier=1] - gas价格乘数，用于加速交易
	 * @param {boolean} [params.gasOptions.useEIP1559=false] - 是否使用EIP-1559交易类型
	 * @returns {Promise<string|null>} - 交易哈希，如授权额度已足够则返回null
	 */
	async checkAndApproveToken({ token, amount, permit2Amount = null, targetContract, gasOptions = {} }) {
		try {
			token = token.toUpperCase();
			if (this.isNativeToken(token)) return;
			const tokenInfo = this.tokens[token];
			if (!tokenInfo) throw new Error(`${this.formattedChain}网络 没有${token}代币信息，请先添加`);
			const { address: tokenAddr, abi: tokenAbi, decimals: tokenDecimals } = tokenInfo;
			const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, this.wallet);
			let amountWei = ethers.parseUnits(amount.toString(), tokenDecimals);
			const currentAllowanceWel = await tokenContract.allowance(this.address, targetContract);
			console.log(`${this.formattedChain}网络 当前 ${token} 授权额度为: ${ethers.formatUnits(currentAllowanceWel, tokenDecimals)}`);

			if (currentAllowanceWel >= amountWei) {
				console.log(`${this.formattedChain}网络  ${token} 授权额度充足`);
				return true;
			}
			//permit2合约授权额度小于交易额度，则设置一个较大的额度备用。
			if (permit2Amount) {
				if (permit2Amount < amount) {
					throw new Error(`permit2授权额度 ${permit2Amount} 小于交易金额 ${amount}, 请设置一个较大的额度备用`);
				}
				const permit2AmountWei = ethers.parseUnits(permit2Amount.toString(), tokenDecimals);
				amount = permit2Amount;
				amountWei = permit2AmountWei;
			}

			// 设置gas价格
			const gasPriceParams = await this.setGasPrice(gasOptions);
			console.log(`${this.formattedChain}网络 授权额度 ${amount} ${token}，发送交易...`);
			const tx = await tokenContract.approve(targetContract, amountWei, gasPriceParams);
			console.log(`${this.formattedChain}网络 授权 ${token} 交易已提交，等待区块链确认...`);
			await tx.wait();
			notificationManager.success({
				"message": "授权成功",
				"context": {
					"代币": token,
					"授权额度": amount,
					"授权给permit2额度": permit2Amount,
					"目标合约": targetContract,
					"交易哈希": tx.hash
				}
			});
			return tx.hash;
		} catch (error) {
			notificationManager.error({
				"message": "授权失败",
				"context": {
					"代币": token,
					"授权额度": amount,
					"授权给permit2额度": permit2Amount,
					"目标合约": targetContract,
					"错误信息": error.message
				}
			});
			return false;
		}
	}

	/**
	 * 监听指定地址的代币转账事件
	 * @param {Object} params - 参数对象
	 * @param {string} params.listenAddress - 要监听的地址
	 * @param {string} params.listenToken - 要监听的代币
	 * @param {string} [params.direction='in'] - 监听方向，'in'或'out'
	 * @returns {ethers.Contract} - 合约实例，可用于取消监听
	 */
	async listenContract({ listenAddress, listenToken, direction = 'in' }) {
		const tokenInfo = this.tokens[listenToken];
		if (!tokenInfo) throw new Error(`${this.formattedChain}网络 没有${listenToken}代币信息，请先添加`);
		const { address: tokenAddr, abi: tokenAbi, decimals: tokenDecimals } = tokenInfo;
		const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, this.provider);
		const tokenSymbol = await tokenContract.symbol();

		const balanceWei = await tokenContract.balanceOf(listenAddress);
		console.log(`地址 ${listenAddress} ${this.formattedChain}网络 ${tokenSymbol} 余额: ${ethers.formatUnits(balanceWei, tokenDecimals)}`);

		// 根据流入或流出的方向设置过滤器
		let filter;
		if (direction === 'in') {
			// 监听流入指定地址的事件
			filter = tokenContract.filters.Transfer(null, listenAddress);
			console.log(`---------监听 ${this.formattedChain} 网络 ${tokenSymbol} 流入指定地址 ${listenAddress} --------`);
		} else if (direction === 'out') {
			// 监听从指定地址流出的事件
			filter = tokenContract.filters.Transfer(listenAddress, null);
			console.log(`---------监听 ${this.formattedChain} 网络 ${tokenSymbol} 流出指定地址 ${listenAddress} --------`);
		} else {
			throw new Error('无效的方向参数，请使用 "in" 或 "out"');
		}

		tokenContract.on(filter, (from, to, amount) => {
			console.log(`${from} -> ${to} ${ethers.formatUnits(amount, tokenDecimals)}`);
		});

		return tokenContract; // 返回合约实例，可用于取消监听
	}
}

export const evmClient = EVMClient;