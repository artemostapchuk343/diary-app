import { create } from 'zustand'
import { db } from './db'
import { isSignedIn, uploadFinanceData, downloadFinanceData } from './googleDrive'

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
  version: 2,
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
  // After May 2026 payments: rata 27 (mortgage) + installment 10 (cash loan)
  mortgage: {
    originalAmount: 480860,
    remainingBalance: 459199.60,
    monthlyPayment: 2981.12,
    subsidyAmount: 1930.05,
    installmentsPaid: 27,
    totalInstallments: 239,
    interestRate: 7.14,
    subsidyEnds: '2035-09',
    rateResetDate: '2039-03',
    payoffDate: '2044-02',
  },
  cashLoan: {
    originalAmount: 150000,
    remainingBalance: 139869.93,
    monthlyPayment: 2338.75,
    installmentsPaid: 10,
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
    '2026-04': {
      income: 11728,
      freelance: 3823,
      balances: { mbank: null, millennium: 8049 },
      spending: {
        groceries: 857,
        dining: 604,
        bars: 591,
        transport: 1103,
        health: 540,
        clothing: 560,
        shopping: 1623,
        entertainment: 129,
        cash: 640,
      },
      transactions: {
        groceries: [
          { name: 'Carrefour', amount: 152.04, date: '04-04' },
          { name: 'Carrefour', amount: 106.26, date: '04-16' },
          { name: 'Carrefour', amount: 93.98, date: '04-11' },
          { name: 'Carrefour', amount: 73.84, date: '04-30' },
          { name: 'Carrefour', amount: 55.38, date: '04-26' },
          { name: 'Biedronka', amount: 43.27, date: '04-22' },
          { name: 'Żabka', amount: 35.02, date: '04-14' },
          { name: 'Carrefour', amount: 34.02, date: '04-24' },
          { name: 'Żabka', amount: 28.58, date: '04-25' },
          { name: 'Żabka', amount: 23.19, date: '04-28' },
          { name: 'Carrefour', amount: 22.98, date: '04-17' },
          { name: 'Aldi', amount: 20.98, date: '04-08' },
          { name: 'Biedronka', amount: 20.79, date: '04-09' },
          { name: 'Biedronka', amount: 19.42, date: '04-02' },
          { name: 'Gorącopolecam', amount: 17.95, date: '04-23' },
          { name: 'Gorącopolecam', amount: 17.95, date: '04-02' },
          { name: 'Biedronka', amount: 16.06, date: '04-21' },
          { name: 'Carrefour Express', amount: 13.39, date: '04-03' },
          { name: 'Kandm Delikatesy', amount: 12.69, date: '04-23' },
          { name: 'Żabka', amount: 8.99, date: '04-12' },
          { name: 'Carrefour', amount: 7.87, date: '04-29' },
          { name: 'Żabka', amount: 7.40, date: '04-03' },
          { name: 'Żabka', amount: 7.40, date: '04-02' },
          { name: 'Żabka', amount: 7.00, date: '04-14' },
          { name: 'Żabka', amount: 6.70, date: '04-18' },
          { name: 'Żabka', amount: 3.49, date: '04-07' },
        ],
        dining: [
          { name: 'Dinner w/ Damian (momo)', amount: 240.00, date: '04-20' },
          { name: 'Dominos (delivery)', amount: 49.45, date: '04-08' },
          { name: 'PLSBX (work lunch)', amount: 44.85, date: '04-26' },
          { name: 'PLSBX (work lunch)', amount: 44.85, date: '04-24' },
          { name: 'Dominos (delivery)', amount: 45.95, date: '04-15' },
          { name: 'Dominos (delivery)', amount: 45.95, date: '04-23' },
          { name: 'Green Coffee', amount: 34.90, date: '04-03' },
          { name: 'Emel', amount: 20.00, date: '04-09' },
          { name: 'Slimak', amount: 20.00, date: '04-08' },
          { name: 'Emel', amount: 20.00, date: '04-01' },
          { name: 'PLSBX (work lunch)', amount: 16.15, date: '04-11' },
          { name: 'Automat vending', amount: 19.00, date: '04-xx' },
        ],
        bars: [
          { name: 'eBilet (concert tickets)', amount: 325.90, date: '04-15' },
          { name: 'Asia Mama', amount: 57.78, date: '04-25' },
          { name: 'Wally', amount: 24.00, date: '04-21' },
          { name: 'Wally', amount: 23.00, date: '04-22' },
          { name: 'Pobudka', amount: 22.90, date: '04-23' },
          { name: 'Wally', amount: 22.00, date: '04-30' },
          { name: 'Wally', amount: 22.00, date: '04-29' },
          { name: 'Pobudka', amount: 21.90, date: '04-15' },
          { name: 'Pobudka', amount: 21.90, date: '04-14' },
          { name: 'PeP*H event', amount: 29.00, date: '04-23' },
          { name: 'Wally', amount: 20.00, date: '04-16' },
        ],
        transport: [
          { name: 'Wizzair (Morocco flights)', amount: 648.00, date: '04-23' },
          { name: 'Uber', amount: 53.55, date: '04-01' },
          { name: 'Uber Eats', amount: 50.96, date: '04-13' },
          { name: 'Bolt', amount: 20.90, date: '04-30' },
          { name: 'Uber', amount: 25.84, date: '04-24' },
          { name: 'Uber', amount: 20.47, date: '04-15' },
          { name: 'Uber', amount: 18.95, date: '04-02' },
          { name: 'Uber', amount: 18.90, date: '04-14' },
          { name: 'Uber', amount: 18.54, date: '04-12' },
          { name: 'Uber', amount: 18.47, date: '04-04' },
          { name: 'Uber', amount: 17.27, date: '04-25' },
          { name: 'Uber', amount: 16.87, date: '04-10' },
          { name: 'Uber', amount: 16.58, date: '04-12' },
          { name: 'Uber', amount: 16.39, date: '04-06' },
          { name: 'Uber', amount: 16.06, date: '04-08' },
          { name: 'Uber', amount: 15.28, date: '04-10' },
          { name: 'Uber', amount: 15.18, date: '04-03' },
          { name: 'Uber', amount: 14.43, date: '04-05' },
          { name: 'Uber', amount: 12.78, date: '04-09' },
          { name: 'Uber', amount: 12.64, date: '04-26' },
          { name: 'Lime scooter', amount: 9.11, date: '04-07' },
          { name: 'BP fuel', amount: 13.48, date: '04-19' },
          { name: 'Shell fuel', amount: 5.29, date: '04-20' },
          { name: 'Bolt', amount: 15.40, date: '04-03' },
        ],
        health: [
          { name: 'Dentysta ⚠️ extraordinary', amount: 450.00, date: '04-28' },
          { name: 'Shamrock Barbershop', amount: 90.00, date: '04-03' },
        ],
        clothing: [
          { name: 'TK Maxx', amount: 349.99, date: '04-25' },
          { name: 'LP Reserved (shoes)', amount: 129.99, date: '04-30' },
          { name: 'LP Reserved (shoes)', amount: 79.99, date: '04-25' },
        ],
        shopping: [
          { name: 'Monnarita (furniture) ⚠️', amount: 429.00, date: '04-23' },
          { name: 'Allegro', amount: 571.85, date: '04-13' },
          { name: 'Temu', amount: 365.18, date: '04-07' },
          { name: 'Leroy Merlin', amount: 159.20, date: '04-16' },
          { name: 'Allegro', amount: 74.80, date: '04-18' },
          { name: 'Castorama', amount: 22.98, date: '04-13' },
        ],
        entertainment: [
          { name: 'Claude.ai subscription', amount: 96.03, date: '04-28' },
          { name: 'Kraken Pro (Google Play)', amount: 23.99, date: '04-12' },
          { name: 'Google One', amount: 8.99, date: '04-06' },
        ],
        cash: [
          { name: 'Revolut (Morocco prep)', amount: 420.45, date: '04-27' },
          { name: 'Revolut (Morocco prep)', amount: 220.13, date: '04-23' },
        ],
      },
    },
    '2026-05': {
      income: 0,  // salary paid ~May 28–30, after statement cutoff (May 22)
      freelance: 0,
      balances: { mbank: null, millennium: 6566 },
      spending: {
        groceries: 526,
        dining: 493,
        bars: 155,
        transport: 379,
        health: 3001,
        clothing: 306,
        shopping: 5978,
        entertainment: 350,
        cash: 2138,
      },
      transactions: {
        groceries: [
          { name: 'Carrefour', amount: 193.62, date: '05-16' },
          { name: 'Carrefour', amount: 79.09, date: '05-13' },
          { name: 'Carrefour', amount: 62.77, date: '05-21' },
          { name: 'Żabka', amount: 45.69, date: '05-17' },
          { name: 'Kandm Delikatesy', amount: 37.68, date: '05-02' },
          { name: 'Carrefour', amount: 19.01, date: '05-20' },
          { name: 'Żabka', amount: 18.98, date: '05-14' },
          { name: 'Carrefour Express', amount: 12.79, date: '05-03' },
          { name: 'Biedronka', amount: 11.99, date: '05-19' },
          { name: 'Airport Chopina', amount: 8.50, date: '05-05' },
          { name: 'Żabka', amount: 7.49, date: '05-16' },
          { name: 'Żabka', amount: 6.60, date: '05-20' },
          { name: 'Mahatta market (Morocco)', amount: 22.17, date: '05-11' },
        ],
        dining: [
          { name: 'Dominos (delivery)', amount: 45.95, date: '05-02' },
          { name: 'Dominos (delivery)', amount: 45.95, date: '05-13' },
          { name: 'Dominos (delivery)', amount: 45.95, date: '05-19' },
          { name: 'Uber Eats', amount: 57.75, date: '05-01' },
          { name: 'Restau Le Grand Bazar (Morocco)', amount: 71.85, date: '05-11' },
          { name: 'Green Coffee', amount: 43.40, date: '05-03' },
          { name: 'Green Coffee', amount: 35.40, date: '05-04' },
          { name: 'Green Coffee', amount: 34.90, date: '05-13' },
          { name: 'Green Coffee', amount: 34.90, date: '05-16' },
          { name: 'McDonald\'s (Morocco)', amount: 34.55, date: '05-12' },
          { name: 'PLSBX (work lunch)', amount: 26.50, date: '05-01' },
          { name: 'McDonald\'s (Morocco)', amount: 11.92, date: '05-11' },
          { name: 'Automat vending', amount: 3.50, date: '05-19' },
        ],
        bars: [
          { name: 'Ticketmaster (event ticket)', amount: 135.00, date: '05-02' },
          { name: 'Wally', amount: 20.00, date: '05-21' },
        ],
        transport: [
          { name: 'Parking MZA', amount: 250.00, date: '05-12' },
          { name: 'Uber', amount: 34.16, date: '05-04' },
          { name: 'Uber', amount: 21.59, date: '05-01' },
          { name: 'Uber', amount: 21.51, date: '05-07' },
          { name: 'Uber', amount: 16.95, date: '05-14' },
          { name: 'Uber', amount: 16.46, date: '05-06' },
          { name: 'Uber', amount: 12.56, date: '05-01' },
          { name: 'Shell (Morocco)', amount: 5.74, date: '05-11' },
        ],
        health: [
          { name: 'Dentysta ⚠️ extraordinary', amount: 2220.00, date: '05-19' },
          { name: 'Dentysta ⚠️ extraordinary', amount: 500.00, date: '05-20' },
          { name: 'Sassy Company (beauty)', amount: 120.00, date: '05-04' },
          { name: 'Rossmann', amount: 58.13, date: '05-04' },
          { name: 'Gate Retail Wizz (airport)', amount: 55.04, date: '05-13' },
          { name: 'JMIDF pharmacy', amount: 34.99, date: '05-16' },
          { name: 'Gate Retail Wizz (airport)', amount: 13.21, date: '05-13' },
        ],
        clothing: [
          { name: 'eobuwie.com (shoes)', amount: 256.98, date: '05-20' },
          { name: 'Moroccan Roses (souvenir)', amount: 49.28, date: '05-11' },
        ],
        shopping: [
          { name: 'Siveco Design (renovation) ⚠️', amount: 3520.00, date: '05-09' },
          { name: 'Siveco Design (renovation) ⚠️', amount: 2106.00, date: '05-09' },
          { name: 'GetYourGuide Marrakech tour', amount: 140.05, date: '05-08' },
          { name: 'GetYourGuide Paradise Valley', amount: 107.88, date: '05-09' },
          { name: 'GetYourGuide excursion', amount: 69.45, date: '05-07' },
          { name: 'home-you.com (decor)', amount: 34.98, date: '05-18' },
          { name: 'VOTINGPARTNER once.net', amount: 9.84, date: '05-18' },
        ],
        entertainment: [
          { name: 'ArtStation Pro annual ⚠️', amount: 314.49, date: '05-22' },
          { name: 'Kraken Pro (Google Play)', amount: 23.99, date: '05-11' },
          { name: 'Google One', amount: 8.99, date: '05-15' },
          { name: 'Google One', amount: 2.61, date: '05-06' },
        ],
        cash: [
          { name: 'ATM withdrawal mBank', amount: 1000.00, date: '05-04' },
          { name: 'ATM withdrawal mBank', amount: 1000.00, date: '05-04' },
          { name: 'ATM Morocco (Marrakech)', amount: 137.54, date: '05-13' },
        ],
      },
    },
  },
}

