'use client';

import TabLayout from '@/components/TabLayout';
import TransferPage from './transfer/page';
import SpeedUpPage from './speedUp/page';
import SplitPage from './split/page';

export default function UTXOPage() {
  const tabs = [
    { id: 'transfer', name: '转账', component: <TransferPage /> },
    { id: 'speedUp', name: '加速交易', component: <SpeedUpPage /> },
    { id: 'split', name: '拆UTXO', component: <SplitPage /> }
  ];

  return (
    <TabLayout 
      title="UTXO 工具"
      description="BTC 等 UTXO 类型公链系列操作"
      tabs={tabs}
    />
  );
}