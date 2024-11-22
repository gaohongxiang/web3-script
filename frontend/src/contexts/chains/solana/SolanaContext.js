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
  validationError: null,

  // 收集相关
  sendAll: false,
  keepAmount: false,
  customAmount: false,
  sendAmount: '',
  keepValue: '',
  eligibleCount: 0
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

  // 收集相关
  const [sendAll, setSendAll] = useState(initialState.sendAll);
  const [keepAmount, setKeepAmount] = useState(initialState.keepAmount);
  const [customAmount, setCustomAmount] = useState(initialState.customAmount);
  const [sendAmount, setSendAmount] = useState(initialState.sendAmount);
  const [keepValue, setKeepValue] = useState(initialState.keepValue);
  const [eligibleCount, setEligibleCount] = useState(initialState.eligibleCount);

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
    setSendAll(initialState.sendAll);
    setKeepAmount(initialState.keepAmount);
    setCustomAmount(initialState.customAmount);
    setSendAmount(initialState.sendAmount);
    setKeepValue(initialState.keepValue);
    setEligibleCount(initialState.eligibleCount);
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

    // 收集相关状态
    sendAll,
    keepAmount,
    customAmount,
    sendAmount,
    keepValue,
    eligibleCount,

    // 设置函数
    setEncryptedKey,
    setAddressList,
    setBalance,
    setSelectedToken,
    setReceiverList,
    setIsReceiverValid,
    setTxInfo,
    setValidationError,
    setSendAll,
    setKeepAmount,
    setCustomAmount,
    setSendAmount,
    setKeepValue,
    setEligibleCount,
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