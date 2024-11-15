import { NextResponse } from 'next/server';
import { transfer } from '@/../../backend/utxo-script/index.js';

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            enBtcMnemonicOrWif,  // 加密的助记词
            toData,             // 转账地址和金额列表
            chain,              // 网络
            gas,                // 已经计算好的 gas 值
            selectedUtxos,     // UTXO 列表
            scriptType          // 脚本类型

        } = body;

        // 调用后端转账函数
        // 参数 { enBtcMnemonicOrWif, toData, chain = 'btc', gas, selectedUtxos, scriptType = 'P2TR' }
        const result = await transfer({
            enBtcMnemonicOrWif,
            toData,
            chain,
            gas,
            selectedUtxos,
            scriptType
        });

        if (!result || !result.txid) {
            return NextResponse.json({
                success: false,
                error: '转账失败，请重试'
            });
        }

        return NextResponse.json({
            success: true,
            txid: result.txid
        });
    } catch (error) {
        console.error('Transfer error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || '转账失败，请重试'
        });
    }
} 