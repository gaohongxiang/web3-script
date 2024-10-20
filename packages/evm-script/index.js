import fs from 'fs';
import { ethers } from 'ethers';
import { config } from 'dotenv';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { deCryptText } from '../crypt-module/crypt.js';

// 获取环境变量
const { parsed } = config();

const mainTokens = ['ETH', 'BNB', 'POL', 'AVAX'];

let network,rpc;

/**
 * 获取指定网络的 JSON-RPC 提供者。
 * 
 * @param {string} chain - 代币所在链。
 * @param {string} [proxy=null] - 代理，默认不走代理
 * 
 * 根据配置的网络名称，返回相应的网络和 JSON-RPC 提供者实例。
 * @returns {Object|null} - 返回一个包含网络名称和提供者实例的对象；如果网络不存在，则返回 null。
 */
export function getNetworkProvider(chain, proxy=null) {
	chain = chain.toLowerCase();
	const infuraKey = parsed.infuraKey;
	if (['eth', 'ethereum', 'erc20'].includes(chain)) {
		network = 'ethereum';
		rpc = `https://mainnet.infura.io/v3/${infuraKey}`;
	} else if (['arb', 'arbitrum'].includes(chain)) {
		network = 'arbitrum';
		rpc = `https://arbitrum-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['op', 'optimism'].includes(chain)) {
		network = 'optimism';
		rpc = `https://optimism-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['zk', 'zks', 'zksync'].includes(chain)) {
		network = 'zksync';
		rpc = `https://zksync-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['base'].includes(chain)) {
		network = 'base';
		rpc = `https://base-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['linea'].includes(chain)) {
		network = 'linea';
		rpc = `https://linea-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['blast'].includes(chain)) {
		network = 'blast';
		rpc = `https://blast-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['scroll'].includes(chain)) {
		network = 'scroll';
		rpc = `https://scroll-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['bsc', 'bep20'].includes(chain)) {
		network = 'bsc';
		rpc = `https://bsc-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['opbnb'].includes(chain)) {
		network = 'opbnb';
		rpc = `https://opbnb-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['matic', 'pol', 'polygon'].includes(chain)) {
		network = 'polygon';
		rpc = `https://polygon-mainnet.infura.io/v3/${infuraKey}`;
	} else if (['avax', 'avalanche', 'avax-c'].includes(chain)) {
		network = 'avalanche c-chain';
		rpc = `https://avalanche-mainnet.infura.io/v3/${infuraKey}`;
	} else {
		console.log('链不存在, 请重新输入。')
		return
	}

	let provider;
	if (proxy) {
		// 创建 SOCKS 代理
		const agent = new SocksProxyAgent(proxy);

		// 注册全局的 getUrl 函数，所有的 FetchRequest 实例都会使用这个函数来处理网络请求
		ethers.FetchRequest.registerGetUrl(ethers.FetchRequest.createGetUrlFunc({ agent }));

		// 创建以太坊提供者，使用 FetchRequest 以确保走代理
		const ethFetchReq = new ethers.FetchRequest(rpc);
		provider = new ethers.JsonRpcProvider(ethFetchReq);
	} else {
		// 不使用代理的情况
		provider = new ethers.JsonRpcProvider(rpc);
	}

	return { network, provider };
}

/**
 * 获取指定代币的信息，包括地址、ABI 和小数位数。
 *
 * @param {string} token - 代币名称。
 * @param {Object} options - 可选参数对象。
 * @param {string} [options.tokenFile='./data/token.json'] - 包含代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * @returns {Promise<Object>} - 返回一个包含代币地址、ABI 和小数位数的对象。
 */
export async function getTokenInfo(token, { tokenFile = './data/token.json' } = {}) {
	try{
		token = token.toUpperCase();
		const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
		const tokenInfo = data[network][token];
		const tokenAddr = tokenInfo.address;
		const tokenAbi = tokenInfo.abi;
		const tokenDecimals = tokenInfo.decimals;
		return { tokenAddr, tokenAbi, tokenDecimals };
	}catch{
		console.log(`错误: ${token} 代币信息 在 ${network} 网络中不存在，请先添加。`);
		return;
	}
}

