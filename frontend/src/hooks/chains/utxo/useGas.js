'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';

// 将 debounce 函数移到组件外部
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    return new Promise((resolve) => {
      timeout = setTimeout(() => {
        resolve(func(...args));
      }, wait);
    });
  };
};

export function useGas() {
  const { network } = useUtxoContext();
  const [gasInfo, setGasInfo] = useState({
    low: { fee: '1', time: '~30 分钟' },
    medium: { fee: '2', time: '~10 分钟' },
    high: { fee: '5', time: '~3 分钟' }
  });
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(false);

  // Gas 费用相关
  const fetchGasFees = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = network === 'btc' 
        ? 'https://mempool.space/api' 
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/v1/fees/recommended`);
      const fees = await response.json();
      
      setGasInfo(prev => ({
        low: { fee: fees.hourFee, time: prev.low.time },
        medium: { fee: fees.halfHourFee, time: prev.medium.time },
        high: { fee: fees.fastestFee, time: prev.high.time }
      }));
    } catch (error) {
      console.error('获取 Gas 费用失败:', error);
    } finally {
      setLoading(false);
    }
  }, [network]);

  // 网络变化时立即更新 gas
  useEffect(() => {
    let countdownTimer;
    let fetchTimer;

    fetchGasFees();
    setCountdown(30);

    countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchGasFees();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownTimer);
      clearInterval(fetchTimer);
    };
  }, [network, fetchGasFees]);

  

  return {
    gasInfo,
    countdown,
    loading,
  };
} 