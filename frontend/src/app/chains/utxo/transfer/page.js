'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { UTXONetworkAndGas } from '@/components/chains/utxo/UTXONetworkAndGas';
import { FromAddress } from '@/components/chains/utxo/FromAddress';
import { useUtxo } from '@/hooks/chains/utxo/useUtxo';
import { useGas } from '@/hooks/chains/utxo/useGas';
import { Message } from '@/components/Message';
import { ConfirmDialog } from '@/components/ConfirmDialog';

// 地址格式验证函数
const isValidBtcAddress = (address) => {
  if (!address) return false;
  address = address.replace(/^["']|["']$/g, '');
  return address.startsWith('bc1p') || 
         address.startsWith('bc1q') || 
         address.startsWith('1');
};

// 转账数据格式验证函数
const parseTransferList = (text, network) => {
  if (!text.trim()) {
    return { error: '请输入转账地址列表' };
  }

  const lines = text.split('\n').filter(line => line.trim());
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^["']?([^"',]+)["']?,\s*(\d*\.?\d*)$/);
    
    if (!match) {
      return { error: '接收地址列表格式错误' };
    }

    const [, address, amount] = match;
    
    if (network === 'btc' && !isValidBtcAddress(address)) {
      return { error: '地址格式错误，仅支持 bc1p、bc1q 或 1 开头的地址' };
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return { error: '金额格式错误，请输入大于0的数字' };
    }
  }

  return { error: null };
};

