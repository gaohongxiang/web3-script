'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useTransaction } from '@/hooks/chains/utxo/useTransaction';
import { useDebounceFn } from 'ahooks';
import { LoadingButton } from '@/components/LoadingButton';

export function Transaction() {
  const { 
    network,
    address,
    txInfo,
    setTxInfo,
    validationError,
    setValidationError
  } = useUtxoContext();

  const { validateAddressInTx, getTransaction } = useTransaction();
  const [txid, setTxid] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);

  // 验证地址
  const validateAddress = useCallback(() => {
    if (!address || !txInfo?.success) return;
    
    const result = validateAddressInTx(txInfo.data, address);
    setValidationError(result.success ? null : '该地址不在交易输入中');
  }, [address, txInfo, validateAddressInTx, setValidationError]);

  // 获取交易信息
  const fetchTransaction = useCallback(async (value) => {
    if (!value) return;
    
    // 先验证格式
    const formatResult = validateFormat(value);
    if (!formatResult.success) {
      handleError(formatResult);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await getTransaction(value);
      if (!result.success) {
        handleError(result);
        return;
      }

      resetStates();
      setTxInfo(result);
    } catch (error) {
      handleError(TX_ERRORS.NETWORK_ERROR);
    }
  }, [validateFormat, getTransaction, setTxInfo]);

  // 重置状态
  const resetStates = useCallback(() => {
    setError(null);
    setTxInfo(null);
    setLoading(false);
    setRetryable(false);
    setRetryCountdown(0);
  }, [setTxInfo]);

  // 处理错误
  const handleError = useCallback((result) => {
    setError(result.message);
    setTxInfo(null);
    setRetryable(result.retryable);
    if (result.retryable) {
      setRetryCountdown(5);
    }
    if (!result.retryable) {
      setLoading(false);
    }
  }, [setTxInfo]);

  // 使用防抖处理输入
  const { run: debouncedFetch } = useDebounceFn(
    (value) => {
      if (!value) return;
      fetchTransaction(value);
    },
    { wait: 300 }
  );

  // 处理输入变化
  const handleInputChange = useCallback((e) => {
    const value = e.target.value.trim();
    setTxid(value);
    
    if (!value) {
      resetStates();
      return;
    }

    // 先验证格式
    const formatResult = validateFormat(value);
    if (!formatResult.success) {
      handleError(formatResult);
      return;
    }

    debouncedFetch(value);
  }, [validateFormat, debouncedFetch, resetStates, handleError]);

  // 监听网络变化
  useEffect(() => {
    if (network && txid) {
      fetchTransaction(txid);
    }
  }, [network]); // 只依赖 network

  // 处理自动重试倒计时
  useEffect(() => {
    if (!retryCountdown) return;

    const timer = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev <= 1) {
          fetchTransaction(txid);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [retryCountdown]); // 只依赖 retryCountdown

  // 监听地址和交易信息变化
  useEffect(() => {
    if (address && txInfo) {
      validateAddress();
    }
  }, [address, txInfo, validateAddress]);

  return (
    <div>
      <div className="min-h-[32px] flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          交易ID
        </label>
        <div className="ml-2">
          {(loading || retryable) ? (
            <div className="flex items-center">
              <LoadingButton
                loading={loading}
                onClick={() => retryable && fetchTransaction(txid)}
                title="获取交易"
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

      <input
        type="text"
        value={txid}
        onChange={handleInputChange}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="输入交易ID"
      />

      {txInfo?.success && (
        <div className="mt-2 space-y-1 text-sm">
          <div>
            <span className="text-gray-500">交易大小：</span>
            <span className="font-medium">{txInfo.data.size} vB</span>
          </div>
          <div>
            <span className="text-gray-500">手续费率：</span>
            <span className="font-medium">{txInfo.data.feeRate} sat/vB</span>
          </div>
        </div>
      )}
    </div>
  );
} 