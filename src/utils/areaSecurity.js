import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ACCESS_CODES_COLLECTION = 'area_access_codes';
const HASH_ALGORITHM = 'SHA-256';
const PBKDF2_ITERATIONS = 210000;
const KEY_LENGTH = 256;

const textEncoder = new TextEncoder();

export const normalizeAreaCode = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .trim()
    .toLocaleUpperCase('tr-TR');

export const validateAreaCode = (value) => {
    const code = normalizeAreaCode(value);
    if (!code) return 'Alan kodu boş olamaz.';
    if (code.length < 4) return 'Alan kodu en az 4 karakter olmalı.';
    if (code.length > 32) return 'Alan kodu en fazla 32 karakter olmalı.';
    if (!/^[0-9A-ZÇĞİÖŞÜ_-]+$/u.test(code)) return 'Alan kodunda yalnızca harf, rakam, tire ve alt çizgi kullan.';
    return '';
};

export const validateAreaPassword = (value) => {
    const password = String(value || '');
    if (password.length < 8) return 'Şifre en az 8 karakter olmalı.';
    if (!/[A-ZÇĞİÖŞÜ]/u.test(password)) return 'Şifre en az bir büyük harf içermeli.';
    if (!/[a-zçğıöşü]/u.test(password)) return 'Şifre en az bir küçük harf içermeli.';
    if (!/[0-9]/.test(password)) return 'Şifre en az bir rakam içermeli.';
    return '';
};

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

const base64ToBytes = (base64) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

const createSalt = () => {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return bytesToBase64(salt);
};

const derivePasswordHash = async (password, salt) => {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            hash: HASH_ALGORITHM,
            salt: base64ToBytes(salt),
            iterations: PBKDF2_ITERATIONS,
        },
        keyMaterial,
        KEY_LENGTH
    );
    return bytesToBase64(bits);
};

const timingSafeEqual = (a, b) => {
    const left = String(a || '');
    const right = String(b || '');
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let index = 0; index < left.length; index += 1) {
        diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return diff === 0;
};

export const createPasswordRecord = async (password) => {
    const validation = validateAreaPassword(password);
    if (validation) throw new Error(validation);
    const salt = createSalt();
    const passwordHash = await derivePasswordHash(password, salt);
    return {
        passwordConfigured: true,
        passwordHash,
        passwordSalt: salt,
        passwordAlgorithm: `PBKDF2-${HASH_ALGORITHM}`,
        passwordIterations: PBKDF2_ITERATIONS,
        passwordUpdatedAt: new Date(),
    };
};

export const verifyAreaPassword = async (password, areaRecord) => {
    if (!areaRecord?.passwordConfigured) return true;
    if (!areaRecord.passwordHash || !areaRecord.passwordSalt) return false;
    const attemptedHash = await derivePasswordHash(password, areaRecord.passwordSalt);
    return timingSafeEqual(attemptedHash, areaRecord.passwordHash);
};

export const getAreaAccessRef = (code) => doc(db, ACCESS_CODES_COLLECTION, normalizeAreaCode(code));

export const readAreaAccessRecord = async (code) => {
    const normalizedCode = normalizeAreaCode(code);
    if (!normalizedCode) return null;
    const snap = await getDoc(getAreaAccessRef(normalizedCode));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data(), accessCode: normalizedCode };
};

export const resolveAreaLogin = async (code) => {
    const normalizedCode = normalizeAreaCode(code);
    const validation = validateAreaCode(normalizedCode);
    if (validation) throw new Error(validation);

    const record = await readAreaAccessRecord(normalizedCode);
    if (record?.disabled) throw new Error('Bu alan kodu artık kullanılmıyor.');
    if (record) {
        return {
            accessCode: normalizedCode,
            dataCode: record.dataCode || record.legacyDataCode || normalizedCode,
            areaRecord: record,
            isLegacy: false,
        };
    }

    return {
        accessCode: normalizedCode,
        dataCode: normalizedCode,
        areaRecord: {
            accessCode: normalizedCode,
            dataCode: normalizedCode,
            passwordConfigured: false,
            legacyFallback: true,
        },
        isLegacy: true,
    };
};

export const ensureAreaAccessRecord = async ({ accessCode, dataCode, uid, passwordRecord = null }) => {
    const normalizedAccessCode = normalizeAreaCode(accessCode);
    const normalizedDataCode = normalizeAreaCode(dataCode || accessCode);
    const now = serverTimestamp();

    await setDoc(getAreaAccessRef(normalizedAccessCode), {
        accessCode: normalizedAccessCode,
        dataCode: normalizedDataCode,
        ownerUid: uid || null,
        passwordConfigured: Boolean(passwordRecord),
        ...(passwordRecord || {}),
        disabled: false,
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
};

export const changeAreaAccessCode = async ({ currentAccessCode, currentDataCode, nextAccessCode, uid }) => {
    const currentCode = normalizeAreaCode(currentAccessCode);
    const dataCode = normalizeAreaCode(currentDataCode || currentAccessCode);
    const nextCode = normalizeAreaCode(nextAccessCode);
    const validation = validateAreaCode(nextCode);
    if (validation) throw new Error(validation);
    if (nextCode === currentCode) throw new Error('Yeni alan kodu mevcut kodla aynı olamaz.');

    await runTransaction(db, async (transaction) => {
        const currentRef = getAreaAccessRef(currentCode);
        const nextRef = getAreaAccessRef(nextCode);
        const [currentSnap, nextSnap] = await Promise.all([
            transaction.get(currentRef),
            transaction.get(nextRef),
        ]);

        if (nextSnap.exists() && !nextSnap.data()?.disabled) {
            throw new Error('Bu alan kodu başka bir alan tarafından kullanılıyor.');
        }

        const currentData = currentSnap.exists()
            ? currentSnap.data()
            : {
                accessCode: currentCode,
                dataCode,
                ownerUid: uid || null,
                passwordConfigured: false,
            };

        if (currentData.disabled) throw new Error('Mevcut alan kodu artık kullanılmıyor.');

        transaction.set(nextRef, {
            ...currentData,
            accessCode: nextCode,
            dataCode: currentData.dataCode || currentData.legacyDataCode || dataCode,
            ownerUid: currentData.ownerUid || uid || null,
            disabled: false,
            previousAccessCode: currentCode,
            updatedAt: serverTimestamp(),
        }, { merge: true });

        transaction.set(currentRef, {
            accessCode: currentCode,
            dataCode: currentData.dataCode || currentData.legacyDataCode || dataCode,
            ownerUid: currentData.ownerUid || uid || null,
            disabled: true,
            replacedBy: nextCode,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    });
};

