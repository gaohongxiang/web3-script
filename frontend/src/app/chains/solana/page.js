'use client';

import TabLayout from '@/components/TabLayout';
import TransferPage from './transfer/page';
import CollectPage from './collect/page';

export default function SolanaPage() {
  const tabs = [
    { 
      id: 'transfer', 
      name: '转账',
      component: <TransferPage />
    },
    {
      id: 'collect',
      name: '归集',
      component: <CollectPage />
    }
  ];

  return (
    <TabLayout 
      title="Solana 工具"
      description="Solana 系列操作"
      tabs={tabs}
    />
  );
}