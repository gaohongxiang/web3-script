'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useUTXO } from '@/hooks/chains/utxo/useUTXO';
import { LoadingButton } from '@/components/LoadingButton';

export const UTXOList = memo(function UTXOList({ disabled }) {

  // 从 Context 获取共享状态
  const { 
    network,
    address,
    selectedUtxos,
    setSelectedUtxos,
    encryptedKey
  } = useUtxoContext();

  // 组件内部状态
  const { getUtxos } = useUTXO();
  const [utxoData, setUtxoData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [filterAmount, setFilterAmount] = useState(10000);

  // 获取 UTXO 列表
  const fetchUtxos = useCallback(async () => {
    if (!address || disabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getUtxos(address);
      if (!result.success) {
        setError(result.message);
        setRetryable(result.retryable);
        if (result.retryable && retryCount < 3) {
          setRetryCountdown(5);
          setRetryCount(prev => prev + 1);
        }
        return;
      }

      setUtxoData(result.data);
      setError(null);
      setRetryable(false);
      setRetryCountdown(0);
      setRetryCount(0);
    } finally {
      if (!retryable) {
        setLoading(false);
      }
    }
  }, [address, disabled, getUtxos, retryCount, retryable]);

  // 监听地址和网络变化
  useEffect(() => {
    const shouldFetch = address && address !== '-' && !disabled;
    
    if (shouldFetch) {
      fetchUtxos();
    }
  }, [address, network, disabled]);

  // 处理自动重试
  useEffect(() => {
    if (!retryCountdown) return;

    const timer = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          fetchUtxos();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [retryCountdown, fetchUtxos]);

  // 监听过滤金额变化
  useEffect(() => {
    // 当过滤金额变化时，取消选择那些不满足条件的 UTXO
    setSelectedUtxos(prev => 
      prev.filter(utxo => utxo.value >= filterAmount)
    );
  }, [filterAmount, setSelectedUtxos]);

  // 监听助记词变化
  useEffect(() => {
    setSelectedUtxos([]);  // 清空选择的 UTXO
  }, [encryptedKey, setSelectedUtxos]);

  // 处理 UTXO 选择
  const handleUtxoSelect = useCallback((utxo) => {
    const isSelectable = utxo.value >= filterAmount;
    if (!isSelectable || disabled) return;

    setSelectedUtxos(prev => {
      const isSelected = prev.some(
        selected => selected.txid === utxo.txid && selected.vout === utxo.vout
      );

      if (isSelected) {
        // 如果已选中，则移除
        return prev.filter(
          selected => !(selected.txid === utxo.txid && selected.vout === utxo.vout)
        );
      } else {
        // 如果未选中，则添加
        return [...prev, utxo];
      }
    });
  }, [disabled, setSelectedUtxos, filterAmount]);

  return (
    <div>
      {/* 标题和过滤设置 */}
      <div className="min-h-[32px] flex items-center justify-between mb-1">
        <div className="flex items-center space-x-3">
          <label className="block text-sm font-medium text-gray-700">
            UTXO列表
          </label>
          {address && address !== '-' && (
            <div className="flex items-center space-x-1">
              <LoadingButton
                title="刷新UTXO列表"
                onClick={fetchUtxos}
                loading={loading}
                wait={3000}
                className="inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          )}
          {error && (
            <span className="text-xs text-red-500">
              {error}
            </span>
          )}
        </div>

        {/* 过滤聪设置 */}
        <div className="flex items-center space-x-3">
          <input
            min="0"
            type="number"
            value={filterAmount}
            onChange={(e) => setFilterAmount(Number(e.target.value))}
            className="
              w-20 px-2 py-1 text-xs
              border border-gray-300 rounded
              focus:outline-none focus:ring-1
              focus:ring-blue-500
            "
          />
          <span className="text-xs text-gray-500">
            以下不使用，保护铭文符文等资产
          </span>
        </div>
      </div>

      {/* UTXO 列表 */}
      <div className="border border-gray-200 rounded-lg max-h-[240px] overflow-y-auto">
        {!utxoData?.allUtxos?.length ? (
          <div className="p-4 text-center text-gray-500">
            {loading ? '获取中...' : '-'}
          </div>
        ) : (
          utxoData.allUtxos.map((utxo) => {
            // 只有已确认且金额大于过滤值的 UTXO 才可选
            const isSelectable = utxo.status.block_height !== 0 && utxo.value >= filterAmount;
            const isSelected = selectedUtxos.some(
              selected => selected.txid === utxo.txid && selected.vout === utxo.vout
            );

            return (
              <div
                key={`${utxo.txid}:${utxo.vout}`}
                onClick={() => isSelectable && !disabled && handleUtxoSelect(utxo)}
                className={`
                  flex items-center justify-between p-2 border-b border-gray-100 last:border-0
                  ${isSelectable && !disabled ? 'cursor-pointer hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}
                  ${isSelected ? 'bg-blue-50' : ''}
                `}
              >
                <div className="flex-1 mr-8">
                  <div className="flex items-center space-x-2">
                    <span className="text-[13px] text-gray-600 break-all">
                      {utxo.value / 100000000} {network === 'btc' ? 'BTC' : 'FB'} ({utxo.value} 聪)
                    </span>
                    <span className={`text-[12px] ${utxo.status.block_height !== 0 ? 'text-gray-400' : 'text-red-500'}`}>
                      {utxo.status.block_height !== 0 ? '已确认' : '未确认'}
                    </span>
                  </div>
                  <div className="text-[12px] text-gray-400">
                    {utxo.txid}:{utxo.vout}
                  </div>
                </div>
                <div className="flex items-center mr-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!isSelectable || disabled}
                    onChange={() => {}}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 统计信息 */}
      <div className="mt-3 flex items-center space-x-6 text-xs text-gray-400">
        <div className="flex items-center">
          <span>总计：</span>
          <span className="ml-1">{utxoData?.total ?? '-'} 条UTXO</span>
        </div>
        <div className="flex items-center">
          <span>过滤后：</span>
          <span className="ml-1">
            {utxoData?.allUtxos?.filter(utxo => utxo.value >= filterAmount)?.length ?? '-'} 条UTXO
          </span>
        </div>
        <div className="flex items-center">
          <span>已确认：</span>
          <span className="ml-1">
            {utxoData?.allUtxos?.filter(utxo => utxo.status.block_height !== 0)?.length ?? '-'} 条UTXO
          </span>
        </div>
        <div className="flex items-center text-gray-900">
          <span>已选择：</span>
          <span className="ml-1">
            {selectedUtxos.length > 0 
              ? `${selectedUtxos.length} 个UTXO，共 ${selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0).toLocaleString()} 聪`
              : '-'
            }
          </span>
        </div>
      </div>
    </div>
  );
}); 