'use client';

import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';
import { Select } from '@/components/Select';
import { LoadingButton } from '@/components/LoadingButton';
import { useState, useEffect, useMemo } from 'react';

export function TokenList({ disabled = false }) {
  const { 
    selectedToken,
    setSelectedToken
  } = useSolanaContext();

  const [loading, setLoading] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [customDecimals, setCustomDecimals] = useState('');
  const [error, setError] = useState('');
  const [tokenList, setTokenList] = useState([]);

  // 获取代币列表
  useEffect(() => {
    fetch('/token.json')
      .then(res => res.json())
      .then(data => {
        const tokens = data?.solana ? Object.entries(data.solana).map(([symbol, data]) => ({
          mint: data.address,
          symbol: symbol,
          decimals: Number(data.decimals)
        })) : [];
        setTokenList(tokens);
      });
  }, []);

  const tokenOptions = [
    {
      value: 'custom',
      label: '添加自定义代币',
      isCustom: true
    },
    ...tokenList.map(token => ({
      value: token.mint,
      label: token.symbol,
      token: token
    }))
  ];

  const getCustomTokenOption = (token) => ({
    value: token.mint,
    label: '自定义代币',
    token: token
  });

  const selectedOption = selectedToken 
    ? {
        value: selectedToken.mint,
        label: selectedToken.symbol,
        token: selectedToken
      }
    : null;

  const handleChange = (option) => {
    if (option.isCustom) {
      setShowCustomInput(true);
    } else {
      setSelectedToken(option.token);
    }
  };

  const handleCustomTokenSubmit = async () => {
    if (!customTokenAddress.trim()) {
      setError('请输入代币地址');
      return;
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(customTokenAddress)) {
      setError('无效的代币地址格式');
      return;
    }

    if (!customSymbol.trim()) {
      setError('请输入代币符号');
      return;
    }

    if (!customDecimals) {
      setError('请输入代币精度');
      return;
    }

    const newToken = {
      mint: customTokenAddress,
      symbol: customSymbol,
      decimals: Number(customDecimals)
    };

    try {
      const response = await fetch('/api/addToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chain: 'solana',
          token: {
            address: customTokenAddress,
            decimals: customDecimals
          },
          symbol: customSymbol
        })
      });

      if (!response.ok) {
        throw new Error('保存代币失败');
      }

      setTokenList(prev => [...prev, newToken]);
      setSelectedToken(newToken);
      setShowCustomInput(false);
      setCustomTokenAddress('');
      setCustomSymbol('');
      setCustomDecimals('');
      setError('');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div>
      <div className="min-h-[32px] flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          转账代币
        </label>
        {loading && (
          <LoadingButton
            loading={true}
            title="获取代币"
            className="!ml-2"
          />
        )}
      </div>

      {showCustomInput ? (
        <div className="space-y-2">
          <div className="flex space-x-2">
            <input
              type="text"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              placeholder="代币符号"
              className="w-2/6 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={customTokenAddress}
              onChange={(e) => setCustomTokenAddress(e.target.value)}
              placeholder="代币地址"
              className="w-3/6 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={customDecimals}
              onChange={(e) => setCustomDecimals(e.target.value)}
              placeholder="精度"
              className="w-1/6 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={handleCustomTokenSubmit}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              确认添加
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustomInput(false);
                setCustomTokenAddress('');
                setCustomSymbol('');
                setCustomDecimals('');
                setError('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="flex space-x-2">
          <div className="w-2/6">
            <div className="text-xs text-gray-500 mb-1">代币符号</div>
            <Select
              value={selectedOption}
              onChange={handleChange}
              options={tokenOptions}
              placeholder="选择代币"
              disabled={disabled}
            />
          </div>
          
          <div className="w-3/6">
            <div className="text-xs text-gray-500 mb-1">代币地址</div>
            <input
              type="text"
              value={selectedToken?.mint || ''}
              readOnly
              placeholder="-"
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed select-none pointer-events-none text-gray-400"
            />
          </div>

          <div className="w-1/6">
            <div className="text-xs text-gray-500 mb-1">代币精度</div>
            <input
              type="text"
              value={selectedToken?.decimals || ''}
              readOnly
              placeholder="-"
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed select-none pointer-events-none text-gray-400"
            />
          </div>
        </div>
      )}
    </div>
  );
} 