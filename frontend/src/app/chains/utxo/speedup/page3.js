'use client';

import { useState, useCallback, useEffect } from 'react';
import { UTXONetworkAndGas } from '@/components/chains/utxo/UTXONetworkAndGas';
import { Transaction } from '@/components/chains/utxo/Transaction';
import { Address } from '@/components/chains/utxo/Address';
import { UTXOList } from '@/components/chains/utxo/UTXOList';
import { Message } from '@/components/Message';
import { useTransaction } from '@/hooks/chains/utxo/useTransaction';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';

export default function SpeedUp() {
  const { network } = useUtxoContext();
  const { validateAddressInTx } = useTransaction();

  // 交易相关状态
  const [txid, setTxid] = useState('');
  const [txInfo, setTxInfo] = useState(null);

  // 地址相关状态
  const [addressData, setAddressData] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // UTXO 相关状态
  const [selectedUtxos, setSelectedUtxos] = useState([]);

  // 验证地址是否在交易中
  const validateAddress = useCallback((address, tx) => {
    if (!address || !tx?.success) return null;
    console.log('Validating address:', { address, tx });
    const result = validateAddressInTx(tx.data, address);
    console.log('Validation result:', result);
    // 如果有交易信息但地址不在交易中，返回错误信息
    if (tx.success && !result.success) {
      return '该地址不在交易输入中';
    }
    return null;
  }, [validateAddressInTx]);

  // 处理交易信息变化
  const handleTxInfoChange = useCallback((info) => {
    console.log('Transaction info changed:', info);
    setTxInfo(info);
    if (addressData?.address && info?.success) {
      const error = validateAddress(addressData.address, info);
      console.log('Setting validation error:', error);
      setValidationError(error);
    }
  }, [addressData?.address, validateAddress]);

  // 处理地址变化
  const handleAddressChange = useCallback((data) => {
    console.log('Address changed:', data);
    setAddressData(data);
    setSelectedUtxos([]);
    
    // 只有当有交易信息时才验证地址
    if (data?.address && txInfo?.success) {
      const error = validateAddress(data.address, txInfo);
      console.log('Setting validation error:', error);
      setValidationError(error);
    } else {
      setValidationError(null);
    }
  }, [txInfo, validateAddress]);

  // 监听网络变化
  useEffect(() => {
    // 网络变化时清空所有状态
    setTxid('');
    setTxInfo(null);
    setAddressData(null);
    setValidationError(null);
    setSelectedUtxos([]);
  }, [network]);

  return (
    <>
      <UTXONetworkAndGas />
      
      <Transaction
        onChange={setTxid}
        onTxInfoChange={handleTxInfoChange}
      />

      <div className="mt-4">
        <Address 
          onAddressChange={handleAddressChange}
          label="加速地址"
          validationError={validationError}
        />
      </div>

      {addressData?.address && (
        <div className="mt-4">
          <UTXOList
            key={`${network}-${addressData.address}`}
            address={addressData.address}
            selectedUtxos={selectedUtxos}
            onUtxoSelect={setSelectedUtxos}
          />
        </div>
      )}
    </>
  );
}
