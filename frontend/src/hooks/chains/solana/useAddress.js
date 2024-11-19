'use client';

import { useCallback } from 'react';
import { ADDRESS_ERRORS } from '@/constants/errors';
import { useSolanaContext } from '@/contexts/chains/solana/SolanaContext';

// 验证 Solana 地址格式
export const isValidSolanaAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  
  // 检查长度
  if (address.length !== 44) return false;
  
  // 检查字符集 (Base58)
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return base58Regex.test(address);
};

// 验证转账金额 (包含租金验证)
export const validateTransferAmount = async (receivers, currentBalance, selectedToken) => {
  if (!receivers?.length) return { isValid: true };

  const ACCOUNT_RENT = 0.001;
  const totalAmount = receivers.reduce((total, [_, amount]) => {
    if (isNaN(amount)) return total;
    return total + amount;
  }, 0);

  const isSOL = selectedToken?.symbol === 'SOL';

  if (isSOL) {
    const requiredRent = (receivers.length + 1) * ACCOUNT_RENT;
    const totalRequired = totalAmount + requiredRent;

    if (totalRequired > currentBalance) {
      return {
        isValid: false,
        error: `总转账金额 ${totalAmount} SOL + 所需租金 ${requiredRent} SOL(${receivers.length + 1}个账户) 超出当前余额 ${currentBalance} SOL`
      };
    }
  } else {
    // 代币转账
    if (totalAmount > currentBalance) {
      return {
        isValid: false,
        error: `总转账金额 ${totalAmount} ${selectedToken.symbol} 超出当前余额 ${currentBalance} ${selectedToken.symbol}`
      };
    }
    
    // 获取 SOL 余额
    const solResult = await getBalance(addressList[0].address, { token: 'SOL', tokenAddr:'So11111111111111111111111111111111111111112' });
    const solBalance = solResult.success ? parseFloat(solResult.data.balance) : 0;
    
    const requiredRent = receivers.length * ACCOUNT_RENT;
    if (solBalance < requiredRent) {
      return {
        isValid: false,
        error: `SOL 余额不足以支付租金，需要 ${requiredRent} SOL (${receivers.length}个接收账户)`
      };
    }
  }

  return { isValid: true };
};

export function useAddress() {
  const { selectedToken } = useSolanaContext();
  
  const getAddress = useCallback(async (encryptedKey) => {
    try {
      const response = await fetch('/api/chains/solana/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedKey })
      });

      if (response.status === 500) {
        return {
          success: false,
          message: ADDRESS_ERRORS.NETWORK_ERROR.message,
          retryable: true
        };
      }

      const result = await response.json();
      if (!result || !result.address) {
        return {
          success: false,
          message: ADDRESS_ERRORS.PARSE_ERROR.solana.message,
          retryable: false
        };
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: ADDRESS_ERRORS.NETWORK_ERROR.message,
        retryable: true
      };
    }
  }, []);

  const getBalance = useCallback(async (address, { token, tokenAddr }) => {
    try {
      const response = await fetch('/api/chains/solana/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, token, tokenAddr })
      });

      if (!response.ok) {
        return {
          success: false,
          message: ADDRESS_ERRORS.NETWORK_ERROR.message,
          retryable: true
        };
      }

      const result = await response.json();

      if (!result.success) {
        return result;
      }

      if (!result.data || result.data.balance === undefined) {
        return {
          success: false,
          message: ADDRESS_ERRORS.BALANCE_ERROR.message,
          retryable: true
        };
      }

      const balance = result.data.balance?.toString() || '0';
      
      return {
        success: true,
        data: { balance }
      };

    } catch (error) {
      console.error('获取余额错误:', error);
      return {
        success: false,
        message: ADDRESS_ERRORS.NETWORK_ERROR.message,
        retryable: true
      };
    }
  }, []);

  return { isValidSolanaAddress, getAddress, getBalance };
}