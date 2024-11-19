import { SolanaProvider } from '@/contexts/chains/solana/SolanaContext';

export default function SolanaLayout({ children }) {
  return (
    <SolanaProvider>
      {children}
    </SolanaProvider>
  );
} 