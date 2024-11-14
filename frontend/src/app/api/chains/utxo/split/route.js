import { NextResponse } from 'next/server';
import { splitUTXO } from '@/../../backend/utxo-script/index.js';


export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      enBtcMnemonicOrWif,
      chain,
      selectedUtxos,
      splitNum,
      gas,
      scriptType
    } = body;

    // 调用后端 API
    // { enBtcMnemonicOrWif, chain = 'btc', selectedUtxos, splitNum = 3, gas, scriptType = 'P2TR' }
    const result = await splitUTXO({
        enBtcMnemonicOrWif,
        chain,
        selectedUtxos,
        splitNum,
        gas,
        scriptType
    });

    if (!result || !result.txid) {
        return NextResponse.json({
            success: false,
            error: '拆分失败，请重试'
        });
    }

    return NextResponse.json({
        success: true,
        txid: result.txid
    });

  } catch (error) {
    console.error('Split UTXO error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '拆分失败，请重试'
    });
  }
}
