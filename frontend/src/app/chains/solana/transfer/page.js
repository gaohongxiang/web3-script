'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ResultDialog } from '@/components/ResultDialog';
import { ReceiverList } from '@/components/chains/solana/ReceiverList';
import { TokenList } from '@/components/chains/solana/TokenList';
import { AddressList } from '@/components/chains/solana/AddressList';

export default function TransferPage() {
  const {
    encryptedKey,
    addressList,
    selectedToken,
    receiverList,
    isReceiverValid,
  } = useSolanaContext();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultData, setResultData] = useState({
    success: false,
    txid: '',
    error: ''
  });

  const canTransfer = useMemo(() => {
    return !!(
      encryptedKey &&    // 有私钥
      addressList[0]?.address &&
      addressList[0].address !== '-' &&  // 有发送地址
      selectedToken &&   // 选择了代币
      receiverList &&    // 有接收地址
      isReceiverValid   // 接收地址格式和余额验证都通过
    );
  }, [encryptedKey, addressList, selectedToken, receiverList, isReceiverValid]);

  const handleTransfer = useCallback(async () => {
    setConfirmLoading(true);
    try {
      const response = await fetch('/api/chains/solana/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          encryptedKey,
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

    } catch (error) {
      console.error('Transfer error:', error);
      setResultData({
        success: false,
        txid: '',
        error: error.message || '转账失败，请重试'
      });
    } finally {
      setConfirmLoading(false);
      setIsConfirmOpen(false);
      setIsResultOpen(true);
    }
  }, [encryptedKey, selectedToken, receiverList]);

  return (
    <div className="space-y-4">
      {/* 代币选择 */}
      <TokenList />

      {/* 发送地址 */}
      <AddressList mode="transfer" />

      {/* 接收地址列表 */}
      <ReceiverList />

      <button
        type="button"
        disabled={!canTransfer || confirmLoading}
        onClick={() => setIsConfirmOpen(true)}
        className={`
          w-full px-4 py-2 text-sm font-medium rounded-lg
          ${canTransfer && !confirmLoading
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        {confirmLoading ? '处理中...' : '转账'}
      </button>

      <ConfirmDialog
        title="确认转账"
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleTransfer}
        loading={confirmLoading}
      >
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-gray-500">发送地址：</span>
            <span className="break-all">{addressList[0]?.address}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">发送代币：</span>
            <span>{selectedToken?.symbol}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">接收地址：</span>
            <div className="mt-1 pl-2 space-y-1">
              {Array.isArray(receiverList) && receiverList.map(([address, amount], index) => (
                <div key={index} className="break-all">{address}, {amount} {selectedToken?.symbol}</div>
              ))}
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
        type="transfer"
      />
    </div>
  );
}