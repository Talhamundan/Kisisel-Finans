import { collection, doc, getDoc, increment, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import {
    RECEIPT_STATUSES,
    buildReceiptHash,
    buildReceiptDocId,
    buildReceiptRecord,
    toDateKey,
    validateReceiptPayload,
} from '../utils/receipts';

const parseAmount = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const debugReceiptImport = (stage, details = {}) => {
    if (!import.meta.env?.DEV) return;
    console.info('[receipts:import]', stage, details);
};

const isSameImportedReceipt = (existingReceipt, nextReceipt, alanKodu) => (
    existingReceipt?.alanKodu === alanKodu
    && existingReceipt?.importId === nextReceipt.importId
    && existingReceipt?.normalizedHash === nextReceipt.normalizedHash
);

export const useReceiptActions = ({ user, alanKodu, receipts = [], accounts = [] }) => {
    const importReceipt = async (payload) => {
        debugReceiptImport('start', { hasUser: Boolean(user?.uid), hasArea: Boolean(alanKodu) });
        if (!user?.uid) throw new Error('Fiş aktarımı için giriş yapmalısın.');
        if (!alanKodu) throw new Error('Fiş aktarımı için veri alanı seçmelisin.');

        const receipt = buildReceiptRecord({ payload, user, alanKodu, existingReceipts: receipts });
        const receiptRef = doc(db, 'fisler', buildReceiptDocId(alanKodu, receipt.importId));
        const localExisting = (receipts || []).find((item) => item.id === receiptRef.id);
        if (localExisting) {
            if (!isSameImportedReceipt(localExisting, receipt, alanKodu)) {
                debugReceiptImport('local-conflict', { receiptId: receiptRef.id, status: localExisting.status || '' });
                throw new Error('Aynı import kimliğiyle farklı içerikli bir fiş zaten var. Mevcut kayıt ezilmedi.');
            }
            debugReceiptImport('local-existing', { receiptId: receiptRef.id, status: localExisting.status || '' });
            return { id: receiptRef.id, existing: true, receipt: localExisting };
        }

        try {
            debugReceiptImport('write-attempt', { receiptId: receiptRef.id });
            await setDoc(receiptRef, receipt, { merge: true });
            debugReceiptImport('write-created', { receiptId: receiptRef.id });
            return { id: receiptRef.id, existing: false, receipt: { id: receiptRef.id, ...receipt } };
        } catch (error) {
            debugReceiptImport('write-error', { receiptId: receiptRef.id, code: error?.code || '' });
            if (error?.code === 'permission-denied') {
                try {
                    const existingSnap = await getDoc(receiptRef);
                    if (existingSnap.exists()) {
                        const existingReceipt = { id: receiptRef.id, ...existingSnap.data() };
                        if (isSameImportedReceipt(existingReceipt, receipt, alanKodu)) {
                            debugReceiptImport('remote-existing', { receiptId: receiptRef.id, status: existingReceipt.status || '' });
                            return { id: receiptRef.id, existing: true, receipt: existingReceipt };
                        }
                        debugReceiptImport('remote-conflict', { receiptId: receiptRef.id, status: existingReceipt.status || '' });
                        throw new Error('Aynı import kimliğiyle farklı içerikli bir fiş zaten var. Mevcut kayıt ezilmedi.');
                    }
                } catch (readError) {
                    if (readError?.message?.includes('farklı içerikli')) throw readError;
                }
                throw new Error('Fiş bu veri alanına kaydedilemedi. Oturumun ve seçili veri alanı yetkin doğrulanamadı.');
            }
            throw error;
        }
    };

    const updateReceipt = async (receiptId, values = {}) => {
        if (!receiptId) return false;
        const validation = validateReceiptPayload({
            merchant: values.merchant,
            date: values.date,
            total: values.total,
            currency: values.currency || 'TRY',
            category: values.category,
            items: values.items || [],
        });
        if (!validation.valid) {
            toast.error(validation.errors[0] || 'Fiş bilgileri geçersiz.');
            return false;
        }
        const normalizedHash = buildReceiptHash({ ...validation.normalized, alanKodu });
        await updateDoc(doc(db, 'fisler', receiptId), {
            merchant: validation.normalized.merchant,
            date: validation.normalized.date,
            total: validation.normalized.total,
            currency: validation.normalized.currency,
            category: validation.normalized.category,
            items: validation.normalized.items,
            normalizedHash,
            selectedAccountId: values.selectedAccountId || '',
            validation: {
                ...(values.validation || {}),
                ...validation.validation,
                duplicateCandidateIds: values.validation?.duplicateCandidateIds || [],
            },
            updatedAt: new Date(),
        });
        toast.success('Fiş güncellendi.');
        return true;
    };

    const approveReceipt = async (receiptId, values = {}) => {
        if (!user?.uid || !alanKodu) {
            toast.error('Onay için giriş ve veri alanı gerekli.');
            return false;
        }
        const selectedAccountId = values.selectedAccountId || '';
        if (!selectedAccountId) {
            toast.warning('Hesap veya kredi kartı seçmelisin.');
            return false;
        }

        try {
            const receiptRef = doc(db, 'fisler', receiptId);
            const accountRef = doc(db, 'hesaplar', selectedAccountId);
            const transactionRef = doc(collection(db, 'nakit_islemleri'));

            await runTransaction(db, async (transaction) => {
                const [receiptSnap, accountSnap] = await Promise.all([
                    transaction.get(receiptRef),
                    transaction.get(accountRef),
                ]);
                if (!receiptSnap.exists()) throw new Error('Fiş bulunamadı.');
                const receipt = receiptSnap.data();
                if (receipt.alanKodu !== alanKodu) throw new Error('Fiş bu veri alanına ait değil.');
                if (receipt.status !== RECEIPT_STATUSES.PENDING) throw new Error('Bu fiş zaten işlenmiş.');
                if (receipt.approvedTransactionId) throw new Error('Bu fiş daha önce harcamaya dönüştürülmüş.');
                if (!accountSnap.exists()) throw new Error('Seçilen hesap bulunamadı.');
                const account = accountSnap.data();
                if (account.alanKodu !== alanKodu) throw new Error('Seçilen hesap bu veri alanına ait değil.');

                const nextPayload = {
                    merchant: values.merchant ?? receipt.merchant,
                    date: values.date ?? receipt.date,
                    total: values.total ?? receipt.total,
                    currency: values.currency ?? receipt.currency,
                    category: values.category ?? receipt.category,
                    items: values.items ?? receipt.items ?? [],
                };
                const validation = validateReceiptPayload(nextPayload);
                if (!validation.valid) throw new Error(validation.errors[0] || 'Fiş bilgileri geçersiz.');
                const total = parseAmount(validation.normalized.total);
                const approvedDate = validation.normalized.date;
                const description = validation.normalized.merchant || 'Fiş harcaması';
                const normalizedHash = buildReceiptHash({ ...validation.normalized, alanKodu });

                transaction.set(transactionRef, {
                    uid: user.uid,
                    alanKodu,
                    hesapId: selectedAccountId,
                    islemTipi: 'gider',
                    kategori: validation.normalized.category,
                    tutar: total,
                    aciklama: description,
                    tarih: approvedDate,
                    receiptId,
                    receiptImportId: receipt.importId || '',
                    receiptHash: normalizedHash,
                    receiptDateKey: toDateKey(approvedDate),
                });
                transaction.update(accountRef, { guncelBakiye: increment(-total) });
                transaction.update(receiptRef, {
                    ...validation.normalized,
                    selectedAccountId,
                    status: RECEIPT_STATUSES.APPROVED,
                    normalizedHash,
                    approvedTransactionId: transactionRef.id,
                    approvedAt: new Date(),
                    updatedAt: new Date(),
                    validation: {
                        ...(receipt.validation || {}),
                        ...validation.validation,
                        duplicateCandidateIds: receipt.validation?.duplicateCandidateIds || [],
                    },
                });
            });

            toast.success('Fiş harcamaya dönüştürüldü.');
            return true;
        } catch (error) {
            console.error('Fiş onaylanamadı:', error);
            toast.error(error?.message || 'Fiş onaylanamadı.');
            return false;
        }
    };

    const rejectReceipt = async (receiptId) => {
        if (!receiptId) return false;
        await updateDoc(doc(db, 'fisler', receiptId), {
            status: RECEIPT_STATUSES.REJECTED,
            rejectedAt: new Date(),
            updatedAt: new Date(),
        });
        toast.info('Fiş reddedildi.');
        return true;
    };

    return {
        importReceipt,
        updateReceipt,
        approveReceipt,
        rejectReceipt,
        accounts,
    };
};

