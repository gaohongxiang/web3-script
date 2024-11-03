import { UtxoProvider } from '@/contexts/chains/utxo/UtxoContext';

export default function UTXOLayout({ children }) {
  return (
    <UtxoProvider>
      {children}
    </UtxoProvider>
  );
} 