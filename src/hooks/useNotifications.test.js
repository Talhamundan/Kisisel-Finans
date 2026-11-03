import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDueNotificationMessage, maskMoneyInNotificationMessage, sortNotificationsByDueDay } from '../utils/notifications.js';

test('overdue unpaid notifications include delayed wording', () => {
    assert.equal(
        buildDueNotificationMessage({ name: 'Zekat (%3)', daysLeft: -1, overdueText: 'ödenmedi' }),
        '🔥 Zekat (%3) ödenmedi! (1 gün gecikti)'
    );
});

test('overdue notifications do not duplicate gecikti when status already says it', () => {
    assert.equal(
        buildDueNotificationMessage({ name: 'Elektrik Faturası', daysLeft: -2, overdueText: 'GECİKTİ' }),
        '🔥 Elektrik Faturası GECİKTİ! (2 gün)'
    );
});

test('hidden notifications mask money inside pending sale messages', () => {
    assert.equal(
        maskMoneyInNotificationMessage('🔔 HNM, Sandisk Extreme Portable SSD 1TB için kalan ₺4.200,00 ödemesini henüz yapmadı.', true),
        '🔔 HNM, Sandisk Extreme Portable SSD 1TB için kalan **** ₺ ödemesini henüz yapmadı.'
    );
});

test('pending items sort by due day across types without changing the source list', () => {
    const notifications = [
        { id: 'icloud', tip: 'abonelik', daysLeft: 3 },
        { id: 'instagram', tip: 'abonelik', daysLeft: 1 },
        { id: 'airpods', tip: 'taksit', daysLeft: 2 },
        { id: 'limit', tip: 'kk_limit' },
        { id: 'today', tip: 'hatirlatici', daysLeft: 0 },
        { id: 'late', tip: 'fatura', daysLeft: -1 },
        { id: 'oldest', tip: 'borc_hatirlatma', daysLeft: -5 },
        { id: 'same-day', tip: 'bes_odeme', daysLeft: 1 },
        { id: 'sale', tip: 'alacak' },
    ];
    const originalOrder = notifications.map(({ id }) => id);

    assert.deepEqual(sortNotificationsByDueDay(notifications).map(({ id }) => id), [
        'oldest', 'late', 'today', 'instagram', 'same-day', 'airpods', 'icloud', 'limit', 'sale',
    ]);
    assert.deepEqual(notifications.map(({ id }) => id), originalOrder);
    assert.deepEqual(sortNotificationsByDueDay(), []);
});
