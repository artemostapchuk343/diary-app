import { create } from 'zustand'
import { db } from './db'

export const CATEGORIES = {
  groceries:     { label: 'Groceries',       color: '#4ade80', budget: 700 },
  dining:        { label: 'Quick dining',     color: '#a3e635', budget: 225 },
  bars:          { label: 'Bars & social',    color: '#818cf8', budget: 300 },
  transport:     { label: 'Transport',        color: '#60a5fa', budget: 375 },
  health:        { label: 'Health & care',    color: '#f87171', budget: 180 },
  clothing:      { label: 'Clothing',         color: '#fb923c', budget: 150 },
  shopping:      { label: 'Online shopping',  color: '#fbbf24', budget: 300 },
  entertainment: { label: 'Entertainment',    color: '#e879f9', budget: 100 },
  cash:          { label: 'Cash',             color: '#94a3b8', budget: 600 },
}

export const SCENARIOS = {
  1: { label: 'Aggressive', savingsPerMonth: 2483, funPerMonth: 0,    pillowDate: '2027-01', loanPayoffDate: '2029-09', interestSaved: 28500 },
  2: { label: 'Balanced',   savingsPerMonth: 1783, funPerMonth: 700,  pillowDate: '2027-05', loanPayoffDate: '2030-06', interestSaved: 23400 },
  3: { label: 'Comfortable',savingsPerMonth: 1183, funPerMonth: 1300, pillowDate: '2027-10', loanPayoffDate: '2031-04', interestSaved: 17000 },
}

const INITIAL = {
  version: 1,
  lastUpdated: '2026-05-22',
  income: { monthlySalary: 11700 },
  fixedCosts: {
    mortgage: 2981.12,
    cashLoan: 2338.75,
    insurance: 208,
    uniqa: 25,
    czynsz: 739.52,
    internet: 56.49,
    subscriptions: 180,
  },
  mortgage: {
    originalAmount: 480860,
    remainingBalance: 461365.64,
    monthlyPayment: 2981.12,
    subsidyAmount: 1930.05,
    installmentsPaid: 26,
    totalInstallments: 239,
    interestRate: 7.14,
    subsidyEnds: '2035-09',
    rateResetDate: '2039-03',
    payoffDate: '2044-02',
  },
  cashLoan: {
    originalAmount: 150000,
    remainingBalance: 140947.20,
    monthlyPayment: 2338.75,
    installmentsPaid: 9,
    totalInstallments: 96,
    interestRate: 10.74,
    payoffDate: '2033-08',
  },
  savings: {
    pillow: 0,
    targetPillow: 22000,
    scenario: 2,
  },
  months: {
    '2026-05': {
      income: 11700,
      freelance: 0,
      spending: {
        groceries: 700,
        dining: 225,
        bars: 300,
        transport: 375,
        health: 180,
        clothing: 150,
        shopping: 300,
        entertainment: 100,
        cash: 600,
      },
    },
  },
}

export const useFinance = create((set, get) => ({
  data: null,
  loaded: false,

  load: async () => {
    const row = await db.settings.get('finance')
    set({ data: row?.value ?? INITIAL, loaded: true })
  },

  _save: async (data) => {
    await db.settings.put({ key: 'finance', value: data })
    set({ data })
  },

  importMonth: async (monthKey, patch) => {
    const data = get().data
    const existing = data.months?.[monthKey] ?? {}
    const updated = {
      ...data,
      lastUpdated: new Date().toISOString().slice(0, 10),
      months: {
        ...data.months,
        [monthKey]: { ...existing, ...patch },
      },
      ...(patch.mortgage   && { mortgage:  { ...data.mortgage,  ...patch.mortgage  } }),
      ...(patch.cashLoan   && { cashLoan:  { ...data.cashLoan,  ...patch.cashLoan  } }),
      ...(patch.savings    && { savings:   { ...data.savings,   ...patch.savings   } }),
    }
    await get()._save(updated)
  },

  updateSavings: async (patch) => {
    const data = get().data
    await get()._save({ ...data, savings: { ...data.savings, ...patch } })
  },

  setScenario: async (n) => {
    const data = get().data
    await get()._save({ ...data, savings: { ...data.savings, scenario: n } })
  },
}))

// Computed helpers (pure, no store)
export function computeFixedTotal(fixedCosts) {
  return Object.values(fixedCosts).reduce((s, v) => s + v, 0)
}

export function computeBuffer(income, fixedCosts) {
  return income.monthlySalary - computeFixedTotal(fixedCosts)
}

export function computeSpendingTotal(spending) {
  return Object.values(spending || {}).reduce((s, v) => s + v, 0)
}

export function pillowMonthsLeft(pillow, target, savingsPerMonth) {
  const remaining = Math.max(0, target - pillow)
  if (savingsPerMonth <= 0) return null
  return Math.ceil(remaining / savingsPerMonth)
}
