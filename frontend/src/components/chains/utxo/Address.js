'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUtxoContext, SCRIPT_TYPES } from '@/contexts/chains/utxo/UtxoContext';
import { useAddress } from '@/hooks/chains/utxo/useAddress';
import { useDebounceFn } from 'ahooks';
import { LoadingButton } from '@/components/LoadingButton';

export function Address({ label = "发送地址", disabled = false }) {
  const { 
    network,
    scriptType,
    encryptedKey,
    setEncryptedKey,
    address,
    balance,
    setAddress,
    setBalance,
    setScriptType
  } = useUtxoContext();

  const { getAddress, getBalance } = useAddress();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [balanceRetryCount, setBalanceRetryCount] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // 获取余额
  const fetchBalance = useCallback(async (addressToFetch) => {

    setBalanceLoading(true);
    try {
      const result = await getBalance(addressToFetch);

      if (!result.success) {
        if (balanceRetryCount < 3) {
          setBalanceRetryCount(prev => prev + 1);
          setRetryCountdown(5);
        }
        return;
      }

      setBalance(result.data.balance);
      setBalanceRetryCount(0);
    } finally {
      setBalanceLoading(false);
    }
  }, [getBalance, setBalance, balanceRetryCount]);

  // 获取地址
  const fetchAddress = useCallback(async (value, type) => {
    if (!value) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getAddress(value, type);
      
      if (!result.success) {
        setError(result.message);
        setRetryable(result.retryable);
        if (result.retryable) {
          setRetryCountdown(5);
        }
        setAddress(null);
        return;
      }

      setError(null);
      setRetryable(false);
      setRetryCountdown(0);
      setAddress(result.data.address);
      
      // 获取余额
      await fetchBalance(result.data.address);
    } finally {
      setLoading(false);
    }
  }, [getAddress, setAddress, fetchBalance, network]);

  // 使用防抖处理输入
  const { run: debouncedFetch } = useDebounceFn(
    (value) => {
      fetchAddress(value, scriptType);
    },
    { wait: 300 }
  );

  // 处理输入变化
  const handleInputChange = useCallback((e) => {
    const value = e.target.value.trim();
    setEncryptedKey(value);
    
    if (!value) {
      setAddress(null);
      setError(null);
      setLoading(false);
      setRetryable(false);
      setRetryCountdown(0);
      return;
    }

    // 只使用防抖的请求
    debouncedFetch(value);
  }, [debouncedFetch, setAddress, setEncryptedKey]);

  // 监听网络和脚本类型变化
  useEffect(() => {
    if (encryptedKey) {
      debouncedFetch(encryptedKey, scriptType);
    }
  }, [network, scriptType, encryptedKey, debouncedFetch]);

  return (
    <div className="-mt-1">
      <div className="min-h-[32px] flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <div className="ml-2">
          {(loading || retryable) ? (
            <div className="flex items-center">
              <LoadingButton
                loading={loading}
                onClick={() => retryable && debouncedFetch(encryptedKey, scriptType)}
                title="获取地址"
              />
              {retryable && retryCountdown > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  {retryCountdown}s 后重试
                </span>
              )}
            </div>
          ) : error ? (
            <span className="text-xs text-red-500">
              {error}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-col">
        <div className="flex">
          {SCRIPT_TYPES.map((type, index) => (
            <button
              key={type.key}
              type="button"
              onClick={() => setScriptType(type.key)}
              disabled={disabled}
              className={`
                w-28 px-4 py-2 text-sm 
                border-t border-l border-r border-gray-300 
                text-center focus:outline-none relative transition-colors
                ${index === 0 ? 'rounded-tl-lg' : ''}
                ${index === SCRIPT_TYPES.length - 1 ? 'rounded-tr-lg' : ''}
                ${scriptType === type.key 
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
                }
                ${disabled ? 'cursor-not-allowed' : ''}
              `}
            >
              {type.label}
            </button>
          ))}
        </div>

        <input
          type="password"
          value={encryptedKey}
          onChange={handleInputChange}
          disabled={disabled}
          className={`
            w-full px-4 py-2 
            border border-gray-300 
            rounded-lg rounded-tl-none 
            focus:outline-none focus:ring-1 mt-[0.5px]
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-blue-500'}
          `}
          placeholder="请输入加密后的助记词或WIF"
        />

        <div className="mt-3 space-y-1">
          <div className="flex items-center text-xs text-gray-400">
            <span className="w-14">地址：</span>
            <span className="flex-1 break-all">
              {loading ? '获取中...' : address || '-'}
            </span>
          </div>
          <div className="flex items-center text-xs text-gray-400">
            <span className="w-14">余额：</span>
            <div className="flex items-center space-x-2">
              <span>
                {balanceLoading 
                  ? '获取中...' 
                  : typeof balance === 'number'
                    ? `${balance} ${network === 'btc' ? 'BTC' : 'FB'}`
                    : '-'
                }
              </span>
              {address && address !== '-' && (
                <LoadingButton
                  onClick={() => fetchBalance(address)}
                  loading={balanceLoading}
                  title="刷新余额"
                  wait={3000}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}