import test from 'node:test';
import assert from 'node:assert/strict';
import { getActiveDashboardInstallmentStatuses } from './dashboardInstallments.js';

const plan = (id, extra = {}) => ({
    id, baslik: id, toplamTutar: 300, aylikTutar: 100,
    taksitSayisi: 3, alisTarihi: new Date(2026, 8, 2), ...extra,
});
const payments = (id) => [1, 2, 3].map((number) => ({
    id: `${id}-${number}`, taksitId: id, installmentNumber: number,
    installmentCount: 3, installmentPlanTitle: id,
    islemTipi: 'gider', tutar: 100, tarih: new Date(2026, number + 7, 2),
}));

test('dashboard excludes completed plans and completed history reconstructed from payments', () => {
    const statuses = getActiveDashboardInstallmentStatuses([
        plan('active', { odenmisTaksit: 2 }),
        plan('counter-completed', { odenmisTaksit: 3 }),
        plan('payments-completed'),
        plan('flag-completed', { status: 'completed' }),
        plan('remaining-completed', { remainingInstallments: 0 }),
    ], [...payments('payments-completed'), ...payments('deleted-completed')]);

    assert.deepEqual(statuses.map(({ installment }) => installment.id), ['active']);
});

test('paying an installment keeps an unfinished plan visible until the final payment', () => {
    const installment = plan('active');
    assert.equal(getActiveDashboardInstallmentStatuses([installment], payments('active').slice(0, 2)).length, 1);
    assert.equal(getActiveDashboardInstallmentStatuses([installment], payments('active')).length, 0);
});
