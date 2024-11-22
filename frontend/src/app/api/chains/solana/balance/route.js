import { NextResponse } from 'next/server';
import { getBalance } from '@/../../backend/sol-script/index.js';
import { ADDRESS_ERRORS } from '@/constants/errors';

export async function POST(request) {
  try {
    const { address, token, tokenAddr } = await request.json();
    
    if (!address) {
      return NextResponse.json({
        success: false,
        message: ADDRESS_ERRORS.BALANCE_ERROR.message,
        retryable: false
      });
    }

    const result = await getBalance({ address, token, tokenAddr });

    // Handle null or undefined result
    if (result === null || result === undefined) {
      return NextResponse.json({
        success: false,
        message: ADDRESS_ERRORS.BALANCE_ERROR.message,
        retryable: true
      });
    }

    return NextResponse.json({
      success: true,
      data: { 
        balance: result.balance?.toString() || '0',
        balanceSat: result.balanceSat?.toString() || '0',
        token,
        tokenAddr 
      }
    });

  } catch (error) {
    console.error('获取余额时出错:', error);
    return NextResponse.json({
      success: false,
      message: ADDRESS_ERRORS.NETWORK_ERROR.message,
      retryable: true
    });
  }
} 