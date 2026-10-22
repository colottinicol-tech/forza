// "Importa da Claude": formato del JSON (vedi PROGRAM_SCHEMA.md), validazione e anteprima.
import { defaultExercise, defaultLift } from './defaults'
import { positionLabel, proposeTm, weeksOfCycle } from './program531'
import type { CycleConfig, Day, Exercise, Lift, PlannedExercise, Position, Settings, TmRule, WeekKind } from './types'

export const IMPORT_FORMAT = 'forza-import'
export const IMPORT_VERSION = 1

export interface ImportData {
  mode: 'replace' | 'merge'
  settings: Partial<Settings>
  exercises: Exercise[]
  lifts: Lift[]
  tmChanges: { exerciseId: string; tm: number; reason: string }[]
  days: Day[] | null
  /** Struttura dei cicli (scarico ogni N cicli, Forever...), uguale per tutti i principali. */
  cycleConfig: Partial<CycleConfig>
  /** Settimana in cui si trova il programma (una sola per tutti gli esercizi). */
  position: Position | null
}

export interface ExistingState {
  exercises: Map<string, Exercise>
  lifts: Map<string, Lift>
  settings: Settings
}

export type ImportResult = { ok: true; data: ImportData; preview: string[] } | { ok: false; errors: string[] }

const WEEKS: WeekKind[] = ['S1', 'S2', 'S3', 'DELOAD', 'SEVENTH_DELOAD', 'SEVENTH_TEST']

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Raccoglie gli errori invece di fermarsi al primo. */
class Checker {
  errors: string[] = []
  fail(path: string, msg: string) {
    this.errors.push(`${path}: ${msg}`)
  }
  num(o: Obj, key: string, path: string, opt: { min?: number; max?: number; optional?: boolean } = {}): number | undefined {
    const v = o[key]
    if (v === undefined) {
      if (!opt.optional) this.fail(`${path}.${key}`, 'manca (deve essere un numero)')
      return undefined
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.fail(`${path}.${key}`, `deve essere un numero, trovato ${JSON.stringify(v)}`)
      return undefined
    }
    if (opt.min !== undefined && v < opt.min) this.fail(`${path}.${key}`, `deve essere almeno ${opt.min}`)
    if (opt.max !== undefined && v > opt.max) this.fail(`${path}.${key}`, `deve essere al massimo ${opt.max}`)
    return v
  }
  /** Numero facoltativo che può essere null ("da completare"). */
  numOrNull(o: Obj, key: string, path: string, opt: { min?: number; max?: number } = {}): number | null {
    if (o[key] === undefined || o[key] === null) return null
    return this.num(o, key, path, opt) ?? null
  }
  str(o: Obj, key: string, path: string, optional = false) {
    const v = o[key]
    if (v === undefined && optional) return undefined
    if (typeof v !== 'string' || !v.trim()) {
      this.fail(`${path}.${key}`, 'deve essere un testo non vuoto')
      return undefined
    }
    return v.trim()
  }
  oneOf<T extends string>(o: Obj, key: string, path: string, values: readonly T[]): T | undefined {
    const v = o[key]
    if (v === undefined) return undefined
    if (!values.includes(v as T)) {
      this.fail(`${path}.${key}`, `valori ammessi: ${values.join(', ')}`)
      return undefined
    }
    return v as T
  }
  bool(o: Obj, key: string, path: string) {
    const v = o[key]
    if (v === undefined) return undefined
    if (typeof v !== 'boolean') this.fail(`${path}.${key}`, 'deve essere true o false')
    return typeof v === 'boolean' ? v : undefined
  }
  arr(o: Obj, key: string, path: string): unknown[] | undefined {
    const v = o[key]
    if (v === undefined) return undefined
    if (!Array.isArray(v)) {
      this.fail(`${path}.${key}`, 'deve essere una lista [...]')
      return undefined
    }
    return v
  }
}

const fmt = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 })

