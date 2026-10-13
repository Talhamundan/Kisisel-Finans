import { toDateSafe } from './helpers.js';

export const RECEIPT_STATUSES = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
};

const parseAmount = (value) => {
    if (value === null || value === undefined || value === '') return NaN;
    const parsed = typeof value === 'string'
        ? parseFloat(value.replace(',', '.'))
        : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : NaN;
};

const cleanText = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeReceiptText = (value) => cleanText(value).toLocaleLowerCase('tr-TR');

const roundMoney = (value) => Math.round((parseAmount(value) || 0) * 100) / 100;

export const stableHash = (value) => {
    const input = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

export const toDateKey = (value) => {
    const date = toDateSafe(value);
    if (!date) return '';
    return date.toISOString().slice(0, 10);
};

export const buildReceiptHash = ({ alanKodu = '', merchant = '', date = '', total = 0, currency = 'TRY' } = {}) => (
    stableHash([
        String(alanKodu || '').trim(),
        normalizeReceiptText(merchant),
        toDateKey(date),
        Math.round(roundMoney(total) * 100),
        String(currency || 'TRY').toLocaleUpperCase('tr-TR'),
    ].join('|'))
);

export const buildReceiptImportId = (payload = {}) => {
    const explicit = cleanText(payload.importId || payload.import_id || payload.idempotencyKey);
    if (explicit) return explicit;
    return `auto-${buildReceiptHash(payload)}`;
};

export const buildReceiptDocId = (alanKodu, importId) => (
    `receipt_${stableHash(`${alanKodu || ''}|${importId || ''}`)}`
);

export class ReceiptImportError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ReceiptImportError';
        this.details = details;
    }
}

export const normalizeReceiptImportData = (encodedValue = '') => (
    String(encodedValue || '')
        .trim()
        .replace(/\s+/g, '')
);

export const decodeReceiptImportData = (encodedValue = '') => {
    const cleaned = normalizeReceiptImportData(encodedValue);
    if (!cleaned) throw new Error('Aktarım verisi bulunamadı.');
    const base64 = cleaned.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(cleaned.length / 4) * 4, '=');
    let bytes;
    let decoded = '';

    try {
        if (typeof atob === 'function') {
            bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        } else {
            bytes = Uint8Array.from(globalThis.Buffer.from(base64, 'base64'));
        }
    } catch (error) {
        throw new ReceiptImportError('Aktarım verisi Base64 olarak okunamadı. Kestirme çıktısı eksik veya bozuk olabilir.', {
            cause: error?.message,
            rawData: encodedValue,
        });
    }

    try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (error) {
        throw new ReceiptImportError('Aktarım verisi UTF-8 metin olarak okunamadı. Kestirme çıktısı bozulmuş olabilir.', {
            cause: error?.message,
            rawData: encodedValue,
        });
    }

    try {
        return JSON.parse(decoded);
    } catch (error) {
        throw new ReceiptImportError('Aktarım verisi JSON olarak okunamadı. Kestirmeden gelen veri eksik veya kesilmiş olabilir.', {
            cause: error?.message,
            rawData: encodedValue,
            decodedText: decoded,
        });
    }
};

export const getReceiptImportDataFromLocation = (locationLike = window.location) => {
    const hash = String(locationLike?.hash || '');
    if (!hash.startsWith('#')) return '';
    const params = new URLSearchParams(hash.slice(1));
    return params.get('data') || '';
};

export const getReceiptImportPayloadFromLocation = (locationLike = window.location) => {
    const data = getReceiptImportDataFromLocation(locationLike);
    if (!data) return null;
    return decodeReceiptImportData(data);
};

export const stripReceiptImportFragment = () => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.includes('data=')) return;
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
};

export const validateReceiptPayload = (payload = {}) => {
    const warnings = [];
    const errors = [];
    const merchant = cleanText(payload.merchant || payload.store || payload.vendor);
    const date = toDateSafe(payload.date || payload.tarih);
    const total = parseAmount(payload.total ?? payload.tutar);
    const currency = cleanText(payload.currency || payload.paraBirimi || 'TRY').toLocaleUpperCase('tr-TR') || 'TRY';
    const category = cleanText(payload.category || payload.kategori || 'Diğer') || 'Diğer';
    const rawItems = Array.isArray(payload.items) ? payload.items : [];

    if (!merchant) errors.push('Mağaza adı eksik.');
    if (!date) errors.push('Fiş tarihi geçersiz.');
    if (!Number.isFinite(total) || total <= 0) errors.push('Toplam tutar pozitif bir sayı olmalı.');
    if (!currency || currency.length > 8) errors.push('Para birimi geçersiz.');

    const items = rawItems.map((item, index) => {
        const name = cleanText(item?.name || item?.ad || item?.title) || `Ürün ${index + 1}`;
        const quantity = parseAmount(item?.quantity ?? item?.adet ?? 1);
        const itemTotal = parseAmount(item?.total ?? item?.tutar);
        return {
            name,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            total: Number.isFinite(itemTotal) && itemTotal >= 0 ? roundMoney(itemTotal) : 0,
        };
    });
    const itemTotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
    const safeTotal = Number.isFinite(total) ? roundMoney(total) : 0;
    const totalMismatch = items.length > 0 && Math.abs(itemTotal - safeTotal) > 0.02;
    if (totalMismatch) warnings.push(`Ürün toplamı (${itemTotal.toFixed(2)}) fiş toplamından (${safeTotal.toFixed(2)}) farklı.`);

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        normalized: {
            merchant,
            date,
            total: safeTotal,
            currency,
            category,
            items,
        },
        validation: {
            errors,
            warnings,
            itemTotal,
            totalMismatch,
            missingFields: errors,
        },
    };
};

export const buildReceiptRecord = ({ payload, user, alanKodu, existingReceipts = [] }) => {
    const result = validateReceiptPayload(payload);
    if (!result.valid) {
        const error = new Error(result.errors.join(' '));
        error.validation = result;
        throw error;
    }
    const {
        uid: _ignoredUid,
        alanKodu: _ignoredAlanKodu,
        areaCode: _ignoredAreaCode,
        veriAlanKodu: _ignoredDataAreaCode,
        ...safeRawPayload
    } = payload || {};
    const importId = buildReceiptImportId(payload);
    const normalizedHash = buildReceiptHash({ ...result.normalized, alanKodu });
    const dateKey = toDateKey(result.normalized.date);
    const duplicateCandidateIds = (existingReceipts || [])
        .filter((receipt) => receipt.status !== RECEIPT_STATUSES.REJECTED)
        .filter((receipt) => (
            normalizeReceiptText(receipt.merchant) === normalizeReceiptText(result.normalized.merchant)
            && toDateKey(receipt.date) === dateKey
            && Math.round(roundMoney(receipt.total) * 100) === Math.round(result.normalized.total * 100)
            && String(receipt.currency || 'TRY').toLocaleUpperCase('tr-TR') === result.normalized.currency
        ))
        .map((receipt) => receipt.id)
        .filter(Boolean);

    return {
        uid: user?.uid || '',
        alanKodu,
        status: RECEIPT_STATUSES.PENDING,
        source: cleanText(payload.source || 'ios_shortcuts') || 'ios_shortcuts',
        ...result.normalized,
        rawPayload: safeRawPayload,
        importId,
        normalizedHash,
        selectedAccountId: '',
        approvedTransactionId: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        approvedAt: null,
        rejectedAt: null,
        validation: {
            ...result.validation,
            duplicateCandidateIds,
        },
    };
};

