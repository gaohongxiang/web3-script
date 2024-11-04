'use client';

import { useState, useEffect } from 'react';
import { UTXONetworkAndGas } from '@/components/chains/utxo/UTXONetworkAndGas';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useGas } from '@/hooks/chains/utxo/useGas';
import { useTransaction } from '@/hooks/chains/utxo/useTransaction';
import { useLoadingState } from '@/hooks/useLoadingState';
import { Message } from '@/components/Message';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FromAddress } from '@/components/chains/utxo/FromAddress';
import { UTXOList } from '@/components/chains/utxo/UTXOList';

export default function SpeedUp() {
  // ============ Context Hooks ============
  const { network, gasLevel, customGas, setCustomGas, setGasLevel } = useUtxoContext();
  const { gasInfo } = useGas();
  const { getTransactionInfo, validateAddressInTx, calculateAccelerateFee } = useTransaction();

  // ============ Loading States ============
  const {
    data: txInfo,
    loading: txLoading,
    error: txError,
    execute: executeTxInfo,
    retry: retryTxInfo
  } = useLoadingState(null, { errorMessage: '获取交易失败' });

  // ============ State ============
  const [txid, setTxid] = useState('');
  const [formData, setFormData] = useState({});
  const [selectedUtxos, setSelectedUtxos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [accelerateFee, setAccelerateFee] = useState(null);

  // 处理交易ID输入
  const handleTxidChange = async (e) => {
    const newTxid = e.target.value.trim();
    setTxid(newTxid);
    setValidationError(null);

    if (!newTxid) {
      return;
    }

    const result = await executeTxInfo(getTransactionInfo, newTxid);
    if (!result?.success) {
      setValidationError(result?.error || '获取交易失败');
    } else if (result.confirmed) {
      setValidationError('交易已确认，无需加速');
    } else {
      setValidationError(null);
    }
  };

  // 处理表单数据变化
  const handleFormDataChange = (data) => {
    setFormData(data);
  };

  // 处理提交
  const handleSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  // 处理确认
  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const requestData = {
        txid,
        enMnemonicOrWif: formData.enMnemonicOrWif,
        network,
        gas: customGas ? parseInt(customGas) : parseInt(gasInfo[gasLevel].fee),
        scriptType: formData.scriptType,
        selectedUtxos
      };

      const response = await fetch('/api/chains/utxo/speedUp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || '加速失败');
      }

      const explorerUrl = network === 'btc' 
        ? 'https://mempool.space/tx/' 
        : 'https://mempool.fractalbitcoin.io/tx/';

      setSuccess(
        <div>
          加速成功！交易ID: 
          <a 
            href={`${explorerUrl}${data.txid}`}
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline ml-1"
          >
            {data.txid}
          </a>
        </div>
      );

      // 清空表单
      setTxid('');
      setFormData({});
      setSelectedUtxos([]);
    } catch (error) {
      console.error('SpeedUp error:', error);
      setError(error.message || '加速失败，请重试');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  // 当网络变化时重新验证交易ID
  useEffect(() => {
    if (txid) {
      handleTxidChange({ target: { value: txid } });
    }
  }, [network]);

  // 当选择新的 gas 费率或 UTXO 时计算加速费用
  useEffect(() => {
    if (txInfo?.feeRate && (customGas || gasInfo?.[gasLevel]?.fee)) {
      const newFeeRate = parseInt(customGas || gasInfo[gasLevel].fee);
      const result = calculateAccelerateFee(txInfo, newFeeRate, formData.scriptType, selectedUtxos);
      setAccelerateFee(result.success ? result.neededSats : null);
    } else {
      setAccelerateFee(null);
    }
  }, [txInfo, gasLevel, customGas, gasInfo, formData.scriptType, selectedUtxos, calculateAccelerateFee]);

  return (
    <>
      <UTXONetworkAndGas />
      
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          交易ID
        </label>
        <div className="relative">
          <input
            type="text"
            value={txid}
            onChange={handleTxidChange}
            placeholder="输入要加速的交易ID"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {txLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-sm text-gray-500">解析中...</span>
            </div>
          )}
        </div>
        {txError && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm text-red-500">{txError}</span>
            <button
              onClick={() => retryTxInfo(getTransactionInfo, txid)}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              重新获取
            </button>
          </div>
        )}
        {validationError && validationError.includes('交易') && (
          <div className="mt-1">
            <Message type="error">{validationError}</Message>
          </div>
        )}
      </div>

      <div className="mt-4">
        <FromAddress 
          onChange={(address) => {
            // 处理地址变化
          }}
          onFormDataChange={handleFormDataChange}
          label="加速地址"
        />
      </div>

      {/* UTXO 列表 */}
      {formData.address && (
        <div className="mt-4">
          <UTXOList
            address={formData.address}
            selectedUtxos={selectedUtxos}
            onUtxoSelect={setSelectedUtxos}
            accelerateFee={accelerateFee}
          />

          {/* 费率信息 */}
          {txInfo && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="text-sm">
                <span className="text-gray-500">待加速交易的费率：</span>
                <span className="font-medium">{txInfo.feeRate} sat/vB</span>
              </div>
              <div className="text-sm flex items-center">
                <span className="text-gray-500">加速后费率：</span>
                <input
                  type="number"
                  value={customGas || gasInfo?.[gasLevel]?.fee || ''}
                  onChange={(e) => {
                    setCustomGas(e.target.value);
                    setGasLevel('custom');
                  }}
                  className="w-20 px-2 py-1 ml-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="ml-1">sat/vB</span>
                <span className="text-gray-500 ml-2">
                  (提升 {Math.round((parseInt(customGas || gasInfo?.[gasLevel]?.fee || 0) / txInfo.feeRate - 1) * 100)}%)
                </span>
                {(!customGas && !gasInfo?.[gasLevel]?.fee) || parseInt(customGas || gasInfo?.[gasLevel]?.fee || 0) <= txInfo.feeRate && (
                  <span className="text-red-500 ml-2">
                    加速费率必须大于当前费率
                  </span>
                )}
              </div>
              <div className="text-sm">
                <span className="text-gray-500">需要费用：</span>
                {(!customGas && !gasInfo?.[gasLevel]?.fee) || parseInt(customGas || gasInfo?.[gasLevel]?.fee || 0) <= txInfo.feeRate ? (
                  <span className="font-medium">～</span>
                ) : (
                  <span className="font-medium">{accelerateFee?.toLocaleString() || '～'} 聪</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Message type="error">{error}</Message>
        </div>
      )}

      {success && (
        <div className="mt-4">
          <Message type="success">{success}</Message>
        </div>
      )}

      {/* 加速按钮 */}
      <button
        type="submit"
        onClick={handleSubmit}
        disabled={!txid || !formData.address || !selectedUtxos.length || !accelerateFee || selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0) < accelerateFee || loading}
        className={`mt-4 w-full px-4 py-3 rounded-lg text-white font-medium transition-colors ${
          !txid || !formData.address || !selectedUtxos.length || !accelerateFee || selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0) < accelerateFee || loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? '处理中...' : '加速'}
      </button>

      {/* 确认对话框 */}
      <ConfirmDialog
        title="确认加速交易"
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        loading={loading}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-gray-600">网络：</span>
              <span className="font-medium ml-2">{network === 'btc' ? 'Bitcoin' : 'Fractal'}</span>
            </div>
            <div>
              <span className="text-gray-600">脚本类型：</span>
              <span className="font-medium ml-2">{formData.scriptType}</span>
            </div>
            <div>
              <span className="text-gray-600">Gas 费用：</span>
              <span className="font-medium ml-2">
                {customGas || gasInfo?.[gasLevel]?.fee || '0'} sat/vB 
                ({customGas ? '自定义' : gasLevel})
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">选中的 UTXO：</span>
              <div className="mt-2 space-y-2">
                {selectedUtxos.map((utxo, index) => (
                  <div key={`${utxo.txid}:${utxo.vout}`} className="text-sm">
                    <span className="font-medium">{(utxo.value / 100000000).toFixed(8)} {network === 'btc' ? 'BTC' : 'FB'}</span>
                    <span className="text-gray-400 ml-2">({utxo.value.toLocaleString()} 聪)</span>
                  </div>
                ))}
                <div className="text-sm text-gray-500">
                  总计: {selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0).toLocaleString()} 聪
                </div>
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">加速地址：</span>
              <span className="font-medium ml-2 break-all">{formData.address}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">加速交易：</span>
              <span className="font-medium ml-2 break-all">{txid}</span>
            </div>
            {txInfo?.feeRate && (
              <div className="col-span-2">
                <span className="text-gray-600">费率对比：</span>
                <div className="mt-2 space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-500">当前费率：</span>
                    <span className="font-medium">{txInfo.feeRate} sat/vB</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">加速费率：</span>
                    <span className="font-medium">{customGas || gasInfo?.[gasLevel]?.fee} sat/vB</span>
                    <span className="text-gray-500 ml-2">
                      (提升 {Math.round((parseInt(customGas || gasInfo?.[gasLevel]?.fee) / txInfo.feeRate - 1) * 100)}%)
                    </span>
                  </div>
                  {accelerateFee && (
                    <div className="text-sm">
                      <span className="text-gray-500">需要费用：</span>
                      <span className="font-medium">{accelerateFee.toLocaleString()} 聪</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
