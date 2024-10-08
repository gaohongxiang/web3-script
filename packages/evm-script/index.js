import fs from 'fs';
import { ethers } from 'ethers';
import { config } from 'dotenv';
import { deCryptText } from '../crypt-module/crypt.js';

// 获取环境变量
const { parsed } = config();

const mainTokens = ['ETH', 'BNB', 'POL', 'AVAX'];

/**
 * 获取指定网络的 JSON-RPC 提供者。
 * 
 * 根据配置的网络名称，返回相应的网络和 JSON-RPC 提供者实例。
 * @returns {Object|null} - 返回一个包含网络名称和提供者实例的对象；如果网络不存在，则返回 null。
 */
export function getNetworkProvider() {
	let network = parsed.evmNetwork.toLowerCase();
	let rpc;
	if (['eth', 'ethereum', 'erc20'].includes(network)) {
		network = 'ethereum';
		rpc = parsed.ethereumMainnetApi;
	} else if (['arb', 'arbitrum'].includes(network)) {
		network = 'arbitrum';
		rpc = parsed.arbitrumMainnetApi;
	} else if (['op', 'optimism'].includes(network)) {
		network = 'optimism';
		rpc = parsed.optimismMainnetApi;
	} else if (['matic', 'pol', 'polygon'].includes(network)) {
		network = 'polygon';
		rpc = parsed.polygonMainnetApi;
	} else if (['zk', 'zks', 'zksync'].includes(network)) {
		network = 'zksync';
		rpc = parsed.zksyncMainnetApi;
	} else {
		console.log('链不存在, 请重新输入')
		return
	}
	const provider = new ethers.JsonRpcProvider(rpc);
	return { network, provider };
}

const { network, provider } = getNetworkProvider();


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
		console.log(`错误: 代币 "${token}" 在网络 "${network}" 中不存在。`)
		return
	}
}

/**
 * 获取当前网络的 gas 费用数据，包括 gasPrice、maxFeePerGas 和 maxPriorityFeePerGas。
 *
 * @returns {Promise<Object|null>} - 返回一个包含 gas 费用数据的对象，如果出错则返回 null。
 */
export async function getGas() {
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
 * @returns {Promise<string|null>} - 返回合约的字节码，如果出错则返回 null。
 */
export async function getBytecode(tokenAddr) {
	const code = await provider.getCode(tokenAddr).catch(err => { console.log(err); return null; });
	console.log(`地址${tokenAddr}合约bytecode: ${code}`);
	return code
}

/**
 * 根据提供的加密私钥生成一个以太坊钱包实例。
 *
 * @param {string} enPrivateKey - 加密的私钥字符串。
 * @returns {Promise<ethers.Wallet>} - 返回一个以太坊钱包实例。
 */
export async function getWallet(enPrivateKey) {
	const privateKey = await deCryptText(enPrivateKey);
	const wallet = new ethers.Wallet(privateKey, provider);
	return wallet
}

/**
 * 获取指定地址的以太币或代币余额。
 *
 * @param {string} address - 要查询余额的地址。
 * @param {string} token - 代币名称（大小写不敏感）。
 * @param {Object} options - 可选参数对象。
 * @param {string} [options.tokenFile='./data/token.json'] - 包含代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * @returns {Promise<string|null>} - 返回代币余额（以字符串形式），如果出错则返回 null。
 */
export async function getBalance(address, token, { tokenFile = './data/token.json' } = {}) {
	token = token.toUpperCase();
	let tokenBalance
	if (mainTokens.includes(token)) {
		const tokenBalanceWei = await provider.getBalance(address).catch(err => { console.log(err); return null; });
		tokenBalance = ethers.formatEther(tokenBalanceWei);
		console.log(`地址 ${address} ${token}余额: ${tokenBalance}`);
	} else {
		const tokenInfo = await getTokenInfo(listenToken, {tokenFile});
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
 * @param {string} [tokenFile='./data/token.json'] - 包含代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * @returns {Promise<void>} - 无返回值，处理转账过程中的错误。
 */
export async function transferToken({ enPrivateKey, toAddress, token, value, tokenFile = './data/token.json' }) {
	try {
		token = token.toUpperCase()
		value = ethers.parseEther(value.toString());
		const wallet = await getWallet(enPrivateKey);
		const fromAddress = await wallet.getAddress();
		if (mainTokens.includes(token)) {
			console.log(`地址 ${fromAddress} 发送前 ${token} 余额: ${ethers.formatEther(await provider.getBalance(fromAddress))}`);
			// 构造交易请求，参数：to为接收地址，value为ETH数额
			const tx = {
				to: toAddress,
				value,
			};
			// 发送交易，获得收据
			const receipt = await wallet.sendTransaction(tx);
			console.log('等待交易在区块链确认（需要几分钟）');
			await receipt.wait(); // 等待链上确认交易
			console.log(`交易哈希: ${receipt.hash}`); // 打印交易详情
			console.log(`地址 ${fromAddress} 发送后 ${token} 余额: ${ethers.formatEther(await provider.getBalance(fromAddress))}`);
		} else {
			const tokenInfo = await getTokenInfo(listenToken, {tokenFile});
			if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
			const { tokenAddr, tokenAbi, tokenDecimals } = tokenInfo;
			const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, wallet);
			console.log(`地址 ${fromAddress} 发送前 ${token} 余额: ${ethers.formatUnits(await tokenContract.balanceOf(fromAddress), tokenDecimals)}`);
			const receipt = await tokenContract.transfer(toAddress, value);
			console.log('等待交易在区块链确认（需要几分钟）');
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
 * @param {string} [params.tokenFile='./data/token.json'] - 包含代币信息的 JSON 文件路径，默认为 './data/token.json'。
 * @param {string} [params.direction='in'] - 监听的方向，可以是 'in'（流入）或 'out'（流出），默认为 'in'。
 */
export async function listenContract({ listenAddress, listenToken, tokenFile = './data/token.json', direction = 'in' }) {
	const tokenInfo = await getTokenInfo(listenToken, {tokenFile});
	if (!tokenInfo) { console.log('没有此代币信息，请先添加'); return };
	const { tokenAddr, tokenAbi, tokenDecimals } = tokenInfo;
	const tokenContract = new ethers.Contract(tokenAddr, tokenAbi, provider);
	const tokenSymbol = await tokenContract.symbol();
	await tokenContract.balanceOf(address).then(balance => (console.log(`地址 ${listenAddress} ${tokenSymbol} 余额: ${balance}`)));
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