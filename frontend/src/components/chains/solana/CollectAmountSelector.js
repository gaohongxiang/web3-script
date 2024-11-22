'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';

const MIN_SOL_BALANCE = 0.001;

export function CollectAmountSelector({ 
  addressList, 
  selectedToken,
  onAmountChange 
}) {
  const {
    sendAll, setSendAll,
    keepAmount, setKeepAmount,
    customAmount, setCustomAmount,
    sendAmount, setSendAmount,
    keepValue, setKeepValue,
    eligibleCount, setEligibleCount
  } = useSolanaContext();

  useEffect(() => {
    let count = 0;
    let eligibleAddresses = [];

    if (sendAll) {
      eligibleAddresses = addressList.filter(addr => {
        const balance = Number(addr.balance || 0);
        return selectedToken?.symbol === 'SOL' ? 
          balance > MIN_SOL_BALANCE : 
          balance > 0;
      }).map(addr => ({
        ...addr,  // 保留原始地址的所有信息
        collectAmount: selectedToken?.symbol === 'SOL' ? 
          (Number(addr.balance) - MIN_SOL_BALANCE).toString() :
          addr.balance,
        collectAmountSat: selectedToken?.symbol === 'SOL' ? 
          (Number(addr.balanceSat) - MIN_SOL_BALANCE * 1e9).toString() :
          addr.balanceSat
      }));
      count = eligibleAddresses.length;
    } else if (keepAmount && keepValue) {
      eligibleAddresses = addressList.filter(addr => {
        const balance = Number(addr.balance || 0);
        const keep = Number(keepValue);
        if (selectedToken?.symbol === 'SOL') {
          const minKeep = Math.max(keep, MIN_SOL_BALANCE);
          return balance > minKeep;
        }
        return balance > keep;
      }).map(addr => {
        const keep = Number(keepValue);
        const keepSat = keep * Math.pow(10, selectedToken?.decimals || 9);
        const collectAmount = Number(addr.balance) - (
          selectedToken?.symbol === 'SOL' ? 
            Math.max(keep, MIN_SOL_BALANCE) : 
            keep
        );
        const collectAmountSat = Number(addr.balanceSat) - (
          selectedToken?.symbol === 'SOL' ? 
            Math.max(keepSat, MIN_SOL_BALANCE * 1e9) : 
            keepSat
        );
        
        return {
          ...addr,  // 保留原始地址的所有信息
          collectAmount: collectAmount.toString(),
          collectAmountSat: collectAmountSat.toString()
        };
      });
      count = eligibleAddresses.length;
    } else if (customAmount && sendAmount) {
      eligibleAddresses = addressList.filter(addr => {
        const balance = Number(addr.balance || 0);
        const send = Number(sendAmount);
        return selectedToken?.symbol === 'SOL' ? 
          balance >= send + MIN_SOL_BALANCE :
          balance >= send;
      }).map(addr => ({
        ...addr,  // 保留原始地址的所有信息
        collectAmount: sendAmount,
        collectAmountSat: (Number(sendAmount) * Math.pow(10, selectedToken?.decimals || 9)).toString()
      }));
      count = eligibleAddresses.length;
    }

    setEligibleCount(count);
    onAmountChange(eligibleAddresses);
  }, [addressList, sendAll, keepAmount, keepValue, customAmount, sendAmount, selectedToken, onAmountChange]);

  const handleSendAllChange = useCallback((checked) => {
    setSendAll(checked);
    if (checked) {
      setKeepAmount(false);
      setCustomAmount(false);
      setSendAmount('');
      setKeepValue('');
      
      const eligibleAddresses = addressList.filter(addr => {
        const balance = Number(addr.balance || 0);
        return selectedToken?.symbol === 'SOL' ? 
          balance > MIN_SOL_BALANCE : 
          balance > 0;
      }).map(addr => ({
        ...addr,  // 保留原有的所有属性
        collectAmount: selectedToken?.symbol === 'SOL' ? 
          (Number(addr.balance) - MIN_SOL_BALANCE).toString() :
          addr.balance,
        collectAmountSat: selectedToken?.symbol === 'SOL' ? 
          (Number(addr.balanceSat) - MIN_SOL_BALANCE * 1e9).toString() :
          addr.balanceSat
      }));

      onAmountChange(eligibleAddresses);
      setEligibleCount(eligibleAddresses.length);
    } else {
      onAmountChange([]);
      setEligibleCount(0);
    }
  }, [addressList, selectedToken, onAmountChange]);

  const handleCustomAmountChange = useCallback((checked) => {
    setCustomAmount(checked);
    if (checked) {
      setSendAll(false);
      setKeepAmount(false);
      setKeepValue('');
      
      if (sendAmount) {
        const sendValue = Number(sendAmount);
        const sendValueSat = sendValue * Math.pow(10, selectedToken?.decimals || 9);
        
        const eligibleAddresses = addressList.filter(addr => {
          const balance = Number(addr.balance || 0);
          return selectedToken?.symbol === 'SOL' ? 
            balance >= sendValue + MIN_SOL_BALANCE :
            balance >= sendValue;
        });

        onAmountChange(eligibleAddresses.map(addr => ({
          address: addr.address,
          balance: addr.balance,
          balanceSat: addr.balanceSat,
          enPrivateKey: addr.enPrivateKey,
          collectAmount: sendValue.toString(),
          collectAmountSat: sendValueSat.toString()
        })));
      }
    } else {
      onAmountChange([]);
    }
  }, [addressList, selectedToken, sendAmount, onAmountChange]);

  const handleSendAmountChange = useCallback((value) => {
    setSendAmount(value);
    if (value && customAmount) {
      const sendValue = Number(value);
      const eligibleAddresses = addressList.filter(addr => {
        const balance = Number(addr.balance || 0);
        return selectedToken?.symbol === 'SOL' ? 
          balance >= sendValue + MIN_SOL_BALANCE :
          balance >= sendValue;
      });

      onAmountChange(eligibleAddresses.map(addr => ({
        address: addr.address,
        amount: sendValue.toString()
      })));
    }
  }, [addressList, selectedToken, customAmount, onAmountChange]);

  const handleKeepValueChange = useCallback((value) => {
    setKeepValue(value);
    if (value && keepAmount) {
      const keep = Number(value);
      const eligibleAddresses = addressList.filter(addr => {
        const balance = Number(addr.balance || 0);
        const minKeep = selectedToken?.symbol === 'SOL' ? 
          Math.max(keep, MIN_SOL_BALANCE) : 
          keep;
        return balance > minKeep;
      });

      onAmountChange(eligibleAddresses.map(addr => {
        const balance = Number(addr.balance);
        const minKeep = selectedToken?.symbol === 'SOL' ? 
          Math.max(keep, MIN_SOL_BALANCE) : 
          keep;
        return {
          address: addr.address,
          amount: (balance - minKeep).toString()
        };
      }));
    } else {
      if (!value) {
        onAmountChange([]);
      }
    }
  }, [addressList, selectedToken, keepAmount, onAmountChange]);

  const handleKeepAmountChange = useCallback((checked) => {
    setKeepAmount(checked);
    if (checked) {
      setSendAll(false);
      setCustomAmount(false);
      setSendAmount('');
      
      if (keepValue) {
        const keep = Number(keepValue);
        const keepSat = keep * Math.pow(10, selectedToken?.decimals || 9);
        
        const eligibleAddresses = addressList.filter(addr => {
          const balance = Number(addr.balance || 0);
          if (selectedToken?.symbol === 'SOL') {
            const minKeep = Math.max(keep, MIN_SOL_BALANCE);
            return balance > minKeep;
          }
          return balance > keep;
        });

        onAmountChange(eligibleAddresses.map(addr => {
          const collectAmount = Number(addr.balance) - (
            selectedToken?.symbol === 'SOL' ? 
              Math.max(keep, MIN_SOL_BALANCE) : 
              keep
          );
          const collectAmountSat = Number(addr.balanceSat) - (
            selectedToken?.symbol === 'SOL' ? 
              Math.max(keepSat, MIN_SOL_BALANCE * 1e9) : 
              keepSat
          );
          
          return {
            address: addr.address,
            balance: addr.balance,
            balanceSat: addr.balanceSat,
            enPrivateKey: addr.enPrivateKey,
            collectAmount: collectAmount.toString(),
            collectAmountSat: collectAmountSat.toString()
          };
        }));
      }
    } else {
      setKeepValue('');
      onAmountChange([]);
    }
  }, [addressList, selectedToken, keepValue, onAmountChange]);

  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex items-center space-x-1">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={sendAll}
                onChange={(e) => handleSendAllChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 cursor-pointer"
              />
              <span className="ml-2 text-sm text-gray-600">发送全部</span>
            </label>
          </div>

          <div className="flex items-center space-x-1">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 cursor-pointer"
              />
              <span className="ml-2 text-sm text-gray-600">发送金额</span>
            </label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={sendAmount}
                onChange={(e) => handleSendAmountChange(e.target.value)}
                placeholder="发送数量"
                disabled={!customAmount}
                className="w-24 px-2 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              />
              <span className="text-sm text-gray-500 w-16 truncate">{selectedToken ? selectedToken.symbol : ''}</span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={keepAmount}
                onChange={(e) => handleKeepAmountChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 cursor-pointer"
              />
              <span className="ml-2 text-sm text-gray-600">保留固定余额</span>
            </label>
            <div className="flex items-center space-x-1">
              <input
                type="number"
                value={keepValue}
                onChange={(e) => handleKeepValueChange(e.target.value)}
                placeholder="保留数量"
                disabled={!keepAmount}
                className="w-24 px-2 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              />
              <span className="text-sm text-gray-500 w-16 truncate">{selectedToken ? selectedToken.symbol : ''}</span>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          符合条件地址数：
          {!sendAll && !keepAmount && !customAmount ? (
            <span>-</span>
          ) : (
            <span className={eligibleCount > 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
              {`${eligibleCount}条`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