export const useFinance = create((set, get) => ({
  data: null,
  loaded: false,

  load: async () => {
    const row = await db.settings.get('finance')
    const stored = row?.value
    const local = (stored && stored.version >= INITIAL.version) ? stored : INITIAL
    if (!stored || stored.version < INITIAL.version) {
      await db.settings.put({ key: 'finance', value: local })
    }
    set({ data: local, loaded: true })

    // Drive sync in background — don't block the UI
    if (!isSignedIn()) return
    try {
      const driveData = await downloadFinanceData()
      const current = get().data
      if (!driveData) {
        uploadFinanceData(current).catch(() => {})
        return
      }
      const localTs = current._syncedAt ? new Date(current._syncedAt).getTime() : 0
      const driveTs = driveData._syncedAt ? new Date(driveData._syncedAt).getTime() : 0
      if (driveTs > localTs) {
        await db.settings.put({ key: 'finance', value: driveData })
        set({ data: driveData })
      } else if (localTs > driveTs) {
        uploadFinanceData(current).catch(() => {})
      }
    } catch (e) {
      console.error('Finance Drive sync failed:', e)
    }
  },

  _save: async (data) => {
    const stamped = { ...data, _syncedAt: new Date().toISOString() }
    await db.settings.put({ key: 'finance', value: stamped })
    set({ data: stamped })
    if (isSignedIn()) {
      try { await uploadFinanceData(stamped) }
      catch (e) { console.error('Finance Drive upload failed:', e) }
    }
  },

  importMonth: async (monthKey, patch) => {
    const data = get().data
    const existing = data.months?.[monthKey] ?? {}
    // spending: support both flat {cat: total} and detailed {cat: {total, items}}
    // flatten to totals for spending, keep items in transactions
    const rawSpending = patch.spending ?? {}
    const spending = {}
    const transactions = { ...(existing.transactions ?? {}) }
    for (const [cat, val] of Object.entries(rawSpending)) {
      if (typeof val === 'number') {
        spending[cat] = val
      } else if (val && typeof val === 'object') {
        spending[cat] = val.total ?? val.items?.reduce((s, i) => s + i.amount, 0) ?? 0
        if (val.items) transactions[cat] = val.items
      }
    }
    if (patch.transactions) {
      Object.assign(transactions, patch.transactions)
    }
    const monthEntry = {
      ...existing,
      income: patch.income ?? existing.income,
      freelance: patch.freelance ?? existing.freelance,
      spending: { ...existing.spending, ...spending },
      ...(Object.keys(transactions).length && { transactions }),
      ...(patch.balances && { balances: patch.balances }),
    }
    const updated = {
      ...data,
      lastUpdated: new Date().toISOString().slice(0, 10),
      months: { ...data.months, [monthKey]: monthEntry },
      ...(patch.mortgage && { mortgage: { ...data.mortgage, ...patch.mortgage } }),
      ...(patch.cashLoan && { cashLoan: { ...data.cashLoan, ...patch.cashLoan } }),
      ...(patch.savings  && { savings:  { ...data.savings,  ...patch.savings  } }),
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
