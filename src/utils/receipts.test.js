import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildReceiptDocId,
    buildReceiptRecord,
    buildReceiptImportId,
    decodeReceiptImportData,
    getReceiptImportPayloadFromLocation,
    normalizeReceiptImportData,
    ReceiptImportError,
    validateReceiptPayload,
} from './receipts.js';

const encodeBase64Url = (value) => globalThis.Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

test('valid receipt payload is normalized with item mismatch warning', () => {
    const result = validateReceiptPayload({
        merchant: ' Örnek Market ',
        date: '2026-10-12',
        total: 90.2,
        currency: 'try',
        category: 'Market',
        items: [{ name: 'Ürün', quantity: 1, total: 15 }],
    });

    assert.equal(result.valid, true);
    assert.equal(result.normalized.merchant, 'Örnek Market');
    assert.equal(result.normalized.currency, 'TRY');
    assert.equal(result.validation.totalMismatch, true);
    assert.equal(result.validation.warnings.length, 1);
});

test('invalid payload reports missing and invalid fields', () => {
    const result = validateReceiptPayload({
        merchant: '',
        date: 'not-a-date',
        total: -5,
    });

    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /Mağaza/);
    assert.match(result.errors.join(' '), /tarih/i);
    assert.match(result.errors.join(' '), /pozitif/);
});

test('base64url import data decodes JSON', () => {
    const payload = { merchant: 'A', date: '2026-10-12', total: 1 };
    assert.deepEqual(decodeReceiptImportData(encodeBase64Url(payload)), payload);
});

test('base64url import data preserves Turkish UTF-8 text', () => {
    const payload = {
        merchant: 'Çağdaş Şarküteri İÖÜ ÇĞŞ',
        date: '2026-10-12',
        total: 123.45,
        items: [{ name: 'Sütlü çikolata', quantity: 2, total: 45.5 }],
    };
    const encoded = encodeBase64Url(payload);
    assert.deepEqual(decodeReceiptImportData(encoded), payload);
    assert.deepEqual(getReceiptImportPayloadFromLocation({ hash: `#data=${encoded}` }), payload);
});

test('base64url import data accepts line breaks and missing padding', () => {
    const payload = { merchant: 'Satır Sonlu Market', date: '2026-10-12', total: 42.5 };
    const encoded = encodeBase64Url(payload);
    const wrapped = `${encoded.slice(0, 8)}\n${encoded.slice(8, 21)}\r\n${encoded.slice(21)}`;
    assert.equal(normalizeReceiptImportData(wrapped), encoded);
    assert.deepEqual(decodeReceiptImportData(wrapped), payload);
});

test('long base64url import data decodes long item lists', () => {
    const payload = {
        merchant: 'Uzun Liste Market',
        date: '2026-10-12',
        total: 1275,
        items: Array.from({ length: 75 }, (_, index) => ({
            name: `Ürün ${index + 1}`,
            quantity: 1,
            total: 17,
        })),
    };
    assert.deepEqual(decodeReceiptImportData(encodeBase64Url(payload)), payload);
});

test('truncated JSON throws a friendly receipt import error with decoded text', () => {
    const encoded = globalThis.Buffer.from('{"merchant":"Kesik Market","date":"2026-10-12"', 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

    assert.throws(
        () => decodeReceiptImportData(encoded),
        (error) => (
            error instanceof ReceiptImportError
            && /JSON olarak okunamadı/.test(error.message)
            && error.details.decodedText.includes('Kesik Market')
        ),
    );
});

test('invalid utf-8 throws a friendly receipt import error', () => {
    const encoded = globalThis.Buffer.from([0xff, 0xfe, 0xfd]).toString('base64url');
    assert.throws(
        () => decodeReceiptImportData(encoded),
        (error) => error instanceof ReceiptImportError && /UTF-8/.test(error.message),
    );
});

test('invalid base64url JSON throws before Firestore import', () => {
    assert.throws(() => decodeReceiptImportData(encodeReceiptImportDataBroken()), ReceiptImportError);
});

test('record builder creates import id and duplicate candidates', () => {
    const payload = { merchant: 'A Market', date: '2026-10-12', total: 100, currency: 'TRY', uid: 'shortcut-uid', alanKodu: 'SHORTCUT' };
    const receipt = buildReceiptRecord({
        payload,
        user: { uid: 'user-1' },
        alanKodu: 'EV',
        existingReceipts: [{ id: 'old', merchant: 'a market', date: '2026-10-12', total: 100, currency: 'TRY', status: 'pending' }],
    });

    assert.equal(receipt.uid, 'user-1');
    assert.equal(receipt.alanKodu, 'EV');
    assert.equal(receipt.status, 'pending');
    assert.equal(receipt.importId, buildReceiptImportId(payload));
    assert.equal(receipt.rawPayload.uid, undefined);
    assert.equal(receipt.rawPayload.alanKodu, undefined);
    assert.deepEqual(receipt.validation.duplicateCandidateIds, ['old']);
});

test('receipt document id is deterministic for import id idempotency', () => {
    const first = buildReceiptDocId('EV', 'shortcut-123');
    const second = buildReceiptDocId('EV', 'shortcut-123');
    const otherArea = buildReceiptDocId('OFIS', 'shortcut-123');
    assert.equal(first, second);
    assert.notEqual(first, otherArea);
});

test('same explicit import id targets one document even if payload content differs', () => {
    const first = { importId: 'ios-repeat-1', merchant: 'A Market', date: '2026-10-12', total: 100 };
    const second = { importId: 'ios-repeat-1', merchant: 'B Market', date: '2026-10-13', total: 250 };
    const firstId = buildReceiptDocId('EV', buildReceiptImportId(first));
    const secondId = buildReceiptDocId('EV', buildReceiptImportId(second));
    assert.equal(firstId, secondId);
});

test('new receipt records are pending drafts and do not contain financial transaction fields', () => {
    const receipt = buildReceiptRecord({
        payload: { merchant: 'Market', date: '2026-10-12', total: 100 },
        user: { uid: 'auth-user' },
        alanKodu: 'EV',
    });

    assert.equal(receipt.status, 'pending');
    assert.equal(receipt.approvedTransactionId, '');
    assert.equal(receipt.selectedAccountId, '');
    assert.equal(receipt.hesapId, undefined);
    assert.equal(receipt.islemTipi, undefined);
    assert.equal(receipt.tutar, undefined);
});

const encodeReceiptImportDataBroken = () => globalThis.Buffer.from('{"ok":true', 'utf8')
    .toString('base64url');

