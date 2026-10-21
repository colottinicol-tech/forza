// Tab bar fissa in basso, sopra l'indicatore Home dell'iPhone.
import type { ComponentType } from 'react'
import { IconHistory, IconProgram, IconProgress, IconSettings, IconToday } from './icons'

export const TABS = [
  { id: 'oggi', label: 'Oggi', Icon: IconToday },
  { id: 'programma', label: 'Programma', Icon: IconProgram },
  { id: 'storico', label: 'Storico', Icon: IconHistory },
  { id: 'progressi', label: 'Progressi', Icon: IconProgress },
  { id: 'impostazioni', label: 'Impostazioni', Icon: IconSettings },
] as const satisfies readonly { id: string; label: string; Icon: ComponentType }[]

export type TabId = (typeof TABS)[number]['id']

export function TabBar({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t-[0.5px] border-sep bg-bar backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex px-[env(safe-area-inset-left)]">
        {TABS.map(({ id, label, Icon }) => (
          <li key={id} className="flex-1">
            <button
              type="button"
              onClick={() => onSelect(id)}
              aria-current={active === id ? 'page' : undefined}
              className={`flex h-[50px] w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active === id ? 'text-accent' : 'text-label-2'
              }`}
            >
              <Icon />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
