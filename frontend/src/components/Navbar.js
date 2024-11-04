'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState(null);

  const navItems = {
    'UTXO': {
      items: [
        { name: '转账', href: '/utxo/transfer' },
        { name: '加速交易', href: '/utxo/speedUp' },
        { name: '拆分UTXO', href: '/utxo/split' }
      ]
    },
    'Solana': {
      items: [
        { name: '转账', href: '/solana/transfer' },
        { name: 'SPL Token', href: '/solana/spl' }
      ]
    },
    'Ethereum': {
      items: [
        { name: '转账', href: '/ethereum/transfer' },
        { name: 'ERC20', href: '/ethereum/erc20' }
      ]
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold">
            Web3 Scripts
          </Link>

          {/* Navigation Items */}
          <div className="flex space-x-1">
            {Object.entries(navItems).map(([category, { items }]) => (
              <div 
                key={category}
                className="relative"
                onMouseEnter={() => setActiveDropdown(category)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  className={`px-4 py-2 rounded-md hover:bg-gray-800 ${
                    activeDropdown === category ? 'bg-gray-800' : ''
                  }`}
                >
                  {category}
                </button>

                {/* Dropdown Menu */}
                {activeDropdown === category && (
                  <div className="absolute top-full left-0 w-48 py-2 mt-1 bg-gray-900 rounded-md shadow-xl border border-gray-800">
                    {items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-4 py-2 hover:bg-gray-800 ${
                          pathname === item.href ? 'bg-blue-600' : ''
                        }`}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right Side Links */}
          <div className="flex items-center space-x-4">
            <Link href="/docs" className="text-gray-300 hover:text-white">
              文档
            </Link>
            <Link 
              href="https://github.com/your-repo" 
              target="_blank"
              className="text-gray-300 hover:text-white"
            >
              GitHub
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
} 