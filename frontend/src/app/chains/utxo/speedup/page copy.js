'use client';

import { useState, useEffect } from 'react';
import { UTXONetworkAndGas } from '@/components/chains/utxo/UTXONetworkAndGas';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useGas } from '@/hooks/chains/utxo/useGas';
import { useTransaction } from '@/hooks/chains/utxo/useTransaction';
import { Message } from '@/components/Message';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Address } from '@/components/chains/utxo/Address';
import { UTXOList } from '@/components/chains/utxo/UTXOList';
import { Transaction } from '@/components/chains/utxo/Transaction';

export default function SpeedUp() {
  // ============ Context Hooks ============
  const { network, gasLevel, customGas, setCustomGas, setGasLevel } = useUtxoContext();
  const { gasInfo } = useGas();
  const { validateAddressInTx, calculateAccelerateFee } = useTransaction();

  // ============ State ============
  const [txid, setTxid] = useState('');
  const [txInfo, setTxInfo] = useState(null);
  const [formData, setFormData] = useState({});
  const [selectedUtxos, setSelectedUtxos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [accelerateFee, setAccelerateFee] = useState(null);
  const [showResult, setShowResult] = useState(false);

  // 处理表单数据变化
  const handleFormDataChange = async (data) => {
    setFormData(data);

    // 只在地址变化且有交易时验证
    if (txid && data.address && txInfo && data.address !== formData.address) {
      const result = validateAddressInTx(txInfo, data.address);
      if (!result.success) {
        setValidationError(result.error);
      } else {
        setValidationError(null);
      }
    }
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
      if (!response.ok || !data.success || !data.newTxid) {
        throw new Error(data.error || '加速失败');
      }

      const explorerUrl = network === 'btc' 
        ? 'https://mempool.space/tx/' 
        : 'https://mempool.fractalbitcoin.io/tx/';

      setSuccess(
        <div className="space-y-2">
          <div>
            <div className="text-sm text-gray-500">原交易:</div>
            <a 
              href={`${explorerUrl}${txid}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline break-all"
            >
              {txid}
            </a>
          </div>
          <div>
            <div className="text-sm text-gray-500">加速交易:</div>
            <a 
              href={`${explorerUrl}${data.newTxid}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline break-all"
            >
              {data.newTxid}
            </a>
          </div>
        </div>
      );

      setShowResult(true);
    } catch (error) {
      setError(error.message || '加速失败，请重试');
      setShowResult(true);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  // 处理结果弹窗关闭
  const handleResultClose = () => {
    setShowResult(false);
    // 清空表单
    setTxid('');
    setFormData({});
    setSelectedUtxos([]);
    setError(null);
    setSuccess(null);
  };

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
      
      <Transaction
        onChange={setTxid}
        onTxInfoChange={setTxInfo}
      />

      <div className="mt-4">
        <Address 
          onChange={address => {
            // 当地址变化时，同时调用 handleFormDataChange
            handleFormDataChange({
              ...formData,
              address
            });
          }}
          onFormDataChange={handleFormDataChange}
          label="加速地址"
        />
        {validationError && (
          <div className="mt-1">
            <Message type="error">{validationError}</Message>
          </div>
        )}
      </div>

      {/* UTXO 列表和费率信息 - 只在有地址时显示 */}
      {formData.address && txInfo?.success && (
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
                <span className="text-gray-500">加速前费率：</span>
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
                  <>
                    <span className="font-medium">{accelerateFee?.toLocaleString() || '～'} 聪</span>
                    {accelerateFee && selectedUtxos.length > 0 && (
                      <span className={`ml-2 ${selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0) >= accelerateFee ? 'text-green-500' : 'text-red-500'}`}>
                        {selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0) >= accelerateFee
                          ? `(已选择 ${selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0).toLocaleString()} 聪，足够支付此费用)`
                          : `(已选择 ${selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0).toLocaleString()} 聪，还差 ${(accelerateFee - selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0)).toLocaleString()} 聪)`
                        }
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
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
                    <span className="text-gray-500">加速前费率：</span>
                    <span className="font-medium">{txInfo.feeRate} sat/vB</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">加速后费率：</span>
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

      {/* 结果弹窗 */}
      <ConfirmDialog
        title={error ? '加速失败' : '加速成功'}
        isOpen={showResult}
        onClose={handleResultClose}
        onConfirm={handleResultClose}
        confirmText="确定"
        showCancel={false}
        loading={false}
      >
        <div className="p-6">
          {error ? (
            <div className="text-red-500">{error}</div>
          ) : (
            success
          )}
        </div>
      </ConfirmDialog>
    </>
  );
}
