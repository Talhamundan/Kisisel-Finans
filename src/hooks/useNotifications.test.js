import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDueNotificationMessage, maskMoneyInNotificationMessage } from '../utils/notifications.js';

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
