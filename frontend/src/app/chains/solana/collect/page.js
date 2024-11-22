'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ResultDialog } from '@/components/ResultDialog';
import { ReceiverList } from '@/components/chains/solana/ReceiverList';
import { TokenList } from '@/components/chains/solana/TokenList';
import { AddressList } from '@/components/chains/solana/AddressList';
import { CollectAmountSelector } from '@/components/chains/solana/CollectAmountSelector';

export default function CollectPage() {
  const {
    addressList,
    selectedToken,
    receiverList,
    isReceiverValid,
    eligibleCount,
    sendAll, setSendAll,
    keepAmount, setKeepAmount,
    customAmount, setCustomAmount,
    sendAmount, setSendAmount,
    keepValue, setKeepValue,
  } = useSolanaContext();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultData, setResultData] = useState({
    success: false,
    txid: '',
    error: ''
  });
  const [filteredAddressList, setFilteredAddressList] = useState([]);

  const canCollect = useMemo(() => {
    const hasPrivateKeys = addressList.every(addr => addr.enPrivateKey);

    return !!(
      hasPrivateKeys &&    // 有私钥
      addressList[0]?.address &&
      addressList[0].address !== '-' &&  // 有发送地址
      selectedToken &&   // 选择了代币
      receiverList &&    // 有接收地址
      isReceiverValid && // 接收地址格式和余额验证都通过
      eligibleCount > 0  // 确保有符合条件的地址
    );
  }, [addressList, selectedToken, receiverList, isReceiverValid, eligibleCount]);

  const handleCollect = useCallback(async () => {
    setConfirmLoading(true);
    try {
      const response = await fetch('/api/chains/solana/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          addressList: filteredAddressList,
          selectedToken,
          receiverList,
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
      
      // 只重置过滤条件
      setSendAll(false);
      setKeepAmount(false);
      setCustomAmount(false);
      setSendAmount('');
      setKeepValue('');

    } catch (error) {
      console.error('Collect error:', error);
      setResultData({
        success: false,
        txid: '',
        error: error.message || '归集失败，请重试'
      });
    } finally {
      setConfirmLoading(false);
      setIsConfirmOpen(false);
      setIsResultOpen(true);
    }
  }, [filteredAddressList, selectedToken, receiverList, setSendAll, setKeepAmount, setCustomAmount, setSendAmount, setKeepValue]);

  const handleAmountChange = useCallback((addresses) => {
    setFilteredAddressList(addresses);
  }, []);

  return (
    <div className="space-y-4">
      <TokenList />
      <AddressList mode="collect" />
      <CollectAmountSelector 
        addressList={addressList}
        selectedToken={selectedToken}
        onAmountChange={handleAmountChange}
      />
      <ReceiverList mode="collect" />

      <button
        type="button"
        disabled={!canCollect || confirmLoading}
        onClick={() => setIsConfirmOpen(true)}
        className={`
          w-full px-4 py-2 text-sm font-medium rounded-lg
          ${canCollect && !confirmLoading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {confirmLoading ? '处理中...' : '归集'}
      </button>

      <ConfirmDialog
        title="确认归集"
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleCollect}
        loading={confirmLoading}
      >
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-gray-500">发送地址：</span>
            <div className="mt-1 pl-2 space-y-1">
              {filteredAddressList.map((addr) => (
                <div key={addr.address} className="break-all">
                  {addr.address} - 余额: {addr.balance} {selectedToken?.symbol} 
                  {addr.collectAmount && ` - 归集: ${addr.collectAmount} ${selectedToken?.symbol}`}
                </div>
              ))}
            </div>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">发送代币：</span>
            <span>{selectedToken?.symbol}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">归集地址：</span>
            <div className="mt-1 pl-2">
              {Array.isArray(receiverList) && receiverList[0] && (
                <div className="break-all">{receiverList[0][0]}</div>
              )}
            </div>
          </div>
        </div>
      </ConfirmDialog>

      <ResultDialog
        isOpen={isResultOpen}
        onClose={() => setIsResultOpen(false)}
        success={resultData.success}
        txid={resultData.txid}
        network="solana"
        error={resultData.error}
        type="collect"
      />
    </div>
  );
}