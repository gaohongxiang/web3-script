'use client';

import { useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useFee } from './useFee';

// 这些错误只在交易相关功能中使用
export const TX_ERRORS = {
  INVALID_FORMAT: {
    type: 'INVALID_FORMAT',
    message: '交易ID格式不正确，应为64位十六进制字符',
    retryable: false
  },
  NOT_FOUND: {
    type: 'NOT_FOUND',
    message: '交易不存在，请检查网络或交易ID是否正确',
    retryable: false
  },
  CONFIRMED: {
    type: 'CONFIRMED',
    message: '交易已确认，无需加速',
    retryable: false
  },
  SERVER_ERROR: {
    type: 'SERVER_ERROR',
    message: '获取交易失败，请重试',
    retryable: true
  },
  NETWORK_ERROR: {
    type: 'NETWORK_ERROR',
    message: '获取交易失败，请重试',
    retryable: true
  }
};

export function useTransaction() {
  const { network } = useUtxoContext();
  const { calculateFee, calculateTxSize } = useFee();

  // 单独的格式验证函数
  const validateFormat = useCallback((txid) => {
    if (!txid || !/^[0-9a-fA-F]{64}$/.test(txid)) {
      return {
        success: false,
        ...TX_ERRORS.INVALID_FORMAT
      };
    }
    return { success: true };
  }, []);

  const getTransaction = useCallback(async (txid) => {
    // 先验证格式
    const formatResult = validateFormat(txid);
    if (!formatResult.success) {
      return formatResult;
    }

    try {
      const baseUrl = network === 'btc'
        ? 'https://mempool.space/api'
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/tx/${txid}`);
      
      // 2. 处理不同的响应状态
      if (response.status === 404) {
        return {
          success: false,
          ...TX_ERRORS.NOT_FOUND
        };
      }
      
      if (response.status === 500) {
        return {
          success: false,
          ...TX_ERRORS.SERVER_ERROR
        };
      }

      // 3. 处理响应数据
      const transaction = await response.json();
      
      if (transaction.status.confirmed) {
        return {
          success: false,
          ...TX_ERRORS.CONFIRMED
        };
      }

      const addresses = Array.from(new Set([
        ...(transaction.vin || []).map(vin => vin.prevout?.scriptpubkey_address).filter(Boolean),
        ...(transaction.vout || []).map(vout => vout.scriptpubkey_address).filter(Boolean)
      ]))
      // 4. 返回成功结果
      return {
        success: true,
        data: {
          addresses,
          feeRate: transaction.adjustedFeePerVsize,
          vsize: transaction.adjustedVsize,
          confirmed: transaction.status.confirmed,
          weight: transaction.weight,
          size: transaction.size,
          fee: transaction.fee
        }
      };
    } catch (error) {
      return {
        success: false,
        ...TX_ERRORS.NETWORK_ERROR
      };
    }
  }, [network]);

  // 验证地址是否在交易输出中
  const validateAddressInTx = useCallback((txInfo, address) => {
    try {
      if (!txInfo?.success) {
        return {
          success: false,
          error: txInfo?.error || '获取交易失败'
        };
      }

      // addresses 直接在 txInfo 中
      const addresses = txInfo.addresses;

      // 确保 addresses 是数组
      const addressArray = Array.isArray(addresses) ? addresses : [];

      if (!addressArray.includes(address)) {
        return {
          success: false,
          error: `地址 ${address} 不在交易中，无法使用 CPFP 加速`
        };
      }

      return {
        success: true,
        data: txInfo
      };
    } catch (error) {
      return {
        success: false,
        error: '验证地址失败，请重试'
      };
    }
  }, []);

  return {
    validateFormat,  // 导出格式验证函数
    getTransaction,
    validateAddressInTx
  };
} 