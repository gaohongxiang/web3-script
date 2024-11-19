import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'

export function Select({ value, onChange, options, placeholder, disabled }) {
  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className="relative">
        <Listbox.Button className={`
          relative w-full px-4 py-2 text-sm text-left
          border border-gray-300 rounded-lg
          focus:outline-none focus:ring-1
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'focus:ring-blue-500'}
        `}>
          <span className={`block truncate ${!value ? 'text-gray-400' : ''}`}>
            {value?.label || placeholder}
          </span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2">
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="none" stroke="currentColor">
              <path d="M7 7l3-3 3 3m0 6l-3 3-3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </Listbox.Button>
        
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="
            absolute z-10 w-full py-1 mt-1
            bg-white rounded-lg shadow-lg
            border border-gray-200
            focus:outline-none
            max-h-60 overflow-auto
          ">
            {options.map((option) => (
              <Listbox.Option
                key={option.value}
                value={option}
                className={({ active }) => `
                  relative cursor-pointer select-none py-2 px-4
                  ${active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}
                `}
              >
                {({ selected }) => (
                  <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                    {option.label}
                  </span>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  )
} 