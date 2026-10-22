// Mattoncini dell'interfaccia in stile iOS: barra del titolo, titolo grande, liste raggruppate, righe.
import { useEffect, useState, type ReactNode } from 'react'

/** Altezza della barra del titolo (come UINavigationBar). Lo spazio lo lascia App, sotto la safe area. */
export const NAV_BAR_HEIGHT = 44

/** Freccia di iOS: grande per «‹ Indietro», piccola (›) a fine riga nelle liste. */
export function Chevron({ direction = 'left', small = false }: { direction?: 'left' | 'right'; small?: boolean }) {
  return (
    <svg width={small ? 8 : 12} height={small ? 13 : 20} viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'left' ? 'M10 2 2 10l8 8' : 'M2 2l8 8-8 8'} />
    </svg>
  )
}

/**
 * Schermata con titolo grande. Quando scorri, il titolo piccolo compare al centro della barra in alto,
 * che diventa sfocata (come nelle app di Apple). `back` mostra «‹ Indietro» a sinistra.
 */
export function Screen({
  title,
  subtitle,
  back,
  trailing,
  children,
}: {
  title: string
  subtitle?: string
  back?: { label: string; onClick: () => void }
  trailing?: ReactNode
  children: ReactNode
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section>
      <div
        className={`fixed inset-x-0 top-0 z-30 transition-colors duration-200 ${scrolled ? 'border-b-[0.5px] border-sep bg-bar backdrop-blur-xl' : ''}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2" style={{ height: NAV_BAR_HEIGHT }}>
          <div className="min-w-0">
            {back && (
              <button type="button" onClick={back.onClick} className="flex min-h-11 items-center gap-1.5 px-2 text-[17px] text-accent active:opacity-50">
                <Chevron />
                <span className="truncate">{back.label}</span>
              </button>
            )}
          </div>
          <p className={`max-w-[55vw] truncate text-[17px] font-semibold transition-opacity duration-200 ${scrolled ? 'opacity-100' : 'opacity-0'}`}>
            {title}
          </p>
          <div className="flex min-w-0 justify-end">{trailing}</div>
        </div>
      </div>
      <header className="px-4 pt-1 pb-2">
        <h1 className="text-[34px] leading-[41px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-label-2">{subtitle}</p>}
      </header>
      <div className="flex flex-col gap-7 pb-6">{children}</div>
    </section>
  )
}

export function Group({ header, footer, children }: { header?: ReactNode; footer?: string; children: ReactNode }) {
  return (
    <div>
      {header && <h2 className="px-8 pb-1.5 text-[13px] text-label-2 uppercase">{header}</h2>}
      <div className="mx-4 overflow-hidden rounded-[20px] bg-card">{children}</div>
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
