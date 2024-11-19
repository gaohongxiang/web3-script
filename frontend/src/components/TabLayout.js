'use client';

import { useState } from 'react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function TabLayout({ title, description, tabs }) {
  const [selectedTab, setSelectedTab] = useState(tabs[0]?.id);
  const [selectedSubTab, setSelectedSubTab] = useState(tabs[0]?.subTabs?.[0]?.id);

  const renderContent = () => {
    const tab = tabs.find(t => t.id === selectedTab);
    if (!tab) return null;
    
    if (tab.subTabs) {
      const subTab = tab.subTabs.find(st => st.id === selectedSubTab);
      return subTab ? subTab.component : tab.subTabs[0]?.component;
    }
    
    return tab.component;
  };

  const currentTab = tabs.find(t => t.id === selectedTab);

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
          {/* 一级选项卡 */}
          <div className="relative flex">
            <div className="flex">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedTab(tab.id);
                    if (tab.subTabs) {
                      setSelectedSubTab(tab.subTabs[0]?.id);
                    }
                  }}
                  className={classNames(
                    'w-[112px] px-4 py-2 text-sm text-center border-t border-gray-300',
                    'focus:outline-none relative transition-colors',
                    index === 0 ? 'rounded-tl-lg border-l' : '',
                    index === tabs.length - 1 ? 'rounded-tr-lg border-r' : '',
                    index !== 0 ? 'border-l border-gray-300' : '',
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

          {/* 二级选项卡 */}
          {currentTab?.subTabs && (
            <div className="flex border-l border-gray-300 bg-white">
              {currentTab.subTabs.map((subTab, index) => (
                <button
                  key={subTab.id}
                  onClick={() => setSelectedSubTab(subTab.id)}
                  className={classNames(
                    'w-[112px] px-4 py-2 text-sm text-center border-t border-gray-300',
                    'focus:outline-none relative transition-colors',
                    index !== 0 ? 'border-l border-gray-300' : '',
                    index === currentTab.subTabs.length - 1 ? 'border-r border-gray-300 rounded-tr-lg' : '',
                    selectedSubTab === subTab.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-600 hover:text-blue-600'
                  )}
                >
                  {subTab.name}
                </button>
              ))}
            </div>
          )}

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