'use client';

import { useState, useEffect } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useBalance } from '@/hooks/chains/utxo/useBalance';
import { Message } from '@/components/Message';

export function FromAddress({ onChange, onFormDataChange }) {
  const { network } = useUtxoContext();
  const { getBalance } = useBalance();
  const [formData, setFormData] = useState({
    enMnemonicOrWif: '',
    scriptType: 'P2TR'
  });
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState(null);
  const [balanceSat, setBalanceSat] = useState(null);
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState(null);
  const [balanceError, setBalanceError] = useState(null);

  useEffect(() => {
    if (address) {
      fetchBalance(address);
    }
  }, [network, address]);

  const fetchBalance = async (addr) => {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const result = await getBalance(addr);

      if (!result.success) {
        throw new Error(result.error);
      }

      const { balance: newBalance, balanceSat: newBalanceSat } = result.data;

      setBalance(newBalance);
      setBalanceSat(newBalanceSat);

      const updateData = {
        enMnemonicOrWif: formData.enMnemonicOrWif,
        scriptType: formData.scriptType,
        address: addr,
        balance: newBalance,
        balanceSat: newBalanceSat
      };
      onFormDataChange?.(updateData);

    } catch (error) {
      console.error('Balance error:', error);
      setBalanceError(error.message || '获取余额失败，请重试');
      setBalance(null);
      setBalanceSat(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  const decryptAddress = async (value, scriptType) => {
    if (!value) return;
    
    setDecryptLoading(true);
    setError(null);
    try {
      if (value.includes('生成密钥对和地址时发生错误')) {
        throw new Error('加密内容无效，请检查输入');
      }

      const response = await fetch('/api/chains/utxo/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedKey: value.trim(),
          network,
          scriptType
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || '解密失败');
      }

      const newAddress = data.address;
      setAddress(newAddress);
      onChange?.(newAddress);

      await fetchBalance(newAddress);

    } catch (error) {
      setAddress('');
      setBalance(null);
      setBalanceSat(null);
      setError(error.message || '加密内容无效或获取余额失败，请检查输入');
    } finally {
      setDecryptLoading(false);
    }
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    const newFormData = {
      ...formData,
      [name]: value.trim()
    };
    setFormData(newFormData);

    if (name === 'enMnemonicOrWif') {
      if (value.trim()) {
        decryptAddress(value.trim(), formData.scriptType);
      } else {
        setAddress('');
        setBalance(null);
        setBalanceSat(null);
        onChange?.('');
        onFormDataChange?.({
          ...newFormData,
          address: ''
        });
      }
    }
  };

  const handleScriptTypeChange = (newType) => {
    const newFormData = {
      ...formData,
      scriptType: newType
    };
    setFormData(newFormData);

    if (formData.enMnemonicOrWif) {
      decryptAddress(formData.enMnemonicOrWif, newType);
    }
  };

  return (
    <div className="-mt-1">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        发送地址
      </label>
      <div>
        <div className="relative flex">
          {['P2TR', 'P2WPKH', 'P2PKH'].map((type, index) => (
            <button
              key={type}
              type="button"
              onClick={() => handleScriptTypeChange(type)}
              className={`w-24 px-3 py-1.5 text-xs border-t border-l border-r border-gray-300 text-center focus:outline-none relative transition-colors ${
                index === 0 ? 'rounded-tl-lg' : ''
              } ${
                index === 2 ? 'rounded-tr-lg' : ''
              } ${
                formData.scriptType === type
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="-mt-[1px] border border-gray-300 rounded-lg rounded-tl-none bg-white">
          <input
            type="text"
            name="enMnemonicOrWif"
            value={formData.enMnemonicOrWif}
            onChange={handleChange}
            className={`w-full px-4 py-2 focus:outline-none focus:ring-1 ${
              error 
                ? 'border-red-500 focus:ring-red-500' 
                : 'focus:ring-blue-500'
            }`}
            placeholder="输入加密的助记词或WIF私钥"
            autoComplete="off"
          />
        </div>

        {formData.enMnemonicOrWif && (
          <div className="mt-3">
            {decryptLoading ? (
              <p className="text-sm text-gray-500">解密中...</p>
            ) : error ? (
              <Message type="error">{error}</Message>
            ) : address && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-gray-400">地址：</span>
                  <span className="text-gray-600 font-medium break-all">{address}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">余额：</span>
                  {balanceLoading ? (
                    <span className="text-gray-500">获取中...</span>
                  ) : balanceError ? (
                    <Message type="error">{balanceError}</Message>
                  ) : balance !== null ? (
                    <>
                      <span className="text-gray-600 font-medium">
                        {balance.toFixed(8)} {network === 'btc' ? 'BTC' : 'FB'}
                      </span>
                      <span className="text-gray-400 ml-2">
                        ({balanceSat?.toLocaleString()} 聪)
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 