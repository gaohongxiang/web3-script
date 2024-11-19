import { NextResponse } from 'next/server';
import { getKeyPairAndAddress } from '@/../../backend/sol-script/index.js';
import { ADDRESS_ERRORS } from '@/constants/errors';

export async function POST(request) {
  try {
    const { encryptedKey } = await request.json();
    const result = await getKeyPairAndAddress(encryptedKey);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('解析地址时出错:', error);
    return NextResponse.json({
      success: false,
      message: ADDRESS_ERRORS.PARSE_ERROR.solana.message
    }, { status: 500 });
  }
}