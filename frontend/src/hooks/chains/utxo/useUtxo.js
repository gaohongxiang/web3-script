'use client';

import { useCallback } from 'react';
import { useUtxoContext } from '@/contexts/chains/utxo/UtxoContext';

export function useUtxo() {
  const { network } = useUtxoContext();

  // 获取 UTXO 列表
  const getUtxos = useCallback(async (address) => {
    try {
      const baseUrl = network === 'btc' 
        ? 'https://mempool.space/api' 
        : 'https://mempool.fractalbitcoin.io/api';

      const response = await fetch(`${baseUrl}/address/${address}/utxo`);
      const utxos = await response.json();

      // 处理所有 UTXO
      const allUtxos = utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        status: utxo.status,
        block_height: utxo.status.block_height
      }));

      // 通过区块高度判断未确认的 UTXO
      const unconfirmedUtxos = allUtxos.filter(utxo => utxo.block_height === 0);

      return {
        success: true,
        data: {
          allUtxos,
          unconfirmedUtxos
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || '获取 UTXO 失败'
      };
    }
  }, [network]);

  // 本地过滤 UTXO
  const filterUtxos = useCallback((allUtxos, filterMinSize = 546) => {
    return allUtxos.filter(utxo => utxo.value >= filterMinSize);
  }, []);

  return { 
    getUtxos,
    filterUtxos
  };
}
