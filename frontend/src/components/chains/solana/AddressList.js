'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';
import { useAddress } from '@/hooks/chains/solana/useAddress';
import { LoadingButton } from '@/components/LoadingButton';
import { useDebounceFn } from 'ahooks';
import CodeMirror from '@uiw/react-codemirror';

export function AddressList({ mode = 'transfer' }) {
  const { 
    addressList,
    selectedToken,
    setAddressList,
    setEncryptedKey
  } = useSolanaContext();

  const { getAddress, getBalance } = useAddress();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [balanceRetryCount, setBalanceRetryCount] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // 获取余额
  const fetchBalance = useCallback(async (addressToFetch) => {
    console.log('开始获取余额:', {
      addressToFetch,
      selectedToken
    });
    
    setBalanceLoading(true);
    try {
      const result = await getBalance(addressToFetch, {
        token: selectedToken?.symbol,
        tokenAddr: selectedToken?.mint
      });
      console.log('余额结果:', result);

      if (!result.success) {
        setError(result.message);
        if (balanceRetryCount < 3) {
          setBalanceRetryCount(prev => prev + 1);
          setRetryCountdown(5);
        }
        return;
      }

      setAddressList(prev => {
        const newList = prev.map(item => 
          item.address === addressToFetch 
            ? { 
                ...item, 
                balance: result.data.balance,
                decimals: selectedToken?.decimals || 9
              }
            : item
        );
        console.log('更新后的地址列表:', newList);
        return newList;
      });
      setError(null);
      setBalanceRetryCount(0);
    } finally {
      setBalanceLoading(false);
    }
  }, [getBalance, setAddressList, balanceRetryCount, selectedToken]);

  // 获取地址
  const fetchAddress = useCallback(async (value) => {
    if (!value) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getAddress(value);
      
      if (!result.success) {
        setError(result.message);
        setRetryable(result.retryable);
        if (result.retryable) {
          setRetryCountdown(5);
        }
        setAddressList([]);
        return;
      }

      const newAddress = {
        address: result.data.address,
        balance: '0',
        key: value
      };

      setAddressList(prev => 
        mode === 'transfer' ? [newAddress] : [...prev, newAddress]
      );

      // 获取余额
      await fetchBalance(result.data.address);
      
      setError(null);
      setRetryable(false);
      setRetryCountdown(0);
    } finally {
      setLoading(false);
    }
  }, [mode, getAddress, setAddressList, fetchBalance]);

  // 使用防抖处理输入
  const { run: debouncedFetch } = useDebounceFn(
    (value) => {
      if (mode === 'transfer') {
        fetchAddress(value);
      } else {
        // 批量模式下,按行处理每个输入
        value.split('\n')
          .filter(line => line.trim())
          .forEach(line => fetchAddress(line.trim()));
      }
    },
    { wait: 300 }
  );

  // 处理输入变化
  const handleInputChange = useCallback((value) => {
    setEncryptedKey(value);
    
    if (!value.trim()) {
      setAddressList([]);
      setError(null);
      setLoading(false);
      return;
    }

    debouncedFetch(value);
  }, [debouncedFetch, setAddressList, setEncryptedKey]);

  // 监听代币变化,更新余额
  useEffect(() => {
    if (addressList.length > 0) {
      const addresses = addressList.map(addr => addr.address);
      // 使用 Set 去重
      const uniqueAddresses = [...new Set(addresses)];
      uniqueAddresses.forEach(address => {
        fetchBalance(address);
      });
    }
  }, [selectedToken]); // 只依赖 selectedToken 的变化

  return (
    <div>
      <div className="min-h-[32px] flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {mode === 'transfer' ? '发送地址' : '发送地址列表'}
        </label>
        <div className="ml-2">
          {(loading || retryable) ? (
            <div className="flex items-center">
              <LoadingButton
                loading={loading}
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

      {mode === 'transfer' ? (
        <>
          <input
            type="text"
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={!selectedToken}
            placeholder={selectedToken ? "请输入加密后私钥" : "请先选择代币"}
            className={`
              w-full px-4 py-3 text-sm
              border border-gray-300 rounded-lg
              focus:outline-none focus:ring-1
              ${!selectedToken ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-blue-500'}
            `}
          />

          <div className="mt-3 space-y-1">
            <div className="flex items-center text-xs text-gray-400">
              <span className="w-14">地址：</span>
              <span className="flex-1 break-all">
                {loading ? '获取中...' : addressList[0]?.address || '-'}
              </span>
            </div>
            <div className="flex items-center text-xs text-gray-400">
              <span className="w-14">余额：</span>
              <div className="flex items-center space-x-2">
                <span>
                  {balanceLoading ? '获取中...' : 
                    addressList[0] ? `${addressList[0].balance || '0'} ${selectedToken?.symbol || 'SOL'}` : '-'
                  }
                </span>
                {addressList[0]?.address && (
                  <LoadingButton
                    onClick={() => fetchBalance(addressList[0].address)}
                    loading={balanceLoading}
                    title="刷新余额"
                    wait={3000}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <CodeMirror
          value=""
          onChange={handleInputChange}
          placeholder="每行输入一个加密后私钥"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: false,
            highlightActiveLine: false,
          }}
          height="160px"
          className="text-sm border border-gray-300 rounded-lg"
        />
      )}

      {mode !== 'transfer' && addressList.length > 0 && (
        <div className="mt-3 border border-gray-200 rounded-lg divide-y">
          {addressList.map((addr) => (
            <div key={addr.address} className="p-3">
              <div className="text-sm break-all">{addr.address}</div>
              <div className="text-xs text-gray-500 mt-1">
                余额: {balanceLoading ? '获取中...' : 
                  `${addr.balance || '0'} ${selectedToken?.symbol || 'SOL'}`
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 