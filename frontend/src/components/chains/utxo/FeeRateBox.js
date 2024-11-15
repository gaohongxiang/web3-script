'use client';

import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { useMemo } from 'react';

export function FeeRateBox({
  title = '费率对比',
  gasInputLabel = '当前费率',
  type = 'transfer'  // 'transfer' | 'speedUp' | 'split'
}) {
  const { 
    selectedUtxos,
    currentFeeRate,
    transferFee,
    speedUpFee,
    splitFee,
    setCustomGas,
    setGasLevel,
    isReceiverValid,
    splitParts,
    txInfo  // 添加 txInfo
  } = useUtxoContext();

  // 根据类型获取对应的费用计算结果
  const estimatedFee = useMemo(() => {
    if (!selectedUtxos.length) return null;

    if (type === 'transfer' && isReceiverValid) return transferFee;
    if (type === 'speedUp' && txInfo?.success) return speedUpFee;
    if (type === 'split') return splitFee;
    return null;
  }, [type, transferFee, speedUpFee, splitFee, selectedUtxos, isReceiverValid, txInfo]);

  // 构建显示项
  const items = useMemo(() => {
    const baseItems = [
      {
        label: gasInputLabel,
        value: currentFeeRate,
        input: true,
        onChange: (e) => {
          const value = e.target.value.trim();
          setCustomGas(value === '' ? null : Number(value));
          setGasLevel('custom');
        },
        error: type === 'speedUp' && txInfo?.data?.feeRate && currentFeeRate <= txInfo.data.feeRate 
          ? '加速后费率必须大于加速前费率'
          : null
      }
    ];

    // 如果是加速功能且有原交易信息，添加原费率显示
    if (type === 'speedUp' && txInfo?.data?.feeRate) {
      baseItems.unshift({
        label: '加速前费率',
        value: `${txInfo.data.feeRate} sat/vB`,
        input: false
      });
    }

    // 添加预估费用
    baseItems.push({
      label: '预估费用',
      value: estimatedFee?.fee?.toLocaleString() ?? '-',
      input: false,
      showUtxoInfo: true
    });

    return baseItems;
  }, [type, currentFeeRate, txInfo, estimatedFee, gasInputLabel]);

  return (
    <div>
      <div className="min-h-[32px] flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {title}
        </label>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center text-xs">
            <span className="w-20 text-gray-400">{item.label}：</span>
            {item.input ? (
              <div className="flex items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  value={item.value ?? ''}
                  onChange={item.onChange}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="ml-1 text-gray-400">sat/vB</span>
                {item.error && (
                  <span className="ml-2 text-red-500">{item.error}</span>
                )}
              </div>
            ) : (
              <>
                <span className="text-gray-900">
                  {item.showUtxoInfo ? (
                    <>
                      {item.value} 聪
                      {selectedUtxos.length > 0 && estimatedFee?.fee && type !== 'split' && (
                        <span className={estimatedFee.success ? 'text-green-500' : 'text-red-500'}>
                          （已选择 {selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0).toLocaleString()} 聪，
                          {estimatedFee.success ? '足够' : '不足'}支付交易费用）
                        </span>
                      )}
                    </>
                  ) : (
                    item.value
                  )}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 