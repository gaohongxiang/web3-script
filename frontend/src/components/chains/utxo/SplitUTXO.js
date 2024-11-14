'use client';

import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';

export function SplitUTXO({ disabled = false }) {
  const { 
    splitParts, 
    setSplitParts,
    splitFee,
    selectedUtxos,
    network
  } = useUtxoContext();

  const selectedAmount = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        拆分详情
      </label>
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="text-sm text-gray-600 mr-2">拆分份数：</span>
            <input
              type="number"
              value={splitParts || ''}
              onChange={(e) => {
                const value = e.target.value === '' ? 0 : Number(e.target.value);
                setSplitParts(value);
              }}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (value < 1) {
                  setSplitParts(1);
                } else if (value > 100) {
                  setSplitParts(100);
                }
              }}
              disabled={disabled}
              className={`
                w-16 px-2 py-1 text-sm
                border border-gray-300 rounded
                focus:outline-none focus:ring-1
                ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-blue-500'}
              `}
            />
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-600 mr-2">每份金额：</span>
            <span className="text-sm text-gray-900">
              {splitFee?.amountPerPart ? (
                <>
                  {(splitFee.amountPerPart / 100000000).toFixed(8)} {network === 'btc' ? 'BTC' : 'FB'}
                  <span className="text-gray-500 ml-1">
                    ({splitFee.amountPerPart.toLocaleString()} 聪)
                  </span>
                </>
              ) : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 