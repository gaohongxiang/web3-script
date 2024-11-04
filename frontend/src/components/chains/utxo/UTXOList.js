'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useUtxo } from '@/hooks/chains/utxo/useUtxo';
import { useLoadingState } from '@/hooks/useLoadingState';
import { Message } from '@/components/Message';
import { getCacheKey, getCache, setCache } from '@/utils/cache';

export function UTXOList({ 
  address,
  selectedUtxos = [],
  onUtxoSelect,
  accelerateFee = null
}) {
  const { network } = useUtxoContext();
  const { getUtxos, filterUtxos } = useUtxo();
  const [filterAmount, setFilterAmount] = useState('10000');

  // 使用 useLoadingState 管理 UTXO 加载状态
  const {
    data: utxoInfo,
    loading: utxoLoading,
    error: utxoError,
    execute: executeUtxoFetch,
    retry: retryUtxoFetch
  } = useLoadingState(null, { errorMessage: '获取UTXO失败' });

  // 计算选中的 UTXO 总金额
  const selectedUtxosTotal = useMemo(() => {
    return selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
  }, [selectedUtxos]);

  // 获取过滤后的 UTXO
  const filteredUtxos = useMemo(() => {
    if (!utxoInfo?.data?.allUtxos) return [];
    const filtered = filterUtxos(utxoInfo.data.allUtxos, parseInt(filterAmount) || 546);
    return filtered.sort((a, b) => {
      const aConfirmed = !!a.status?.block_height;
      const bConfirmed = !!b.status?.block_height;
      if (aConfirmed !== bConfirmed) return aConfirmed ? 1 : -1;
      return b.value - a.value;
    });
  }, [utxoInfo, filterAmount, filterUtxos]);

  // 当过滤金额变化时，检查并更新选中的 UTXO
  useEffect(() => {
    // 获取所有过滤后的 UTXO 的 ID
    const filteredIds = new Set(filteredUtxos.map(utxo => `${utxo.txid}:${utxo.vout}`));
    
    // 检查选中的 UTXO 是否还在过滤后的列表中
    const newSelectedUtxos = selectedUtxos.filter(utxo => 
      filteredIds.has(`${utxo.txid}:${utxo.vout}`)
    );

    // 如果有 UTXO 被过滤掉了，更新选中状态
    if (newSelectedUtxos.length !== selectedUtxos.length) {
      onUtxoSelect(newSelectedUtxos);
    }
  }, [filteredUtxos, selectedUtxos, onUtxoSelect]);

  // 获取 UTXO 列表
  const fetchUtxos = useCallback(async () => {
    if (!address) return;

    try {
      const cacheKey = getCacheKey('utxos', network, address);
      const cachedUtxos = getCache('utxos', cacheKey);
      if (cachedUtxos) {
        console.log('Using cached UTXOs:', cachedUtxos);
        await executeUtxoFetch(() => Promise.resolve(cachedUtxos));
        return;
      }

      console.log('Fetching UTXOs for:', address);
      const result = await executeUtxoFetch(getUtxos, address);
      console.log('UTXO fetch result:', result);

      if (result?.success) {
        setCache('utxos', cacheKey, result);
      }
    } catch (error) {
      console.error('Fetch UTXOs error:', error);
    }
  }, [address, network, executeUtxoFetch, getUtxos]);

  // 在地址变化或网络变化时获取 UTXO
  useEffect(() => {
    console.log('Address changed:', address);
    if (address) {
      fetchUtxos();
    }
  }, [address, network]);

  // 处理 UTXO 选择
  const handleUtxoSelect = (utxo) => {
    onUtxoSelect(prev => {
      const isSelected = prev.some(u => u.txid === utxo.txid && u.vout === utxo.vout);
      if (isSelected) {
        return prev.filter(u => !(u.txid === utxo.txid && u.vout === utxo.vout));
      } else {
        return [...prev, utxo];
      }
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          地址 UTXO 列表
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            value={filterAmount}
            onChange={(e) => setFilterAmount(e.target.value)}
            className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="过滤金额"
          />
          <span className="text-sm text-gray-500">聪以下的 UTXO 不使用（保护铭文、符文等资产）</span>
        </div>
      </div>

      {utxoLoading ? (
        <div className="text-sm text-gray-500 py-4 text-center">
          解析中...
        </div>
      ) : utxoError ? (
        <div className="p-4">
          <Message type="error">
            <div className="flex items-center justify-between">
              <span>{utxoError}</span>
              <button
                onClick={fetchUtxos}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                重新获取
              </button>
            </div>
          </Message>
        </div>
      ) : (
        <>
          <div className="border border-gray-200 rounded-lg max-h-[240px] overflow-y-auto">
            {/* UTXO 列表内容 */}
            {filteredUtxos.map((utxo, index) => (
              <UTXOItem
                key={`${utxo.txid}:${utxo.vout}`}
                utxo={utxo}
                network={network}
                isSelected={selectedUtxos.some(u => u.txid === utxo.txid && u.vout === utxo.vout)}
                onSelect={() => handleUtxoSelect(utxo)}
                isLast={index === filteredUtxos.length - 1}
              />
            ))}
            {filteredUtxos.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                没有符合条件的 UTXO
              </p>
            )}
          </div>

          {/* UTXO 统计信息 */}
          <div className="mt-2 text-sm text-gray-500 flex justify-between items-center">
            <div>
              总计: {filteredUtxos.length} 条 UTXO
            </div>
            <div>
              已确认: {filteredUtxos.filter(utxo => !!utxo.status?.block_height).length} 条
              {filteredUtxos.length > 0 && ` (${Math.round(filteredUtxos.filter(utxo => !!utxo.status?.block_height).length / filteredUtxos.length * 100)}%)`}
            </div>
          </div>

          {/* 选中金额信息 */}
          <div className="mt-2 text-sm">
            <span className="text-gray-500">已选择：</span>
            <span className="font-medium">{selectedUtxos.length > 0 ? selectedUtxosTotal.toLocaleString() : '0'} 聪</span>
            {accelerateFee && selectedUtxos.length > 0 && (
              <span className={`ml-2 ${selectedUtxosTotal >= accelerateFee ? 'text-green-500' : 'text-red-500'}`}>
                {selectedUtxosTotal >= accelerateFee
                  ? `(足够支付 ${accelerateFee.toLocaleString()} 聪加速费用)`
                  : `(不够支付 ${accelerateFee.toLocaleString()} 聪加速费用，还差 ${(accelerateFee - selectedUtxosTotal).toLocaleString()} 聪)`
                }
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// UTXO 列表项组件
function UTXOItem({ utxo, network, isSelected, onSelect, isLast }) {
  const isConfirmed = !!utxo.status?.block_height;
  const btcValue = utxo.value / 100000000;

  return (
    <div
      className={`flex items-center justify-between p-3 ${
        !isLast ? 'border-b border-gray-200' : ''
      } ${!isConfirmed ? 'opacity-50' : ''}`}
    >
      <div className="flex-1 mr-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">
            {btcValue.toFixed(8)} {network === 'btc' ? 'BTC' : 'FB'}
          </span>
          <span className="text-gray-400 ml-2">
            ({utxo.value.toLocaleString()} 聪)
          </span>
          <span className={`ml-2 ${isConfirmed ? 'text-gray-400' : 'text-red-500 font-medium'}`}>
            {isConfirmed ? '已确认' : '未确认'}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-1 break-all">
          {utxo.txid}:{utxo.vout}
        </div>
      </div>
      <div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          disabled={!isConfirmed}
          className={`w-4 h-4 border-gray-300 rounded focus:ring-blue-500 ${
            isConfirmed ? 'text-blue-600 cursor-pointer' : 'text-gray-300 cursor-not-allowed'
          }`}
        />
      </div>
    </div>
  );
} 