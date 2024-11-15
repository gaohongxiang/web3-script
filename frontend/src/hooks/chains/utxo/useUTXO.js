'use client';

import { useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { UTXO_ERRORS } from '@/constants/errors';

export function useUTXO() {
  const { network } = useUtxoContext();

  // 获取 UTXO 列表
  const getUtxos = useCallback(async (address) => {
    try {
      const baseUrl = network === 'btc' 
        ? 'https://mempool.space/api' 
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/address/${address}/utxo`);
      
      if (response.status === 500) {
        return {
          success: false,
          message: UTXO_ERRORS.NETWORK_ERROR.message,
          retryable: true
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message: UTXO_ERRORS.FETCH_ERROR.message,
          retryable: true
        };
      }

      const data = await response.json();
      // 排序：先按确认状态分组，每组内按金额从大到小排序
      const sortedData = data.sort((a, b) => {
        // 先按确认状态分组
        if (a.status.block_height === 0 && b.status.block_height !== 0) {
          return -1;  // a 未确认，排在前面
        }
        if (a.status.block_height !== 0 && b.status.block_height === 0) {
          return 1;   // b 未确认，排在前面
        }
        // 同组内按金额从大到小排序
        return b.value - a.value;
      });

      return {
        success: true,
        data: {
          allUtxos: sortedData,
          total: data.length
        }
      };
    } catch (error) {
      return {
        success: false,
        message: UTXO_ERRORS.NETWORK_ERROR.message,
        retryable: true
      };
    }
  }, [network]);

  return {
    getUtxos
  };
}
