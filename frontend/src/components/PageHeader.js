'use client';

import { usePathname } from 'next/navigation';

const pageInfo = {
  '/chains/utxo/transfer': {
    title: 'UTXO 工具',
    description: 'BTC 等 UTXO 类型公链系列操作'
  },
  '/chains/utxo/speedup': {
    title: 'UTXO 工具',
    description: 'BTC 等 UTXO 类型公链系列操作'
  },
  '/chains/utxo/split': {
    title: 'UTXO 工具',
    description: 'BTC 等 UTXO 类型公链系列操作'
  },
  '/chains/solana/transfer': {
    title: 'Solana 工具',
    description: 'Solana 公链系列操作'
  },
  '/chains/solana/spl': {
    title: 'Solana 工具',
    description: 'Solana 公链系列操作'
  }
};

export function PageHeader() {
  const pathname = usePathname();
  const info = pageInfo[pathname];

  if (!info) return null;

  return (
    <div className="container mx-auto px-4">
      <div className="max-w-4xl mx-auto py-4 text-center">
        <h3 className="font-medium mb-1">{info.title}</h3>
        <p className="text-sm text-gray-600">{info.description}</p>
      </div>
    </div>
  );
} 