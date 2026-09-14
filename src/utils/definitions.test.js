import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFINITION_STATUS,
    getInstallmentStatus,
    sumMatchedPayments,
    summarizeDefinitionsOverview,
} from './definitions.js';

test('sumMatchedPayments totals only paid rows with matched transactions', () => {
    const summary = sumMatchedPayments([
        {
            id: 'paid-1',
            status: DEFINITION_STATUS.PAID,
            paidAmount: 2450.25,
            transaction: { id: 'tx-1', tutar: 2450.25 },
        },
        {
            id: 'waiting-1',
            status: DEFINITION_STATUS.WAITING,
            paidAmount: 120,
            transaction: null,
        },
        {
            id: 'zero-1',
            status: DEFINITION_STATUS.PAID,
            paidAmount: 0,
            transaction: null,
        },
        {
            id: 'paid-duplicate',
            status: DEFINITION_STATUS.PAID,
            paidAmount: 2450.25,
            transaction: { id: 'tx-1', tutar: 2450.25 },
        },
    ]);

    assert.equal(summary.count, 1);
    assert.equal(summary.total, 2450.25);
});

test('getInstallmentStatus paid amount comes from linked transactions only', () => {
    const status = getInstallmentStatus({
        id: 'installment-1',
        baslik: 'Ayakkabı',
        toplamTutar: 6000,
        taksitSayisi: 3,
        aylikTutar: 2000,
        odenmisTaksit: 2,
        alisTarihi: new Date('2026-01-01'),
    }, [
        {
            id: 'tx-1',
            islemTipi: 'gider',
            taksitId: 'installment-1',
            installmentNumber: 1,
            tutar: 2000,
            tarih: new Date('2026-01-01'),
        },
    ]);

    assert.equal(status.paidCount, 2);
    assert.equal(status.paidAmount, 2000);
    assert.equal(status.remainingAmount, 4000);
});

test('summarizeDefinitionsOverview keeps assets and debt items aligned with totals', () => {
    const summary = summarizeDefinitionsOverview({
        accounts: [
            { id: 'cash', hesapAdi: 'Nakit', hesapTipi: 'nakit', guncelBakiye: 100 },
            { id: 'investment', hesapAdi: 'Yatırım', hesapTipi: 'yatirim', guncelBakiye: 200 },
            { id: 'card', hesapAdi: 'Kart', hesapTipi: 'krediKarti', guncelBakiye: -300 },
        ],
        debts: [{ id: 'debt-1', ad: 'Manuel', kalanTutar: 400 }],
        financings: [],
        installments: [
            { id: 'installment-1', baslik: 'Taksit', toplamTutar: 600, taksitSayisi: 3, aylikTutar: 200 },
        ],
        transactions: [],
    });

    const assetItemsTotal = summary.assets.items.reduce((sum, item) => sum + item.value, 0);
    const debtItemsTotal = summary.debts.items.reduce((sum, item) => sum + item.value, 0);

    assert.equal(summary.assets.total, 300);
    assert.equal(assetItemsTotal, summary.assets.total);
    assert.equal(summary.debts.total, 1300);
    assert.equal(debtItemsTotal, summary.debts.total);
});
