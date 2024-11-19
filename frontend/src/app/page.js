'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Web3 脚本工具</h1>
          <p className="text-gray-600 text-lg">
            简单、安全的区块链工具集合
          </p>
        </div>

        <div className="grid gap-6">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold mb-4">开始使用</h2>
            <p className="text-gray-600 mb-4">
              选择左侧导航栏中的工具开始使用。每个工具都有详细的使用说明。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* UTXO 工具 */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-xl font-semibold mb-4">UTXO Scripts</h2>
              <div className="space-y-3">
                <Link 
                  href="/chains/utxo"
                  className="block px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <h3 className="font-medium mb-1">UTXO 工具</h3>
                  <p className="text-sm text-gray-600">BTC 等 UTXO 类型公链系列操作</p>
                </Link>
              </div>
            </div>

            {/* Solana 工具 */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-xl font-semibold mb-4">Solana Scripts</h2>
              <div className="space-y-3">
                <Link 
                  href="/chains/solana"
                  className="block px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <h3 className="font-medium mb-1">Solana 工具</h3>
                  <p className="text-sm text-gray-600">Solana 公链系列操作</p>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-12 text-center">
          <p className="text-gray-600">
            开源项目 • 
            <a 
              href="https://github.com/your-repo" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-500 ml-1"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 