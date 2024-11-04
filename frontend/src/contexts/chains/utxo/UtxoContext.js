'use client';

import { createContext, useContext, useState } from 'react';
import { clearAllCache } from '@/utils/cache';

const UtxoContext = createContext();

export function UtxoProvider({ children }) {
  const [network, setNetwork] = useState('btc');
  const [gasLevel, setGasLevel] = useState('medium');
  const [customGas, setCustomGas] = useState('');

  const handleNetworkChange = (newNetwork) => {
    clearAllCache();  // 切换网络时清除所有缓存
    setNetwork(newNetwork);
  };

  const value = {
    network,
    setNetwork: handleNetworkChange,
    gasLevel,
    setGasLevel,
    customGas,
    setCustomGas
  };

  return (
    <UtxoContext.Provider value={value}>
      {children}
    </UtxoContext.Provider>
  );
}

export function useUtxoContext() {
  const context = useContext(UtxoContext);
  if (!context) {
    throw new Error('useUtxoContext must be used within a UtxoProvider');
  }
  return context;
} 