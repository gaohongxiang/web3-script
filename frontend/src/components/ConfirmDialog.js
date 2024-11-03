'use client';

export function ConfirmDialog({
  title = '确认信息',
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  children  // 具体内容由父组件传入
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-medium mb-6">{title}</h3>
        
        {children}  {/* 渲染传入的具体内容 */}

        <div className="mt-8 flex space-x-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-base"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 text-base"
          >
            {loading ? '处理中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  );
} 