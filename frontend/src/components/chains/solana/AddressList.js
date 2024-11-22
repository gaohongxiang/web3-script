'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';
import { useAddress } from '@/hooks/chains/solana/useAddress';
import { LoadingButton } from '@/components/LoadingButton';
import { useDebounceFn } from 'ahooks';
import { AddressInputDialog } from './AddressInputDialog';

const MIN_SOL_BALANCE = 0.001;

export function AddressList({ mode = 'transfer' }) {
  const { 
    addressList,
    selectedToken,
    setAddressList,
    setEncryptedKey,
    sendAll,
    keepAmount,
    keepValue,
    customAmount,
    sendAmount
  } = useSolanaContext();

  const { getAddress, getBalance } = useAddress();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [balanceRetryCount, setBalanceRetryCount] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);

  // 添加延迟函数到组件作用域
  const delay = useCallback((ms) => new Promise(resolve => setTimeout(resolve, ms)), []);

  // 获取余额
  const fetchBalance = useCallback(async (addressToFetch) => {
    
    try {
      const result = await getBalance(addressToFetch, {
        token: selectedToken?.symbol,
        tokenAddr: selectedToken?.mint
      });

      if (!result.success) {
        console.error('获取余额失败:', result.message);
        return;
      }

      setAddressList(prev => {
        return prev.map(item => 
          item.address === addressToFetch 
            ? { 
                ...item, 
                balance: result.data.balance,
                balanceSat: result.data.balanceSat
              }
            : item
        );
      });
      
    } catch (error) {
      console.error('获取余额错误:', error);
    }
  }, [getBalance, setAddressList, selectedToken]);

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
        return;
      }

      const newAddress = {
        address: result.data.address,
        balance: '0',
        balanceSat: '0',
        enPrivateKey: value
      };

      setAddressList(prev => {
        // 检查地址是否已存在
        const exists = prev.some(addr => addr.address === result.data.address);
        if (exists) {
          return prev;
        }
        // 保持原有顺序,添加到末尾
        return [...prev, newAddress];
      });

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
    async (value) => {
      if (mode === 'transfer') {
        fetchAddress(value);
      } else {
        // 批量模式下并行处理每个输入
        const lines = value.split('\n').filter(line => line.trim());
        setLoading(true);
        try {
          // 并行获取所有地址
          const addressPromises = lines.map(line => getAddress(line.trim()));
          const results = await Promise.all(addressPromises);
          
          // 过滤出成功的地址并添加到列表
          const validAddresses = results
            .filter(result => result.success)
            .map(result => ({
              address: result.data.address,
              balance: '0',
              balanceSat: '0',
              enPrivateKey: lines[results.indexOf(result)]
            }));

          // 批量更新地址列表
          setAddressList(prev => {
            const newList = [...prev];
            validAddresses.forEach(newAddr => {
              if (!newList.some(addr => addr.address === newAddr.address)) {
                newList.push(newAddr);
              }
            });
            return newList;
          });

          // 并行获取所有余额
          const addresses = validAddresses.map(addr => addr.address);
          if (addresses.length > 0) {
            setBalanceLoading(true);
            try {
              await Promise.all(addresses.map(address => fetchBalance(address)));
            } finally {
              setBalanceLoading(false);
            }
          }
        } finally {
          setLoading(false);
        }
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
      setError(null); // 切换代币时清除错误
      const addresses = addressList.map(addr => addr.address);
      // 使用 Set 去重
      const uniqueAddresses = [...new Set(addresses)];
      setLoading(false);
      // 并行请求余额
      const fetchBalances = async () => {
        setBalanceLoading(true);
        try {
          await Promise.all(uniqueAddresses.map(async (address) => {
            await fetchBalance(address);
          }));
        } finally {
          setBalanceLoading(false);
        }
      };
      fetchBalances();
    }
  }, [selectedToken]); // 只依赖 selectedToken 变化

  // 添加自动重试的 useEffect
  useEffect(() => {
    if (!retryCountdown || !retryable) return;

    const timer = setInterval(async () => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          // 重试获取失败的地址余额
          const failedAddresses = addressList.filter(addr => !addr.balance);
          const retryBalances = async () => {
            for (const addr of failedAddresses) {
              await fetchBalance(addr.address);
              await delay(500);
            }
          };
          retryBalances();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [retryCountdown, retryable, addressList, fetchBalance, delay]);

  const isEligible = useCallback((addr) => {
    const balance = Number(addr.balance || 0);
    
    if (sendAll) {
      return selectedToken?.symbol === 'SOL' ? 
        balance > MIN_SOL_BALANCE : 
        balance > 0;
    } 
    
    if (keepAmount && keepValue) {
      const keep = Number(keepValue);
      if (selectedToken?.symbol === 'SOL') {
        const minKeep = Math.max(keep, MIN_SOL_BALANCE);
        return balance > minKeep;
      }
      return balance > keep;
    } 
    
    if (customAmount && sendAmount) {
      return balance >= Number(sendAmount);
    }
    
    return false;
  }, [sendAll, keepAmount, keepValue, customAmount, sendAmount, selectedToken]);

  return (
    <div>
      <div className="min-h-[32px] flex items-center mb-1">
        <div className="flex items-center">
          <label className="block text-sm font-medium text-gray-700">
            {mode === 'transfer' ? '发送地址' : '发送地址列表'}
          </label>
          {error && (
            <span className="ml-2 text-xs text-red-500">{error}</span>
          )}
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
        <div className="border border-gray-200 rounded-lg">
          <div className="p-2 flex items-center justify-between border-b border-gray-200">
            <button
              type="button"
              onClick={() => setIsInputOpen(true)}
              disabled={!selectedToken?.mint}
              className={`
                px-3 py-1 text-xs font-medium rounded-lg
                ${selectedToken?.mint 
                  ? 'text-white bg-blue-600 hover:bg-blue-500' 
                  : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                }
              `}
            >
              批量导入
            </button>
          </div>

          {addressList.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">
              {!selectedToken?.mint 
                ? '请先选择代币'
                : '点击"批量导入"添加发送地址'
              }
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-2 p-2 bg-gray-50 text-xs font-medium text-gray-500">
                <div className="col-span-1 flex items-center justify-center">序号</div>
                <div className="col-span-8 flex items-center justify-center">地址</div>
                <div className="col-span-3">
                  <div className="flex items-center space-x-1">
                    <span>余额</span>
                    <LoadingButton
                      onClick={async () => {
                        const addresses = addressList.map(addr => addr.address);
                        const uniqueAddresses = [...new Set(addresses)];
                        setBalanceLoading(true);
                        try {
                          await Promise.all(uniqueAddresses.map(async (address) => {
                            await fetchBalance(address);
                          }));
                        } finally {
                          setBalanceLoading(false);
                        }
                      }}
                      loading={balanceLoading}
                      title="刷新余额"
                      wait={3000}
                    />
                  </div>
                </div>
              </div>
              <div className="max-h-[240px] overflow-y-auto divide-y divide-gray-200">
                {addressList.map((addr, index) => {
                  const eligible = isEligible(addr);
                  return (
                    <div key={addr.address} className="grid grid-cols-12 gap-2 p-2">
                      <div className={`col-span-1 text-xs flex items-center justify-center ${
                        eligible ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className={`col-span-8 text-xs break-all flex items-center justify-center ${
                        eligible ? 'text-green-600' : ''
                      }`}>
                        {addr.address}
                      </div>
                      <div className="col-span-3 text-xs">
                        {balanceLoading ? '获取中...' : (
                          <span className={eligible ? 'text-green-600' : 'text-gray-500'}>
                            {`${addr.balance || '0'} ${selectedToken?.symbol || 'SOL'}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {mode !== 'transfer' && (
        <AddressInputDialog
          isOpen={isInputOpen}
          onClose={() => setIsInputOpen(false)}
          onConfirm={handleInputChange}
          loading={loading}
        />
      )}
    </div>
  );
} 