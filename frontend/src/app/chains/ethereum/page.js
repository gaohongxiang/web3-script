import TabLayout from '@/components/common/TabLayout';
import Transfer from './components/Transfer';
import Approve from './components/Approve';

export default function EthereumPage() {
  const tabs = [
    { id: 'transfer', name: '转账', component: <Transfer /> },
    { id: 'approve', name: '授权', component: <Approve /> }
  ];

  return (
    <TabLayout 
      title="以太坊工具"
      description="ETH 等 EVM 链操作"
      tabs={tabs}
    />
  );
} 