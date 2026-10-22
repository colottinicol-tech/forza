// Tab bar in stile iOS 26: una "pillola" di vetro che galleggia sopra il fondo dello schermo.
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

/** Spazio da lasciare in fondo al contenuto perché la barra non copra niente. */
export const TAB_BAR_SPACE = 'calc(max(12px, env(safe-area-inset-bottom) - 13px) + 62px + 16px)'

export function TabBar({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) {
  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-5"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom) - 13px)' }}
    >
      <ul className="glass pointer-events-auto flex h-[62px] w-full max-w-[440px] items-center rounded-full p-1">
        {TABS.map(({ id, label, Icon }) => {
          const selected = active === id
          return (
            <li key={id} className="h-full flex-1">
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={selected ? 'page' : undefined}
                className={`flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                  selected ? 'glass-active text-accent' : 'text-label'
                }`}
              >
                <Icon />
                <span className="max-w-full truncate px-0.5">{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