export function validateImport(raw: unknown, existing: ExistingState): ImportResult {
  let input = raw
  if (typeof raw === 'string') {
    try {
      input = JSON.parse(extractJson(raw))
    } catch {
      return { ok: false, errors: ['Il testo non è un JSON valido. Copia tutto il blocco generato da Claude, dalla prima { all\'ultima }.'] }
    }
  }
  if (!isObj(input)) return { ok: false, errors: ['Il JSON deve essere un oggetto { ... }.'] }
  const c = new Checker()
  if (input.format !== IMPORT_FORMAT) c.fail('format', `deve essere "${IMPORT_FORMAT}"`)
  if (input.version !== IMPORT_VERSION) c.fail('version', `deve essere ${IMPORT_VERSION}`)
  const mode = c.oneOf(input, 'mode', 'mode', ['replace', 'merge'] as const) ?? 'merge'

  // Impostazioni
  const settings: Partial<Settings> = {}
  const cycleConfig: Partial<CycleConfig> = {}
  if (input.settings !== undefined) {
    if (!isObj(input.settings)) c.fail('settings', 'deve essere un oggetto')
    else {
      const s = input.settings
      const set = <K extends keyof Settings>(k: K, v: Settings[K] | undefined | null) => {
        if (v !== undefined && v !== null) settings[k] = v
      }
      set('roundingStep', c.num(s, 'roundingStep', 'settings', { min: 0.5, max: 10, optional: true }))
      set('roundingMode', c.oneOf(s, 'roundingMode', 'settings', ['nearest-down', 'nearest-up', 'down'] as const))
      set('plusRepsBonus', c.num(s, 'plusRepsBonus', 'settings', { min: 0, max: 3, optional: true }))
      set('upperIncrement', c.num(s, 'upperIncrement', 'settings', { min: 0, max: 20, optional: true }))
      set('lowerIncrement', c.num(s, 'lowerIncrement', 'settings', { min: 0, max: 20, optional: true }))
      set('restAccessory', c.num(s, 'restAccessory', 'settings', { min: 0, max: 900, optional: true }))
      set('barWeight', c.num(s, 'barWeight', 'settings', { min: 0, max: 50, optional: true }))
      const tpl = c.oneOf(s, 'template', 'settings', ['original', 'forever'] as const)
      if (tpl) cycleConfig.template = tpl
      const every = c.num(s, 'deloadEvery', 'settings', { min: 1, max: 10, optional: true })
      if (every !== undefined) cycleConfig.deloadEvery = every
      const leader = c.num(s, 'leaderCycles', 'settings', { min: 1, max: 10, optional: true })
      if (leader !== undefined) cycleConfig.leaderCycles = leader
      const anchor = c.num(s, 'anchorCycles', 'settings', { min: 0, max: 10, optional: true })
      if (anchor !== undefined) cycleConfig.anchorCycles = anchor
      const seventh = c.oneOf(s, 'seventhWeek', 'settings', ['deload', 'tmtest'] as const)
      if (seventh) cycleConfig.seventhWeek = seventh
      const wu = c.arr(s, 'warmup', 'settings')
      if (wu) {
        const list: Settings['warmup'] = []
        wu.forEach((w, i) => {
          const p = `settings.warmup[${i}]`
          if (!isObj(w)) return c.fail(p, 'deve essere un oggetto { pct, reps }')
          const pct = c.num(w, 'pct', p, { min: 0.1, max: 1 })
          const reps = c.num(w, 'reps', p, { min: 1, max: 20 })
          if (pct !== undefined && reps !== undefined) list.push({ pct, reps })
        })
        settings.warmup = list
      }
    }
  }

  // Esercizi
  const exercises: Exercise[] = []
  const known = new Map(existing.exercises)
  ;(c.arr(input, 'exercises', '') ?? []).forEach((e, i) => {
    const p = `exercises[${i}]`
    if (!isObj(e)) return c.fail(p, 'deve essere un oggetto')
    const id = c.str(e, 'id', p)
    const name = c.str(e, 'name', p)
    if (!id || !name) return
    if (exercises.some((x) => x.id === id)) return c.fail(`${p}.id`, `"${id}" è ripetuto`)
    const base = existing.exercises.get(id) ?? defaultExercise(id, name)
    const ex: Exercise = { ...base, name }
    ex.barbell = c.bool(e, 'barbell', p) ?? ex.barbell
    ex.loadType = c.oneOf(e, 'loadType', p, ['normal', 'assisted', 'weighted'] as const) ?? ex.loadType
    ex.bodyPart = c.oneOf(e, 'bodyPart', p, ['upper', 'lower'] as const) ?? ex.bodyPart
    ex.increment = c.num(e, 'increment', p, { min: 0, max: 50, optional: true }) ?? ex.increment
    ex.restSec = c.num(e, 'restSec', p, { min: 0, max: 900, optional: true }) ?? ex.restSec
    ex.countsForVolume = c.bool(e, 'countsForVolume', p) ?? ex.countsForVolume
    const notes = c.str(e, 'notes', p, true)
    if (notes !== undefined) ex.notes = notes
    if (e.muscles !== undefined) {
      if (!isObj(e.muscles)) c.fail(`${p}.muscles`, 'deve essere un oggetto { "muscolo": 1 o 0.5 }')
      else {
        const m: Record<string, number> = {}
        for (const [k, v] of Object.entries(e.muscles)) {
          if (typeof v !== 'number' || v < 0 || v > 1) c.fail(`${p}.muscles.${k}`, 'deve essere un numero tra 0 e 1')
          else m[k] = v
        }
        ex.muscles = m
      }
    }
    exercises.push(ex)
    known.set(id, ex)
  })

  const checkRef = (id: unknown, path: string) => {
    if (typeof id !== 'string' || !known.has(id)) {
      c.fail(path, `esercizio ${JSON.stringify(id)} sconosciuto: aggiungilo in "exercises"`)
      return false
    }
    return true
  }

  // Esercizi principali 5/3/1
  const lifts: Lift[] = []
  ;(c.arr(input, 'lifts', '') ?? []).forEach((l, i) => {
    const p = `lifts[${i}]`
    if (!isObj(l)) return c.fail(p, 'deve essere un oggetto')
    if (!checkRef(l.exerciseId, `${p}.exerciseId`)) return
    const id = l.exerciseId as string
    const tm = c.num(l, 'tm', p, { min: 1, max: 1000 })
    if (tm === undefined) return
    const lift: Lift = { ...(existing.lifts.get(id) ?? defaultLift(id, tm)), tm, pendingTm: null }
    // Tutti i principali avanzano insieme: struttura dei cicli e posizione stanno in "settings" e "position".
    for (const k of ['template', 'deloadEvery', 'leaderCycles', 'anchorCycles', 'seventhWeek', 'position']) {
      if (l[k] !== undefined) {
        c.fail(`${p}.${k}`, k === 'position' ? 'non si usa più qui: la posizione è una sola, in "position" in alto' : 'non si usa più qui: va in "settings"')
      }
    }

    if (l.fsl !== undefined) {
      if (!isObj(l.fsl)) c.fail(`${p}.fsl`, 'deve essere un oggetto { "S1": { "sets", "reps" }, ... }')
      else {
        const fsl: Lift['fsl'] = {}
        for (const [k, v] of Object.entries(l.fsl)) {
          const fp = `${p}.fsl.${k}`
          if (k !== 'S1' && k !== 'S2' && k !== 'S3') {
            c.fail(fp, 'le chiavi possono essere solo S1, S2, S3')
            continue
          }
          if (!isObj(v)) {
            c.fail(fp, 'deve essere { "sets": numero, "reps": numero }')
            continue
          }
          const sets = c.num(v, 'sets', fp, { min: 0, max: 10 })
          const reps = c.num(v, 'reps', fp, { min: 1, max: 20 })
          if (sets !== undefined && reps !== undefined) fsl[k] = { sets, reps }
        }
        lift.fsl = fsl
      }
    }
    const rules = c.arr(l, 'tmRules', p)
    if (rules) {
      const list: TmRule[] = []
      rules.forEach((r, j) => {
        const rp = `${p}.tmRules[${j}]`
        if (!isObj(r)) return c.fail(rp, 'deve essere { "minReps", "increment" }')
        const minReps = c.num(r, 'minReps', rp, { min: 0, max: 30 })
        const increment = c.num(r, 'increment', rp, { min: 0, max: 50 })
        if (minReps !== undefined && increment !== undefined) list.push({ minReps, increment })
      })
      lift.tmRules = list
    }
    if (l.rest !== undefined) {
      if (!isObj(l.rest)) c.fail(`${p}.rest`, 'deve essere un oggetto')
      else {
        const r = l.rest
        for (const k of ['work', 'beforePlus', 'afterPlus', 'fsl', 'fslMissed'] as const) {
          const v = c.num(r, k, `${p}.rest`, { min: 0, max: 900, optional: true })
          if (v !== undefined && v !== null) lift.rest = { ...lift.rest, [k]: v }
        }
      }
    }
    if (l.awaitingTmReview !== undefined) {
      const ap = `${p}.awaitingTmReview`
      if (!isObj(l.awaitingTmReview)) c.fail(ap, 'deve essere { "s3PlusReps": numero }')
      else {
        const reps = c.num(l.awaitingTmReview, 's3PlusReps', ap, { min: 0, max: 50 })
        const ex = known.get(id)
        if (reps !== undefined && ex) {
          const s = { ...existing.settings, ...settings }
          const prop = proposeTm(lift, ex, s, reps)
          lift.pendingTm = { proposed: prop.proposed, reason: prop.reason }
        }
      }
    }
    lifts.push(lift)
  })
  const liftIds = new Set([...existing.lifts.keys(), ...lifts.map((l) => l.exerciseId)])
  if (mode === 'replace') {
    liftIds.clear()
    lifts.forEach((l) => liftIds.add(l.exerciseId))
  }

  // Modifiche al TM
  const tmChanges: ImportData['tmChanges'] = []
  ;(c.arr(input, 'tmChanges', '') ?? []).forEach((t, i) => {
    const p = `tmChanges[${i}]`
    if (!isObj(t)) return c.fail(p, 'deve essere un oggetto')
    if (!checkRef(t.exerciseId, `${p}.exerciseId`)) return
    if (!liftIds.has(t.exerciseId as string)) return c.fail(`${p}.exerciseId`, 'non è un esercizio principale 5/3/1')
    const tm = c.num(t, 'tm', p, { min: 1, max: 1000 })
    const reason = c.str(t, 'reason', p, true) ?? 'Importato da Claude'
    if (tm !== undefined) tmChanges.push({ exerciseId: t.exerciseId as string, tm, reason })
  })

  // Giorni
  let days: Day[] | null = null
  const rawDays = c.arr(input, 'days', '')
  if (rawDays) {
    days = []
    rawDays.forEach((d, i) => {
      const p = `days[${i}]`
      if (!isObj(d)) return c.fail(p, 'deve essere un oggetto')
      const id = c.str(d, 'id', p)
      const name = c.str(d, 'name', p)
      const list = c.arr(d, 'exercises', p)
      if (!list) c.fail(`${p}.exercises`, 'manca la lista degli esercizi')
      if (!id || !name || !list) return
      if (days!.some((x) => x.id === id)) return c.fail(`${p}.id`, `"${id}" è ripetuto`)
      const planned: PlannedExercise[] = []
      list.forEach((pe, j) => {
        const ep = `${p}.exercises[${j}]`
        if (!isObj(pe)) return c.fail(ep, 'deve essere un oggetto')
        if (!checkRef(pe.exerciseId, `${ep}.exerciseId`)) return
        const role = c.oneOf(pe, 'role', ep, ['main531', 'accessory'] as const) ?? 'accessory'
        if (role === 'main531' && !liftIds.has(pe.exerciseId as string)) {
          return c.fail(ep, `"${pe.exerciseId}" è indicato come main531 ma non ha una voce in "lifts"`)
        }
        const item: PlannedExercise = { exerciseId: pe.exerciseId as string, role }
        if (role === 'accessory') {
          item.sets = c.numOrNull(pe, 'sets', ep, { min: 1, max: 20 })
          item.reps = c.numOrNull(pe, 'reps', ep, { min: 1, max: 100 })
          item.repMin = c.numOrNull(pe, 'repMin', ep, { min: 1, max: 100 })
          item.repMax = c.numOrNull(pe, 'repMax', ep, { min: 1, max: 100 })
          item.weight = c.numOrNull(pe, 'weight', ep, { min: 0, max: 1000 })
          item.rpeMax = c.numOrNull(pe, 'rpeMax', ep, { min: 5, max: 10 })
          item.progression = c.oneOf(pe, 'progression', ep, ['double', 'none'] as const) ?? 'double'
          if (item.repMin && item.repMax && item.repMin > item.repMax) c.fail(ep, 'repMin è più grande di repMax')
        }
        item.restSec = c.numOrNull(pe, 'restSec', ep, { min: 0, max: 900 })
        const ss = pe.superset
        if (ss !== undefined && ss !== null && typeof ss !== 'string') c.fail(`${ep}.superset`, 'deve essere una lettera, es. "A"')
        item.superset = typeof ss === 'string' && ss.trim() ? ss.trim() : null
        const notes = c.str(pe, 'notes', ep, true)
        if (notes) item.notes = notes
        planned.push(item)
      })
      days!.push({ id, name, order: i, exercises: planned })
    })
  }

  const cfg: CycleConfig = { ...existing.settings.cycleConfig, ...cycleConfig }
  let position: Position | null = null
  if (input.position !== undefined) {
    const pp = 'position'
    if (!isObj(input.position)) c.fail(pp, 'deve essere { "cycle": numero, "week": "S1" }')
    else {
      const cycle = c.num(input.position, 'cycle', pp, { min: 1, max: 999 })
      const week = c.oneOf(input.position, 'week', pp, WEEKS)
      if (input.position.week === undefined) c.fail(`${pp}.week`, `manca (${WEEKS.join(', ')})`)
      const extra = c.bool(input.position, 'extra', pp) ?? false
      if (cycle !== undefined && week) {
        if (extra) position = { cycle, weekIdx: 0, extra: week }
        else {
          const idx = weeksOfCycle(cfg, cycle).indexOf(week)
          if (idx < 0) c.fail(pp, `il ciclo ${cycle} non ha la settimana ${week} (usa "extra": true)`)
          else position = { cycle, weekIdx: idx, extra: null }
        }
      }
    }
  }
  if (input.nextDay !== undefined) c.fail('nextDay', 'non si usa più: il giorno si sceglie dalla schermata Oggi')
  if (mode === 'replace' && !days) c.fail('days', 'con "mode": "replace" servono i giorni del programma')

  if (c.errors.length) return { ok: false, errors: c.errors }

  const data: ImportData = { mode, settings, exercises, lifts, tmChanges, days, cycleConfig, position }
  return { ok: true, data, preview: buildPreview(data, existing) }
}

