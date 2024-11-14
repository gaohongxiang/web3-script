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
    transferFee,  // 转账费用
    speedUpFee,   // 加速费用
    setCustomGas,
    setGasLevel,
    isReceiverValid,
  } = useUtxoContext();

  // 根据类型获取对应的费用计算结果
  const estimatedFee = useMemo(() => {
    // 如果没有选择 UTXO 或接收地址未验证，返回 null
    if (!selectedUtxos.length || !isReceiverValid) return null;

    if (type === 'transfer') return transferFee;
    if (type === 'speedUp') return speedUpFee;
    return null;
  }, [type, transferFee, speedUpFee, selectedUtxos, isReceiverValid]);

  // 构建显示项
  const items = [
    {
      label: gasInputLabel,
      value: currentFeeRate,
      input: true,
      onChange: (e) => {
        const value = e.target.value.trim();
        setCustomGas(value === '' ? null : Number(value));
        setGasLevel('custom');
      }
    },
    {
      label: '预估费用',
      value: estimatedFee 
        ? `${estimatedFee.fee?.toLocaleString() ?? '-'} 聪${
            selectedUtxos.length 
              ? `, 已选择 ${selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0).toLocaleString()} 聪${
                  estimatedFee.success ? '，足够支付交易费用' : '，不足以支付交易费用'
                }`
              : ''
          }`
        : '- 聪'
    }
  ];

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
                <span className="ml-1">sat/vB</span>
              </div>
            ) : (
              <>
                <span className="text-gray-400">
                  {estimatedFee?.fee?.toLocaleString() ?? '-'} 聪
                </span>
                {selectedUtxos.length > 0 && estimatedFee?.fee && (
                  <span className={estimatedFee.success ? 'text-green-500' : 'text-red-500'}>
                    （已选择 {selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0).toLocaleString()} 聪，
                    {estimatedFee.success ? '足够' : '不足'}支付交易费用）
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 