import { NextResponse } from 'next/server';
import { parseToken } from '@/../../backend/crypt-module/onepassword.js';
import 'dotenv/config';

export async function GET(request) {
  try {
    const token = await parseToken(process.env.parseToken);
    
    // 同时设置环境变量
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