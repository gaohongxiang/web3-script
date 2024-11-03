import { NextResponse } from 'next/server';
import { getKeyPairAndAddressInfo } from '@/../../backend/utxo-script/index.js';

export async function POST(request) {
  try {
    const { encryptedKey, network, scriptType } = await request.json();
    const result = await getKeyPairAndAddressInfo(encryptedKey, network, scriptType);
    return NextResponse.json({
      success: true,
      address: result.address
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
} 