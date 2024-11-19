import { NextResponse } from 'next/server';
import { getKeyPairAndAddressInfo } from '@/../../backend/utxo-script/index.js';
import { ADDRESS_ERRORS } from '@/constants/errors';

export async function POST(request) {
  try {
    const { encryptedKey, network, scriptType } = await request.json();
    
    const result = await getKeyPairAndAddressInfo(encryptedKey, network, scriptType);

    if (!result || !result.address) {
      return NextResponse.json({
        success: false,
        ...ADDRESS_ERRORS.utxo.PARSE_ERROR
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        address: result.address
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      ...ADDRESS_ERRORS.utxo.PARSE_ERROR
    });
  }
} 