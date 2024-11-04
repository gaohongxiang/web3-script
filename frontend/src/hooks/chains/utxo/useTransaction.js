'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';
import { getCacheKey, getCache, setCache } from '@/utils/cache';

// 不同脚本类型的大小（vBytes）
const SCRIPT_SIZES = {
  P2PKH: {
    base: 10,
    input: 148,
    output: 34
  },
  P2WPKH: {
    base: 10.5,
    input: 68,
    output: 31
  },
  P2TR: {
    base: 10.5,
    input: 57.5,
    output: 43
  }
};

// 验证交易ID格式
const isValidTxid = (txid) => {
  return /^[a-fA-F0-9]{64}$/.test(txid);
};

export function useTransaction() {
  const { network } = useUtxoContext();
  const timeoutRef = useRef();

  // 获取交易信息的基础函数
  const getTransactionInfo = useCallback(async (txid) => {
    if (!txid) {
      return {
        success: false,
        error: '请输入交易ID'
      };
    }

    // 添加格式验证
    if (!isValidTxid(txid)) {
      return {
        success: false,
        error: '交易ID格式不正确，应为64位十六进制字符'
      };
    }

    try {
      // 检查缓存
      const cacheKey = getCacheKey('transactions', network, txid);
      const cachedTx = getCache('transactions', cacheKey);
      if (cachedTx) {
        return cachedTx;
      }

      const baseUrl = network === 'btc'
        ? 'https://mempool.space/api'
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/tx/${txid}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('交易不存在，请检查网络或交易ID是否正确');
        }
        throw new Error('获取交易失败');
      }

      const transaction = await response.json();

      // 使用 Set 来存储唯一地址
      let addresses = new Set();

      // 收集输入地址
      for (const vin of transaction.vin || []) {
        if (vin.prevout?.scriptpubkey_address) {
          addresses.add(vin.prevout.scriptpubkey_address);
        }
      }

      // 收集输出地址
      for (const vout of transaction.vout || []) {
        if (vout.scriptpubkey_address) {
          addresses.add(vout.scriptpubkey_address);
        }
      }

      const result = {
        success: true,
        addresses: addresses,
        feeRate: transaction.adjustedFeePerVsize,
        vsize: transaction.adjustedVsize,
        confirmed: transaction.status.confirmed,
        weight: transaction.weight,
        size: transaction.size,
        fee: transaction.fee
      };

      // 缓存结果
      setCache('transactions', cacheKey, result);
      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }, [network]);

  // 验证地址是否在交易中
  const validateAddressInTx = useCallback(async (txid, address) => {
    if (!address) {
      return {
        valid: false,
        error: '请输入地址'
      };
    }

    const txResult = await getTransactionInfo(txid);
    if (!txResult.success) {
      return {
        valid: false,
        error: txResult.error
      };
    }

    if (txResult.confirmed) {
      return {
        valid: false,
        error: '交易已确认，无需加速'
      };
    }

    return {
      valid: txResult.addresses.has(address),
      error: txResult.addresses.has(address) ? null : `地址 ${address} 不在交易 ${txid} 中，无法使用 CPFP 加速`,
      feeRate: txResult.feeRate,
      weight: txResult.weight,
      size: txResult.vsize,
      fee: txResult.fee
    };
  }, [getTransactionInfo]);

  // 计算加速费用
  const calculateAccelerateFee = useCallback((txInfo, newFeeRate, scriptType = 'P2TR', selectedUtxos = []) => {
    const feeRateDiff = Math.ceil(newFeeRate - txInfo.feeRate);
    
    if (feeRateDiff <= 0) {
      return {
        success: false,
        error: '新费率必须高于当前费率'
      };
    }

    // 计算子交易的 vBytes
    const sizes = SCRIPT_SIZES[scriptType];
    // 基础大小 + 输入大小 * 输入数量 + 输出大小 * 2（一个用于加速，一个用于找零）
    const childTxVBytes = Math.ceil(sizes.base + (sizes.input * selectedUtxos.length) + (sizes.output * 2));
    
    // 计算需要的聪数
    // 1. 子交易本身的费用
    const childTxFee = Math.ceil(childTxVBytes * newFeeRate);
    // 2. 父交易费率提升所需的费用
    const parentTxFee = Math.ceil(txInfo.vsize * feeRateDiff);

    return {
      success: true,
      feeRate: txInfo.feeRate,
      neededSats: Math.ceil(childTxFee + parentTxFee),
      details: {
        childTxFee: Math.ceil(childTxFee),
        parentTxFee: Math.ceil(parentTxFee),
        parentTxSize: txInfo.size,
        parentTxVsize: txInfo.vsize,
        childTxVsize: childTxVBytes,
        childTxInputCount: selectedUtxos.length
      }
    };
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    getTransactionInfo,
    validateAddressInTx,
    calculateAccelerateFee
  };
} 