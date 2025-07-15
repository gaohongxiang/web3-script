import axios from 'axios';
import { ethers } from 'ethers-v6';
import { HttpsProxyAgent } from 'https-proxy-agent';

class YalaScript {
    constructor(privateKey, rpcUrl, proxyUrl = null) {
        this.privateKey = privateKey;
        this.rpcUrl = rpcUrl;
        this.proxyUrl = proxyUrl;
        
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
        this.wallet = new ethers.Wallet(this.privateKey, this.provider);
        
        this.axiosConfig = {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        
        if (this.proxyUrl) {
            const agent = new HttpsProxyAgent(this.proxyUrl);
            this.axiosConfig.httpsAgent = agent;
            this.axiosConfig.httpAgent = agent;
        }
        
        this.client = axios.create(this.axiosConfig);
    }

    async getChallenge(address, chain = 1) {
        try {
            const response = await this.client.post('https://api.yala.org/api/account/challenge', {
                address: address.toLowerCase(),
                chain: chain
            });
            
            if (response.data.code !== 0) {
                throw new Error(`Challenge API failed: ${response.data.msg}`);
            }
            
            return response.data.data;
        } catch (error) {
            console.error('Error getting challenge:', error.message);
            throw error;
        }
    }

    async signMessage(message) {
        try {
            const signature = await this.wallet.signMessage(message);
            return signature;
        } catch (error) {
            console.error('Error signing message:', error.message);
            throw error;
        }
    }

    async login(address, chain, expires, hmac, signature) {
        try {
            const response = await this.client.post('https://api.yala.org/api/account/login', {
                address: address,
                chain: chain,
                expires: expires,
                hmac: hmac,
                signature: signature
            });
            
            if (response.data.code !== 0) {
                throw new Error(`Login API failed: ${response.data.msg}`);
            }
            
            return response.data.data;
        } catch (error) {
            console.error('Error logging in:', error.message);
            throw error;
        }
    }

    async getSignProof(tokenAccess) {
        try {
            const response = await this.client.get('https://api.yala.org/api/sign/proof', {
                headers: {
                    ...this.axiosConfig.headers,
                    'Authorization': `Bearer ${tokenAccess}`
                }
            });
            
            if (response.data.code !== 0) {
                throw new Error(`Sign proof API failed: ${response.data.msg}`);
            }
            
            return response.data.data;
        } catch (error) {
            console.error('Error getting sign proof:', error.message);
            throw error;
        }
    }

    async claimNFT(contractAddress, signature, signedTimestamp, contractABI) {
        try {
            const contract = new ethers.Contract(contractAddress, contractABI, this.wallet);
            
            const gasEstimate = await contract.claim.estimateGas(signature, signedTimestamp);
            const gasPrice = await this.provider.getFeeData();
            
            const tx = await contract.claim(signature, signedTimestamp, {
                gasLimit: gasEstimate,
                maxFeePerGas: gasPrice.maxFeePerGas,
                maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
            });
            
            console.log('Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt.transactionHash);
            
            return receipt;
        } catch (error) {
            console.error('Error claiming NFT:', error.message);
            throw error;
        }
    }

    async executeFullFlow(contractAddress, contractABI, chain = 1) {
        try {
            const address = this.wallet.address;
            console.log('Starting YALA claim process for address:', address);

            console.log('Step 1: Getting challenge...');
            const challengeData = await this.getChallenge(address, chain);
            console.log('challengeData', challengeData);

            console.log('Step 2: Signing message...');
            const message = `Hello, YALA  ${challengeData.hmac}`;
            const signature = await this.signMessage(message);
            console.log('signature', signature);

            console.log('Step 3: Logging in...');
            const loginData = await this.login(
                challengeData.address,
                challengeData.chain,
                challengeData.expires,
                challengeData.hmac,
                signature
            );
            
            console.log('Step 4: Getting sign proof...');
            const proofData = await this.getSignProof(loginData.tokenAccess);
            console.log('proofData', proofData);
            console.log('Step 5: Claiming NFT...');
            const claimResult = await this.claimNFT(
                contractAddress,
                proofData.signature,
                proofData.signedTimestamp,
                contractABI
            );
            
            console.log('YALA claim completed successfully!');
            return claimResult;
            
        } catch (error) {
            console.error('Error in full flow:', error.message);
            throw error;
        }
    }
}

export default YalaScript;

// 多钱包和代理配置
const wallets = [
  {
    privateKey: 'your_private_key1_here',
    proxyUrl: 'http://user1:pass1@ip1:port1'
  },
  {
    privateKey: 'your_private_key2_here',
    proxyUrl: 'http://user2:pass2@ip2:port2'
  },
  // ...更多钱包
];

const RPC_URL = 'https://mainnet.infura.io/v3/你的apikey';
const CONTRACT_ADDRESS = '0x89216d5C5EDEb318f298c536f0b1EB691aFf1d83';
const CONTRACT_ABI = [
  "function claim(bytes signature, uint256 signedTimestamp) external"
];

async function runForWallet(wallet, index) {
  try {
    console.log(`\n========== 钱包${index + 1} 开始执行 ==========`);
    console.log(`地址: ${new ethers.Wallet(wallet.privateKey).address}`);
    console.log(`代理: ${wallet.proxyUrl}`);
    
    const yalaScript = new YalaScript(wallet.privateKey, RPC_URL, wallet.proxyUrl);
    const result = await yalaScript.executeFullFlow(CONTRACT_ADDRESS, CONTRACT_ABI);
    
    console.log(`\n✅ 钱包${index + 1} 执行成功!`);
    console.log(`交易哈希: ${result.transactionHash}`);
    return { index, success: true, result };
  } catch (error) {
    console.error(`\n❌ 钱包${index + 1} 执行失败: ${error.message}`);
    return { index, success: false, error: error.message };
  }
}

async function main() {
  console.log(`🚀 开始执行 ${wallets.length} 个钱包的并发任务...\n`);
  
  const results = await Promise.allSettled(
    wallets.map((wallet, idx) => runForWallet(wallet, idx))
  );
  
  console.log('\n========== 执行结果汇总 ==========');
  
  let successCount = 0;
  let failureCount = 0;
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const { success, error } = result.value;
      if (success) {
        console.log(`✅ 钱包${index + 1}: 成功`);
        successCount++;
      } else {
        console.log(`❌ 钱包${index + 1}: 失败 - ${error}`);
        failureCount++;
      }
    } else {
      console.log(`❌ 钱包${index + 1}: 意外错误 - ${result.reason}`);
      failureCount++;
    }
  });
  
  console.log(`\n📊 总计: ${successCount} 成功, ${failureCount} 失败`);
  console.log(`成功率: ${((successCount / wallets.length) * 100).toFixed(2)}%`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}