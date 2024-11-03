// 交易相关
const validateAddressInTx = useCallback(
    debounce(async (txid, address) => {
      if (!txid || !address) {
        return {
          valid: false,
          confirmed: false,
          error: '请输入交易ID和地址'
        };
      }

      try {
        const baseUrl = network === 'btc' 
          ? 'https://mempool.space/api' 
          : 'https://mempool.fractalbitcoin.io/api';

        const response = await fetch(`${baseUrl}/tx/${txid}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('交易不存在，请检查交易ID是否正确');
          }
          throw new Error(`获取交易失败: ${response.status}`);
        }

        const transaction = await response.json();

        if (transaction.status?.confirmed) {
          return {
            valid: false,
            confirmed: true,
            error: '交易已确认，无需加速'
          };
        }

        const addresses = new Set();
        for (const vin of transaction.vin || []) {
          if (vin.prevout?.scriptpubkey_address) {
            addresses.add(vin.prevout.scriptpubkey_address);
          }
        }
        for (const vout of transaction.vout || []) {
          if (vout.scriptpubkey_address) {
            addresses.add(vout.scriptpubkey_address);
          }
        }

        return {
          valid: addresses.has(address),
          confirmed: false,
          error: addresses.has(address) ? null : `地址 ${address} 不在交易 ${txid} 中，无法使用 CPFP 加速`
        };
      } catch (error) {
        return {
          valid: false,
          confirmed: false,
          error: error.message
        };
      }
    }, 500),
    [network]
  );

  return {
    validateAddressInTx
  };