/**
 * 获取当前网络的 gas 费用数据，包括 gasPrice、maxFeePerGas 和 maxPriorityFeePerGas。
 * @param {Object} provider - 提供者对象，用于获取费用数据
 * @returns {Promise<Object|null>} - 返回一个包含 gas 费用数据的对象，如果出错则返回 null。
 */
export async function getGas(provider) {
	const feeData = await provider.getFeeData().catch(err => { console.log(err); return null; });
	const gasPrice = ethers.formatUnits(feeData['gasPrice'], 'gwei');
	const maxFeePerGas = ethers.formatUnits(feeData['maxFeePerGas'], 'gwei');
	const maxPriorityFeePerGas = ethers.formatUnits(feeData['maxPriorityFeePerGas'], 'gwei');
	console.log(`gasPrice:${gasPrice}\nmaxFeePerGas:${maxFeePerGas}\nmaxPriorityFeePerGas:${maxPriorityFeePerGas}`);
	return { gasPrice, maxFeePerGas, maxPriorityFeePerGas };
}

/**
 * 获取指定地址的合约字节码。
 *
 * @param {string} tokenAddr - 要查询的合约地址。
 * @param {string} provider - 提供者对象。
 * @returns {Promise<string|null>} - 返回合约的字节码，如果出错则返回 null。
 */
export async function getBytecode(tokenAddr, provider) {
	const code = await provider.getCode(tokenAddr).catch(err => { console.log(err); return null; });
	console.log(`地址${tokenAddr}合约bytecode: ${code}`);
	return code;
}

/**
 * 根据提供的加密私钥生成一个以太坊钱包实例。
 *
 * @param {string} enPrivateKey - 加密的私钥字符串。
 * @param {string} provider - 提供者对象。
 * @returns {Promise<ethers.Wallet>} - 返回一个以太坊钱包实例。
 */
export async function getWallet(enPrivateKey, provider) {
	const privateKey = await deCryptText(enPrivateKey);
	const wallet = new ethers.Wallet(privateKey, provider);
	return wallet;
}

/**
 * 获取指定地址的以太币或代币余额。
 *
 * @param {string} address - 要查询余额的地址。
 * @param {string} token - 代币名称（大小写不敏感）。
 * @param {string} chain - 代币所在链。
 * @param {string} [proxy=null] - 代理，默认不走代理
 * @param {string} [tokenFile='./data/token.json'] - 包含代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * @returns {Promise<string|null>} - 返回代币余额（以字符串形式），如果出错则返回 null。
 */
export async function getBalance({ address, token, chain, proxy=null, tokenFile = './data/token.json' }) {
	token = token.toUpperCase();
	let tokenBalance;
	const { provider } = getNetworkProvider(chain, proxy);
	if (mainTokens.includes(token)) {
		const tokenBalanceWei = await provider.getBalance(address).catch(err => { console.log(err); return null; });
		tokenBalance = ethers.formatEther(tokenBalanceWei);
		console.log(`地址 ${address} ${token}余额: ${tokenBalance}`);
	} else {
		const tokenInfo = await getTokenInfo(token, {tokenFile});
		if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
		const { tokenAddr, tokenAbi, tokenDecimals } = tokenInfo;
		const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, provider);
		const tokenBalanceWei = await tokenContract.balanceOf(address).catch(err => { console.log(err); return null; });
		tokenBalance = ethers.formatUnits(tokenBalanceWei, tokenDecimals);
		console.log(`地址 ${address} ${token}余额: ${tokenBalance}`);
	};
	return tokenBalance;
}

/**
 * 转账指定代币到目标地址。
 *
 * @param {Object} params - 转账参数对象。
 * @param {string} params.enPrivateKey - 加密的私钥字符串，用于生成钱包。
 * @param {string} params.toAddress - 接收地址。
 * @param {string} params.token - 代币名称（大小写不敏感）。
 * @param {string|number} params.value - 转账金额，可以是字符串或数字。
 * @param {string} params.chain - 代币所在链。
 * @param {string} [proxy=null] - 代理，默认不走代理
 * @param {string} [tokenFile='./data/token.json'] - 包含代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * @returns {Promise<void>} - 无返回值，处理转账过程中的错误。
 */
