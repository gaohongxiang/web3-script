'use client';

import { useState, useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';
import { isValidSolanaAddress, validateTransferAmount } from '@/hooks/chains/solana/useAddress';

export function ReceiverList() {
  const { 
    receiverList,
    setReceiverList,
    setIsReceiverValid,
    selectedToken,
    addressList
  } = useSolanaContext();

  const [validationErrors, setValidationErrors] = useState({});

  // 处理输入变化
  const handleChange = useCallback(async (value) => {
    // 直接处理成数组格式
    const receivers = value.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [address, amount] = line.split(',').map(s => s.trim());
        return [address, parseFloat(amount)];
      });
    
    setReceiverList(receivers); // 直接存储数组格式
    
    if (!value.trim()) {
      setValidationErrors({});
      setIsReceiverValid(true);
      return;
    }

    // 验证逻辑...
    let isValid = true;
    let errorMessage = null;

    for (const [address, amount] of receivers) {
      if (!isValidSolanaAddress(address)) {
        isValid = false;
        errorMessage = '地址格式错误，请输入有效的 Solana 地址';
        break;
      }

      if (isNaN(amount) || amount <= 0) {
        isValid = false;
        errorMessage = '金额必须大于0';
        break;
      }
    }

    // 余额验证...
    if (isValid && addressList[0]?.balance) {
      const validAmount = await validateTransferAmount(
        receivers,
        parseFloat(addressList[0].balance),
        selectedToken
      );

      if (!validAmount.isValid) {
        isValid = false;
        errorMessage = validAmount.error;
      }
    }

    setValidationErrors({ receiverList: errorMessage });
    setIsReceiverValid(isValid);
  }, [setReceiverList, setIsReceiverValid, addressList, selectedToken]);

  // 将数组转换回字符串用于显示
  const displayValue = useMemo(() => {
    if (!Array.isArray(receiverList)) return '';
    return receiverList
      .map(([address, amount]) => `${address},${amount}`)
      .join('\n');
  }, [receiverList]);

  return (
    <div>
      <div className="min-h-[32px] flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          接收地址列表
        </label>
        <div className="ml-2">
          {validationErrors.receiverList && (
            <span className="text-[12px] text-red-500">
              {validationErrors.receiverList}
            </span>
          )}
        </div>
      </div>

      <div className={`border rounded-lg overflow-hidden
        ${validationErrors.receiverList ? 'border-red-500' : 'border-gray-300'}`}
      >
        <CodeMirror
          value={displayValue}
          onChange={handleChange}
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

      <p className="mt-2 text-sm text-gray-500">
        正确格式：'地址,数量'。地址必须是有效的 Solana 地址，数量必须大于0，金额单位为 {selectedToken?.symbol || 'SOL'}。每行一个。
      </p>
    </div>
  );
} 