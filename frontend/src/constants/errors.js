export const ADDRESS_ERRORS = {
  PARSE_ERROR: {
    type: 'PARSE_ERROR',
    utxo: {
      message: '解析地址失败，请输入正确的加密助记词或私钥'
    },
    solana: {
      message: '解析地址失败，请输入正确的加密私钥'
    }
  },
  BALANCE_ERROR: {
    type: 'BALANCE_ERROR',
    message: '获取余额失败，请重试'
  },
  NETWORK_ERROR: {
    type: 'NETWORK_ERROR',
    message: '网络错误，请重试'
  }
};

export const TX_ERRORS = {
  NOT_FOUND: {
    type: 'NOT_FOUND',
    message: '交易不存在，请检查网络或交易ID是否正确'
  }
};

export const UTXO_ERRORS = {
  FETCH_ERROR: {
    type: 'FETCH_ERROR',
    message: '获取UTXO失败，请重试'
  },
  NETWORK_ERROR: {
    type: 'NETWORK_ERROR',
    message: '网络错误，请重试'
  }
};

export const GAS_ERRORS = {
  FETCH_ERROR: {
    type: 'FETCH_ERROR',
    message: '获取费率失败，请重试'
  },
  NETWORK_ERROR: {
    type: 'NETWORK_ERROR',
    message: '网络错误，请重试'
  }
}; 