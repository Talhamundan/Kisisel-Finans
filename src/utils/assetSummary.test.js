import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAssets } from './assetSummary.js';

test('summarizeAssets totals cash, investment cash, positions and BES once', () => {
    const summary = summarizeAssets({
        accounts: [
            { id: 'cash', hesapTipi: 'nakit', guncelBakiye: 30000 },
            { id: 'midas', hesapTipi: 'yatirim', guncelBakiye: 20000 },
        ],
        portfolio: [
            { id: 'stock', varlikTuru: 'Hisse', adet: 8, guncelFiyat: 10000, alisFiyati: 9000 },
        ],
        besData: { guncelTutar: 10000 },
    });

    assert.equal(summary.assets.availableCash, 30000);
    assert.equal(summary.assets.investmentCash, 20000);
    assert.equal(summary.assets.openPositionValue, 80000);
    assert.equal(summary.assets.besValue, 10000);
    assert.equal(summary.assets.total, 140000);
    assert.equal(summary.investment.power, 110000);
});

test('summarizeAssets subtracts credit card and manual debts once', () => {
    const summary = summarizeAssets({
        accounts: [
            { id: 'cash', hesapTipi: 'nakit', guncelBakiye: 30000 },
            { id: 'midas', hesapTipi: 'yatirim', guncelBakiye: 20000 },
            { id: 'card', hesapTipi: 'krediKarti', guncelBakiye: -25000 },
        ],
        portfolio: [
            { id: 'stock', varlikTuru: 'Hisse', adet: 8, guncelFiyat: 10000, alisFiyati: 9000 },
        ],
        besData: { guncelTutar: 10000 },
        debts: [{ id: 'manual', type: 'VERECEK', kalanTutar: 15000 }],
    });

    assert.equal(summary.assets.total, 140000);
    assert.equal(summary.debts.creditCards, 25000);
    assert.equal(summary.debts.manualDebt, 15000);
    assert.equal(summary.debts.total, 40000);
    assert.equal(summary.netWorth, 100000);
});

test('summarizeAssets keeps net worth stable after credit card payment', () => {
    const before = summarizeAssets({
        accounts: [
            { id: 'cash', hesapTipi: 'nakit', guncelBakiye: 30000 },
            { id: 'card', hesapTipi: 'krediKarti', guncelBakiye: -10000 },
        ],
    });
    const after = summarizeAssets({
        accounts: [
            { id: 'cash', hesapTipi: 'nakit', guncelBakiye: 25000 },
            { id: 'card', hesapTipi: 'krediKarti', guncelBakiye: -5000 },
        ],
    });

    assert.equal(before.netWorth, 20000);
    assert.equal(after.netWorth, 20000);
});

test('summarizeAssets prefers bes_data.guncelTutar over legacy BES portfolio records', () => {
    const summary = summarizeAssets({
        portfolio: [
            { id: 'legacy-bes', varlikTuru: 'BES', adet: 1, guncelFiyat: 20000, alisFiyati: 20000 },
        ],
        besData: { guncelTutar: 20000 },
    });

    assert.equal(summary.assets.besValue, 20000);
    assert.equal(summary.assets.openPositionValue, 0);
    assert.equal(summary.assets.total, 20000);
    assert.equal(summary.diagnostics[0].type, 'ignored_legacy_bes_portfolio');
});

test('summarizeAssets preserves total assets after investment purchase', () => {
    const before = summarizeAssets({
        accounts: [{ id: 'midas', hesapTipi: 'yatirim', guncelBakiye: 50000 }],
    });
    const after = summarizeAssets({
        accounts: [{ id: 'midas', hesapTipi: 'yatirim', guncelBakiye: 20000 }],
        portfolio: [{ id: 'stock', varlikTuru: 'Hisse', adet: 3, guncelFiyat: 10000, alisFiyati: 10000 }],
    });

    assert.equal(before.assets.total, 50000);
    assert.equal(after.assets.investmentCash, 20000);
    assert.equal(after.assets.openPositionValue, 30000);
    assert.equal(after.assets.total, 50000);
});

test('summarizeAssets keeps negative credit card balances out of available cash', () => {
    const summary = summarizeAssets({
        accounts: [
            { id: 'cash', hesapTipi: 'nakit', guncelBakiye: 30000 },
            { id: 'card', hesapTipi: 'krediKarti', guncelBakiye: -10000 },
        ],
    });

    assert.equal(summary.cash.available, 30000);
    assert.equal(summary.debts.creditCards, 10000);
    assert.equal(summary.netWorth, 20000);
});

test('summarizeAssets uses BES fallbacks without overriding an explicit zero', () => {
    const explicitZero = summarizeAssets({
        besData: { guncelTutar: 0, guncelDeger: 12000 },
    });
    const legacy = summarizeAssets({
        besData: { guncelDeger: 12000 },
    });

    assert.equal(explicitZero.assets.besValue, 0);
    assert.equal(legacy.assets.besValue, 12000);
});
