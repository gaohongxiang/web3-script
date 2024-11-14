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
      // 排序：未确认在前，金额从大到小
      const sortedData = data.sort((a, b) => {
        if (a.status.confirmed !== b.status.confirmed) {
          return a.status.confirmed ? 1 : -1;
        }
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
