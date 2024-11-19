import { NextResponse } from 'next/server';
import { transfer } from '@/../../backend/sol-script/index.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      encryptedKey,
      selectedToken,
      receiverList,
    } = body;

    // 调用后端转账函数
    const result = await transfer({
      enPrivateKey: encryptedKey,
      toData: receiverList,
      token: selectedToken.symbol,
      tokenAddr: selectedToken.mint,
      tokenDecimals: selectedToken.decimals
    });

    if (!result) {
      throw new Error('转账失败，请重试');
    }

    return NextResponse.json({
      success: true,
      txid: result
    });

  } catch (error) {
    console.error('Transfer error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '转账失败，请重试'
    });
  }
} 