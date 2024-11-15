'use client';

export function ResultDialog({
  isOpen,
  onClose,
  success,
  txid,
  newTxid,
  network,
  error,
  type = 'transfer'  // 'transfer' | 'speedUp' | 'split'
}) {
  if (!isOpen) return null;

  const getTitle = () => {
    const actionMap = {
      transfer: '转账',
      speedUp: '加速',
      split: '拆分'
    };
    
    const action = actionMap[type] || '操作';
    return `${action}${success ? '成功' : '失败'}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-medium mb-6">
          <span className={success ? 'text-green-500' : 'text-red-500'}>
            {getTitle()}
          </span>
        </h3>
        
        <div className="space-y-4">
          {success ? (
            <>
              {txid && (
                <div className="text-base">
                  <div className="text-gray-600 mb-2">
                    {type === 'speedUp' ? '原交易ID：' : '交易ID：'}
                  </div>
                  <div className="break-all">
                    <a
                      href={`${network === 'btc' ? 'https://mempool.space' : 'https://mempool.fractalbitcoin.io/'}/tx/${txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      {txid}
                    </a>
                  </div>
                </div>
              )}
              {type === 'speedUp' && newTxid && (
                <div className="text-base">
                  <div className="text-gray-600 mb-2">新交易ID：</div>
                  <div className="break-all">
                    <a
                      href={`${network === 'btc' ? 'https://mempool.space' : 'https://mempool.fractalbitcoin.io/'}/tx/${newTxid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      {newTxid}
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-base text-gray-600">{error}</div>
          )}
        </div>

        <div className="mt-8 flex space-x-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-base"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
} 