export async function transfer({ enPrivateKey, toAddress, token, value, chain, proxy=null, tokenFile = './data/token.json' }) {
	try {
		token = token.toUpperCase();
		const { provider } = getNetworkProvider(chain, proxy);
		const wallet = await getWallet(enPrivateKey, provider);
		const fromAddress = await wallet.getAddress();
		if (mainTokens.includes(token)) {
			value = ethers.parseEther(value.toString());
			const beforeBalance = await provider.getBalance(fromAddress);
			console.log(`地址 ${fromAddress} 发送前 ${token} 余额: ${ethers.formatEther(beforeBalance)}`);
			if(beforeBalance < value){console.log('地址余额不足, 无法完成转账');return};
			// 构造交易请求，参数：to为接收地址，value为ETH数额
			const tx = {
				to: toAddress,
				value,
			};
			// 发送交易，获得收据
			const receipt = await wallet.sendTransaction(tx);
			console.log('等待交易在区块链确认...');
			await receipt.wait(); // 等待链上确认交易
			console.log(`交易哈希: ${receipt.hash}`); // 打印交易详情
			console.log(`地址 ${fromAddress} 发送后 ${token} 余额: ${ethers.formatEther(await provider.getBalance(fromAddress))}`);
		} else {
			const tokenInfo = await getTokenInfo(token, {tokenFile});
			if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
			const { tokenAddr, tokenAbi, tokenDecimals } = tokenInfo;
			const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, wallet);
			value = ethers.parseUnits(value.toString(), tokenDecimals);
			const beforeBalance = await tokenContract.balanceOf(fromAddress);
			console.log(`地址 ${fromAddress} 发送前 ${token} 余额: ${ethers.formatUnits(beforeBalance, tokenDecimals)}`);
			if(beforeBalance < value){console.log('地址余额不足, 无法完成转账');return};
			const receipt = await tokenContract.transfer(toAddress, value);
			console.log('等待交易在区块链确认...');
			await receipt.wait();
			console.log(`交易哈希: ${receipt.hash}`); // 打印交易详情
			// iv. 打印交易后余额
			console.log(`地址 ${fromAddress} 发送后 ${token} 余额: ${ethers.formatUnits(await tokenContract.balanceOf(fromAddress), tokenDecimals)}`);
		}
	} catch (error) {
		console.log(error);
	}
}

/**
 * 监听指定地址的代币转账事件（流入或流出）。
 *
 * @param {Object} params - 参数对象。
 * @param {string} params.listenAddress - 要监听的地址。
 * @param {string} params.listenToken - 要监听的代币名称。
 * @param {string} params.chain - 要监听的代币所在链。
 * @param {string} [proxy=null] - 代理，默认不走代理
 * @param {string} [params.tokenFile='./data/token.json'] - 包含代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * @param {string} [params.direction='in'] - 监听的方向，可以是 'in'（流入）或 'out'（流出），默认为 'in'。
 */
export async function listenContract({ listenAddress, listenToken, chain, proxy=null, tokenFile = './data/token.json', direction = 'in' }) {
	const { network, provider } = getNetworkProvider(chain, proxy);
	const tokenInfo = await getTokenInfo(listenToken, {tokenFile});
	if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
	const { tokenAddr, tokenAbi, tokenDecimals } = tokenInfo;
	const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, provider);
	const tokenSymbol = await tokenContract.symbol();
	await tokenContract.balanceOf(listenAddress).then(balance => (console.log(`地址 ${listenAddress} ${tokenSymbol} 余额: ${balance}`)));
	// 根据流入或流出的方向设置过滤器
    let filter;
    if (direction === 'in') {
        // 监听流入指定地址的事件
        filter = tokenContract.filters.Transfer(null, listenAddress);
        console.log(`---------监听 ${network} 网络 USDT 流入指定地址 ${listenAddress} --------`);
    } else if (direction === 'out') {
        // 监听从指定地址流出的事件
        filter = tokenContract.filters.Transfer(listenAddress, null);
        console.log(`---------监听 ${network} 网络 USDT 流出指定地址 ${listenAddress} --------`);
    } else {
        console.log('无效的方向参数，请使用 "in" 或 "out"');
        return;
    }
	
	tokenContract.on(filter, (res) => {
		console.log(`${res.args[0]} -> ${res.args[1]} ${ethers.formatUnits(res.args[2], tokenDecimals)}`);
	});
}