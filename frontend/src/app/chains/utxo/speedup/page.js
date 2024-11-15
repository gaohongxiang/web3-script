'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useTransaction } from '@/hooks/chains/utxo/useTransaction';
import { UTXONetworkAndGas } from '@/components/chains/utxo/UTXONetworkAndGas';
import { Transaction } from '@/components/chains/utxo/Transaction';
import { Address } from '@/components/chains/utxo/Address';
import { UTXOList } from '@/components/chains/utxo/UTXOList';
import { FeeRateBox } from '@/components/chains/utxo/FeeRateBox';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ResultDialog } from '@/components/ResultDialog';

export default function SpeedUp() {
  const {
    network,
    scriptType,
    encryptedKey,
    address,
    selectedUtxos,
    currentFeeRate,
    gasLevel,
    customGas,
    speedUpFee,
    txInfo,
    getUtxos,
    getBalance,
    setSelectedUtxos,
    txid,
    setTxInfo
  } = useUtxoContext();

  const { getTransaction, validateAddressInTx } = useTransaction();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultData, setResultData] = useState({
    success: false,
    newTxid: '',
    error: ''
  });
  const [addressError, setAddressError] = useState('');

  // 获取地址验证结果
  useEffect(() => {
    if (txInfo?.success && address && address !== '-') {
      const validation = validateAddressInTx(txInfo, address);
      setAddressError(validation.success ? '' : validation.error);
    } else {
      setAddressError('');
    }
  }, [txInfo, address, validateAddressInTx]);

  // 判断是否可以加速
  const canSpeedUp = !!(
    selectedUtxos.length > 0 &&
    speedUpFee?.success &&
    txInfo?.success &&
    !txInfo?.data?.confirmed &&
    validateAddressInTx(txInfo, address).success
  );

  // 处理加速提交
  const handleSpeedUp = useCallback(async () => {
    if (!canSpeedUp || confirmLoading) return;
    setConfirmLoading(true);
    try {
      const params = {
        enBtcMnemonicOrWif: encryptedKey,
        chain: network,
        selectedUtxos,
        gas: currentFeeRate,
        scriptType,
        txid
      };

      const response = await fetch('/api/chains/utxo/speedUp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '加速失败，请重试');
      }

      setResultData({
        success: true,
        newTxid: result.newTxid,
        error: ''
      });

      // 重置状态
      setSelectedUtxos([]);

    } catch (error) {
      console.error('SpeedUp error:', error);
      setResultData({
        success: false,
        newTxid: '',
        error: error.message || '加速失败，请重试'
      });
    } finally {
      setConfirmLoading(false);
      setIsConfirmOpen(false);
      setIsResultOpen(true);
    }
  }, [network, scriptType, encryptedKey, selectedUtxos, currentFeeRate, txid]);

  return (
    <div className="space-y-4">
      <UTXONetworkAndGas />
      <Transaction />
      <Address 
        label="加速地址" 
        validationError={addressError} 
        disabled={!txInfo?.success}
      />
      <UTXOList key={`${network}-${address}`} />
      <FeeRateBox
        title="费用信息"
        gasInputLabel="加速后费率"
        type="speedUp"
      />

      <button
        type="button"
        disabled={!canSpeedUp || confirmLoading}
        onClick={() => setIsConfirmOpen(true)}
        className={`
          w-full px-4 py-2 text-sm font-medium rounded-lg
          ${canSpeedUp && !confirmLoading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {confirmLoading ? '处理中...' : '确认加速'}
      </button>

      <ConfirmDialog
        title="确认加速"
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSpeedUp}
        loading={confirmLoading}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-gray-600">网络：</span>
              <span className="font-medium ml-2">{network === 'btc' ? 'Bitcoin' : 'Fractal'}</span>
            </div>
            <div>
              <span className="text-gray-600">脚本类型：</span>
              <span className="font-medium ml-2">{scriptType}</span>
            </div>
            <div>
              <span className="text-gray-600">加速前费率：</span>
              <span className="font-medium ml-2">
              {txInfo?.data?.feeRate || '-'} sat/vB
              </span>
            </div>
            <div>
              <span className="text-gray-600">加速后费率：</span>
              <span className="font-medium ml-2">
                {currentFeeRate} sat/vB ({customGas ? '自定义' : gasLevel})
              </span>
            </div>
            <div>
              <span className="text-gray-600">预估费用：</span>
              <span className="font-medium ml-2">
                {speedUpFee?.fee?.toLocaleString()} 聪
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">加速交易：</span>
              <span className="font-medium ml-2 break-all">{txid}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">加速地址：</span>
              <span className="font-medium ml-2 break-all">{address}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">选择的UTXO：</span>
              <span className="font-medium ml-2">
                {selectedUtxos.length} 个，共 {selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0).toLocaleString()} 聪
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>

      <ResultDialog
        isOpen={isResultOpen}
        onClose={() => setIsResultOpen(false)}
        success={resultData.success}
        txid={txid}
        newTxid={resultData.newTxid}
        network={network}
        error={resultData.error}
        type="speedUp"
      />
    </div>
  );
}
