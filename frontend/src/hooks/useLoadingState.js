import { useState, useCallback } from 'react';

export function useLoadingState(initialState = null, options = {}) {
  const [data, setData] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (asyncFunction, ...params) => {
    setLoading(true);
    setError(null);

    try {
      const result = await asyncFunction(...params);
      setData(result);
      return result;
    } catch (error) {
      const errorMessage = options.errorMessage || '获取失败';
      setError(error.message || errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options.errorMessage]);

  const retry = useCallback(async (asyncFunction, ...params) => {
    return execute(asyncFunction, ...params);
  }, [execute]);

  return {
    data,
    loading,
    error,
    execute,
    retry,
    setData
  };
} 