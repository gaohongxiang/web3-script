'use client';

export function Message({ type = 'info', children }) {
  if (!children) return null;

  const styles = {
    error: 'bg-red-50 border-red-200 text-red-600',
    success: 'bg-green-50 border-green-200 text-green-600',
    info: 'bg-blue-50 border-blue-200 text-blue-600',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-600'
  };

  return (
    <div className={`p-2 border rounded-lg text-sm ${styles[type]}`}>
      {children}
    </div>
  );
} 