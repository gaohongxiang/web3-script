'use client';

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useFee } from '@/hooks/chains/utxo/useFee';

// 网络配置常量
export const NETWORKS = [
  { key: 'btc', label: 'Bitcoin' },
  { key: 'fractal', label: 'Fractal' }
];

// 脚本类型常量
export const SCRIPT_TYPES = [
  { key: 'P2TR', label: 'P2TR' },
  { key: 'P2WPKH', label: 'P2WPKH' },
  { key: 'P2PKH', label: 'P2PKH' }
];

// 初始状态
const initialState = {
  network: 'btc',
  scriptType: 'P2TR',
  encryptedKey: '',
  address: '-',
  balance: '-',
  selectedUtxos: [],
  filterAmount: 10000,
  gasInfo: {
    fast: { fee: '-', time: '快速' },
    medium: { fee: '-', time: '一般' },
    slow: { fee: '-', time: '慢速' }
  },
  receiverList: '',
  isReceiverValid: false,
  txInfo: null,
  validationError: null,
  splitParts: 2,
  txid: '',
};

// 创建 Context
const UtxoContext = createContext(initialState);

// Context Provider
export function UtxoProvider({ children }) {
  // ======== 基础状态 ========
  // 网络和脚本类型
  const [network, setNetwork] = useState(initialState.network);
  const [scriptType, setScriptType] = useState(initialState.scriptType);

  // 助记词和地址
  const [encryptedKey, setEncryptedKey] = useState('');
  const [address, setAddress] = useState(initialState.address);
  const [balance, setBalance] = useState(initialState.balance);

  // UTXO 相关
  const [selectedUtxos, setSelectedUtxos] = useState(initialState.selectedUtxos);
  const [filterAmount, setFilterAmount] = useState(initialState.filterAmount);

  // Gas 相关
  const [gasInfo, setGasInfo] = useState(initialState.gasInfo);
  const [gasLevel, setGasLevel] = useState('fast');
  const [customGas, setCustomGas] = useState(null);

  // 接收地址相关
  const [receiverList, setReceiverList] = useState(initialState.receiverList);
  const [isReceiverValid, setIsReceiverValid] = useState(initialState.isReceiverValid);

  // 交易相关
  const [txid, setTxid] = useState(initialState.txid);
  const [txInfo, setTxInfo] = useState(initialState.txInfo);
  const [validationError, setValidationError] = useState(initialState.validationError);

  // 拆分相关
  const [splitParts, setSplitParts] = useState(initialState.splitParts);

  // ======== 计算状态 ========
  // 获取费用计算函数
  const { calculateTransferFee, calculateSpeedUpFee, calculateSplitFee } = useFee();

  // 计算当前使用的费率
  const currentFeeRate = useMemo(() => 
    gasLevel === 'custom'
      ? customGas
      : gasLevel === 'fast'
        ? gasInfo?.fast?.fee
        : gasLevel === 'medium'
          ? gasInfo?.medium?.fee
          : gasInfo?.slow?.fee
  , [customGas, gasLevel, gasInfo]);

  // 计算转账费用
  const transferFee = useMemo(() => {
    if (!receiverList || !currentFeeRate) return null;
    return calculateTransferFee(receiverList, currentFeeRate, selectedUtxos);
  }, [receiverList, currentFeeRate, selectedUtxos, calculateTransferFee]);

  // 计算加速费用
  const speedUpFee = useMemo(() => { 
    if (!currentFeeRate) return null;
    return calculateSpeedUpFee(txInfo, currentFeeRate, selectedUtxos);
  }, [currentFeeRate, txInfo, selectedUtxos, calculateSpeedUpFee]);

  // 计算拆分费用
  const splitFee = useMemo(() => {
    if (!selectedUtxos.length || !currentFeeRate || !splitParts) return null;
    return calculateSplitFee(splitParts, currentFeeRate, selectedUtxos);
  }, [selectedUtxos, currentFeeRate, splitParts, calculateSplitFee]);

  // ======== 处理函数 ========
  // 处理网络切换
  const handleNetworkChange = useCallback((newNetwork) => {
    setNetwork(newNetwork);
    // 重置相关状态
    setAddress(initialState.address);
    setBalance(initialState.balance);
    setTxInfo(initialState.txInfo);
    setValidationError(initialState.validationError);
    setSelectedUtxos(initialState.selectedUtxos);
    setGasInfo(initialState.gasInfo);
  }, []);

  // 处理脚本类型切换
  const handleScriptTypeChange = useCallback((newType) => {
    setScriptType(newType);
    // 保留助记词，但清空地址相关状态
    setAddress(null);
    setBalance(null);
    setValidationError(null);
    setSelectedUtxos([]);
  }, []);

  // 清空所有状态
  const clearState = useCallback(() => {
    setNetwork(initialState.network);
    setScriptType(initialState.scriptType);
    setEncryptedKey(initialState.encryptedKey);
    setAddress(initialState.address);
    setBalance(initialState.balance);
    setTxInfo(initialState.txInfo);
    setValidationError(initialState.validationError);
    setSelectedUtxos(initialState.selectedUtxos);
    setGasInfo(initialState.gasInfo);
    setSplitParts(initialState.splitParts);
    setTxid(initialState.txid);
  }, []);

  // ======== Context 值 ========
  const value = {
    // 基础状态
    network,
    scriptType,
    encryptedKey,
    address,
    balance,
    selectedUtxos,
    filterAmount,
    gasInfo,
    gasLevel,
    customGas,
    receiverList,
    isReceiverValid,
    txInfo,
    validationError,
    splitParts,
    txid,

    // 计算状态
    currentFeeRate,
    transferFee,
    speedUpFee,
    splitFee,

    // 设置函数
    setNetwork: handleNetworkChange,
    setScriptType: handleScriptTypeChange,
    setEncryptedKey,
    setAddress,
    setBalance,
    setSelectedUtxos,
    setFilterAmount,
    setGasInfo,
    setGasLevel,
    setCustomGas,
    setReceiverList,
    setIsReceiverValid,
    setTxInfo,
    setValidationError,
    setSplitParts,
    setTxid,
    clearState
  };

  return (
    <UtxoContext.Provider value={value}>
      {children}
    </UtxoContext.Provider>
  );
}

// 自定义 Hook
export function useUtxoContext() {
  const context = useContext(UtxoContext);
  if (!context) {
    throw new Error('useUtxoContext must be used within a UtxoProvider');
  }
  return context;
} 