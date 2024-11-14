'use client';

import { useEffect, useState, useCallback } from 'react';
import { NetworkAndGas } from '@/components/NetworkAndGas';
import { useUtxoContext, NETWORKS } from '@/contexts/chains/utxo/UtxoContext';
import { useGas } from '@/hooks/chains/utxo/useGas';

export function UTXONetworkAndGas() {
  const { 
    network,
    gasInfo,
    gasLevel,
    customGas,
    setNetwork,
    setCustomGas,
    setGasLevel
  } = useUtxoContext();

  const { loading, fetchGas } = useGas();
  const [currentCountdown, setCurrentCountdown] = useState(30);

  // 处理倒计时和自动刷新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentCountdown(prev => {
        if (prev <= 1) {
          fetchGas();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchGas]);

  // 处理网络切换
  const handleNetworkChange = useCallback((networkKey) => {
    setNetwork(networkKey);
    setCurrentCountdown(30);
  }, [setNetwork]);

  // 处理 gas 级别切换
  const handleGasLevelChange = useCallback((level) => {
    if (level !== 'custom') {
      setCustomGas(null);
    }
    setGasLevel(level);
  }, [setGasLevel, setCustomGas]);

  // 处理自定义 gas 输入
  const handleCustomGasChange = useCallback((value) => {
    const numValue = value ? Number(value) : null;
    setCustomGas(numValue);
    setGasLevel('custom');
  }, [setCustomGas, setGasLevel]);

  return (
    <NetworkAndGas
      networks={NETWORKS}
      selectedNetwork={network}
      onNetworkChange={handleNetworkChange}
      gasInfo={gasInfo}
      loading={loading}
      countdown={currentCountdown}
      gasUnit="sat/vB"
      selectedGasLevel={gasLevel}
      customGas={customGas}
      onCustomGasChange={handleCustomGasChange}
      onGasLevelChange={handleGasLevelChange}
    />
  );
} 