'use client';

import { useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';

export function useBalance() {
  const { network } = useUtxoContext();

  const getBalance = useCallback(async (address) => {
    try {
      const baseUrl = network === 'btc' 
        ? 'https://mempool.space/api' 
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/address/${address}`);
      const data = await response.json();

      const balanceSat = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      return {
        success: true,
        data: {
          balanceSat,                    // 聪为单位
          balance: balanceSat / 100000000  // BTC为单位
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || '获取余额失败'
      };
    }
  }, [network]);

  return { getBalance };
}
