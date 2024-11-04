'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useBalance } from '@/hooks/chains/utxo/useBalance';
import { Message } from '@/components/Message';
import { getCacheKey, getCache, setCache } from '@/utils/cache';
import { useLoadingState } from '@/hooks/useLoadingState';

export function FromAddress({ onChange, onFormDataChange, label = "发送地址" }) {
  const { network } = useUtxoContext();
  const { getBalance } = useBalance();
  
  // 使用 useLoadingState 管理解密和余额获取状态
  const {
    loading: decryptLoading,
    error: decryptError,
    execute: executeDecrypt,
    retry: retryDecrypt
  } = useLoadingState(null, { errorMessage: '解密失败' });

  const {
    data: balanceData,
    loading: balanceLoading,
    error: balanceError,
    execute: executeBalance,
    retry: retryBalance
  } = useLoadingState(null, { errorMessage: '获取余额失败' });

  // 表单状态
  const [formData, setFormData] = useState({
    enMnemonicOrWif: '',
    scriptType: 'P2TR'
  });
  const [address, setAddress] = useState('');

  // 获取余额
  const fetchBalance = useCallback(async (addr) => {
    if (!addr) return;
    const result = await executeBalance(getBalance, addr);
    if (result?.success) {
      const { balance, balanceSat } = result.data;
      onFormDataChange?.({
        ...formData,
        address: addr,
        balance,
        balanceSat
      });
    }
  }, [executeBalance, getBalance, formData, onFormDataChange]);

  // 解密地址
  const decryptAddress = async (value, scriptType) => {
    if (!value) return;

    try {
      // 尝试从缓存获取
      const cacheKey = getCacheKey('addresses', network, value, scriptType);
      const cachedAddress = getCache('addresses', cacheKey);
      if (cachedAddress) {
        setAddress(cachedAddress);
        onChange?.(cachedAddress);
        await fetchBalance(cachedAddress);
        return;
      }

      // 解密地址
      const result = await executeDecrypt(async () => {
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
        return data;
      });

      if (result?.success) {
        const newAddress = result.address;
        setCache('addresses', cacheKey, newAddress);
        setAddress(newAddress);
        onChange?.(newAddress);
        await fetchBalance(newAddress);
      }
    } catch (error) {
      setAddress('');
    }
  };

  // 重试
  const handleRetry = () => {
    if (address) {
      retryBalance(getBalance, address);
    } else if (formData.enMnemonicOrWif) {
      retryDecrypt();
    }
  };

  // 处理输入变化
  const handleChange = async (e) => {
    const { name, value } = e.target;
    const newFormData = {
      ...formData,
      [name]: value.trim()
    };
    setFormData(newFormData);

    if (name === 'enMnemonicOrWif') {
      if (!value.trim()) {
        setAddress('');
        onFormDataChange?.({
          ...newFormData,
          address: ''
        });
        return;
      }

      // 先检查缓存
      const cacheKey = getCacheKey('addresses', network, value.trim(), formData.scriptType);
      const cachedAddress = getCache('addresses', cacheKey);
      if (cachedAddress) {
        setAddress(cachedAddress);
        onChange?.(cachedAddress);
        // 使用缓存的地址直接获取余额，避免重复解密
        await fetchBalance(cachedAddress);
        return;
      }

      // 如果没有缓存，再进行解密
      try {
        const result = await executeDecrypt(async () => {
          const response = await fetch('/api/chains/utxo/address', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              encryptedKey: value.trim(),
              network,
              scriptType: formData.scriptType
            }),
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.error || '解密失败');
          }
          return data;
        });

        if (result?.success) {
          const newAddress = result.address;
          setCache('addresses', cacheKey, newAddress);
          setAddress(newAddress);
          onChange?.(newAddress);
          await fetchBalance(newAddress);
        }
      } catch (error) {
        setAddress('');
        onFormDataChange?.({
          ...newFormData,
          address: '',
          error: error.message
        });
      }
    }
  };

  // 处理脚本类型变化
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

  // 在地址变化或网络变化时重新获取余额
  useEffect(() => {
    if (address) {
      fetchBalance(address);
    }
  }, [address, network]);

  return (
    <div className="-mt-1">
      <label htmlFor="enMnemonicOrWif" className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div>
        {/* 脚本类型选择 */}
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

        {/* 输入框 */}
        <div className="-mt-[1px] border border-gray-300 rounded-lg rounded-tl-none bg-white">
          <input
            type="text"
            id="enMnemonicOrWif"
            name="enMnemonicOrWif"
            value={formData.enMnemonicOrWif}
            onChange={handleChange}
            className={`w-full px-4 py-2 focus:outline-none focus:ring-1 ${
              decryptError 
                ? 'border-red-500 focus:ring-red-500' 
                : 'focus:ring-blue-500'
            }`}
            placeholder="输入加密的助记词或WIF私钥"
            autoComplete="off"
          />
        </div>

        {/* 地址和余额显示 */}
        {formData.enMnemonicOrWif && (
          <div className="mt-3">
            {(decryptLoading || balanceLoading) ? (
              <p className="text-sm text-gray-500">解析中...</p>
            ) : (decryptError || balanceError) ? (
              <div className="flex items-center justify-between">
                <Message type="error">{decryptError || balanceError}</Message>
                <button
                  onClick={handleRetry}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  重新获取
                </button>
              </div>
            ) : address ? (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-gray-400">地址：</span>
                  <span className="text-gray-600 font-medium break-all">{address}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">余额：</span>
                  {balanceData?.data && (
                    <>
                      <span className="text-gray-600 font-medium">
                        {balanceData.data.balance.toFixed(8)} {network === 'btc' ? 'BTC' : 'FB'}
                      </span>
                      <span className="text-gray-400 ml-2">
                        ({balanceData.data.balanceSat.toLocaleString()} 聪)
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}