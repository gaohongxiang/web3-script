'use client';

import { useState, useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';

export function ReceiverList({ onChange }) {
  const { network } = useUtxoContext();
  
  const [toAddressList, setToAddressList] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // 验证地址格式
  const validateAddress = useCallback((address) => {
    return address.startsWith('bc1p') || 
           address.startsWith('bc1q') || 
           address.startsWith('1');
  }, []);

  // 验证输入格式
  const validateInput = useCallback((value) => {
    if (!value) return null;

    const lines = value.trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split(',');
      if (parts.length !== 2) {
        return '正确格式：\'地址,数量\'。地址只接受bc1p、bc1q、1开头，数量必须大于0';
      }

      const [address, amount] = parts.map(p => p.trim());

      if (!validateAddress(address)) {
        return '正确格式：\'地址,数量\'。地址只接受bc1p、bc1q、1开头，数量必须大于0';
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return '正确格式：\'地址,数量\'。地址只接受bc1p、bc1q、1开头，数量必须大于0';
      }
    }

    return null;
  }, [validateAddress]);

  // 处理输入变化
  const handleChange = useCallback((e) => {
    const value = e.target.value;
    const receivers = value.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [address, amount] = line.split(',').map(s => s.trim());
        return [address, parseFloat(amount)];
      });
    
    setToAddressList(value);
    onChange(receivers, !validateInput(value));
  }, [onChange, validateInput]);

  // 处理输入验证
  const handleBlur = useCallback((e) => {
    const value = e.target.value;
    const error = validateInput(value);
    setValidationErrors({ toAddressList: error });
  }, [validateInput]);

  return (
    <div>
      <div className="min-h-[32px] flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          接收地址列表
        </label>
        <div className="ml-2">
          {validationErrors.toAddressList && (
            <span className="text-[12px] text-red-500">
              正确格式：'地址,数量'。地址只接受bc1p、bc1q、1开头，数量必须大于0
            </span>
          )}
        </div>
      </div>

      <textarea
        value={toAddressList}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={4}
        className={`
          w-full px-4 py-3 border border-gray-300 rounded-lg 
          focus:outline-none focus:ring-1 overflow-y-auto
          ${validationErrors.toAddressList 
            ? "border-red-500 focus:ring-red-500" 
            : "focus:ring-blue-500"
          }
        `}
        placeholder={`每行一个地址和金额，用逗号分隔，例如：\nbc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh,0.001\nbc1pxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh,0.002`}
        style={{ maxHeight: '160px' }}
      />
      <p className="mt-2 text-sm text-gray-500">
        正确格式：'地址,数量'。地址只接受bc1p、bc1q、1开头，数量必须大于0，金额单位为 {network === 'btc' ? 'BTC' : 'FB'}。 每行一个。
      </p>
    </div>
  );
} 