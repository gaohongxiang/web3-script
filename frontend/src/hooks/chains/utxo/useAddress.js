'use client';

import { useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { ADDRESS_ERRORS } from '@/constants/errors';

export function useAddress() {
  const { network } = useUtxoContext();

  // 从后端获取地址
  const getAddress = useCallback(async (encryptedKey, scriptType = 'P2TR') => {
    try {
      const response = await fetch('/api/chains/utxo/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          encryptedKey, 
          network, 
          scriptType
        })
      });

      if (response.status === 500) {
        return {
          success: false,
          message: ADDRESS_ERRORS.NETWORK_ERROR.message,
          retryable: true  // 标记为可重试错误
        };
      }
      
      const result = await response.json();
      if (!result.success) {
        return {
          ...result,
          retryable: false  // 标记为一次性错误
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: ADDRESS_ERRORS.NETWORK_ERROR.message,
        retryable: true
      };
    }
  }, [network]);

  // 前端获取余额
  const getBalance = useCallback(async (address) => {
    try {
      const baseUrl = network === 'btc' 
        ? 'https://mempool.space/api' 
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/address/${address}`);

      if (response.status === 500) {
        return {
          success: false,
          message: ADDRESS_ERRORS.NETWORK_ERROR.message,
          retryable: true
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message: ADDRESS_ERRORS.BALANCE_ERROR.message,
          retryable: true
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          balance: data.chain_stats.funded_txo_sum / 100000000,
          balanceSat: data.chain_stats.funded_txo_sum
        }
      };
    } catch (error) {
      return {
        success: false,
        message: ADDRESS_ERRORS.NETWORK_ERROR.message,
        retryable: true
      };
    }
  }, [network]);

  return { getAddress, getBalance };
}

// 导出错误类型供组件使用
export { ADDRESS_ERRORS };
