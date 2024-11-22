'use client';

import { useState, useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';
import { isValidSolanaAddress, validateTransferAmount } from '@/hooks/chains/solana/useAddress';

export function ReceiverList({ mode = 'transfer' }) {
  const { 
    receiverList,
    setReceiverList,
    setIsReceiverValid,
    selectedToken
  } = useSolanaContext();

  const [value, setValue] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // 处理输入变化
  const handleChange = useCallback((newValue) => {
    if (mode === 'collect') {
      const address = newValue;  // 不需要 trim()，让用户自由输入
      setReceiverList([[address, '0']]);
      
      // 只在失去焦点时验证
      if (address && !isValidSolanaAddress(address)) {
        setValidationErrors({ receiverList: '请输入有效的 Solana 地址' });
        setIsReceiverValid(false);
      } else {
        setValidationErrors({});
        setIsReceiverValid(true);
      }
      return;
    }

    // 转账模式：直接保存用户输入，不做处理
    if (mode === 'transfer') {
      setValue(newValue);
      setValidationErrors({});
      setIsReceiverValid(true);
    }
  }, [mode, setReceiverList, setValidationErrors, setIsReceiverValid]);

  const handleBlur = useCallback(() => {
    if (mode === 'transfer' && value) {
      // 分割并验证每一行
      const receivers = value.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.split(',');
          if (parts.length !== 2) {
            setValidationErrors({ 
              receiverList: `正确格式：'地址,数量'。地址必须是有效的 Solana 地址，数量必须大于0，金额单位为 ${selectedToken?.symbol || 'SOL'}。每行一个。` 
            });
            setIsReceiverValid(false);
            return line;
          }
          
          const [address, amount] = parts.map(s => s.trim());
          
          if (!isValidSolanaAddress(address)) {
            setValidationErrors({ receiverList: '地址格式错误，请输入有效的 Solana 地址' });
            setIsReceiverValid(false);
            return line;
          }

          const amountNum = Number(amount);
          if (isNaN(amountNum) || amountNum <= 0) {
            setValidationErrors({ receiverList: '金额必须大于0' });
            setIsReceiverValid(false);
            return line;
          }

          return [address, amount];
        });

      if (!validationErrors.receiverList) {
        setReceiverList(receivers);
        setIsReceiverValid(true);
      }
    }
  }, [mode, value, selectedToken, setReceiverList, setValidationErrors, setIsReceiverValid]);

  // 将数组转换回字符串用于显示
  const displayValue = useMemo(() => {
    if (mode === 'collect') {
      // 归集模式：只显示地址，不显示金额
      return Array.isArray(receiverList) && receiverList[0] ? receiverList[0][0] : '';
    }
    // 转账模式：原有逻辑
    if (!Array.isArray(receiverList)) return '';
    return receiverList
      .map(([address, amount]) => `${address},${amount}`)
      .join('\n');
  }, [receiverList, mode]);

  return (
    <div>
      <div className="min-h-[32px] flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {mode === 'collect' ? '归集地址' : '接收地址列表'}
        </label>
        <div className="ml-2">
          {validationErrors.receiverList && (
            <span className="text-[12px] text-red-500">
              {validationErrors.receiverList}
            </span>
          )}
        </div>
      </div>

      {mode === 'collect' ? (
        // 归集模式：单个地址输入框
        <input
          type="text"
          placeholder="请输入归集地址"
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          className="
            w-full px-4 py-2 text-sm
            border rounded-lg
            focus:outline-none focus:ring-1
            border-gray-300
          "
        />
      ) : (
        // 转账模式：原有的多行输入框
        <div className={`border rounded-lg overflow-hidden
          ${validationErrors.receiverList ? 'border-red-500' : 'border-gray-300'}`}
        >
          <CodeMirror
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={`每行一个地址和金额，用逗号分隔，例如：\nHN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH,0.001\nAxDhv66cvqf5VbJN54a2VR7Lg1fZGVQfSN69gqxmJY5n,0.002`}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: false,
              highlightActiveLine: false,
            }}
            height="160px"
            className="text-sm"
          />
        </div>
      )}

      <p className="mt-2 text-sm text-gray-500">
        {mode === 'collect' 
          ? '请输入要归集到的目标地址，该地址将接收所有来源地址的代币'
          : `正确格式：'地址,数量'。地址必须是有效的 Solana 地址，数量必须大于0，金额单位为 ${selectedToken?.symbol || 'SOL'}。每行一个。`
        }
      </p>
    </div>
  );
} 