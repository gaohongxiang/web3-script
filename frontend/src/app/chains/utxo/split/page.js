'use client';

import { useState, useMemo, useCallback } from 'react';
import { UTXONetworkAndGas } from '@/components/chains/utxo/UTXONetworkAndGas';
import { Address } from '@/components/chains/utxo/Address';
import { UTXOList } from '@/components/chains/utxo/UTXOList';
import { SplitUTXO } from '@/components/chains/utxo/SplitUTXO';
import { FeeRateBox } from '@/components/chains/utxo/FeeRateBox';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ResultDialog } from '@/components/ResultDialog';

export default function Split() {
  const {
    network,
    scriptType,
    encryptedKey,
    address,
    selectedUtxos,
    currentFeeRate,
    gasLevel,
    customGas,
    splitFee,
    splitParts,
    setSplitParts,
    setSelectedUtxos
  } = useUtxoContext();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultData, setResultData] = useState({
    success: false,
    txid: '',
    error: ''
  });

  // 判断是否可以拆分
  const canSplit = useMemo(() => !!(
    address &&
    address !== '-' &&  // 有发送地址
    selectedUtxos.length > 0 &&  // 选择了 UTXO
    currentFeeRate &&  // 有费率
    splitParts >= 1 &&  // 拆分份数大于等于1
    splitFee?.success  // 费用计算成功且金额足够
  ), [address, selectedUtxos.length, currentFeeRate, splitParts, splitFee]);

  // 处理拆分提交
  const handleSplit = useCallback(async () => {
    if (!canSplit || confirmLoading) return;
    setConfirmLoading(true);
    try {
      const response = await fetch('/api/chains/utxo/split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enBtcMnemonicOrWif: encryptedKey,
          chain: network,
          selectedUtxos,
          splitNum: splitParts,
          gas: currentFeeRate,
          scriptType,
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '拆分失败，请重试');
      }

      setResultData({
        success: true,
        txid: result.txid,
        error: ''
      });

      // 重置拆分相关的状态
      setSplitParts(2);  // 重置拆分份数为初始值
      setSelectedUtxos([]); // 清空选中的 UTXO

    } catch (error) {
      console.error('Split error:', error);
      setResultData({
        success: false,
        txid: '',
        error: error.message || '拆分失败，请重试'
      });
    } finally {
      setConfirmLoading(false);
      setIsConfirmOpen(false);
      setIsResultOpen(true);
    }
  }, [network, scriptType, encryptedKey, selectedUtxos, currentFeeRate, splitParts]);

  return (
    <div className="space-y-4">
      <UTXONetworkAndGas />
      <Address label="拆分地址" />
      <UTXOList
        key={`${network}-${address}`}
        disabled={!address}
      />

      <SplitUTXO
        selectedAmount={selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0)}
        onSettingsChange={({ parts }) => setSplitParts(parts)}
      />

      <FeeRateBox
        title="费用信息"
        gasInputLabel="当前费率"
        type="split"
      />

      <button
        type="button"
        disabled={!canSplit || confirmLoading}
        onClick={() => setIsConfirmOpen(true)}
        className={`
          w-full px-4 py-2 text-sm font-medium rounded-lg
          ${canSplit && !confirmLoading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {confirmLoading ? '处理中...' : '拆分'}
      </button>

      <ConfirmDialog
        title="确认拆分"
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSplit}
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
              <span className="text-gray-600">Gas 费用：</span>
              <span className="font-medium ml-2">
                {currentFeeRate} sat/vB ({customGas ? '自定义' : gasLevel})
              </span>
            </div>
            <div>
              <span className="text-gray-600">预估费用：</span>
              <span className="font-medium ml-2">
                {splitFee?.fee?.toLocaleString()} 聪
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">发送地址：</span>
              <span className="font-medium ml-2 break-all">{address}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">选择的UTXO：</span>
              <span className="font-medium ml-2">
                {selectedUtxos.length} 个，共 {selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0).toLocaleString()} 聪
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">拆分详情：</span>
              <span className="font-medium ml-2">
                拆分为 {splitParts} 份，每份 {splitFee?.amountPerPart?.toLocaleString() ?? '-'} 聪
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>

      <ResultDialog
        isOpen={isResultOpen}
        onClose={() => setIsResultOpen(false)}
        success={resultData.success}
        txid={resultData.txid}
        network={network}
        error={resultData.error}
      />
    </div>
  );
}
