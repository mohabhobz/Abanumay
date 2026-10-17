import { projectRows } from '@/data/mock/projects'
import { agreements } from '@/data/mock/agreements'
import { closeRows } from '@/data/mock/closing'
import { planRows } from '@/data/mock/plans'
import { payRequests } from '@/data/mock/disbursements'
import { seedWorkHours } from '@/lib/sla'
import { liveClock } from '@/data/stageClock'

/* v3 · 3.4.15 · the fixture's «time in stage» was written in calendar hours · read once at load in
   the working-day unit the limits use (lib/sla.ts), so a seeded row is late against the same span it
   was before. A move resets the clock to zero as before. */
for (const r of projectRows) r.hoursInStage = seedWorkHours(r.hoursInStage)
for (const r of agreements) r.hoursInStage = seedWorkHours(r.hoursInStage)
for (const r of closeRows) r.hoursInStage = seedWorkHours(r.hoursInStage)
for (const r of planRows) r.hoursInStage = seedWorkHours(r.hoursInStage)
for (const r of payRequests) r.hoursInState = seedWorkHours(r.hoursInState)

/* Batch 8 · cross x.5.1 · every record's clock runs from its next move (data/stageClock.ts) */
for (const r of projectRows) liveClock(r)
for (const r of agreements) liveClock(r)
for (const r of closeRows) liveClock(r)
for (const r of planRows) liveClock(r)
for (const r of payRequests) liveClock(r, 'hoursInState')
