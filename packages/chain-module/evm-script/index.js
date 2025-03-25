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
			rpcUrls: {
				infura: `https://mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://eth-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
				public: 'https://eth.llamarpc.com'

			}
		}],
		[['arb', 'arbitrum'], {
			formattedChain: 'arbitrum',
			rpcUrls: {
				infura: `https://arbitrum-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://arb-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['op', 'optimism'], {
			formattedChain: 'optimism',
			rpcUrls: {
				infura: `https://optimism-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://opt-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['zk', 'zks', 'zksync'], {
			formattedChain: 'zksync',
			rpcUrls: {
				infura: `https://zksync-mainnet.infura.io/v3/${process.env.infuraKey}`
			}
		}],
		[['base'], {
			formattedChain: 'base',
			rpcUrls: {
				infura: `https://base-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://base-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['linea'], {
			formattedChain: 'linea',
			rpcUrls: {
				infura: `https://linea-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://linea-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['blast'], {
			formattedChain: 'blast',
			rpcUrls: {
				infura: `https://blast-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://blast-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['scroll'], {
			formattedChain: 'scroll',
			rpcUrls: {
				infura: `https://scroll-mainnet.infura.io/v3/${process.env.infuraKey}`
			}
		}],
		[['bsc', 'bep20'], {
			formattedChain: 'bsc',
			rpcUrls: {
				infura: `https://bsc-mainnet.infura.io/v3/${process.env.infuraKey}`,
				custom: 'https://bsc-dataseed.binance.org/'
			}
		}],
		[['opbnb'], {
			formattedChain: 'opbnb',
			rpcUrls: {
				infura: `https://opbnb-mainnet.infura.io/v3/${process.env.infuraKey}`
			}
		}],
		[['matic', 'pol', 'polygon'], {
			formattedChain: 'polygon',
			rpcUrls: {
				infura: `https://polygon-mainnet.infura.io/v3/${process.env.infuraKey}`,
				alchemy: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.alchemyKey}`,
			}
		}],
		[['avax', 'avalanche', 'avax-c'], {
			formattedChain: 'avalanche',
			rpcUrls: {
				infura: `https://avalanche-mainnet.infura.io/v3/${process.env.infuraKey}`
			}
		}],
		// 测试网
		[['monad'], {
			formattedChain: 'monad',
			rpcUrls: {
				public: 'https://testnet-rpc.monad.xyz/'
			}
		}]
	]);

	/**
	 * 创建EVM客户端实例
	 * @param {Object} options - 配置选项
	 * @param {string} options.chain - 链名称
	 * @param {string} [options.rpcProvider='infura'] - RPC提供商名称
	 * @param {string} [options.socksProxyUrl=null] - 代理URL
	 * @param {string} [options.tokenFile='./data/token.json'] - 代币信息文件路径
	 */
	constructor({ chain, rpcProvider = 'infura', socksProxyUrl = null, tokenFile = './data/token.json' }) {
		this.wallet = null;
		this.address = null;
		this.chainId = null;

		// 初始化provider
		const { formattedChain, provider } = this._getNetworkProvider(chain, rpcProvider, socksProxyUrl);
		this.formattedChain = formattedChain;
		this.provider = provider;

		// 读取保存的代币信息，包括地址、ABI和小数位数
		const tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
		this.tokens = tokens[formattedChain];

		// 设置主网代币列表为实例属性
		this.nativeTokens = ['ETH', 'BNB', 'POL', 'AVAX', 'MON'];
	}

	/**
	 * 创建EVM客户端实例
	 * @param {Object} options - 配置选项
	 * @param {string} options.chain - 链名称
	 * @param {string} [options.rpcProvider='infura'] - RPC提供商名称
	 * @param {string} [options.socksProxyUrl=null] - 代理URL
	 * @param {string} [options.tokenFile='./data/token.json'] - 代币信息文件路径
	 * @param {string} [options.enPrivateKey] - 加密的私钥，如果提供则自动连接钱包
	 * @returns {Promise<EVMClient>} - 初始化完成的EVM客户端实例
	 */
	static async create({ chain, rpcProvider = 'infura', enPrivateKey, socksProxyUrl = null, tokenFile = './data/token.json' }) {
		const instance = new this({ chain, rpcProvider, socksProxyUrl, tokenFile });

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
	 * 获取指定网络的JSON-RPC提供者
	 * @private
	 * @param {string} chain - 链名称
	 * @param {string} rpcProvider - RPC提供商名称
	 * @param {string} [socksProxyUrl=null] - 代理URL
	 * @returns {Object} - 包含格式化链名称和提供者实例的对象
	 * @throws {Error} 当链不存在或提供商不支持该链时抛出错误
	 */
	_getNetworkProvider(chain, rpcProvider, socksProxyUrl = null) {
		chain = chain.toLowerCase();

		// 查找链配置
		let chainConfig = null;
		for (const [aliases, config] of EVMClient.CHAIN_CONFIG) {
			if (aliases.includes(chain)) {
				chainConfig = config;
				break;
			}
		}

		if (!chainConfig) {
			const supportedChains = Array.from(EVMClient.CHAIN_CONFIG.keys()).flat().join(', ');
			throw new Error(`不支持的链: ${chain}。支持的链包括: ${supportedChains}`);
		}

		const { formattedChain, rpcUrls } = chainConfig;

		// 检查提供商是否支持该链
		if (!rpcUrls[rpcProvider]) {
			const supportedProviders = Object.keys(rpcUrls).join(', ');
			throw new Error(`提供商 ${rpcProvider} 不支持链 ${formattedChain}。支持的提供商: ${supportedProviders}`);
		}

		const rpcUrl = rpcUrls[rpcProvider];

		// 创建provider
		let provider;
		if (socksProxyUrl) {
			// 创建 SOCKS 代理
			const agent = new SocksProxyAgent(socksProxyUrl);

			// 注册全局的 getUrl 函数
			ethers.FetchRequest.registerGetUrl(ethers.FetchRequest.createGetUrlFunc({ agent }));

			// 创建以太坊提供者，使用 FetchRequest 以确保走代理
			const ethFetchReq = new ethers.FetchRequest(rpcUrl);
			provider = new ethers.JsonRpcProvider(ethFetchReq);
		} else {
			provider = new ethers.JsonRpcProvider(rpcUrl);
		}

		return { formattedChain, provider };
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
		return this.nativeTokens.includes(token) ? true : false;
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