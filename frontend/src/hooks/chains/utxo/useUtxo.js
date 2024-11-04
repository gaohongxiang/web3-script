'use client';

import { useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { getCacheKey, getCache, setCache } from '@/utils/cache';

export function useUtxo() {
  const { network } = useUtxoContext();

  // 获取 UTXO 列表
  const getUtxos = useCallback(async (address) => {
    try {
      // 检查缓存
      const cacheKey = getCacheKey('utxos', network, address);
      const cachedUtxos = getCache('utxos', cacheKey);
      if (cachedUtxos) {
        return {
          success: true,
          data: cachedUtxos
        };
      }

      const baseUrl = network === 'btc' 
        ? 'https://mempool.space/api' 
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/address/${address}/utxo`);
      if (!response.ok) {
        throw new Error('获取 UTXO 失败');
      }

      const utxos = await response.json();
      const result = {
        allUtxos: utxos,
        unconfirmedUtxos: utxos.filter(utxo => !utxo.status?.block_height)
      };

      // 缓存结果
      setCache('utxos', cacheKey, result);

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

  // 本地过滤 UTXO
  const filterUtxos = useCallback((allUtxos, filterMinSize = 546) => {
    return allUtxos.filter(utxo => utxo.value >= filterMinSize);
  }, []);

  return { 
    getUtxos,
    filterUtxos
  };
}
