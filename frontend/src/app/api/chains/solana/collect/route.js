import { NextResponse } from 'next/server';
import { consolidateFunds } from '@/../../backend/sol-script/index.js';

export async function POST(request) {
  try {
    const { addressList, selectedToken, receiverList } = await request.json();
   
    // 验证必要参数
    if (!addressList?.length || !selectedToken || !receiverList?.[0]) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      });
    }

    // 调用归集函数
    const result = await consolidateFunds({
      fromData: addressList,
      toAddress: receiverList[0][0],
      tokenInfo: {
        ...selectedToken,
        address: selectedToken.mint // 后端使用 address 而不是 mint
      }
    });

    // 检查 result 是否为 null
    if (!result) {
      return NextResponse.json({
        success: false,
        error: '归集失败，没有可归集的余额或交易失败'
      });
    }

    return NextResponse.json({
      success: true,
      txid: result.txid
    });

  } catch (error) {
    console.error('Collect error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '归集失败'
    });
  }
}
