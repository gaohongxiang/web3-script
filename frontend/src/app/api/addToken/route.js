// frontend/src/app/api/tokens/add/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { chain, token, symbol } = await request.json();
    
    // 读取现有的 token.json，保持原始字符串
    const tokenJsonPath = path.resolve(process.cwd(), '../data/token.json');
    const content = fs.readFileSync(tokenJsonPath, 'utf8');
    
    // 找到对应链区块的结束位置
    const chainStart = content.indexOf(`"${chain}": {`);
    const chainBlock = content.slice(chainStart);
    const chainEndMatch = chainBlock.match(/\n    }/);
    const chainEnd = chainStart + chainEndMatch.index;
    
    // 格式化新token
    const newToken = `,\n        "${symbol}": {\n` +
                    `            "address":"${token.address}",\n` +
                    `            "decimals":"${token.decimals}"\n` +
                    `        }`;
    
    // 拼接内容
    const newContent = content.slice(0, chainEnd) + 
                      newToken + 
                      content.slice(chainEnd);
    
    fs.writeFileSync(tokenJsonPath, newContent);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}