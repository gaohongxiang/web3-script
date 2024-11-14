import { NextResponse } from 'next/server';
import { speedUp } from '@/../../backend/utxo-script/index.js';

export async function POST(request) {
  try {
    const {
      txid,
      enMnemonicOrWif,
      network,
      gas,
      scriptType,
      selectedUtxos
    } = await request.json();

    // 调用后端的 speedUp 函数
    const result = await speedUp({
      enBtcMnemonicOrWif: enMnemonicOrWif,
      txid,
      chain: network,
      gas: parseInt(gas),
      UTXOs: selectedUtxos,
      scriptType
    });

    // 如果后端返回 null，说明加速失败
    if (!result || !result.newTxid) {
      return NextResponse.json({
        success: false,
        error: '加速失败，请重试'
      });
    }

    return NextResponse.json({
      success: true,
      newTxid: result.newTxid
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || '加速失败，请重试'
    });
  }
}