import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyCreditCardPaymentToBalances,
    CREDIT_CARD_PAYMENT_TYPES,
    getCreditCardPaymentAmountOptions,
    isCreditCardStatementPaymentTransaction,
    validateCreditCardPayment,
} from './creditCardPayments.js';

const cash = (overrides = {}) => ({
    id: 'cash-1',
    hesapAdi: 'Vadesiz',
    hesapTipi: 'nakit',
    guncelBakiye: 1000,
    paraBirimi: 'TRY',
    ...overrides,
});

const card = (overrides = {}) => ({
    id: 'card-1',
    hesapAdi: 'Kart',
    hesapTipi: 'krediKarti',
    guncelBakiye: -500,
    asgariOdemeTutari: 100,
    paraBirimi: 'TRY',
    ...overrides,
});

test('tam ekstre ödemesi kartı ve yaklaşan ödemeyi kapatır', () => {
    const result = applyCreditCardPaymentToBalances({
        sourceAccount: cash(),
        cardAccount: card(),
        amount: 500,
        paymentId: 'payment-full',
    });

    assert.equal(result.valid, true);
    assert.equal(result.sourceBalance, 500);
    assert.equal(result.cardBalance, 0);
    assert.equal(result.metadata.statementRemainingAfterPayment, 0);
    assert.equal(result.metadata.statementPaid, true);
});

test('kısmi ödeme kalan ekstre borcunu günceller', () => {
    const result = applyCreditCardPaymentToBalances({
        sourceAccount: cash(),
        cardAccount: card(),
        amount: 200,
        paymentId: 'payment-partial',
    });

    assert.equal(result.valid, true);
    assert.equal(result.sourceBalance, 800);
    assert.equal(result.cardBalance, -300);
    assert.equal(result.metadata.appliedToStatement, 200);
    assert.equal(result.metadata.statementRemainingAfterPayment, 300);
    assert.equal(result.metadata.statementPaid, false);
});

test('birden fazla kısmi ödeme kalan borcu doğru taşır', () => {
    const first = applyCreditCardPaymentToBalances({
        sourceAccount: cash(),
        cardAccount: card(),
        amount: 150,
        paymentId: 'payment-partial-1',
    });
    const second = applyCreditCardPaymentToBalances({
        sourceAccount: cash({ guncelBakiye: first.sourceBalance }),
        cardAccount: card({ guncelBakiye: first.cardBalance }),
        amount: 200,
        paymentId: 'payment-partial-2',
    });

    assert.equal(second.valid, true);
    assert.equal(second.sourceBalance, 650);
    assert.equal(second.cardBalance, -150);
    assert.equal(second.metadata.statementRemainingAfterPayment, 150);
});

test('güncel borç ödemesi kart borcunu sıfırlar', () => {
    const result = applyCreditCardPaymentToBalances({
        sourceAccount: cash({ guncelBakiye: 1200 }),
        cardAccount: card({ guncelBakiye: -800, asgariOdemeTutari: 160 }),
        amount: 800,
        paymentId: 'payment-current',
    });

    assert.equal(result.valid, true);
    assert.equal(result.sourceBalance, 400);
    assert.equal(result.cardBalance, 0);
    assert.equal(result.metadata.statementPaid, true);
});

test('yetersiz bakiye ödeme oluşturmaz', () => {
    const result = validateCreditCardPayment({
        sourceAccount: cash({ guncelBakiye: 100 }),
        cardAccount: card(),
        amount: 250,
    });

    assert.equal(result.valid, false);
    assert.match(result.message, /Yetersiz bakiye/);
});

test('aynı işlem iki kez gönderilirse bakiye tekrar değişmez', () => {
    const result = applyCreditCardPaymentToBalances({
        sourceAccount: cash(),
        cardAccount: card(),
        amount: 100,
        paymentId: 'payment-same',
        processedPaymentIds: ['payment-same'],
    });

    assert.equal(result.duplicate, true);
    assert.equal(result.sourceBalance, 1000);
    assert.equal(result.cardBalance, -500);
});

test('hızlı işlem hedefi kredi kartıysa ödeme tutar seçenekleri hesaplanır', () => {
    const targetCard = card({ guncelBakiye: -450, asgariOdemeTutari: 90 });
    const options = getCreditCardPaymentAmountOptions(targetCard);
    const validation = validateCreditCardPayment({
        sourceAccount: cash({ guncelBakiye: 700 }),
        cardAccount: targetCard,
        amount: options.options.find((option) => option.id === 'statement').amount,
    });

    assert.equal(options.currentDebt, 450);
    assert.equal(options.minimumPayment, 90);
    assert.equal(options.options.every((option) => option.enabled), true);
    assert.equal(validation.valid, true);
});

test('tam ödeme sonrası yaklaşan ödeme kapanmış sayılır', () => {
    const result = applyCreditCardPaymentToBalances({
        sourceAccount: cash(),
        cardAccount: card({ guncelBakiye: -320, asgariOdemeTutari: 64 }),
        amount: 320,
        paymentId: 'payment-upcoming',
    });

    assert.equal(result.metadata.statementPaid, true);
    assert.equal(result.metadata.statementRemainingAfterPayment, 0);
});

test('ara ödeme kart borcunu azaltır ama ekstreyi kapatmaz', () => {
    const result = applyCreditCardPaymentToBalances({
        sourceAccount: cash(),
        cardAccount: card({ guncelBakiye: -320, asgariOdemeTutari: 64 }),
        amount: 320,
        paymentId: 'payment-interim',
        paymentType: CREDIT_CARD_PAYMENT_TYPES.INTERIM,
    });

    assert.equal(result.valid, true);
    assert.equal(result.sourceBalance, 680);
    assert.equal(result.cardBalance, 0);
    assert.equal(result.metadata.creditCardPaymentType, CREDIT_CARD_PAYMENT_TYPES.INTERIM);
    assert.equal(result.metadata.appliedToStatement, 0);
    assert.equal(result.metadata.statementRemainingAfterPayment, 320);
    assert.equal(result.metadata.statementPaid, false);
});

test('ekstre takibi ara ödemeyi ödeme olarak saymaz', () => {
    const statementPayment = {
        islemTipi: 'transfer',
        hedefId: 'card-1',
        kategori: 'Kredi Kartı Ödemesi',
        creditCardPaymentType: CREDIT_CARD_PAYMENT_TYPES.STATEMENT,
    };
    const interimPayment = {
        ...statementPayment,
        creditCardPaymentType: CREDIT_CARD_PAYMENT_TYPES.INTERIM,
    };

    assert.equal(isCreditCardStatementPaymentTransaction(statementPayment, 'card-1'), true);
    assert.equal(isCreditCardStatementPaymentTransaction(interimPayment, 'card-1'), false);
});