/** Accetta anche il JSON dentro un blocco ```json ... ``` o con testo intorno. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

const SETTING_LABEL: Record<string, string> = {
  roundingStep: 'arrotondamento',
  roundingMode: 'modo di arrotondare',
  plusRepsBonus: 'reps in più per l\'e1RM dei set «+»',
  upperIncrement: 'aumento TM upper',
  lowerIncrement: 'aumento TM lower',
  restAccessory: 'recupero dei complementari',
  barWeight: 'bilanciere',
  warmup: 'riscaldamento',
}

function buildPreview(d: ImportData, existing: ExistingState): string[] {
  const out: string[] = []
  const name = (id: string) => d.exercises.find((e) => e.id === id)?.name ?? existing.exercises.get(id)?.name ?? id
  if (d.mode === 'replace') out.push('Il programma attuale (giorni ed esercizi principali) viene sostituito. Lo storico resta.')
  const s = Object.keys(d.settings).map((k) => SETTING_LABEL[k] ?? k)
  if (s.length) out.push(`Impostazioni aggiornate: ${s.join(', ')}.`)
  const added = d.exercises.filter((e) => !existing.exercises.has(e.id))
  const changed = d.exercises.filter((e) => existing.exercises.has(e.id))
  if (added.length) out.push(`Nuovi esercizi (${added.length}): ${added.map((e) => e.name).join(', ')}.`)
  if (changed.length) out.push(`Esercizi aggiornati (${changed.length}): ${changed.map((e) => e.name).join(', ')}.`)
  const cfg = { ...existing.settings.cycleConfig, ...d.cycleConfig }
  if (Object.keys(d.cycleConfig).length) {
    out.push(
      cfg.template === 'forever'
        ? `Cicli: 5/3/1 Forever, ${cfg.leaderCycles} Leader + ${cfg.anchorCycles} Anchor.`
        : `Cicli: settimana di scarico ogni ${cfg.deloadEvery === 1 ? 'ciclo' : `${cfg.deloadEvery} cicli`}.`,
    )
  }
  if (d.position) out.push(`Si parte da: ${positionLabel(cfg, d.position)}.`)
  for (const l of d.lifts) {
    const prev = existing.lifts.get(l.exerciseId)
    const tm = prev && prev.tm !== l.tm ? `TM ${fmt(prev.tm)} → ${fmt(l.tm)}` : `TM ${fmt(l.tm)}`
    let line = `${name(l.exerciseId)} (5/3/1): ${tm} kg.`
    if (l.pendingTm) line += ` Da confermare il nuovo TM: ${fmt(l.pendingTm.proposed)} kg.`
    out.push(line)
  }
  for (const t of d.tmChanges) {
    const prev = existing.lifts.get(t.exerciseId)?.tm
    out.push(`${name(t.exerciseId)}: TM ${prev !== undefined ? `${fmt(prev)} → ` : ''}${fmt(t.tm)} kg (${t.reason}).`)
  }
  if (d.days) {
    for (const day of d.days) {
      const todo = day.exercises.filter(
        (e) => e.role === 'accessory' && (e.sets == null || e.weight == null || (e.reps == null && e.repMax == null)),
      )
      out.push(
        `Giorno «${day.name}»: ${day.exercises.map((e) => name(e.exerciseId)).join(', ')}.` +
          (todo.length ? ` Da completare nell'app: ${todo.map((e) => name(e.exerciseId)).join(', ')}.` : ''),
      )
    }
  }
  if (!out.length) out.push('Nessuna modifica.')
  return out
}
