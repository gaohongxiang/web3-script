'use client';

import { useCallback } from 'react';
import { useRequest } from 'ahooks';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';

const API_ENDPOINTS = {
  btc: 'https://mempool.space/api/v1/fees/recommended',
  fractal: 'https://mempool.fractalbitcoin.io/api/v1/fees/recommended'
};

export function useGas() {
  const { network, setGasInfo } = useUtxoContext();

  // 获取费率
  const { data, loading, refresh } = useRequest(
    async () => {
      if (!network) return null;
      
      const baseUrl = API_ENDPOINTS[network];
      const response = await fetch(baseUrl, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('获取费率失败');
      }

      const data = await response.json();
      const result = {
        fast: {
          fee: data.fastestFee,
          time: '快速'
        },
        medium: {
          fee: data.halfHourFee,
          time: '一般'
        },
        slow: {
          fee: data.hourFee,
          time: '慢速'
        }
      };

      setGasInfo(result);
      return result;
    },
    {
      refreshInterval: 30000,
      ready: !!network,
      refreshDeps: [network],
      onError: (error) => {
        console.error('Get gas fees error:', error);
      }
    }
  );

  return {
    gasInfo: data,
    loading,
    fetchGas: refresh
  };
} 