export default function Transfer() {
  const { network, gasLevel, customGas } = useUtxoContext();
  const { gasInfo } = useGas();
  const [formData, setFormData] = useState({
    toAddressList: '',
    filterAmount: '10000',
    scriptType: 'P2TR',
    enMnemonicOrWif: '',
    fromAddress: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [transferData, setTransferData] = useState(null);
  const [address, setAddress] = useState('');
  const { getUtxos, filterUtxos } = useUtxo();
  const [utxoInfo, setUtxoInfo] = useState(null);
  const [utxoLoading, setUtxoLoading] = useState(false);
  const [utxoError, setUtxoError] = useState(null);

  // 添加脚本类型变化处理
  const handleScriptTypeChange = (newScriptType) => {
    setFormData(prev => ({
      ...prev,
      scriptType: newScriptType
    }));
  };

  // 处理表单提交
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // 计算总金额，使用字符串处理避免精度丢失
      const toData = formData.toAddressList
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [address, amount] = line.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
          return { address, amount: parseFloat(amount) };
        });

      // 使用 reduce 计算总和，保留 8 位小数
      const totalAmount = toData.reduce((sum, { amount }) => sum + amount, 0).toFixed(8);

      setTransferData({
        toData,
        totalAmount: parseFloat(totalAmount),  // 转回数字但保持精度
        network,
        scriptType: formData.scriptType,
        gasLevel: customGas ? '自定义' : gasLevel,
        gasFee: customGas || gasInfo[gasLevel].fee,
        filterAmount: parseInt(formData.filterAmount) || 10000
      });

      setShowConfirm(true);
    } catch (error) {
      setError(error.message || '转账失败，请重试');
    }
  };

  // 处理表单变化
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setValidationErrors(prev => ({
      ...prev,
      [name]: undefined
    }));
  };

  // 处理失去焦点
  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (name === 'toAddressList' && value.trim()) {
      const { error } = parseTransferList(value, network);
      if (error) {
        setValidationErrors(prev => ({
          ...prev,
          toAddressList: error
        }));
      }
    }
  };

  // 处理确认
  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 计算实际的 gas 费用
      const gas = customGas ? parseInt(customGas) : parseInt(gasInfo[gasLevel].fee);

      // 构造请求数据
      const requestData = {
        enMnemonicOrWif: formData.enMnemonicOrWif,
        toData: transferData.toData.map(({ address, amount }) => [address, amount]),
        network,
        gas,                // 直接传递计算好的 gas 值
        scriptType: formData.scriptType,
        filterAmount: parseInt(formData.filterAmount) || 10000,
        gasInfo
      };

      const response = await fetch('/api/chains/utxo/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || '转账失败');
      }

      setSuccess(
        <div>
          转账成功！交易ID: 
          <a 
            href={`${network === 'btc' ? 'https://mempool.space' : 'https://mempool.fractalbitcoin.io'}/tx/${data.txid}`}
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline ml-1"
          >
            {data.txid}
          </a>
        </div>
      );

      // 清空表单
      setFormData(prev => ({
        ...prev,
        toAddressList: ''
      }));
    } catch (error) {
      console.error('Transfer error:', error);
      setError(error.message || '转账失败，请重试');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const validateForm = () => {
    // 基本验证
    if (!formData.fromAddress || !formData.toAddressList || loading) {
      return { isValid: false };
    }

    // 检查地列表格式
    const { error } = parseTransferList(formData.toAddressList, network);
    if (error) {
      return {
        isValid: false,
        error
      };
    }

    // 计算总金额
    const toData = formData.toAddressList
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [address, amount] = line.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
        return { address, amount: parseFloat(amount) };
      });

    const totalAmount = toData.reduce((sum, { amount }) => sum + amount, 0);

    // 检查余额
    if (formData.balance === undefined || totalAmount > formData.balance) {
      return {
        isValid: false,
        error: `转账总额 ${totalAmount} ${network === 'btc' ? 'BTC' : 'FB'} 超过可用余额 ${formData.balance} ${network === 'btc' ? 'BTC' : 'FB'}`
      };
    }

    return { isValid: true };
  };

  // 使用 useEffect 处理验证结果
  useEffect(() => {
    const { isValid, error } = validateForm();
    if (!isValid && error) {
      setValidationErrors(prev => ({
        ...prev,
        toAddressList: error
      }));
    } else {
      setValidationErrors({});
    }
  }, [formData, network, loading]);

  // 修改按钮的禁用条件
  const isFormValid = validateForm().isValid;

  // 获取 UTXO 信息
  const fetchUtxos = async (address) => {
    setUtxoLoading(true);
    setUtxoError(null);
    try {
      const result = await getUtxos(address);
      if (!result.success) {
        throw new Error(result.error);
      }
      setUtxoInfo(result.data);
    } catch (error) {
      setUtxoError(error.message);
    } finally {
      setUtxoLoading(false);
    }
  };

  // 在地址或网络变化时获取 UTXO
  useEffect(() => {
    if (formData.fromAddress) {
      fetchUtxos(formData.fromAddress);
    }
  }, [formData.fromAddress, network]);  // 加 network 依赖

  // 获取过滤后的 UTXO
  const filteredUtxos = useMemo(() => {
    if (!utxoInfo?.allUtxos) return [];
    return filterUtxos(utxoInfo.allUtxos, parseInt(formData.filterAmount) || 546);
  }, [utxoInfo, formData.filterAmount, filterUtxos]);

  return (
    <>
      <UTXONetworkAndGas />
      <FromAddress 
        onChange={setAddress}
        onFormDataChange={(data) => {
          setFormData(prev => ({
            ...prev,
            fromAddress: data.address,
            enMnemonicOrWif: data.enMnemonicOrWif,
            scriptType: data.scriptType,
            balance: data.balance,
            balanceSat: data.balanceSat
          }));
        }}
      />

      {/* UTXO 信息显示 */}
      {formData.fromAddress && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            地址包含的 UTXO
          </label>
          {utxoLoading ? (
            <p className="text-sm text-gray-500">获取中...</p>
          ) : utxoError ? (
            <Message type="error">{utxoError}</Message>
          ) : utxoInfo && (
            <div className="text-sm space-y-2 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div>
                  可用 UTXO：
                  <span className="text-gray-600 font-medium ml-1">
                    {filteredUtxos.length} 个
                  </span>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={formData.filterAmount}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      filterAmount: e.target.value
                    }))}
                    placeholder="输入过滤金额"
                    className="w-32 px-2 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-gray-400 ml-2">
                    聪以下的 UTXO 不使用（保护铭文、符文等资产）
                  </span>
                </div>
              </div>
              {utxoInfo.unconfirmedUtxos.length > 0 && (
                <div className="text-red-500">
                  未确认 UTXO：
                  <span className="font-medium ml-1">
                    {utxoInfo.unconfirmedUtxos.length} 个
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 接收地址列表 */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          接收地址列表
        </label>
        <textarea
          name="toAddressList"
          value={formData.toAddressList}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={4}
          className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 overflow-y-auto ${
            validationErrors.toAddressList 
              ? "border-red-500 focus:ring-red-500" 
              : "focus:ring-blue-500"
          }`}
          placeholder={`每行一个地址和金额，用逗号分隔，例如：\nbc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh,0.001\nbc1pxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh,0.002`}
          disabled={loading}
          style={{ maxHeight: '160px' }}
        />
        {validationErrors.toAddressList && (
          <Message type="error">
            {validationErrors.toAddressList}
          </Message>
        )}
        <p className="mt-2 text-sm text-gray-500">
          格式："地址,数量"，每行一个。金额单位为 {network === 'btc' ? 'BTC' : 'FB'}
        </p>
      </div>

      {/* 错误和成功提示 */}
      {error && <Message type="error">{error}</Message>}
      
      {success && <Message type="success">{success}</Message>}

      {/* 转账按钮 */}
      <button
        type="submit"
        onClick={handleSubmit}
        disabled={!isFormValid}
        className={`w-full px-4 py-3 rounded-lg text-white font-medium transition-colors ${
          !isFormValid
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? '处理中...' : '转账'}
      </button>

      {/* 确认窗口 */}
      <ConfirmDialog
        title="确认转账信息"
        isOpen={showConfirm && transferData}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        loading={loading}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-gray-600">网络：</span>
              <span className="font-medium ml-2">{network === 'btc' ? 'Bitcoin' : 'Fractal'}</span>
            </div>
            <div>
              <span className="text-gray-600">脚本类型：</span>
              <span className="font-medium ml-2">{formData.scriptType}</span>
            </div>
            <div>
              <span className="text-gray-600">Gas 费用：</span>
              <span className="font-medium ml-2">{customGas || gasInfo[gasLevel].fee} sat/vB ({customGas ? '自定义' : gasLevel})</span>
            </div>
            <div>
              <span className="text-gray-600">资产保护：</span>
              <span className="font-medium ml-2">{parseInt(formData.filterAmount).toLocaleString()} 聪</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">发送地址：</span>
              <span className="font-medium ml-2 break-all">{formData.fromAddress}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">总转账金额：</span>
              <span className="font-medium ml-2">{transferData?.totalAmount} {network === 'btc' ? 'BTC' : 'FB'}</span>
            </div>
          </div>
          <div className="mt-6">
            <span className="text-gray-600 block mb-2">接收地址：</span>
            <div className="mt-2 space-y-1 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {transferData?.toData.map(({ address, amount }, index) => (
                <div key={index} className="text-sm flex justify-between items-center py-2 hover:bg-gray-50">
                  <span className="break-all mr-6 text-base">{address}</span>
                  <span className="whitespace-nowrap text-base font-medium">{amount} {network === 'btc' ? 'BTC' : 'FB'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
