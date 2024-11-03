'use client';

export function NetworkAndGas({
  networks,
  selectedNetwork,
  onNetworkChange,
  gasInfo,
  gasLevel,
  onGasLevelChange,
  customGas,
  onCustomGasChange,
  countdown,
  loading,
  gasUnit = 'sat/vB'
}) {
  return (
    <div className="flex space-x-4">
      <div className="w-2/5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          网络
        </label>
        <select
          value={selectedNetwork}
          onChange={(e) => onNetworkChange(e.target.value)}
          className="w-full px-4 h-[51px] border border-gray-300 rounded-lg text-gray-600 cursor-pointer focus:outline-none focus:border-blue-500"
          style={{ paddingTop: '0', paddingBottom: '0' }}
        >
          {networks.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="w-3/5">
        <div className="flex items-center space-x-2 mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Gas ({gasUnit})
          </label>
          {loading && (
            <span className="text-xs text-gray-500">获取中...</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(gasInfo).map(([level, { fee, time }]) => (
            <button
              key={level}
              type="button"
              onClick={() => {
                onGasLevelChange(level);
                onCustomGasChange('');
              }}
              className={`p-1.5 text-sm rounded-lg border transition-colors ${
                gasLevel === level
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium truncate">{fee} {gasUnit}</div>
              <div className="text-xs text-gray-500 whitespace-nowrap">{time}</div>
            </button>
          ))}
          <div className="relative">
            <input
              type="number"
              value={customGas}
              onChange={(e) => {
                const value = e.target.value;
                onCustomGasChange(value);
                onGasLevelChange(value ? 'custom' : 'medium');
              }}
              placeholder="自定义"
              className={`w-full h-full p-1.5 text-sm rounded-lg border transition-colors ${
                gasLevel === 'custom'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            />
          </div>
        </div>
        <div className="mt-1 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            当前网络拥堵状况：{
              parseInt(gasInfo.medium.fee) > 100 
                ? '严重拥堵' 
                : parseInt(gasInfo.medium.fee) > 50 
                  ? '轻微拥堵' 
                  : '正常'
            }
          </p>
          <p className="text-xs text-gray-500">
            {countdown}s 后刷新
          </p>
        </div>
      </div>
    </div>
  );
} 