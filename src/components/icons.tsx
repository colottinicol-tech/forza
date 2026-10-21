// Icone della tab bar (tratto semplice, colore preso dal testo).
import type { ReactNode } from 'react'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconToday = () => (
  <Icon>
    <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
  </Icon>
)

export const IconProgram = () => (
  <Icon>
    <path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10" />
    <circle cx="5" cy="6.5" r="1" fill="currentColor" />
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="5" cy="17.5" r="1" fill="currentColor" />
  </Icon>
)

export const IconHistory = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
)

export const IconProgress = () => (
  <Icon>
    <path d="M4 20h16" />
    <path d="M4.5 15.5l5-5 4 3 6.5-7.5" />
  </Icon>
)

export const IconSettings = () => (
  <Icon>
    <path d="M4 7h9M19 7h1M4 17h3M13 17h7" />
    <circle cx="16" cy="7" r="2.5" />
    <circle cx="10" cy="17" r="2.5" />
  </Icon>
)
