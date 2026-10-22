// Tipi dei dati salvati sul telefono (IndexedDB) e scambiati con backup e import.

/** Settimane del ciclo 5/3/1. SEVENTH_* = "7ª settimana" di 5/3/1 Forever. */
export type WeekKind = 'S1' | 'S2' | 'S3' | 'DELOAD' | 'SEVENTH_DELOAD' | 'SEVENTH_TEST'

export type SetType = 'warmup' | 'normal' | 'plus' | 'fsl' | 'joker'

/** normal = peso caricato; assisted = il peso è l'assistenza (meno = meglio); weighted = zavorra sul corpo. */
export type LoadType = 'normal' | 'assisted' | 'weighted'

export type BodyPart = 'upper' | 'lower'

export type RoundingMode = 'nearest-down' | 'nearest-up' | 'down'

export interface Exercise {
  id: string
  name: string
  barbell: boolean
  loadType: LoadType
  bodyPart: BodyPart
  /** Aumento di peso per la progressione (kg). */
  increment: number
  /** Recupero di default (secondi). */
  restSec: number
  /** Muscolo → coefficiente (1 diretto, 0,5 indiretto). */
  muscles: Record<string, number>
  /** false = non conta nel volume (es. esercizi riabilitativi). */
  countsForVolume: boolean
  notes?: string
}

export interface FslSpec {
  sets: number
  reps: number
}

/** Regola per il nuovo TM: se il set "+" della S3 fa almeno minReps, TM += increment. */
export interface TmRule {
  minReps: number
  increment: number
}

export interface LiftPosition {
  cycle: number
  /** Indice nella sequenza di settimane del ciclo (vedi weeksOfCycle). */
  weekIdx: number
  /** Settimana inserita (extra o ripetuta) da fare prima di proseguire. */
  extra?: WeekKind | null
}

export interface LiftRest {
  work: number
  beforePlus: number
  afterPlus: number
  fsl: number
  fslMissed: number
}

/** Stato 5/3/1 di un esercizio principale. Una riga per esercizio. */
export interface Lift {
  exerciseId: string
  tm: number
  template: 'original' | 'forever'
  /** Originale: settimana di scarico ogni N cicli (1 = S4 a ogni ciclo). */
  deloadEvery: number
  /** Forever: cicli Leader e Anchor, e che cosa fare nella 7ª settimana. */
  leaderCycles: number
  anchorCycles: number
  seventhWeek: 'deload' | 'tmtest'
  fsl: Partial<Record<'S1' | 'S2' | 'S3', FslSpec>>
  /** Vuoto = regola standard (+incremento se il set "+" raggiunge l'obiettivo). */
  tmRules: TmRule[]
  position: LiftPosition
  pendingTm?: { proposed: number; reason: string } | null
  rest: LiftRest
}

export interface TmChange {
  id?: number
  exerciseId: string
  date: number
  tm: number
  reason: string
}

export interface PlannedExercise {
  exerciseId: string
  role: 'main531' | 'accessory'
  // Solo complementari (null = da completare nell'app):
  sets?: number | null
  reps?: number | null
  repMin?: number | null
  repMax?: number | null
  weight?: number | null
  /** Doppia progressione: aumenta quando tutti i set arrivano a repMax con RPE ≤ rpeMax. */
  rpeMax?: number | null
  progression?: 'double' | 'none'
  restSec?: number | null
  /** Esercizi con la stessa lettera si fanno alternati. */
  superset?: string | null
  notes?: string
}

export interface Day {
  id: string
  name: string
  order: number
  exercises: PlannedExercise[]
}

export interface SessionSet {
  type: SetType
  weight: number | null
  targetReps: number | null
  targetRepsMax?: number | null
  reps: number | null
  rpe: number | null
  done: boolean
  /** % del TM, solo per i set dei principali. */
  pct?: number
}

export interface SessionExercise {
  key: string
  exerciseId: string
  role: 'main531' | 'accessory'
  week?: WeekKind
  cycle?: number
  tm?: number
  notes: string
  superset?: string | null
  restSec: number
  sets: SessionSet[]
}

export interface Session {
  id: string
  dayId: string | null
  dayName: string
  startedAt: number
  endedAt: number | null
  status: 'active' | 'done'
  notes: string
  sessionRpe?: number | null
  microcycle: number
  deload: boolean
  exercises: SessionExercise[]
}

export interface BodyWeight {
  id?: number
  date: number
  kg: number
}

export interface PlateStock {
  kg: number
  pairs: number
}

export interface Settings {
  id: 'main'
  onboarded: boolean
  roundingStep: number
  roundingMode: RoundingMode
  barWeight: number
  plates: PlateStock[]
  /** Riscaldamento dei principali (% del TM × reps). */
  warmup: { pct: number; reps: number }[]
  /** Reps aggiunte ai set "+" per stimare l'e1RM (1 = ti fermi a RPE 9). */
  plusRepsBonus: number
  upperIncrement: number
  lowerIncrement: number
  restAccessory: number
  /** Indice del prossimo giorno da fare e numero del microciclo (giro di tutti i giorni). */
  nextDayIdx: number
  microcycle: number
  lastBackupAt: number | null
  timer: { endsAt: number; total: number } | null
  sound: boolean
}
