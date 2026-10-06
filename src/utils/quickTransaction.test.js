import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getLatestExpenseAccountId,
    getLatestTransferAccountIds,
    getQuickExpenseDefaultAccountId,
    getQuickTransferDefaultAccountIds,
} from './quickTransaction.js';

test('getLatestExpenseAccountId returns the account from the newest expense', () => {
    const validAccountIds = new Set(['cash', 'card']);

    assert.equal(getLatestExpenseAccountId([
        { id: 'income-1', hesapId: 'cash', islemTipi: 'gelir', tarih: '2026-01-03T10:00:00.000Z' },
        { id: 'expense-1', hesapId: 'cash', islemTipi: 'gider', tarih: '2026-01-01T10:00:00.000Z' },
        { id: 'expense-2', hesapId: 'card', islemTipi: 'gider', tarih: { seconds: 1767319200 } },
    ], validAccountIds), 'card');
});

test('getQuickExpenseDefaultAccountId falls back to latest expense before default account', () => {
    assert.equal(getQuickExpenseDefaultAccountId({
        accounts: [{ id: 'default' }, { id: 'latest' }],
        transactions: [
            { hesapId: 'default', islemTipi: 'gider', tarih: '2026-01-01T10:00:00.000Z' },
            { hesapId: 'latest', islemTipi: 'gider', tarih: '2026-01-02T10:00:00.000Z' },
        ],
        defaultPaymentAccountId: 'default',
    }), 'latest');
});

test('getLatestTransferAccountIds returns source and target from the newest transfer', () => {
    assert.deepEqual(getLatestTransferAccountIds([
        { kaynakId: 'cash', hedefId: 'savings', islemTipi: 'transfer', tarih: '2026-01-01T10:00:00.000Z' },
        { kaynakId: 'card', hedefId: 'cash', islemTipi: 'transfer', tarih: '2026-01-03T10:00:00.000Z' },
        { hesapId: 'cash', islemTipi: 'gider', tarih: '2026-01-04T10:00:00.000Z' },
    ], new Set(['cash', 'savings', 'card'])), {
        sourceId: 'card',
        targetId: 'cash',
    });
});

test('getQuickTransferDefaultAccountIds falls back to latest transfer before default source', () => {
    assert.deepEqual(getQuickTransferDefaultAccountIds({
        accounts: [{ id: 'default' }, { id: 'source' }, { id: 'target' }],
        transactions: [
            { kaynakId: 'source', hedefId: 'target', islemTipi: 'transfer', tarih: '2026-01-02T10:00:00.000Z' },
        ],
        defaultPaymentAccountId: 'default',
    }), {
        sourceId: 'source',
        targetId: 'target',
    });
});
