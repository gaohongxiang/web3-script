'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useTransaction } from '@/hooks/chains/utxo/useTransaction';
import { UTXONetworkAndGas } from '@/components/chains/utxo/UTXONetworkAndGas';
import { Transaction } from '@/components/chains/utxo/Transaction';
import { Address } from '@/components/chains/utxo/Address';
import { UTXOList } from '@/components/chains/utxo/UTXOList';
import { FeeRateBox } from '@/components/chains/utxo/FeeRateBox';

export default function SpeedUp() {
  const { 
    network,
    address,
    txInfo,
    gasInfo,
    gasLevel,
    customGas,
    currentFeeRate,
    validationError,
    setValidationError
  } = useUtxoContext();

  const { validateAddressInTx } = useTransaction();
  const [customFeeRate, setCustomFeeRate] = useState(null);

  // 1. 验证交易是否可加速
  const canSpeedUp = txInfo?.success && txInfo?.data?.confirmations === 0;  // 未确认的交易才可加速

  // 2. 验证地址是否在交易中
  const validateAddress = useCallback(() => {
    if (!address || !txInfo?.success) return;
    
    const result = validateAddressInTx(txInfo.data, address);
    setValidationError(result.success ? null : '该地址不在交易输入中');
  }, [address, txInfo, validateAddressInTx, setValidationError]);

  // 监听地址和交易信息变化
  useEffect(() => {
    if (address && txInfo) {
      validateAddress();
    }
  }, [address, txInfo, validateAddress]);

  // 判断是否可以进行下一步
  const canProceed = canSpeedUp && !validationError;

  return (
    <div className="space-y-4">
      <UTXONetworkAndGas />
      
      <Transaction />

      <Address 
        label="加速地址"
        disabled={!canSpeedUp}
      />

      <UTXOList
        key={`${network}-${address}`}
        disabled={!canProceed}
      />

      <FeeRateBox
        title="费率对比"
        disabled={!canSpeedUp}
        items={[
          {
            label: '加速前费率',
            value: txInfo?.data?.feeRate ?? '-'
          },
          {
            label: '加速后费率',
            value: customGas ?? (gasLevel === 'fast' ? gasInfo?.fast?.fee : gasInfo?.medium?.fee),
            input: true,
            min: txInfo?.data?.feeRate ?? 0,
            onChange: (e) => {
              const value = e.target.value;
              setCustomGas(value ? Number(value) : null);
              setGasLevel(value ? 'custom' : 'fast');
            }
          },
          {
            label: '需要费用',
            value: '-',
            unit: 'sat'
          }
        ]}
      />

      <button
        type="button"
        disabled={!canProceed}
        className={`
          w-full px-4 py-2 text-sm font-medium rounded-lg
          ${canProceed
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        加速交易
      </button>
    </div>
  );
}
