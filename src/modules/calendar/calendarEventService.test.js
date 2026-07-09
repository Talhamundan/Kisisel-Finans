import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendarEventsFromData } from './calendarEventService.js';
import { buildMonthGrid } from './calendarUtils.js';

test('uses a compact five-week calendar layout', () => {
  const cells = buildMonthGrid(2026, 6);

  assert.equal(cells.length, 35);
});

test('builds normalized events from budget data', () => {
  const baseDate = new Date('2026-07-15T00:00:00.000Z');

  const events = buildCalendarEventsFromData({
    accounts: [
      { id: 'acc-1', hesapAdi: 'QNB', hesapTipi: 'krediKarti', kesimGunu: '10' },
    ],
    subscriptions: [
      { id: 'sub-1', ad: 'Spotify', tutar: 100, gun: 3 },
    ],
    installments: [
      { id: 'ins-1', baslik: 'Telefon', aylikTutar: 1200, taksitSayisi: 3, odenmisTaksit: 1, alisTarihi: new Date('2026-04-01T00:00:00.000Z') },
    ],
    bills: [
      { id: 'bill-1', tanimId: 'bill-def-1', tutar: 300, sonOdemeTarihi: '2026-07-20' },
    ],
    billDefinitions: [
      { id: 'bill-def-1', baslik: 'Elektrik Faturası' },
    ],
    salaries: [
      { id: 'sal-1', ad: 'Maaş', tutar: 5000, gun: 1 },
    ],
    goals: [
      { id: 'goal-1', hedefAdi: 'Laptop', hedefTutar: 20000, tarih: '2026-08-15' },
    ],
  }, baseDate);

  assert.ok(events.some((event) => event.type === 'credit_card_statement' && event.title.includes('QNB')));
  assert.ok(events.some((event) => event.type === 'subscription' && event.title === 'Spotify'));
  assert.ok(events.some((event) => event.type === 'installment' && event.title.includes('Telefon')));
  assert.ok(events.some((event) => event.type === 'bill' && event.title === 'Elektrik Faturası'));
  assert.ok(events.some((event) => event.type === 'salary' && event.title === 'Maaş'));
  assert.ok(events.some((event) => event.type === 'investment' && event.title.includes('Laptop')));
});
