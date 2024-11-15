'use client';

import { LoadingButton } from './LoadingButton';

export function NetworkAndGas({
  networks,
  selectedNetwork,
  onNetworkChange,
  gasInfo,
  loading,
  countdown,
  gasUnit,
  selectedGasLevel,
  customGas,
  onCustomGasChange,
  onGasLevelChange
}) {
  return (
    <div className="flex space-x-4">
      <div className="w-2/5">
        <div className="min-h-[32px] flex items-center mb-1">
          <label className="block text-sm font-medium text-gray-700">
            网络
          </label>
        </div>
        <select
          value={selectedNetwork}
          onChange={(e) => onNetworkChange(e.target.value)}
          className="w-full h-[51px] px-4 border border-gray-300 rounded-lg text-gray-600 cursor-pointer focus:outline-none focus:border-blue-500"
        >
          {networks.map((network) => (
            <option key={network.key} value={network.key}>
              {network.label}
            </option>
          ))}
        </select>
      </div>

      <div className="w-3/5">
        <div className="min-h-[32px] flex items-center space-x-2 mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Gas ({gasUnit})
          </label>
          {loading && (
            <LoadingButton
              loading={true}
              title="获取费率"
              className="!ml-0"
            />
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {gasInfo && Object.entries(gasInfo).map(([level, { fee, time }]) => (
            <button
              key={level}
              type="button"
              onClick={() => onGasLevelChange(level)}
              className={`
                h-[51px] px-4 text-sm rounded-lg border transition-colors
                ${selectedGasLevel === level
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="font-medium truncate">{fee} {gasUnit}</div>
              <div className="text-xs text-gray-500 whitespace-nowrap">{time}</div>
            </button>
          ))}

          <input
            type="text"
            value={customGas ?? ''}
            onChange={(e) => {
              const value = e.target.value.trim();
              onCustomGasChange(value);
              onGasLevelChange(value ? 'custom' : 'fast');
            }}
            placeholder="自定义"
            className={`
              h-[51px] px-4 text-sm rounded-lg border transition-colors text-center focus:outline-none
              ${selectedGasLevel === 'custom'
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'border-gray-200'
              }
            `}
          />

        </div>
        <div className="h-5 mt-1 flex justify-between items-center">
          <p className="text-xs text-gray-500">
            当前网络拥堵状况：{
              gasInfo && parseInt(gasInfo.medium.fee) > 100
                ? '严重拥堵'
                : gasInfo && parseInt(gasInfo.medium.fee) > 50
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