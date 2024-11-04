'use client';

import { useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { getCacheKey, getCache, setCache } from '@/utils/cache';

export function useBalance() {
  const { network } = useUtxoContext();

  const getBalance = useCallback(async (address) => {
    try {
      // 检查缓存
      const cacheKey = getCacheKey('balances', network, address);
      const cachedBalance = getCache('balances', cacheKey);
      if (cachedBalance) {
        return {
          success: true,
          data: cachedBalance
        };
      }

      const baseUrl = network === 'btc' 
        ? 'https://mempool.space/api' 
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/address/${address}`);
      if (!response.ok) {
        throw new Error('获取余额失败');
      }

      const data = await response.json();
      const result = {
        balance: data.chain_stats.funded_txo_sum / 100000000,
        balanceSat: data.chain_stats.funded_txo_sum
      };

      // 缓存结果
      setCache('balances', cacheKey, result);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, [network]);

  return { getBalance };
}
