'use client';

import { createContext, useContext, useState, useCallback } from 'react';

// 初始状态
const initialState = {
  // 助记词和地址
  encryptedKey: '',
  addressList: [],
  balance: '-',

  // 代币相关
  selectedToken: [],

  // 接收地址相关
  receiverList: '',
  isReceiverValid: false,

  // 交易相关
  txInfo: null,
  validationError: null
};

// 创建 Context
const SolanaContext = createContext(initialState);

// Context Provider
export function SolanaProvider({ children }) {
  // 助记词和地址
  const [encryptedKey, setEncryptedKey] = useState(initialState.encryptedKey);
  const [addressList, setAddressList] = useState(initialState.addressList);
  const [balance, setBalance] = useState(initialState.balance);

  // 代币相关
  const [selectedToken, setSelectedToken] = useState(initialState.selectedToken);

  // 接收地址相关
  const [receiverList, setReceiverList] = useState(initialState.receiverList);
  const [isReceiverValid, setIsReceiverValid] = useState(initialState.isReceiverValid);

  // 交易相关
  const [txInfo, setTxInfo] = useState(initialState.txInfo);
  const [validationError, setValidationError] = useState(initialState.validationError);

  // 清空所有状态
  const clearState = useCallback(() => {
    setEncryptedKey(initialState.encryptedKey);
    setAddressList(initialState.addressList);
    setBalance(initialState.balance);
    setSelectedToken(initialState.selectedToken);
    setReceiverList(initialState.receiverList);
    setIsReceiverValid(initialState.isReceiverValid);
    setTxInfo(initialState.txInfo);
    setValidationError(initialState.validationError);
  }, []);

  const value = {
    // 基础状态
    encryptedKey,
    addressList,
    balance,
    selectedToken,
    receiverList,
    isReceiverValid,
    txInfo,
    validationError,

    // 设置函数
    setEncryptedKey,
    setAddressList,
    setBalance,
    setSelectedToken,
    setReceiverList,
    setIsReceiverValid,
    setTxInfo,
    setValidationError,
    clearState
  };

  return (
    <SolanaContext.Provider value={value}>
      {children}
    </SolanaContext.Provider>
  );
}

// 自定义 Hook
export function useSolanaContext() {
  const context = useContext(SolanaContext);
  if (!context) {
    throw new Error('useSolanaContext must be used within a SolanaProvider');
  }
  return context;
}