// Valori di partenza: impostazioni, nuovo esercizio principale, coefficienti muscolari proposti.
import type { Exercise, Lift, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  onboarded: false,
  roundingStep: 2.5,
  roundingMode: 'nearest-down',
  barWeight: 20,
  plates: [
    { kg: 25, pairs: 0 },
    { kg: 20, pairs: 4 },
    { kg: 15, pairs: 1 },
    { kg: 10, pairs: 2 },
    { kg: 5, pairs: 2 },
    { kg: 2.5, pairs: 2 },
    { kg: 1.25, pairs: 2 },
  ],
  warmup: [
    { pct: 0.4, reps: 5 },
    { pct: 0.5, reps: 5 },
    { pct: 0.6, reps: 3 },
  ],
  plusRepsBonus: 0,
  upperIncrement: 2.5,
  lowerIncrement: 5,
  restAccessory: 90,
  nextDayIdx: 0,
  microcycle: 1,
  lastBackupAt: null,
  timer: null,
  sound: true,
}

export function defaultLift(exerciseId: string, tm: number): Lift {
  return {
    exerciseId,
    tm,
    template: 'original',
    deloadEvery: 1,
    leaderCycles: 2,
    anchorCycles: 1,
    seventhWeek: 'deload',
    fsl: {},
    tmRules: [],
    position: { cycle: 1, weekIdx: 0, extra: null },
    pendingTm: null,
    rest: { work: 120, beforePlus: 180, afterPlus: 180, fsl: 120, fslMissed: 150 },
  }
}

export function defaultExercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    barbell: false,
    loadType: 'normal',
    bodyPart: 'upper',
    increment: 2.5,
    restSec: 90,
    muscles: suggestMuscles(name),
    countsForVolume: true,
  }
}

export const MUSCLES = [
  'petto',
  'dorsali',
  'dorso alto',
  'deltoide anteriore',
  'deltoide laterale',
  'deltoide posteriore',
  'bicipiti',
  'tricipiti',
  'avambracci',
  'quadricipiti',
  'femorali',
  'glutei',
  'adduttori',
  'erettori',
  'polpacci',
  'addominali',
] as const

/** Coefficienti proposti in base al nome (1 diretto, 0,5 indiretto). Si confermano o modificano. */
const SUGGESTIONS: [RegExp, Record<string, number>][] = [
  [/panca|bench|dip|chest press/i, { petto: 1, tricipiti: 0.5, 'deltoide anteriore': 0.5 }],
  [/croci|fly|pec deck/i, { petto: 1 }],
  [/military|shoulder press|lento|overhead/i, { 'deltoide anteriore': 1, tricipiti: 0.5, 'deltoide laterale': 0.5 }],
  [/lat machine|trazion|pull.?up|chin/i, { dorsali: 1, bicipiti: 0.5, 'deltoide posteriore': 0.5 }],
  [/remator|pulley|row/i, { dorsali: 1, 'dorso alto': 1, bicipiti: 0.5, 'deltoide posteriore': 0.5 }],
  [/face pull/i, { 'deltoide posteriore': 1, 'dorso alto': 0.5 }],
  [/alzate laterali|lateral raise/i, { 'deltoide laterale': 1 }],
  [/curl(?!.*leg)(?!.*gamb)/i, { bicipiti: 1, avambracci: 0.5 }],
  [/pushdown|push.?down|estension|french|skull/i, { tricipiti: 1 }],
  [/leg curl/i, { femorali: 1 }],
  [/leg extension/i, { quadricipiti: 1 }],
  [/rdl|rumeno|romanian/i, { femorali: 1, glutei: 1, erettori: 0.5, 'dorso alto': 0.5 }],
  [/squat|pressa|leg press/i, { quadricipiti: 1, glutei: 1, adduttori: 0.5, erettori: 0.5 }],
  [/stacco|deadlift/i, { femorali: 1, glutei: 1, erettori: 1, 'dorso alto': 0.5 }],
  [/polpacci|calf/i, { polpacci: 1 }],
]

export function suggestMuscles(name: string): Record<string, number> {
  for (const [re, map] of SUGGESTIONS) if (re.test(name)) return { ...map }
  return {}
}
