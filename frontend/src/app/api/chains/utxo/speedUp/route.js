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

    return NextResponse.json({
      success: true,
      txid: result?.txid
    });

  } catch (error) {
    console.error('SpeedUp error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}