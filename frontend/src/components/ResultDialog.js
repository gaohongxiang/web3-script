'use client';

export function ResultDialog({
  isOpen,
  onClose,
  success,
  txid,
  network,
  error
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
        <h3 className="text-xl font-medium mb-6">
          {success ? '转账成功' : '转账失败'}
        </h3>
        
        <div className="space-y-4">
          {success ? (
            <>
              <p className="text-green-600">交易已成功广播到网络！</p>
              <div className="break-all">
                <span className="text-gray-600">交易ID：</span>
                <a 
                  href={`${network === 'btc' ? 'https://mempool.space' : 'https://mempool.fractalbitcoin.io'}/tx/${txid}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline ml-1"
                >
                  {txid}
                </a>
              </div>
            </>
          ) : (
            <p className="text-red-600">{error || '转账失败，请重试'}</p>
          )}
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-base"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
} 