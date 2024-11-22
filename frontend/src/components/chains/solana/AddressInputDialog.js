import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import CodeMirror from '@uiw/react-codemirror';
import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';

export function AddressInputDialog({ isOpen, onClose, onConfirm, loading }) {
  const { addressList } = useSolanaContext();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValue(addressList
        .map(addr => addr.key)
        .join('\n')
      );
    }
  }, [isOpen, addressList]);

  const handleConfirm = () => {
    onConfirm(value);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-lg p-6 max-w-2xl w-full">
          <Dialog.Title className="text-lg font-medium mb-4">
            批量添加地址
          </Dialog.Title>

          <CodeMirror
            value={value}
            onChange={setValue}
            placeholder="每行输入一个加密后私钥"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: false,
              highlightActiveLine: false,
            }}
            height="200px"
            className="text-sm border border-gray-300 rounded-lg"
          />

          <div className="mt-6 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg"
            >
              {loading ? '处理中...' : '确认'}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
} 