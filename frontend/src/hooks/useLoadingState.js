import { useState, useCallback, useRef } from 'react';

export function useLoadingState(initialState = null, options = {}) {
  const [data, setData] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hint, setHint] = useState('');
  const [autoRetry, setAutoRetry] = useState(true);
  const lastExecuteTime = useRef(0);
  const currentFunction = useRef(null);

  const throttleTime = options.throttleTime || 3000;
  const timeout = options.timeout || 15000;

  // 检查是否可以执行
  const canExecute = useCallback(() => {
    const now = Date.now();
    const timeLeft = throttleTime - (now - lastExecuteTime.current);
    return timeLeft <= 0 ? true : timeLeft;
  }, [throttleTime]);

  // 重置状态
  const resetRetry = useCallback(() => {
    setAutoRetry(true);
    setHint('');
  }, []);

  // 取消自动重试
  const cancelAutoRetry = useCallback(() => {
    setAutoRetry(false);
    setHint('');
  }, []);

  // 执行函数
  const execute = useCallback(async (asyncFunction, clearData = true) => {
    currentFunction.current = asyncFunction;
    let countDown;
    
    const checkResult = canExecute();
    if (checkResult !== true) {
      let seconds = Math.ceil(checkResult / 1000);
      if (autoRetry) {
        // 创建倒计时
        countDown = setInterval(() => {
          seconds--;
          if (seconds > 0) {
            setHint(`${seconds}秒后自动验证...`);
          } else {
            clearInterval(countDown);
          }
        }, 1000);

        setHint(`${seconds}秒后自动验证...`);
        setTimeout(() => {
          clearInterval(countDown);
          execute(currentFunction.current, clearData);
        }, checkResult);
      } else {
        setHint(`请等待 ${seconds} 秒后再试`);
      }
      return {
        success: false,
        error: '请求过于频繁',
        type: 'THROTTLE'
      };
    }

    setLoading(true);
    setError(null);
    if (clearData) {
      setData(null);
    }
    
    try {
      const startTime = Date.now();

      // 添加超时处理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('请求超时，请重试')), timeout);
      });

      // 使用 Promise.race 竞争
      const result = await Promise.race([
        asyncFunction(),
        timeoutPromise
      ]);

      lastExecuteTime.current = Date.now();

      // 确保最少显示 300ms 的加载状态
      const elapsed = Date.now() - startTime;
      if (elapsed < 300) {
        await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
      }

      setData(result);
      resetRetry();
      if (countDown) {
        clearInterval(countDown);
      }
      return result;
    } catch (error) {
      setError(error.message || options.errorMessage || '操作失败');
      if (error.timeLeft) {
        const seconds = Math.ceil(error.timeLeft / 1000);
        if (autoRetry) {
          setHint(`${seconds}秒后自动验证...`);
          setTimeout(() => {
            execute(currentFunction.current, clearData);
          }, seconds * 1000);
        } else {
          setHint(`请等待 ${seconds} 秒后再试`);
        }
      } else if (error.message === '请求超时，请重试' && autoRetry) {
        setHint(`请求超时，1秒后自动重试...`);
        setTimeout(() => {
          execute(currentFunction.current, clearData);
        }, 1000);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [canExecute, options.errorMessage, autoRetry, timeout]);

  // 手动重试
  const retry = useCallback(async (clearData = true) => {
    if (currentFunction.current) {
      return execute(currentFunction.current, clearData);
    }
  }, [execute]);

  return {
    data,
    loading,
    error,
    hint,
    autoRetry,
    execute,
    retry,
    setData,
    resetRetry,
    cancelAutoRetry
  };
} 