'use client';

import { useState, useRef, useEffect } from 'react';
import { useThrottleFn } from 'ahooks';

export function LoadingButton({ 
  onClick, 
  loading = false,
  disabled = false,
  title = '加载中',
  hint = '',
  className = '',
  wait = 3000,
  minLoadingTime = 500
}) {
  const [throttleHint, setThrottleHint] = useState('');
  const [showLoading, setShowLoading] = useState(false);
  const lastRunTime = useRef(0);
  const loadingTimer = useRef(null);

  useEffect(() => {
    if (loading) {
      setShowLoading(true);
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
    } else {
      loadingTimer.current = setTimeout(() => {
        setShowLoading(false);
      }, minLoadingTime);
    }

    return () => {
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current);
      }
    };
  }, [loading, minLoadingTime]);

  const { run } = useThrottleFn(
    () => {
      lastRunTime.current = Date.now();
      setThrottleHint('');
      onClick?.();
    },
    {
      wait,
      leading: true,
      trailing: false
    }
  );

  const handleClick = (e) => {
    e.preventDefault();
    if (showLoading || disabled) return;
    
    const now = Date.now();
    if (now - lastRunTime.current < wait) {
      setThrottleHint('请求频繁，请稍后重试');
      setTimeout(() => setThrottleHint(''), wait);
    }
    
    run();
  };

  return (
    <div className="flex items-center">
      <button
        onClick={handleClick}
        disabled={showLoading || disabled}
        className={`ml-2 p-1 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors ${
          showLoading ? 'text-blue-500' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        title={throttleHint || hint || title}
      >
        <svg 
          className={`w-4 h-4 ${showLoading ? 'animate-spin' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
          />
        </svg>
      </button>
      {(throttleHint || hint) && (
        <span className="ml-2 text-xs text-red-500">{throttleHint || hint}</span>
      )}
    </div>
  );
} 