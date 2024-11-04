'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';

// 根据不同网络的等待时间配置
const timeConfig = {
  btc: {
    low: '~30 分钟',      // 约3个区块
    medium: '~20 分钟',   // 约2个区块
    high: '~10 分钟'      // 约1个区块
  },
  fractal: {              // 改为 fractal 以匹配 context 中的值
    low: '~15 分钟',      // fractal 网络更快
    medium: '~5 分钟',
    high: '~2 分钟'
  }
};

export function useGas() {
  const { network } = useUtxoContext();
  const [gasInfo, setGasInfo] = useState({
    low: { fee: '1', time: timeConfig[network]?.low || timeConfig.btc.low },
    medium: { fee: '2', time: timeConfig[network]?.medium || timeConfig.btc.medium },
    high: { fee: '5', time: timeConfig[network]?.high || timeConfig.btc.high }
  });
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(false);

  const fetchGasFees = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = network === 'btc' 
        ? 'https://mempool.space/api' 
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/v1/fees/recommended`);
      const fees = await response.json();
      
      // 根据当前网络设置时间
      const times = timeConfig[network] || timeConfig.btc;
      
      setGasInfo({
        low: { 
          fee: fees.economyFee || fees.hourFee || '1', 
          time: times.low 
        },
        medium: { 
          fee: fees.halfHourFee || fees.normalFee || '2', 
          time: times.medium 
        },
        high: { 
          fee: fees.fastestFee || fees.priorityFee || '5', 
          time: times.high 
        }
      });
    } catch (error) {
      console.error('获取 Gas 费用失败:', error);
      // 发生错误时也要更新时间
      const times = timeConfig[network] || timeConfig.btc;
      setGasInfo(prev => ({
        low: { ...prev.low, time: times.low },
        medium: { ...prev.medium, time: times.medium },
        high: { ...prev.high, time: times.high }
      }));
    } finally {
      setLoading(false);
    }
  }, [network]);

  // 网络变化时立即更新时间
  useEffect(() => {
    const times = timeConfig[network] || timeConfig.btc;
    setGasInfo(prev => ({
      low: { ...prev.low, time: times.low },
      medium: { ...prev.medium, time: times.medium },
      high: { ...prev.high, time: times.high }
    }));
  }, [network]);

  // 定时获取 gas 费用
  useEffect(() => {
    fetchGasFees();
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchGasFees();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchGasFees]);

  return {
    gasInfo,
    countdown,
    loading,
  };
} 