'use client';

import { useState } from 'react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function TabLayout({ title, description, tabs }) {
  const [selectedTab, setSelectedTab] = useState(tabs[0]?.id);

  const renderContent = () => {
    const tab = tabs.find(t => t.id === selectedTab);
    return tab ? tab.component : null;
  };

  return (
    <div className="container mx-auto px-4 min-h-[calc(100vh-theme(spacing.14))] pt-6">
      <div className="max-w-4xl mx-auto">
        {/* 工具介绍 */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-medium mb-2">{title}</h3>
          <p className="text-base text-gray-600">{description}</p>
        </div>

        {/* 主要内容区域 */}
        <div className="flex flex-col">
          {/* 选项卡 */}
          <div className="relative flex">
            <div className="flex">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={classNames(
                    'w-28 px-4 py-2 text-sm border-t border-l border-r border-gray-300 text-center',
                    'focus:outline-none relative transition-colors',
                    index === 0 ? 'rounded-tl-lg' : '',
                    index === tabs.length - 1 ? 'rounded-tr-lg' : '',
                    selectedTab === tab.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                  )}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* 表单内容区域 */}
          <div className="border-t border-l border-r border-b border-gray-300 rounded-lg rounded-tl-none bg-white p-5">
            <form className="space-y-5">
              {renderContent()}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 