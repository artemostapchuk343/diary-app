import { create } from 'zustand'
import { db } from './db'

// Morocco trip — compiled from desktop note + mBank/Millennium statements
const MOROCCO = {
  id: 'morocco-2026-05',
  destination: 'Morocco',
  subtitle: 'Tamraght surf camp · Marrakech',
  flag: '🇲🇦',
  dates: { from: '2026-05-05', to: '2026-05-12' },
  days: 8,
  totalPLN: 4399,
  color: '#c87533',   // earthy amber
  gradient: 'from-amber-900/60 to-orange-950/80',
  sections: [
    {
      id: 'flights',
      label: 'Flights & Airport',
      icon: '✈️',
      total: 785,
      items: [
        { name: 'Wizzair — WAW → RAK → WAW', amount: 648, note: 'mBank 23 Apr' },
        { name: 'Flight food (onboard)', amount: 69 },
        { name: 'Gate Retail at airport (snacks)', amount: 68, note: 'Millennium 13 May' },
      ],
    },
    {
      id: 'accommodation',
      label: 'Accommodation',
      icon: '🏄',
      total: 1991,
      items: [
        { name: 'Surf camp, Tamraght (7 nights)', amount: 1571, note: '370 EUR' },
        { name: 'Hotel, Marrakech (1 night)', amount: 420, note: '93.50 EUR via Revolut' },
      ],
    },
    {
      id: 'activities',
      label: 'Activities',
      icon: '🗺️',
      total: 443,
      items: [
        { name: 'Surf camp taxi (Agadir → Tamraght)', amount: 127, note: '30 EUR' },
        { name: 'Marrakech city guided tour', amount: 140, note: 'GetYourGuide' },
        { name: 'Paradise Valley excursion', amount: 69, note: 'GetYourGuide' },
        { name: 'Sandboarding', amount: 107, note: 'GetYourGuide' },
      ],
    },
    {
      id: 'food',
      label: 'Food & Drink',
      icon: '🍽️',
      total: 215,
      items: [
        { name: 'Food in Tamraght', amount: 91, note: '230 MAD' },
        { name: 'Restau Le Grand Bazar, Marrakech', amount: 72, note: 'mBank 11 May' },
        { name: 'McDonald\'s (2×, road)', amount: 46, note: 'mBank 11–12 May' },
        { name: 'Shell, fuel stop', amount: 6 },
      ],
    },
    {
      id: 'admin',
      label: 'Visas & Services',
      icon: '📋',
      total: 756,
      items: [
        { name: 'Express visa at border', amount: 463, note: '1,100 MAD' },
        { name: 'Travel insurance', amount: 37 },
        { name: '2× 1 GB eSIM data', amount: 36, note: '~10 USD' },
        { name: 'Revolut top-up / exchange fees', amount: 220, note: 'Millennium 23 Apr' },
      ],
    },
    {
      id: 'personal',
      label: 'Personal',
      icon: '🎁',
      total: 209,
      items: [
        { name: 'Zinc sunscreen stick', amount: 80, note: '200 MAD' },
        { name: 'Halima tip (surf instructor)', amount: 80, note: '200 MAD' },
        { name: 'Moroccan Roses (souvenir)', amount: 49, note: 'mBank 11 May' },
      ],
    },
  ],
}

const TRIPS_VERSION = 2
const INITIAL_TRIPS = [MOROCCO]

export const useTravelData = create((set, get) => ({
  trips: null,
  loaded: false,

  load: async () => {
    const row = await db.settings.get('trips')
    const stored = row?.value
    // Re-seed when no data or version is outdated
    if (!stored || !stored._v || stored._v < TRIPS_VERSION) {
      const data = { _v: TRIPS_VERSION, list: INITIAL_TRIPS }
      await db.settings.put({ key: 'trips', value: data })
      set({ trips: INITIAL_TRIPS, loaded: true })
      return
    }
    set({ trips: stored.list ?? INITIAL_TRIPS, loaded: true })
  },

  addTrip: async (trip) => {
    const trips = [...(get().trips ?? []), trip]
    await db.settings.put({ key: 'trips', value: { _v: TRIPS_VERSION, list: trips } })
    set({ trips })
  },

  updateTrip: async (id, patch) => {
    const trips = (get().trips ?? []).map(t => t.id === id ? { ...t, ...patch } : t)
    await db.settings.put({ key: 'trips', value: { _v: TRIPS_VERSION, list: trips } })
    set({ trips })
  },
}))
