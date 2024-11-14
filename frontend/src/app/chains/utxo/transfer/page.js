'use client';

import { UTXONetworkAndGas } from '@/components/chains/utxo/UTXONetworkAndGas';
import { Address } from '@/components/chains/utxo/Address';
import { UTXOList } from '@/components/chains/utxo/UTXOList';
import { ReceiverList } from '@/components/chains/utxo/ReceiverList';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FeeRateBox } from '@/components/chains/utxo/FeeRateBox';
import { ResultDialog } from '@/components/ResultDialog';

export default function Transfer() {
  const {
    network,
    scriptType,
    encryptedKey,
    address,
    selectedUtxos,
    currentFeeRate,
    gasLevel,
    customGas,
    filterAmount,
    receiverList,
    isReceiverValid,
    setReceiverList,
    setIsReceiverValid,
    transferFee,  // 从 Context 获取费用计算结果
    getUtxos,
    getBalance,
  } = useUtxoContext();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultData, setResultData] = useState({
    success: false,
    txid: '',
    error: ''
  });

  // 判断是否可以转账
  const canTransfer = useMemo(() => {
    return !!(
      address &&
      address !== '-' &&  // 有发送地址
      selectedUtxos.length > 0 &&  // 选择了 UTXO
      currentFeeRate &&  // 有费率
      receiverList &&  // 有接收地址
      isReceiverValid &&  // 接收地址格式正确
      transferFee?.success  // 费用计算成功且金额足够
    );
  }, [address, selectedUtxos.length, currentFeeRate, receiverList, isReceiverValid, transferFee]);

  // 处理转账确认
  const handleTransfer = useCallback(async () => {
    setConfirmLoading(true);
    setResultData({
      success: false,
      txid: '',
      error: ''
    });  // 清除之前的错误
    try {
      const response = await fetch('/api/chains/utxo/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enMnemonicOrWif: encryptedKey,  // 加密的助记词
          toData: receiverList,           // 转账地址和金额列表
          network,                        // 网络
          gas: currentFeeRate,            // 已经计算好的 gas 值
          scriptType,                     // 脚本类型
          selectedUtxos                    // utxo列表
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setResultData({
        success: true,
        txid: result.txid,
        error: ''
      });

      // 交易成功后刷新数据
      if (getUtxos && getBalance) {
        await Promise.all([
          getUtxos(address),  // 重新获取 UTXO 列表
          getBalance(address) // 重新获取余额
        ]);
      }
      
    } catch (error) {
      setResultData({
        success: false,
        txid: '',
        error: error.message || '转账失败，请重试'
      });
    } finally {
      setConfirmLoading(false);
      setIsConfirmOpen(false);
      setIsResultOpen(true);  // 显示结果对话框
    }
  }, [network, scriptType, encryptedKey, selectedUtxos, receiverList, currentFeeRate, address, getUtxos, getBalance]);

  return (
    <div className="space-y-4">
      {/* 网络和 Gas */}
      <UTXONetworkAndGas />

      {/* 发送地址 */}

      <Address
        label="发送地址"
      />

      {/* UTXO 列表 */}
      <UTXOList
        key={`${network}-${address}`}
        disabled={!address}
      />

      {/* 接收地址列表 */}
      <ReceiverList
        onChange={(value, isValid) => {
          setReceiverList(value);
          setIsReceiverValid(isValid);
        }}
      />

      <FeeRateBox
        title="费用信息"
        gasInputLabel="当前费率"
        type="transfer"
      />

      {/* 转账按钮 */}
      <button
        type="button"
        disabled={!canTransfer}
        onClick={() => setIsConfirmOpen(true)}
        className={`
          w-full px-4 py-2 text-sm font-medium rounded-lg
          ${canTransfer
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        转账
      </button>

      <ConfirmDialog
        title="确认转账"
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleTransfer}
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
              <span className="text-gray-600">资产保护：</span>
              <span className="font-medium ml-2">{filterAmount.toLocaleString()} 聪</span>
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
          </div>

          <div className="mt-6">
            <span className="text-gray-600 block mb-2">接收地址：</span>
            <div className="mt-2 space-y-1 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {Array.isArray(receiverList) && receiverList.map(([address, amount], index) => (
                <div key={index} className="text-sm flex justify-between items-center py-2 hover:bg-gray-50">
                  <span className="break-all mr-6 text-base">{address}</span>
                  <span className="whitespace-nowrap text-base font-medium">
                    {amount} {network === 'btc' ? 'BTC' : 'FB'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="text-gray-600">预估费用：</span>
            <span className="font-medium ml-2">
            {transferFee?.fee?.toLocaleString()} 聪
            </span>
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
