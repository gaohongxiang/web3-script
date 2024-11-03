'use client';

import { createContext, useContext, useState } from 'react';

const UtxoContext = createContext();

export function UtxoProvider({ children }) {
  const [network, setNetwork] = useState('btc');
  const [gasLevel, setGasLevel] = useState('medium');
  const [customGas, setCustomGas] = useState('');

  const value = {
    network,
    setNetwork,
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