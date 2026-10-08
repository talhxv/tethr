// In-memory stand-ins for Notion and Google Calendar, used only when
// BOOKING_MOCK=1. Nothing leaves the process and nothing survives a restart.
import { randomUUID } from 'node:crypto'

const HOUR = 3_600_000

const state = {
  leads: new Map(),
  // A few existing "meetings" so the picker has gaps like a real calendar
  busy: [26, 29.5, 50, 75].map((h) => {
    const start = Math.ceil(Date.now() / HOUR) * HOUR + h * HOUR
    return { start, end: start + HOUR }
  }),
  leadsDown: false,
  calendarDown: false,
  markFailures: 0,
}

export const leads = {
  async createLead(lead) {
    if (state.leadsDown) throw new Error('Mock: lead store is down')
    const id = randomUUID()
    state.leads.set(id, { id, ...lead, booked: false })
    return id
  },
  async getLead(id) {
    if (state.leadsDown) throw new Error('Mock: lead store is down')
    return state.leads.get(id) ?? null
  },
  async markBooked(id, booking) {
    if (state.markFailures > 0) {
      state.markFailures--
      throw new Error('Mock: lead update failed')
    }
    Object.assign(state.leads.get(id), { booked: true, booking })
  },
}

export const calendar = {
  async busy() {
    if (state.calendarDown) throw new Error('Mock: calendar is down')
    return state.busy
  },
  async createEvent({ lead, start, end }) {
    if (state.calendarDown) throw new Error('Mock: calendar is down')
    state.busy.push({ start: Date.parse(start), end: Date.parse(end) })
    return { eventId: lead.id.replace(/-/g, ''), start, end, meetLink: 'https://meet.google.com/mock-call-link' }
  },
}

/* POST /api/booking-mock — test controls, routed only in mock mode.
   { calendar: 'down' | 'up' }   availability and booking fail / recover
   { leads: 'down' | 'up' }      saving a lead fails / recovers
   { take: '<ISO start>' }       someone else books that slot (30 minutes)
   { markFails: n }              the next n updates of a booked lead fail
   Answers with the current state, leads included. */
export function control(body = {}) {
  if (body.calendar) state.calendarDown = body.calendar === 'down'
  if (body.leads) state.leadsDown = body.leads === 'down'
  if (Number.isInteger(body.markFails)) state.markFailures = body.markFails
  if (body.take) {
    const start = Date.parse(body.take)
    if (Number.isFinite(start)) state.busy.push({ start, end: start + HOUR / 2 })
  }
  return { calendarDown: state.calendarDown, leadsDown: state.leadsDown, busy: state.busy.length, leads: [...state.leads.values()] }
}
