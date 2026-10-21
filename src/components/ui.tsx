// Mattoncini dell'interfaccia in stile iOS: titolo grande, liste raggruppate, righe.
import type { ReactNode } from 'react'

export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section>
      <header className="px-4 pt-3 pb-2">
        {subtitle && <p className="text-[13px] font-semibold uppercase tracking-wide text-label-2">{subtitle}</p>}
        <h1 className="text-[34px] leading-[41px] font-bold tracking-tight">{title}</h1>
      </header>
      <div className="flex flex-col gap-7 pb-6">{children}</div>
    </section>
  )
}

export function Group({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  return (
    <div>
      {header && <h2 className="px-8 pb-1.5 text-[13px] uppercase text-label-2">{header}</h2>}
      <div className="mx-4 overflow-hidden rounded-[10px] bg-card">{children}</div>
      {footer && <p className="px-8 pt-1.5 text-[13px] text-label-2">{footer}</p>}
    </div>
  )
}

/** Riga di una lista raggruppata, con separatore rientrato come su iOS. */
export function Row({ title, detail, children }: { title: ReactNode; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pl-4 [&:first-child>div]:border-t-0">
      <div className="flex min-h-11 items-center justify-between gap-3 border-t-[0.5px] border-sep py-2.5 pr-4">
        <span>{title}</span>
        {detail !== undefined && <span className="text-right text-label-2">{detail}</span>}
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-6 py-8 text-center">
      <p className="text-[17px] font-semibold">{title}</p>
      <p className="mt-1 text-[15px] text-label-2">{text}</p>
    </div>
  )
}
