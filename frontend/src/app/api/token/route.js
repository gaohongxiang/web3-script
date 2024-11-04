import { NextResponse } from 'next/server';
import { parseToken } from '@/../../backend/crypt-module/onepassword.js';

export async function GET(request) {
  try {
    // 直接使用 Next.js 的环境变量
    const token = await parseToken(process.env.personalToken);
    process.env.KEY = token;
    
    return NextResponse.json({ 
      success: true,
      message: 'Token has been set successfully'
    });
  } catch (error) {
    console.error('Get token error:', error);
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
} 