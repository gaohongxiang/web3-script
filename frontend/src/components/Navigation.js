'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';

export function Navigation() {
  const pathname = usePathname();
  const isActive = (path) => pathname.startsWith(path);

  return (
    <nav>
      <div className="flex h-14">
        {/* Logo */}
        <div className="w-24 pl-8">
          <Link href="/" className="h-14 flex items-center">
            <Logo />
          </Link>
        </div>

        {/* 导航菜单 */}
        <div className="flex items-center space-x-8">
          {/* UTXO 下拉菜单 */}
          <div className="relative group">
            <button className={`h-14 flex items-center font-medium transition-colors ${
              isActive('/chains/utxo') 
                ? 'text-blue-600' 
                : 'text-gray-600 hover:text-gray-900'
            }`}>
              UTXO
            </button>
            <div className="absolute top-full left-0 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <Link 
                href="/chains/utxo" 
                className={`block px-4 py-2 first:rounded-t-lg ${
                  pathname === '/chains/utxo'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                UTXO 工具
              </Link>
            </div>
          </div>

          {/* Solana 下拉菜单 */}
          <div className="relative group">
            <button className={`h-14 flex items-center font-medium transition-colors ${
              isActive('/chains/solana') 
                ? 'text-blue-600' 
                : 'text-gray-600 hover:text-gray-900'
            }`}>
              Solana
            </button>
            <div className="absolute top-full left-0 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <Link 
                href="/chains/solana" 
                className={`block px-4 py-2 first:rounded-t-lg ${
                  pathname === '/chains/solana'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Solana工具
              </Link>
            </div>
          </div>
        </div>

        {/* 右侧链接 */}
        <div className="flex items-center space-x-4 ml-auto pr-8">
          <Link href="/docs" className="text-gray-600 hover:text-gray-900">
            文档
          </Link>
          <a 
            href="https://github.com/your-repo" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-gray-600 hover:text-gray-900"
          >
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
} 