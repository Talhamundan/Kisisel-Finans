import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCariSummaries } from './cari.js';

const cari = { id: 'yusuf', ad: 'Yusuf Kuliyev' };

test('legacy debts without cariId appear under the matching registered cari', () => {
    const summaries = buildCariSummaries([
        { id: 'legacy', ad: '  yusuf   kuliyev ', type: 'ALACAK', kalanTutar: 4000 },
        { id: 'linked', cariId: cari.id, type: 'ALACAK', kalanTutar: 4000 },
    ], [cari]);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].id, cari.id);
    assert.equal(summaries[0].activeCount, 2);
    assert.equal(summaries[0].activeReceivable, 8000);
});

test('cari balances include future due receivables and separate completed items', () => {
    const [summary] = buildCariSummaries([
        { id: 'future', cariId: cari.id, type: 'ALACAK', kalanTutar: 4000, sonOdemeTarihi: '2026-11-02' },
        { id: 'paid', cariId: cari.id, type: 'ALACAK', kalanTutar: 0, toplamTutar: 4000, status: 'completed' },
        { id: 'payable', cariId: cari.id, type: 'VERECEK', kalanTutar: 500 },
    ], [cari]);
    assert.equal(summary.activeReceivable, 4000);
    assert.equal(summary.activePayable, 500);
    assert.equal(summary.netBalance, 3500);
    assert.equal(summary.activeCount, 2);
    assert.equal(summary.completedCount, 1);
});

test('explicit cari links take priority over matching names', () => {
    const summaries = buildCariSummaries([
        { id: 'debt', cariId: 'another', ad: cari.ad, type: 'ALACAK', kalanTutar: 4000 },
    ], [cari, { id: 'another', ad: cari.ad }]);
    assert.equal(summaries.find((item) => item.id === cari.id).activeCount, 0);
    assert.equal(summaries.find((item) => item.id === 'another').activeReceivable, 4000);
});

test('cari deletion selection includes completed and legacy debts without taking another cari records', () => {
    const summaries = buildCariSummaries([
        { id: 'active', cariId: cari.id, kalanTutar: 200 },
        { id: 'completed', cariId: cari.id, kalanTutar: 0, status: 'completed' },
        { id: 'legacy', ad: ' yusuf kuliyev ', kalanTutar: 0, status: 'completed' },
        { id: 'other', cariId: 'another', ad: cari.ad, kalanTutar: 50 },
    ], [cari, { id: 'another', ad: cari.ad }]);
    const selected = summaries.find((item) => item.key === cari.id);
    assert.deepEqual(selected.allItems.map((item) => item.id), ['active', 'completed', 'legacy']);
    assert.equal(selected.activeItems.length, 1);
    assert.equal(selected.completedItems.length, 2);
});

test('legacy cari without a definition and empty registered cari can be selected for deletion', () => {
    const summaries = buildCariSummaries([
        { id: 'legacy', ad: 'Eski Cari', kalanTutar: 0, status: 'completed' },
    ], [cari]);
    assert.equal(summaries.find((item) => item.key === 'eski cari').allItems[0].id, 'legacy');
    assert.deepEqual(summaries.find((item) => item.key === cari.id).allItems, []);
});
