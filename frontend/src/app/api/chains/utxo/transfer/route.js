import { NextResponse } from 'next/server';
import { transfer } from '@/../../backend/utxo-script/index.js';

export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            enMnemonicOrWif,  // 加密的助记词
            toData,           // 转账地址和金额列表
            network,          // 网络
            gas,             // 已经计算好的 gas 值
            scriptType,       // 脚本类型
            filterAmount     // UTXO 过滤金额
        } = body;

        // 调用后端转账函数
        // 参数 { enBtcMnemonicOrWif, toData, chain = 'btc', gas, filterMinUTXOSize = 10000, scriptType = 'P2TR' }
        const result = await transfer({
            enBtcMnemonicOrWif:enMnemonicOrWif,
            toData,
            chain: network,
            gas,
            filterMinUTXOSize: filterAmount,
            scriptType
        });

        if (!result) {
            throw new Error('转账失败，请检查输入');
        }

        return NextResponse.json({
            success: true,
            txid: result.txid
        });
    } catch (error) {
        console.error('\n========== UTXO Transfer Error ==========');
        console.error('Time:', new Date().toISOString());
        console.error('Error:', error);
        console.error('==========================================\n');

        return NextResponse.json(
            { success: false, error: error.message || '转账失败，请重试' },
            { status: 500 }
        );
    }
} 