import test from 'node:test';
import assert from 'node:assert/strict';
import { isActiveAccount, isInvestmentAccount, selectHasInvestmentAccount } from './accounts.js';

test('selectHasInvestmentAccount returns false when there are no investment accounts', () => {
    assert.equal(selectHasInvestmentAccount([]), false);
    assert.equal(selectHasInvestmentAccount([
        { id: 'cash', hesapTipi: 'nakit', guncelBakiye: 5000 },
        { id: 'card', hesapTipi: 'krediKarti', guncelBakiye: -1200 },
    ]), false);
});

test('selectHasInvestmentAccount ignores balance and accepts zero balance investment accounts', () => {
    assert.equal(selectHasInvestmentAccount([
        { id: 'investment-zero', hesapTipi: 'yatirim', guncelBakiye: 0 },
    ]), true);
});

test('selectHasInvestmentAccount returns true for funded active investment accounts', () => {
    assert.equal(selectHasInvestmentAccount([
        { id: 'investment-funded', hesapTipi: 'yatirim', guncelBakiye: 12500 },
    ]), true);
});

test('selectHasInvestmentAccount excludes inactive or deleted investment accounts', () => {
    assert.equal(selectHasInvestmentAccount([
        { id: 'inactive', hesapTipi: 'yatirim', aktif: false, guncelBakiye: 1000 },
        { id: 'passive', hesapTipi: 'yatirim', pasif: true, guncelBakiye: 1000 },
        { id: 'deleted', hesapTipi: 'yatirim', deletedAt: new Date(), guncelBakiye: 1000 },
    ]), false);
});

test('account helpers normalize investment account type labels', () => {
    assert.equal(isInvestmentAccount({ hesapTipi: 'Yatırım Hesabı' }), true);
    assert.equal(isInvestmentAccount({ accountType: 'investment_account' }), true);
    assert.equal(isInvestmentAccount({ hesapTipi: 'nakit' }), false);
    assert.equal(isActiveAccount({ hesapTipi: 'yatirim' }), true);
});
