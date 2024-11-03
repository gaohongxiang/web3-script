'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-gray-800 text-white p-4">
      <h1 className="text-xl font-bold mb-8">Web3 Scripts</h1>
      
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">UTXO Scripts</h2>
          <nav className="space-y-2">
            <Link 
              href="/utxo/transfer"
              className={`block px-4 py-2 rounded ${
                pathname === '/utxo/transfer' 
                  ? 'bg-blue-600' 
                  : 'hover:bg-gray-700'
              }`}
            >
              转账
            </Link>
            <Link 
              href="/utxo/speedup"
              className={`block px-4 py-2 rounded ${
                pathname === '/utxo/speedup' 
                  ? 'bg-blue-600' 
                  : 'hover:bg-gray-700'
              }`}
            >
              加速
            </Link>
          </nav>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">Solana Scripts</h2>
          <nav className="space-y-2">
            <Link 
              href="/solana/transfer"
              className={`block px-4 py-2 rounded ${
                pathname === '/solana/transfer' 
                  ? 'bg-blue-600' 
                  : 'hover:bg-gray-700'
              }`}
            >
              转账
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 