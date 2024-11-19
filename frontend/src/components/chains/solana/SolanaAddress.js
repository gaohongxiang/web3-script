'use client';

export function SolanaAddress({ label = "发送地址", disabled = true }) {
  const { 
    network,
    address,
    balance,
    setAddress,
    setBalance,
    setEncryptedKey
  } = useSolanaContext();

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);

  // 处理输入变化
  const handleInputChange = useCallback((e) => {
    const value = e.target.value.trim();
    setEncryptedKey(value);

    if (!value) {
      setAddress(null);
      setError(null);
      setLoading(false);
      return;
    }

    debouncedFetch(value);
  }, [debouncedFetch, setEncryptedKey, setAddress]);

  return (
    <div className="-mt-1">
      <div className="min-h-[32px] flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {loading && <LoadingButton loading={true} title="获取地址" />}
      </div>

      <input
        type="text"
        onChange={handleInputChange}
        disabled={disabled}
        placeholder="请输入助记词或私钥"
        className={`
          w-full px-4 py-3 text-sm
          border border-gray-300 rounded-lg
          focus:outline-none focus:ring-1
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-blue-500'}
        `}
      />

      {error && (
        <div className="mt-1 text-[12px] text-red-500">{error}</div>
      )}

      <div className="mt-3 space-y-1">
        <div className="flex items-center text-xs text-gray-400">
          <span className="w-14">地址：</span>
          <span className="flex-1 break-all">
            {loading ? '获取中...' : address || '-'}
          </span>
        </div>
        <div className="flex items-center text-xs text-gray-400">
          <span className="w-14">余额：</span>
          <span>
            {loading ? '获取中...' : balance ? `${balance} SOL` : '-'}
          </span>
        </div>
      </div>
    </div>
  );
} 