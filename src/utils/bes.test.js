import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getBesPaymentReminder,
    sumBesContributions,
    sumBesDeductions,
} from './bes.js';
import { summarizeAssets } from './assetSummary.js';

const besPayment = (tutar, tarih) => ({
    kategori: 'BES',
    islemTipi: 'gider',
    tutar,
    tarih: new Date(tarih),
});

test('cumulative BES contributions stay visible when selected month has no payment', () => {
    const transactions = [
        besPayment(1140, '2026-01-15'),
        besPayment(1140, '2026-02-15'),
        besPayment(1140, '2026-03-15'),
        besPayment(1140, '2026-04-15'),
    ];

    assert.equal(sumBesContributions(transactions), 4560);
    assert.equal(sumBesContributions(transactions, { year: 2026, month: 10 }), 0);
});

test('cumulative BES contributions are independent from year filter', () => {
    const transactions = [
        besPayment(1000, '2025-12-15'),
        besPayment(1140, '2026-01-15'),
    ];

    assert.equal(sumBesContributions(transactions), 2140);
    assert.equal(sumBesContributions(transactions, { year: 2025, month: 'all' }), 1000);
    assert.equal(sumBesContributions(transactions, { year: 2026, month: 'all' }), 1140);
});

test('period BES contribution and deduction totals follow selected period', () => {
    const transactions = [
        besPayment(1140, '2026-10-10'),
        besPayment(1140, '2026-11-10'),
        { kategori: 'Market', islemTipi: 'gider', tutar: 500, tarih: new Date('2026-10-12') },
    ];
    const deductions = [
        { tutar: 20, tarih: new Date('2026-10-20') },
        { tutar: 30, tarih: new Date('2026-11-20') },
    ];

    assert.equal(sumBesContributions(transactions, { year: 2026, month: 10 }), 1140);
    assert.equal(sumBesContributions(transactions, { year: 2026, month: 'all' }), 2280);
    assert.equal(sumBesDeductions(deductions, { year: 2026, month: 10 }), 20);
    assert.equal(sumBesDeductions(deductions, { year: 2026, month: 'all' }), 50);
});

test('BES reminder uses configured monthly contribution amount', () => {
    const reminder = getBesPaymentReminder({
        besData: { odemeGunu: 15, varsayilanTutar: 1140, varsayilanHesapId: 'bank' },
        transactions: [],
        now: new Date('2026-10-12T12:00:00'),
        notificationWindowDays: 3,
    });

    assert.equal(reminder.amount, 1140);
    assert.equal(reminder.daysLeft, 3);
});

test('BES reminder is not produced when monthly amount is missing or zero', () => {
    assert.equal(getBesPaymentReminder({
        besData: { odemeGunu: 15, varsayilanHesapId: 'bank' },
        transactions: [],
        now: new Date('2026-10-12T12:00:00'),
        notificationWindowDays: 3,
    }), null);

    assert.equal(getBesPaymentReminder({
        besData: { odemeGunu: 15, varsayilanTutar: 0, varsayilanHesapId: 'bank' },
        transactions: [],
        now: new Date('2026-10-12T12:00:00'),
        notificationWindowDays: 3,
    }), null);
});

test('BES asset total remains sourced from current balance, not contribution period', () => {
    const summary = summarizeAssets({
        besData: { guncelTutar: 29464.39 },
    });

    assert.equal(summary.assets.besValue, 29464.39);
    assert.equal(summary.investment.bes, 29464.39);
});
