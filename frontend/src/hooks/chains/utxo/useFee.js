'use client';

import { useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';

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

export function useFee() {
  const { scriptType } = useUtxoContext();  // 获取当前脚本类型

  // 计算交易大小（vBytes）
  const calculateTxSize = useCallback((inputCount, outputCount) => {
    const sizes = SCRIPT_SIZES[scriptType];  // 根据脚本类型获取对应的大小
    return Math.ceil(sizes.base + (sizes.input * inputCount) + (sizes.output * outputCount));
  }, [scriptType]);  // 依赖 scriptType

  // 计算交易费用（聪）
  const calculateFee = useCallback((inputCount, outputCount, feeRate) => {
    const vBytes = calculateTxSize(inputCount, outputCount);
    return Math.ceil(vBytes * feeRate);
  }, [calculateTxSize]);  // 依赖 calculateTxSize

  // 计算转账费用
  const calculateTransferFee = useCallback((receiverList, currentFeeRate, selectedUtxos) => {
    try {
      if (!receiverList?.length || !selectedUtxos.length || !currentFeeRate) {
        return {
          success: false,
          error: '缺少必要参数'
        };
      }

      // 计算选择的 UTXO 总金额
      const totalAmount = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

      // 计算接收地址总金额 - 现在处理数组格式
      const receiveAmount = receiverList.reduce((sum, [, amount]) => {
        return sum + (parseFloat(amount) * 100000000);  // 转换为聪
      }, 0);

      // 计算输出数量和费用
      const outputCount = receiverList.length;  // 直接使用数组长度

      let fee = calculateFee(
        selectedUtxos.length,  // 输入数量
        outputCount + 1,  // 输出数量（接收地址 + 找零）
        currentFeeRate
      );

      fee = fee + receiveAmount;

      // 返回结果，包含费用和金额比较结果
      return {
        success: totalAmount >= (fee),  // 只影响 success 状态
        fee,  // 始终返回计算出的费用
        receiveAmount,
        details: {
          totalAmount,
          receiveAmount,
          fee,
          remainingAmount: totalAmount - fee,
          inputCount: selectedUtxos.length,
          outputCount: outputCount + 1
        }
      };
    } catch (error) {
      return {
        success: false,
        error: '计算费用失败，请重试'
      };
    }
  }, [calculateFee]);

  // 计算加速费用
  const calculateSpeedUpFee = useCallback((txInfo, newFeeRate, selectedUtxos) => {
    try {

      if (!txInfo?.data) {  // 检查 txInfo.data
        return {
          success: false,
          error: 'Invalid transaction info'
        };
      }

      const feeRateDiff = newFeeRate - txInfo.data.feeRate;
      if (feeRateDiff <= 0) {
        return {
          success: false,
          error: '新费率必须高于当前费率'
        };
      }

      // 计算选择的 UTXO 总金额
      const totalAmount = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

      // 使用 useFee 计算子交易费用
      const childTxVBytes = calculateTxSize(selectedUtxos.length + 1, 2);
      const childTxFee = calculateFee(selectedUtxos.length + 1, 2, newFeeRate); // 输入：选择的utxo+未确认的1个，输出：未确认的1个和找零

      // 计算父交易费率提升所需的费用
      const parentTxFee = Math.ceil(txInfo.data.vsize * feeRateDiff);

      // 计算总费用
      const totalFee = Math.ceil(childTxFee + parentTxFee);

      // 检查 UTXO 金额是否足够
      if (totalAmount < totalFee) {
        return {
          success: false,
          error: '选择的UTXO金额不足以支付费用'
        };
      }

      const result = {
        success: true,
        feeRate: txInfo.data.feeRate,
        fee: totalFee,
        details: {
          childTxFee: Math.ceil(childTxFee),
          parentTxFee: Math.ceil(parentTxFee),
          parentTxSize: txInfo.data.size,
          parentTxVsize: txInfo.data.vsize,
          childTxVsize: childTxVBytes,
          childTxInputCount: selectedUtxos.length,
          totalAmount,
          remainingAmount: totalAmount - totalFee
        }
      };
      return result;

    } catch (error) {
      console.error('calculateSpeedUpFee error:', error);
      return {
        success: false,
        error: '计算费用失败，请重试'
      };
    }
  }, [calculateFee, calculateTxSize]);

  // 在现有的 useFee hook 中添加新的计算函数
  const calculateSplitFee = useCallback((parts, currentFeeRate, selectedUtxos) => {
    try {
      if (!selectedUtxos?.length || !parts || !currentFeeRate) {
        return {
          success: false,
          error: '缺少必要参数'
        };
      }

      // 计算选择的 UTXO 总金额
      const totalAmount = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

      // 计算交易大小：
      // 输入：所有选中的 UTXO 输出：拆分的份数（parts）
      const vsize = calculateTxSize(selectedUtxos.length, parts);
      const fee = calculateFee(selectedUtxos.length, parts, currentFeeRate);

      // 计算每份金额（总金额减去费用后平均分配）
      const amountPerPart = Math.floor((totalAmount - fee) / parts);

      // 检查每份金额是否大于 0
      if (amountPerPart <= 0) {
        return {
          success: false,
          error: '金额太小，无法完成拆分'
        };
      }

      return {
        success: true,
        fee,
        amountPerPart,
        details: {
          totalAmount,
          TxVsize:vsize,
          fee,
          amountPerPart,
          parts,
          inputCount: selectedUtxos.length,
          outputCount: parts,
          remainingAmount: totalAmount - fee - (amountPerPart * parts)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: '计算费用失败，请重试'
      };
    }
  }, [calculateFee]);

  return {
    calculateTxSize,
    calculateFee,
    calculateTransferFee,
    calculateSpeedUpFee,
    calculateSplitFee  // 添加新函数到返回值
  };
} 