import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, increment, getDoc, query, where, getDocs, setDoc, writeBatch, deleteField, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { formatCurrencyPlain, formatMoneyInputValue } from '../utils/helpers';
import { canBeDefaultPaymentAccount } from '../utils/defaultPaymentAccount';
import { buildTransactionTagId, normalizeTagKey, normalizeTagName, uniqueTagIds } from '../utils/tags';
import {
    CREDIT_CARD_PAYMENT_STRATEGIES,
    CREDIT_CARD_PAYMENT_TYPES,
    applyCreditCardPaymentToBalances,
    getCreditCardPaymentPlan,
    toMoneyCents,
    validateCreditCardPayment,
} from '../utils/creditCardPayments';

export const useBudgetActions = (user, alanKodu, hesaplar, kategoriListesi, tanimliFaturalar, etiketler = [], transactionTags = []) => {
    // --- FORM STATES ---
    // Hesap
    const [hesapAdi, setHesapAdi] = useState("");
    const [hesapTipi, setHesapTipi] = useState("nakit");
    const [baslangicBakiye, setBaslangicBakiye] = useState("");
    const [hesapKesimGunu, setHesapKesimGunu] = useState("");
    const [kartLimiti, setKartLimiti] = useState("");
    const [kartOdemeStratejisi, setKartOdemeStratejisi] = useState(CREDIT_CARD_PAYMENT_STRATEGIES.FULL);
    const [kartVarsayilanOdemeTutari, setKartVarsayilanOdemeTutari] = useState("");
    const [kartPlanlananOdemeTutari, setKartPlanlananOdemeTutari] = useState("");
    const [kartAsgariOdemeTutari, setKartAsgariOdemeTutari] = useState("");
    const [varsayilanOdemeAraci, setVarsayilanOdemeAraci] = useState(false);
    const [maasHesabi, setMaasHesabi] = useState(false);
    const [anaMaasHesabi, setAnaMaasHesabi] = useState(false);
    const [hesapMaasGunu, setHesapMaasGunu] = useState("");
    const [bagliMaasId, setBagliMaasId] = useState("");

    // İşlem (Gelir/Gider/Transfer)
    const [secilenHesapId, setSecilenHesapId] = useState("");
    const [islemTutar, setIslemTutar] = useState("");
    const [islemAciklama, setIslemAciklama] = useState("");
    const [islemTipi, setIslemTipi] = useState("gider");
    const [kategori, setKategori] = useState("");
    const [islemTarihi, setIslemTarihi] = useState("");
    const [islemGelirTuru, setIslemGelirTuru] = useState("Diğer Gelir");
    const [islemBagliMaasId, setIslemBagliMaasId] = useState("");
    const [islemMaasDonemi, setIslemMaasDonemi] = useState("");
    const [secilenEtiketIds, setSecilenEtiketIds] = useState([]);
    // NEW: Unit Price & Quantity for editing
    const [islemAdet, setIslemAdet] = useState("");
    const [islemBirimFiyat, setIslemBirimFiyat] = useState("");

    // Transfer Ex
    const [transferKaynakId, setTransferKaynakId] = useState("");
    const [transferHedefId, setTransferHedefId] = useState("");
    const [transferTutar, setTransferTutar] = useState("");
    const [transferUcreti, setTransferUcreti] = useState(""); // NEW: Transfer Fee
    const [transferAciklama, setTransferAciklama] = useState("");
    const [transferTarihi, setTransferTarihi] = useState("");

    // Abonelik
    const [aboAd, setAboAd] = useState("");
    const [aboTutar, setAboTutar] = useState("");
    const [aboGun, setAboGun] = useState("");
    const [aboHesapId, setAboHesapId] = useState("");
    const [aboKategori, setAboKategori] = useState("Fatura");

    // Taksit
    const [taksitBaslik, setTaksitBaslik] = useState("");
    const [taksitToplamTutar, setTaksitToplamTutar] = useState("");
    const [taksitSayisi, setTaksitSayisi] = useState("");
    const [taksitHesapId, setTaksitHesapId] = useState("");
    const [taksitKategori, setTaksitKategori] = useState("");
    const [taksitAlisTarihi, setTaksitAlisTarihi] = useState("");

    // Maaş
    const [maasAd, setMaasAd] = useState("");
    const [maasTutar, setMaasTutar] = useState("");
    const [maasGun, setMaasGun] = useState("");
    const [maasHesapId, setMaasHesapId] = useState("");
    const [maasTur, setMaasTur] = useState("Maaş");

    // Borç
    const [borcAd, setBorcAd] = useState("");
    const [borcTutar, setBorcTutar] = useState("");
    const [borcKalanTutar, setBorcKalanTutar] = useState("");
    const [borcTarih, setBorcTarih] = useState("");
    const [borcKategori, setBorcKategori] = useState(kategoriListesi && kategoriListesi[0] ? kategoriListesi[0] : "");

    // Cari / şirket alacakları
    const [cariBaslik, setCariBaslik] = useState("");
    const [cariTutar, setCariTutar] = useState("");
    const [cariHesapId, setCariHesapId] = useState("");
    const [cariKategori, setCariKategori] = useState("Şirket Harcaması");
    const [cariTarih, setCariTarih] = useState("");
    const [cariNot, setCariNot] = useState("");
    const [cariIadeTutar, setCariIadeTutar] = useState("");
    const [cariIadeHesapId, setCariIadeHesapId] = useState("");

    // Fatura Tanım / Giriş
    const [tanimBaslik, setTanimBaslik] = useState("");
    const [tanimKurum, setTanimKurum] = useState("");
    const [tanimAboneNo, setTanimAboneNo] = useState("");
    const [tanimHesapId, setTanimHesapId] = useState("");
    const [secilenTanimId, setSecilenTanimId] = useState("");
    const [faturaGirisTutar, setFaturaGirisTutar] = useState("");
    const [faturaGirisTarih, setFaturaGirisTarih] = useState("");
    const [faturaGirisAciklama, setFaturaGirisAciklama] = useState("");

    // KK Ödeme
    const [kkOdemeKartId, setKkOdemeKartId] = useState("");
    const [kkOdemeKaynakId, setKkOdemeKaynakId] = useState("");
    const [kkOdemeTutar, setKkOdemeTutar] = useState("");
    const [kkOdemeTarihi, setKkOdemeTarihi] = useState("");
    const [kkOdemeAciklama, setKkOdemeAciklama] = useState("");
    const [kkOdemeTipi, setKkOdemeTipi] = useState(CREDIT_CARD_PAYMENT_TYPES.STATEMENT);

    const [tasimaIslemiSuruyor, setTasimaIslemiSuruyor] = useState(false);
    const [yeniKodInput, setYeniKodInput] = useState("");

    // --- ACTIONS ---
    const ensureTag = async (name) => {
        const cleanedName = normalizeTagName(name);
        const nameKey = normalizeTagKey(cleanedName);
        if (!cleanedName || !nameKey) return null;

        const existing = (etiketler || []).find((tag) => normalizeTagKey(tag?.name) === nameKey || tag?.nameKey === nameKey);
        if (existing) return existing;

        const tagQuery = query(collection(db, "tags"), where("alanKodu", "==", alanKodu), where("nameKey", "==", nameKey));
        const tagSnap = await getDocs(tagQuery);
        if (!tagSnap.empty) {
            const first = tagSnap.docs[0];
            return { id: first.id, ...first.data() };
        }

        const tagRef = doc(collection(db, "tags"));
        const now = new Date();
        await setDoc(tagRef, {
            uid: user.uid,
            alanKodu,
            name: cleanedName,
            nameKey,
            created_at: now,
            updated_at: now,
        });
        return { id: tagRef.id, uid: user.uid, alanKodu, name: cleanedName, nameKey, created_at: now, updated_at: now };
    };

    const syncTransactionTags = async (transactionId, nextTagIds = [], existingLinks = null, batchOverride = null) => {
        if (!transactionId) return;
        const desiredIds = uniqueTagIds(nextTagIds);
        const links = existingLinks || transactionTags.filter((link) => (
            (link.transaction_id || link.transactionId) === transactionId
        ));
        const currentIds = new Set(links.map((link) => link.tag_id || link.tagId).filter(Boolean));
        const desiredSet = new Set(desiredIds);
        const batch = batchOverride || writeBatch(db);
        const now = new Date();

        desiredIds.forEach((tagId) => {
            if (currentIds.has(tagId)) return;
            batch.set(doc(db, "transaction_tags", buildTransactionTagId(transactionId, tagId)), {
                uid: user.uid,
                alanKodu,
                transaction_id: transactionId,
                tag_id: tagId,
                created_at: now,
            });
        });

        links.forEach((link) => {
            const tagId = link.tag_id || link.tagId;
            if (!tagId || desiredSet.has(tagId)) return;
            batch.delete(doc(db, "transaction_tags", link.id || buildTransactionTagId(transactionId, tagId)));
        });

        if (!batchOverride) await batch.commit();
    };

    const renameTag = async (tagId, nextName) => {
        try {
            const cleanedName = normalizeTagName(nextName);
            const nameKey = normalizeTagKey(cleanedName);
            if (!tagId || !cleanedName) {
                toast.warning("Etiket adı boş olamaz.");
                return false;
            }
            const duplicate = (etiketler || []).find((tag) => tag.id !== tagId && (tag.nameKey === nameKey || normalizeTagKey(tag.name) === nameKey));
            if (duplicate) {
                toast.warning("Bu isimde bir etiket zaten var.");
                return false;
            }
            await updateDoc(doc(db, "tags", tagId), { name: cleanedName, nameKey, updated_at: new Date() });
            toast.success("Etiket güncellendi.");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Etiket güncellenemedi.");
            return false;
        }
    };

    const deleteTag = async (tag, options = {}) => {
        if (!tag?.id) return false;
        const usageCount = transactionTags.filter((link) => (link.tag_id || link.tagId) === tag.id).length;
        if (!options.skipConfirm) {
            const result = await Swal.fire({
                title: 'Etiket silinsin mi?',
                text: usageCount > 0
                    ? `Bu etiket ${usageCount} işlemde kullanılıyor. Etiketi silerseniz işlemler silinmez, yalnızca bu etiket bağlantıları kaldırılır.`
                    : `${tag.name} etiketi silinecek.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Evet, Sil',
                cancelButtonText: 'Vazgeç'
            });
            if (!result.isConfirmed) return false;
        }

        try {
            const batch = writeBatch(db);
            transactionTags
                .filter((link) => (link.tag_id || link.tagId) === tag.id)
                .forEach((link) => batch.delete(doc(db, "transaction_tags", link.id || buildTransactionTagId(link.transaction_id || link.transactionId, tag.id))));
            batch.delete(doc(db, "tags", tag.id));
            await batch.commit();
            toast.success("Etiket silindi.");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Etiket silinemedi.");
            return false;
        }
    };

    const hesapEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!hesapAdi) {
                toast.warning("Lütfen hesap adı giriniz.");
                return false;
            }
            let bakiye = parseFloat(baslangicBakiye);
            if (isNaN(bakiye)) {
                bakiye = 0;
            }
            const kesimGunu = parseInt(hesapKesimGunu);
            if (hesapTipi === 'krediKarti' && (!Number.isFinite(kesimGunu) || kesimGunu < 1 || kesimGunu > 31)) {
                toast.warning("Ekstre kesim günü 1-31 arasında olmalı.");
                return false;
            }
            const limit = parseFloat(kartLimiti);
            if (hesapTipi === 'krediKarti' && kartLimiti !== "" && (!Number.isFinite(limit) || limit < 0)) {
                toast.warning("Kart limiti 0 veya daha büyük olmalı.");
                return false;
            }
            const salaryDay = parseInt(hesapMaasGunu);
            const isSalaryAccount = hesapTipi !== 'krediKarti' && maasHesabi;
            const shouldBeDefaultPaymentAccount = hesapTipi !== 'yatirim' && varsayilanOdemeAraci;
            if (isSalaryAccount && (!Number.isFinite(salaryDay) || salaryDay < 1 || salaryDay > 31)) {
                toast.warning("Maaş günü 1-31 arasında olmalı.");
                return false;
            }

            const accountRef = doc(collection(db, "hesaplar"));
            const batch = writeBatch(db);
            batch.set(accountRef, {
                uid: user.uid, alanKodu, hesapAdi, hesapTipi,
                guncelBakiye: bakiye,
                kesimGunu: hesapTipi === 'krediKarti' ? kesimGunu : "",
                kartLimiti: hesapTipi === 'krediKarti' ? (Number.isFinite(limit) ? limit : 0) : 0,
                odemeStratejisi: hesapTipi === 'krediKarti' ? (kartOdemeStratejisi || CREDIT_CARD_PAYMENT_STRATEGIES.FULL) : "",
                varsayilanOdemeTutari: hesapTipi === 'krediKarti' && kartOdemeStratejisi === CREDIT_CARD_PAYMENT_STRATEGIES.FIXED ? (parseFloat(kartVarsayilanOdemeTutari) || 0) : 0,
                planlananOdemeTutari: hesapTipi === 'krediKarti' && kartOdemeStratejisi === CREDIT_CARD_PAYMENT_STRATEGIES.MANUAL ? (parseFloat(kartPlanlananOdemeTutari) || 0) : 0,
                asgariOdemeTutari: hesapTipi === 'krediKarti' ? (parseFloat(kartAsgariOdemeTutari) || 0) : 0,
                maasHesabi: isSalaryAccount,
                anaMaasHesabi: isSalaryAccount ? Boolean(anaMaasHesabi) : false,
                maasGunu: isSalaryAccount ? salaryDay : "",
                bagliMaasId: isSalaryAccount ? (bagliMaasId || "") : "",
                varsayilanOdemeAraci: shouldBeDefaultPaymentAccount,
                guncellemeTarihi: new Date(),
            });
            if (shouldBeDefaultPaymentAccount) {
                hesaplar
                    .filter((account) => account.id && account.varsayilanOdemeAraci)
                    .forEach((account) => batch.update(doc(db, "hesaplar", account.id), { varsayilanOdemeAraci: false, guncellemeTarihi: new Date() }));
            }
            if (isSalaryAccount && anaMaasHesabi) {
                hesaplar
                    .filter((account) => account.anaMaasHesabi)
                    .forEach((account) => batch.update(doc(db, "hesaplar", account.id), { anaMaasHesabi: false }));
            }
            await batch.commit();
            setHesapAdi(""); setBaslangicBakiye(""); setHesapKesimGunu(""); setKartLimiti(""); setKartOdemeStratejisi(CREDIT_CARD_PAYMENT_STRATEGIES.FULL); setKartVarsayilanOdemeTutari(""); setKartPlanlananOdemeTutari(""); setKartAsgariOdemeTutari(""); setVarsayilanOdemeAraci(false);
            setMaasHesabi(false); setAnaMaasHesabi(false); setHesapMaasGunu(""); setBagliMaasId("");
            toast.success("Hesap eklendi.");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Hesap eklenirken hata oluştu.");
            return false;
        }
    }

    const hesapDuzenle = async (e, id) => {
        if (e) e.preventDefault();
        try {
            const bakiye = parseFloat(baslangicBakiye);
            if (isNaN(bakiye)) {
                toast.warning("Geçerli bir bakiye giriniz.");
                return false;
            }
            const kesimGunu = parseInt(hesapKesimGunu);
            if (hesapTipi === 'krediKarti' && (!Number.isFinite(kesimGunu) || kesimGunu < 1 || kesimGunu > 31)) {
                toast.warning("Ekstre kesim günü 1-31 arasında olmalı.");
                return false;
            }
            const limit = parseFloat(kartLimiti);
            if (hesapTipi === 'krediKarti' && kartLimiti !== "" && (!Number.isFinite(limit) || limit < 0)) {
                toast.warning("Kart limiti 0 veya daha büyük olmalı.");
                return false;
            }
            const salaryDay = parseInt(hesapMaasGunu);
            const isSalaryAccount = hesapTipi !== 'krediKarti' && maasHesabi;
            const shouldBeDefaultPaymentAccount = hesapTipi !== 'yatirim' && varsayilanOdemeAraci;
            if (isSalaryAccount && (!Number.isFinite(salaryDay) || salaryDay < 1 || salaryDay > 31)) {
                toast.warning("Maaş günü 1-31 arasında olmalı.");
                return false;
            }
            const batch = writeBatch(db);
            batch.update(doc(db, "hesaplar", id), {
                hesapAdi, hesapTipi,
                guncelBakiye: bakiye,
                kesimGunu: hesapTipi === 'krediKarti' ? kesimGunu : "",
                kartLimiti: hesapTipi === 'krediKarti' ? (Number.isFinite(limit) ? limit : 0) : 0,
                odemeStratejisi: hesapTipi === 'krediKarti' ? (kartOdemeStratejisi || CREDIT_CARD_PAYMENT_STRATEGIES.FULL) : "",
                varsayilanOdemeTutari: hesapTipi === 'krediKarti' && kartOdemeStratejisi === CREDIT_CARD_PAYMENT_STRATEGIES.FIXED ? (parseFloat(kartVarsayilanOdemeTutari) || 0) : 0,
                planlananOdemeTutari: hesapTipi === 'krediKarti' && kartOdemeStratejisi === CREDIT_CARD_PAYMENT_STRATEGIES.MANUAL ? (parseFloat(kartPlanlananOdemeTutari) || 0) : 0,
                asgariOdemeTutari: hesapTipi === 'krediKarti' ? (parseFloat(kartAsgariOdemeTutari) || 0) : 0,
                maasHesabi: isSalaryAccount,
                anaMaasHesabi: isSalaryAccount ? Boolean(anaMaasHesabi) : false,
                maasGunu: isSalaryAccount ? salaryDay : "",
                bagliMaasId: isSalaryAccount ? (bagliMaasId || "") : "",
                varsayilanOdemeAraci: shouldBeDefaultPaymentAccount,
                guncellemeTarihi: new Date(),
            });
            if (shouldBeDefaultPaymentAccount) {
                hesaplar
                    .filter((account) => account.id !== id && account.varsayilanOdemeAraci)
                    .forEach((account) => batch.update(doc(db, "hesaplar", account.id), { varsayilanOdemeAraci: false, guncellemeTarihi: new Date() }));
            }
            if (isSalaryAccount && anaMaasHesabi) {
                hesaplar
                    .filter((account) => account.id !== id && account.anaMaasHesabi)
                    .forEach((account) => batch.update(doc(db, "hesaplar", account.id), { anaMaasHesabi: false }));
            }
            await batch.commit();
            toast.success("Hesap güncellendi.");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Güncelleme başarısız.");
            return false;
        }
    }

    const islemEkle = async (e, manualData = null) => {
        if (e) e.preventDefault();

        try {
            const hedefHesapId = manualData ? manualData.hesapId : secilenHesapId;
            const hedefTutar = manualData ? manualData.tutar : islemTutar;
            const hedefAciklama = manualData ? manualData.aciklama : islemAciklama;
            const hedefKategori = manualData ? manualData.kategori : kategori;
            const hedefTipi = manualData ? manualData.islemTipi : islemTipi;
            const hedefGelirTuru = manualData ? manualData.gelirTuru : islemGelirTuru;
            const hedefBagliMaasId = manualData ? manualData.bagliMaasId : islemBagliMaasId;
            const hedefMaasDonemi = manualData ? (manualData.salaryPeriod || manualData.maasDonemi) : islemMaasDonemi;
            const hedefEtiketIds = manualData ? (manualData.tagIds || []) : secilenEtiketIds;
            const maasOdemeTurleri = ["Maaş Ödemesi", "Maaş Avansı", "Maaş Farkı", "Ek Maaş"];

            if (!hedefHesapId) {
                toast.warning("Lütfen hesap seçimi yapınız.");
                return false;
            }
            if (!hedefTutar) {
                toast.warning("Lütfen tutar giriniz.");
                return false;
            }
            if (!hedefKategori) {
                toast.warning("Lütfen kategori seçiniz.");
                return false;
            }

            const tutar = parseFloat(hedefTutar);
            if (isNaN(tutar)) {
                toast.warning("Geçerli bir tutar giriniz.");
                return false;
            }
            if (hedefTipi === 'gelir' && maasOdemeTurleri.includes(hedefGelirTuru)) {
                if (!hedefBagliMaasId) {
                    toast.warning("Bu gelir türü için bağlı maaş seçiniz.");
                    return false;
                }
                if (!hedefMaasDonemi) {
                    toast.warning("Bu gelir türü için ait olduğu maaş dönemini seçiniz.");
                    return false;
                }
            }

            const tarih = (manualData && manualData.tarih) ? new Date(manualData.tarih) : (islemTarihi ? new Date(islemTarihi) : new Date());
            const yeniIslem = {
                uid: user.uid,
                alanKodu,
                hesapId: hedefHesapId,
                islemTipi: hedefTipi,
                kategori: hedefKategori,
                tutar,
                aciklama: hedefAciklama || "",
                tarih
            };
            if (hedefTipi === 'gelir') {
                yeniIslem.gelirTuru = hedefGelirTuru || "Diğer Gelir";
                yeniIslem.incomeType = yeniIslem.gelirTuru;
                if (hedefBagliMaasId) yeniIslem.bagliMaasId = hedefBagliMaasId;
                if (hedefMaasDonemi) {
                    yeniIslem.maasDonemi = hedefMaasDonemi;
                    yeniIslem.salaryPeriod = hedefMaasDonemi;
                }
            }
            if (manualData) {
                ['gelirTuru', 'incomeType', 'maasOdemeTuru', 'salaryPartType', 'bagliMaasId', 'recurringIncomeId', 'gelirId', 'sourceId', 'maasDonemi', 'salaryPeriod'].forEach((field) => {
                    if (manualData[field] !== undefined && manualData[field] !== '') yeniIslem[field] = manualData[field];
                });
            }

            const batch = writeBatch(db);
            const islemRef = doc(collection(db, "nakit_islemleri"));
            batch.set(islemRef, yeniIslem);
            await syncTransactionTags(islemRef.id, hedefEtiketIds, [], batch);

            batch.update(doc(db, "hesaplar", hedefHesapId), {
                guncelBakiye: increment(hedefTipi === 'gelir' ? tutar : -tutar)
            });
            await batch.commit();

            if (!manualData) {
                setIslemTutar(""); setIslemAciklama(""); setIslemTarihi(""); setIslemGelirTuru("Diğer Gelir"); setIslemBagliMaasId(""); setIslemMaasDonemi(""); setSecilenEtiketIds([]);
            }
            toast.success("İşlem kaydedildi!");
            return true;
        } catch (error) {
            console.error("İşlem ekleme hatası:", error);
            toast.error("İşlem eklenirken hata oluştu.");
            return false;
        }
    }

    // Re-implementing islemSil properly
    const islemSilAction = async (id) => {
        const docRef = doc(db, "nakit_islemleri", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            Swal.fire({
                title: 'Silmek istiyor musun?',
                html: `Bu işlemi geri alamazsın.<br/>Tutar: <b>${formatCurrencyPlain(data.tutar)}</b>`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Evet, Sil!',
                cancelButtonText: 'Vazgeç'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const batch = writeBatch(db);
                        const tutar = parseFloat(data.tutar) || 0;

                        // 1. TERSİNE BAKE GÜNCELLEME MANTIĞI
                        if (data.islemTipi === "transfer") {
                            let linkedFeeDocs = [];
                            if (data.feeTransactionId) {
                                const feeSnap = await getDoc(doc(db, "nakit_islemleri", data.feeTransactionId));
                                if (feeSnap.exists()) linkedFeeDocs = [{ ref: feeSnap.ref, data: feeSnap.data() }];
                            } else {
                                const feeQuery = query(collection(db, "nakit_islemleri"), where("linkedTransferId", "==", id));
                                const feeSnap = await getDocs(feeQuery);
                                linkedFeeDocs = feeSnap.docs.map((feeDoc) => ({ ref: feeDoc.ref, data: feeDoc.data() }));
                            }

                            const accountAdjustments = new Map();
                            const addAccountAdjustment = (accountId, amount) => {
                                if (!accountId || !Number.isFinite(amount) || amount === 0) return;
                                accountAdjustments.set(accountId, (accountAdjustments.get(accountId) || 0) + amount);
                            };

                            // Transfer: Kaynaktan çıktı, Hedefe girdi.
                            // Silinince: Kaynağa geri ekle (+), Hedepten düş (-).
                            addAccountAdjustment(data.kaynakId, tutar);
                            addAccountAdjustment(data.hedefId, -tutar);

                            linkedFeeDocs.forEach(({ ref, data: feeData }) => {
                                const feeAmount = parseFloat(feeData?.tutar) || 0;
                                addAccountAdjustment(feeData?.hesapId, feeAmount);
                                batch.delete(ref);
                            });

                            accountAdjustments.forEach((amount, accountId) => {
                                batch.update(doc(db, "hesaplar", accountId), { guncelBakiye: increment(amount) });
                            });
                        } else {
                            // Gelir/Gider
                            let duzeltmeMiktari = 0;
                            if (data.islemTipi === 'gider' || data.islemTipi === 'yatirim_alis') duzeltmeMiktari = tutar; // Harcananı iade et (+)
                            if (data.islemTipi === 'gelir' || data.islemTipi === 'yatirim_satis') duzeltmeMiktari = -tutar; // Geleni geri al (-)

                            if (data.hesapId && duzeltmeMiktari !== 0) {
                                const hesapRef = doc(db, "hesaplar", data.hesapId);
                                batch.update(hesapRef, { guncelBakiye: increment(duzeltmeMiktari) });
                            }
                        }

                        // 2. Taksit Durumu
                        if (data.kategori === "Taksit" && data.taksitId) {
                            const taksitRef = doc(db, "taksitler", data.taksitId);
                            batch.update(taksitRef, { odenmisTaksit: increment(-1) });
                        }

                        // 3. Borç Ödeme Durumu
                        if (data.borcId) {
                            const borcRef = doc(db, "borclar", data.borcId);
                            batch.update(borcRef, { kalanTutar: increment(tutar) });
                        }

                        // 4. İşlemi Sil
                        transactionTags
                            .filter((link) => (link.transaction_id || link.transactionId) === id)
                            .forEach((link) => batch.delete(doc(db, "transaction_tags", link.id || buildTransactionTagId(id, link.tag_id || link.tagId))));
                        batch.delete(docRef);

                        // 5. Atomik İşlemi Uygula
                        await batch.commit();
                        toast.success("İşlem başarıyla silindi ve bakiyeler güncellendi.");

                    } catch (error) {
                        console.error("Silme hatası:", error);
                        toast.error("İşlem silinirken hata oluştu.");
                    }
                }
            });
        }
    }

    const islemDuzenle = async (e, id, veriler) => {
        e.preventDefault();
        try {
            const yeniTutar = parseFloat(islemTutar);
            if (isNaN(yeniTutar)) {
                toast.warning("Geçerli bir tutar giriniz.");
                return false;
            }

            const guncelTarih = islemTarihi ? new Date(islemTarihi) : new Date();
            const isTransfer = veriler.islemTipi === 'transfer' || veriler.kategori === 'Transfer';
            const maasOdemeTurleri = ["Maaş Ödemesi", "Maaş Avansı", "Maaş Farkı", "Ek Maaş"];
            const eskiTutar = parseFloat(veriler.tutar || 0);
            const eskiHesapId = veriler.hesapId || "";
            const yeniHesapId = isTransfer ? "" : (secilenHesapId || eskiHesapId);

            if (!isTransfer && !yeniHesapId) {
                toast.warning("Lütfen ödeme aracı seçiniz.");
                return false;
            }
            if (veriler.islemTipi === 'gelir' && maasOdemeTurleri.includes(islemGelirTuru)) {
                if (!islemBagliMaasId) {
                    toast.warning("Bu gelir türü için bağlı maaş seçiniz.");
                    return false;
                }
                if (!islemMaasDonemi) {
                    toast.warning("Bu gelir türü için ait olduğu maaş dönemini seçiniz.");
                    return false;
                }
            }

            const updateData = { aciklama: islemAciklama, tutar: yeniTutar, tarih: guncelTarih };
            if (veriler.islemTipi.includes('yatirim') || veriler.kategori === 'Yatırım') {
                updateData.yatirimTuru = kategori;
                updateData.adet = islemAdet ? parseFloat(islemAdet) : 0;
                updateData.birimFiyat = islemBirimFiyat ? parseFloat(islemBirimFiyat) : 0;
            } else {
                updateData.kategori = kategori;
            }
            if (veriler.islemTipi === 'gelir') {
                updateData.gelirTuru = islemGelirTuru || "Diğer Gelir";
                updateData.incomeType = updateData.gelirTuru;
                updateData.bagliMaasId = maasOdemeTurleri.includes(updateData.gelirTuru) ? islemBagliMaasId : "";
                updateData.maasDonemi = maasOdemeTurleri.includes(updateData.gelirTuru) ? islemMaasDonemi : "";
                updateData.salaryPeriod = maasOdemeTurleri.includes(updateData.gelirTuru) ? islemMaasDonemi : "";
            }

            const batch = writeBatch(db);

            if (isTransfer) {
                const fark = yeniTutar - eskiTutar;
                if (Math.abs(fark) > 0.0001) {
                    if (veriler.kaynakId) {
                        batch.update(doc(db, "hesaplar", veriler.kaynakId), { guncelBakiye: increment(-fark) });
                    }
                    if (veriler.hedefId) {
                        batch.update(doc(db, "hesaplar", veriler.hedefId), { guncelBakiye: increment(fark) });
                    }
                }
            } else {
                updateData.hesapId = yeniHesapId;
                const isPozitif = veriler.islemTipi === 'gelir' || veriler.islemTipi === 'yatirim_satis';
                const isNegatif = veriler.islemTipi === 'gider' || veriler.islemTipi === 'yatirim_alis';
                const islemSign = isPozitif ? 1 : (isNegatif ? -1 : 0);

                if (islemSign !== 0) {
                    if (eskiHesapId && eskiHesapId === yeniHesapId) {
                        const fark = islemSign * (yeniTutar - eskiTutar);
                        if (Math.abs(fark) > 0.0001) {
                            batch.update(doc(db, "hesaplar", yeniHesapId), { guncelBakiye: increment(fark) });
                        }
                    } else {
                        if (eskiHesapId) {
                            batch.update(doc(db, "hesaplar", eskiHesapId), { guncelBakiye: increment(-(islemSign * eskiTutar)) });
                        }
                        batch.update(doc(db, "hesaplar", yeniHesapId), { guncelBakiye: increment(islemSign * yeniTutar) });
                    }
                }
            }

            batch.update(doc(db, "nakit_islemleri", id), updateData);
            await syncTransactionTags(id, secilenEtiketIds, null, batch);
            await batch.commit();

            toast.success("İşlem güncellendi.");
            return true;
        } catch (error) {
            console.error("İşlem güncelleme hatası:", error);
            toast.error("İşlem güncellenemedi.");
            return false;
        }
    }

    const normalSil = async (koleksiyon, id) => {
        Swal.fire({ title: 'Emin misin?', text: "Bu kayıt kalıcı olarak silinecek.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Evet, Sil' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, koleksiyon, id));
                    toast.info("Kayıt silindi.");
                } catch (error) {
                    console.error("Silme hatası:", error);
                    toast.error("Silinirken bir hata oluştu: " + error.message);
                }
            }
        });
    }

    const buildPaymentIdempotencyKey = ({ sourceId, cardId, amount, date, paymentType = CREDIT_CARD_PAYMENT_TYPES.STATEMENT }) => {
        const safe = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        return [
            'ccpay',
            safe(paymentType),
            safe(user?.uid),
            safe(alanKodu),
            safe(sourceId),
            safe(cardId),
            Number.isFinite(date?.getTime?.()) ? date.getTime() : Date.now(),
            toMoneyCents(amount),
        ].join('_');
    };

    const krediKartiBorcOdemeKaydet = async ({
        kartId,
        kaynakId,
        tutar,
        tarih,
        aciklama = "",
        odemeTipi = CREDIT_CARD_PAYMENT_TYPES.STATEMENT,
        idempotencyKey,
        resetForm = true,
    }) => {
        try {
            const kart = hesaplar.find(h => h.id === kartId);
            const kaynak = hesaplar.find(h => h.id === kaynakId);
            const validation = validateCreditCardPayment({ sourceAccount: kaynak, cardAccount: kart, amount: tutar });

            if (!validation.valid) {
                toast.error(validation.message);
                return false;
            }

            const paymentDate = tarih instanceof Date ? tarih : (tarih ? new Date(tarih) : new Date());
            const safePaymentDate = Number.isNaN(paymentDate.getTime()) ? new Date() : paymentDate;
            const paymentRef = idempotencyKey
                ? doc(db, "nakit_islemleri", idempotencyKey)
                : doc(collection(db, "nakit_islemleri"));
            const transferId = paymentRef.id;

            await runTransaction(db, async (transaction) => {
                const existingPayment = await transaction.get(paymentRef);
                if (existingPayment.exists()) return;

                const sourceRef = doc(db, "hesaplar", kaynakId);
                const cardRef = doc(db, "hesaplar", kartId);
                const sourceSnap = await transaction.get(sourceRef);
                const cardSnap = await transaction.get(cardRef);
                const freshSource = sourceSnap.exists() ? { id: kaynakId, ...sourceSnap.data() } : null;
                const freshCard = cardSnap.exists() ? { id: kartId, ...cardSnap.data() } : null;
                const freshValidation = validateCreditCardPayment({ sourceAccount: freshSource, cardAccount: freshCard, amount: tutar });

                if (!freshValidation.valid) throw new Error(freshValidation.message);

                const appliedPayment = applyCreditCardPaymentToBalances({
                    sourceAccount: freshSource,
                    cardAccount: freshCard,
                    amount: freshValidation.amount,
                    paymentId: transferId,
                    paymentType: odemeTipi,
                });
                if (!appliedPayment.valid) throw new Error(appliedPayment.message);
                const metadata = appliedPayment.metadata;
                const isStatementPayment = odemeTipi === CREDIT_CARD_PAYMENT_TYPES.STATEMENT;
                const description = aciklama?.trim() || `${freshSource.hesapAdi} → ${freshCard.hesapAdi} ${isStatementPayment ? 'Ekstre Ödemesi' : 'Ara Ödeme'}`;

                transaction.set(paymentRef, {
                    uid: user.uid,
                    alanKodu,
                    islemTipi: "transfer",
                    kategori: "Kredi Kartı Ödemesi",
                    tutar: freshValidation.amount,
                    aciklama: description,
                    tarih: safePaymentDate,
                    kaynakId,
                    hedefId: kartId,
                    transferId,
                    transactionId: transferId,
                    linkedTransactionId: transferId,
                    isCreditCardPayment: true,
                    krediKartiOdeme: true,
                    kkOdemeTipi: odemeTipi,
                    ...metadata,
                    upcomingPaymentStatus: isStatementPayment ? (metadata.statementPaid ? 'paid' : 'partial') : 'independent',
                    paidAt: isStatementPayment && metadata.statementPaid ? safePaymentDate : null,
                });
                transaction.update(sourceRef, { guncelBakiye: appliedPayment.sourceBalance });
                transaction.update(cardRef, { guncelBakiye: appliedPayment.cardBalance });
            });

            toast.success("Kredi kartı ödemesi kaydedildi.");
            if (resetForm) {
                setKkOdemeTutar("");
                setKkOdemeKaynakId("");
                setKkOdemeKartId("");
                setKkOdemeTarihi("");
                setKkOdemeAciklama("");
                setKkOdemeTipi(CREDIT_CARD_PAYMENT_TYPES.STATEMENT);
            }
            return true;
        } catch (err) {
            console.error(err);
            toast.error(err?.message || "Ödeme hatası");
            return false;
        }
    };

    const transferYap = async (e) => {
        if (e) e.preventDefault();
        try {
            const tutar = parseFloat(transferTutar);
            const ucret = parseFloat(transferUcreti) || 0; // Fee

            if (!transferKaynakId || !transferHedefId) {
                toast.error("Lütfen hesapları seçin.");
                return false;
            }
            if (transferKaynakId === transferHedefId) {
                toast.error("Aynı hesaba transfer yapılamaz.");
                return false;
            }
            if (!transferTutar || isNaN(tutar) || tutar <= 0) {
                toast.error("Geçerli bir transfer tutarı girin.");
                return false;
            }

            const k = hesaplar.find(h => h.id === transferKaynakId);
            const h = hesaplar.find(h => h.id === transferHedefId);
            const tarih = transferTarihi ? new Date(transferTarihi) : new Date();

            if (h?.hesapTipi === 'krediKarti') {
                if (ucret > 0) {
                    toast.error("Kredi kartı borç ödemesinde transfer ücreti desteklenmiyor.");
                    return false;
                }
                const success = await krediKartiBorcOdemeKaydet({
                    kartId: transferHedefId,
                    kaynakId: transferKaynakId,
                    tutar,
                    tarih,
                    aciklama: transferAciklama,
                    odemeTipi: CREDIT_CARD_PAYMENT_TYPES.INTERIM,
                    idempotencyKey: buildPaymentIdempotencyKey({ sourceId: transferKaynakId, cardId: transferHedefId, amount: tutar, date: tarih, paymentType: CREDIT_CARD_PAYMENT_TYPES.INTERIM }),
                    resetForm: false,
                });
                if (success) {
                    setTransferTutar(""); setTransferUcreti(""); setTransferAciklama(""); setTransferKaynakId(""); setTransferHedefId(""); setTransferTarihi("");
                }
                return success;
            }

            const batch = writeBatch(db);
            const transferRef = doc(collection(db, "nakit_islemleri"));
            const feeRef = ucret > 0 ? doc(collection(db, "nakit_islemleri")) : null;

            // 1. Transfer Logic (Money Moved)
            const transferAciklamaMetni = transferAciklama.trim()
                || `${k?.hesapAdi} ➝ ${h?.hesapAdi}` + (ucret > 0 ? ` (+${formatCurrencyPlain(ucret)} Komisyon)` : "");

            batch.set(transferRef, {
                uid: user.uid, alanKodu, islemTipi: "transfer", kategori: "Transfer",
                tutar: tutar, aciklama: transferAciklamaMetni,
                tarih: tarih, kaynakId: transferKaynakId, hedefId: transferHedefId,
                transferFeeAmount: ucret,
                feeTransactionId: feeRef?.id || ""
            });

            // 2. Fee Logic (Extra Expense)
            if (ucret > 0 && feeRef) {
                batch.set(feeRef, {
                    uid: user.uid,
                    alanKodu,
                    hesapId: transferKaynakId, // Fee deducted from Source
                    islemTipi: "gider",
                    kategori: "Banka Komisyonu",
                    tutar: ucret,
                    aciklama: `Transfer Ücreti (${k?.hesapAdi} ➝ ${h?.hesapAdi})`,
                    tarih: tarih,
                    linkedTransferId: transferRef.id,
                    transferId: transferRef.id
                });
            }

            // 3. Update Balances
            // Source: Deduct Tutar AND Fee
            batch.update(doc(db, "hesaplar", transferKaynakId), { guncelBakiye: increment(-(tutar + ucret)) });
            // Target: Add Tutar only
            batch.update(doc(db, "hesaplar", transferHedefId), { guncelBakiye: increment(tutar) });
            await batch.commit();

            toast.success("Transfer (ve varsa ücret) işlendi!");
            setTransferTutar(""); setTransferUcreti(""); setTransferAciklama(""); setTransferKaynakId(""); setTransferHedefId(""); setTransferTarihi("");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Transfer hatası");
            return false;
        }
    }

    const krediKartiBorcOde = async (e) => {
        if (e) e.preventDefault();
        const tutar = parseFloat(kkOdemeTutar);
        const tarih = kkOdemeTarihi ? new Date(kkOdemeTarihi) : new Date();
        return krediKartiBorcOdemeKaydet({
            kartId: kkOdemeKartId,
            kaynakId: kkOdemeKaynakId,
            tutar,
            tarih,
            aciklama: kkOdemeAciklama,
            odemeTipi: kkOdemeTipi,
            idempotencyKey: buildPaymentIdempotencyKey({ sourceId: kkOdemeKaynakId, cardId: kkOdemeKartId, amount: tutar, date: tarih, paymentType: kkOdemeTipi }),
        });
    };

    // --- TAKSİT ---
    const taksitEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!taksitHesapId || !taksitToplamTutar || !taksitSayisi) {
                toast.error("Eksik bilgi!");
                return false;
            }
            const toplam = parseFloat(taksitToplamTutar);
            const sayi = parseInt(taksitSayisi);

            if (isNaN(toplam) || isNaN(sayi) || sayi <= 0) {
                toast.error("Geçersiz değerler.");
                return false;
            }

            const aylik = toplam / sayi;
            const secilenTaksitKategori = taksitKategori || (kategoriListesi && kategoriListesi[0]) || "Diğer";
            const tarih = taksitAlisTarihi ? new Date(taksitAlisTarihi) : new Date();

            await addDoc(collection(db, "taksitler"), { uid: user.uid, alanKodu, baslik: taksitBaslik, toplamTutar: toplam, taksitSayisi: sayi, aylikTutar: aylik, odenmisTaksit: 0, hesapId: taksitHesapId, kategori: secilenTaksitKategori, olusturmaTarihi: new Date(), alisTarihi: tarih });

            toast.success("Taksit planı oluşturuldu!");
            setTaksitBaslik(""); setTaksitToplamTutar(""); setTaksitSayisi(""); setTaksitHesapId(""); setTaksitAlisTarihi("");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Taksit oluşturulamadı.");
            return false;
        }
    }

    const taksitOde = async (t) => {
        const result = await Swal.fire({ title: 'Taksit İşlensin mi?', html: `<b>${t.baslik}</b> için bu ayın taksiti işlenecek.<br/><br/><span style="font-size:1.2em; color:#4f46e5; font-weight:bold">${formatCurrencyPlain(t.aylikTutar)}</span>`, icon: 'question', showCancelButton: true, confirmButtonText: 'Evet, İşle', cancelButtonText: 'İptal' });
        if (!result.isConfirmed) return;
        const yeniSayac = t.odenmisTaksit + 1;
        const commitPayment = async (shouldDelete = false) => {
            const batch = writeBatch(db);
            batch.set(doc(collection(db, "nakit_islemleri")), { uid: user.uid, alanKodu, hesapId: t.hesapId, islemTipi: "gider", kategori: t.kategori || "Taksit", tutar: t.aylikTutar, aciklama: `${t.baslik} (${yeniSayac}/${t.taksitSayisi})`, tarih: new Date(), taksitId: t.id });
            batch.update(doc(db, "hesaplar", t.hesapId), { guncelBakiye: increment(-t.aylikTutar) });
            if (shouldDelete) batch.delete(doc(db, "taksitler", t.id));
            else batch.update(doc(db, "taksitler", t.id), { odenmisTaksit: yeniSayac });
            await batch.commit();
        };

        if (yeniSayac >= t.taksitSayisi) {
            const finishResult = await Swal.fire({
                title: 'Taksit Bitti! 🎉',
                text: `${t.baslik || 'Taksit'} taksitleri bitti (${yeniSayac}/${t.taksitSayisi}). Kaldırılsın mı?`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Kaldır',
                cancelButtonText: 'Listede Tut'
            });
            await commitPayment(finishResult.isConfirmed);
        } else { await commitPayment(); }
        toast.success("Taksit işlendi.");
    }
    const taksitDuzenle = async (e, id) => { e.preventDefault(); const toplam = parseFloat(taksitToplamTutar); const sayi = parseInt(taksitSayisi); const aylik = toplam / sayi; const tarih = taksitAlisTarihi ? new Date(taksitAlisTarihi) : new Date(); await updateDoc(doc(db, "taksitler", id), { baslik: taksitBaslik, toplamTutar: toplam, taksitSayisi: sayi, aylikTutar: aylik, hesapId: taksitHesapId, kategori: taksitKategori, alisTarihi: tarih }); toast.success("Taksit güncellendi."); return true; }

    // --- ABONELİK ---
    const abonelikEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!aboAd || !aboTutar || !aboHesapId) {
                toast.error("Eksik bilgi");
                return false;
            }
            const tutar = parseFloat(aboTutar);
            if (isNaN(tutar)) {
                toast.error("Geçersiz tutar");
                return false;
            }
            const secilenAboKategori = aboKategori || (kategoriListesi && kategoriListesi[0]) || "Fatura";
            await addDoc(collection(db, "abonelikler"), { uid: user.uid, alanKodu, ad: aboAd, tutar: tutar, gun: aboGun, hesapId: aboHesapId, kategori: secilenAboKategori });
            setAboAd(""); setAboTutar(""); setAboGun(""); setAboHesapId("");
            toast.success("Sabit gider eklendi.");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Hata oluştu");
            return false;
        }
    }
    const abonelikOde = async (abonelik) => { const result = await Swal.fire({ title: 'Ödeme Onayı', html: `${abonelik.ad} (<b>${formatCurrencyPlain(abonelik.tutar)}</b>) ödensin mi?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Evet, Öde', cancelButtonText: 'İptal' }); if (!result.isConfirmed) return; const batch = writeBatch(db); batch.set(doc(collection(db, "nakit_islemleri")), { uid: user.uid, alanKodu, hesapId: abonelik.hesapId, islemTipi: "gider", kategori: abonelik.kategori || "Fatura", tutar: abonelik.tutar, aciklama: abonelik.ad + " (Otomatik)", tarih: new Date(), subscriptionId: abonelik.id, bagliAbonelikId: abonelik.id, recurringDefinitionId: abonelik.id, autoGeneratedFromId: abonelik.id }); batch.update(doc(db, "hesaplar", abonelik.hesapId), { guncelBakiye: increment(-abonelik.tutar) }); await batch.commit(); toast.success("Ödeme işlendi."); }
    const abonelikDuzenle = async (e, id) => { e.preventDefault(); await updateDoc(doc(db, "abonelikler", id), { ad: aboAd, tutar: parseFloat(aboTutar), gun: aboGun, hesapId: aboHesapId, kategori: aboKategori }); toast.success("Sabit gider güncellendi."); return true; }

    // --- MAAŞ ---
    const maasEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!maasAd || !maasTutar || !maasHesapId) {
                toast.error("Eksik bilgi");
                return false;
            }
            const tutar = parseFloat(maasTutar);
            if (isNaN(tutar)) {
                toast.error("Geçersiz tutar");
                return false;
            }
            await addDoc(collection(db, "maaslar"), {
                uid: user.uid,
                alanKodu,
                ad: maasAd,
                tutar: tutar,
                gun: maasGun,
                hesapId: maasHesapId,
                beklenenHesapId: maasHesapId,
                gerceklesenHesapId: "",
                tur: maasTur || "Maaş"
            });
            setMaasAd(""); setMaasTutar(""); setMaasGun(""); setMaasHesapId(""); setMaasTur("Maaş");
            toast.success("Gelir kalemi eklendi.");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Kayıt başarısız");
            return false;
        }
    }
    const maasYatir = async (maas) => { const result = await Swal.fire({ title: 'Maaş Yatırılsın mı?', html: `💰 <b>${maas.ad}</b> tutarı (${formatCurrencyPlain(maas.tutar)}) hesaba işlensin mi?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Evet, Yatır', confirmButtonColor: 'green' }); if (!result.isConfirmed) return; const hedefHesapId = maas.gerceklesenHesapId || maas.beklenenHesapId || maas.hesapId; const batch = writeBatch(db); batch.set(doc(collection(db, "nakit_islemleri")), { uid: user.uid, alanKodu, hesapId: hedefHesapId, islemTipi: "gelir", kategori: "Maaş/Gelir", gelirTuru: maas.tur || "Maaş Ödemesi", incomeType: maas.tur || "Maaş Ödemesi", bagliMaasId: maas.id, recurringIncomeId: maas.id, tutar: maas.tutar, aciklama: `${maas.ad} (Otomatik)`, tarih: new Date() }); batch.update(doc(db, "hesaplar", hedefHesapId), { guncelBakiye: increment(maas.tutar) }); batch.update(doc(db, "maaslar", maas.id), { gerceklesenHesapId: hedefHesapId, beklenenHesapId: maas.beklenenHesapId || maas.hesapId || "" }); await batch.commit(); toast.success("Gelir hesaba işlendi!"); }
    const maasDuzenle = async (e, id) => { e.preventDefault(); await updateDoc(doc(db, "maaslar", id), { ad: maasAd, tutar: parseFloat(maasTutar), gun: maasGun, hesapId: maasHesapId, beklenenHesapId: maasHesapId, tur: maasTur || "Maaş" }); toast.success("Gelir kalemi güncellendi."); return true; }

    // --- BORÇ ---
    const borcEkle = async (e, close) => {
        if (e) e.preventDefault();
        try {
            if (!borcAd || !borcTutar) {
                toast.error("Eksik bilgi");
                return false;
            }
            const tutar = parseFloat(borcTutar);
            if (isNaN(tutar)) {
                toast.error("Geçersiz tutar");
                return false;
            }
            const kalan = borcKalanTutar ? parseFloat(borcKalanTutar) : tutar;
            const borcQuery = query(collection(db, "borclar"), where("alanKodu", "==", alanKodu));
            const borcSnap = await getDocs(borcQuery);
            const maxOrderIndex = borcSnap.docs.reduce((max, belge) => {
                const sira = Number(belge.data()?.orderIndex);
                return Number.isFinite(sira) ? Math.max(max, sira) : max;
            }, -1);

            const data = {
                uid: user.uid, alanKodu,
                ad: borcAd, toplamTutar: tutar, kalanTutar: kalan,
                kategori: borcKategori || "Borç Ödemesi",
                orderIndex: maxOrderIndex + 1,
                eklenmeTarihi: new Date()
            };
            if (borcTarih) data.sonOdemeTarihi = borcTarih;

            await addDoc(collection(db, "borclar"), data);
            setBorcAd(""); setBorcTutar(""); setBorcKalanTutar(""); setBorcTarih(""); setBorcKategori(kategoriListesi && kategoriListesi[0] ? kategoriListesi[0] : "");
            toast.success("Borç tanımlandı.");
            if (close) close();
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Kayıt başarısız");
            return false;
        }
    }

    const borcDuzenle = async (e, id, close) => {
        if (e) e.preventDefault();
        try {
            const data = {
                ad: borcAd,
                toplamTutar: parseFloat(borcTutar),
                kalanTutar: parseFloat(borcKalanTutar),
                kategori: borcKategori || "Borç Ödemesi"
            };
            if (borcTarih) data.sonOdemeTarihi = borcTarih;
            else data.sonOdemeTarihi = deleteField(); // Remove field if left empty on edit

            await updateDoc(doc(db, "borclar", id), data);
            toast.success("Borç güncellendi.");
            if (close) close();
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Güncelleme başarısız");
            return false;
        }
    }

    const borcOrderGuncelle = async (id, yeniVeri) => {
        if (!id) return false;
        try {
            await updateDoc(doc(db, "borclar", id), yeniVeri);
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Borç sırası güncellenemedi");
            return false;
        }
    }

    const borcOde = async (borc, odemeTutar, secilenHesapId) => {
        try {
            const odeme = parseFloat(odemeTutar);
            const mevcutKalan = parseFloat(borc?.kalanTutar) || 0;
            if (isNaN(odeme) || odeme <= 0) {
                toast.error("Geçerli bir ödeme tutarı girin");
                return { success: false };
            }

            const batch = writeBatch(db);

            // 1. İşlemi Kaydet (Gider)
            batch.set(doc(collection(db, "nakit_islemleri")), {
                uid: user.uid, alanKodu,
                hesapId: secilenHesapId,
                islemTipi: "gider", kategori: borc.kategori || "Borç Ödemesi",
                borcId: borc.id, // Reversion için id bilgisini ekliyoruz
                tutar: odeme, aciklama: `${borc.ad} - Borç Ödemesi`,
                tarih: new Date()
            });

            // 2. Bakiyeden Düş
            batch.update(doc(db, "hesaplar", secilenHesapId), { guncelBakiye: increment(-odeme) });

            // 3. Borcun Kalan Tutarını Düş
            const yeniKalan = mevcutKalan - odeme;
            if (yeniKalan <= 0) {
                batch.update(doc(db, "borclar", borc.id), { kalanTutar: 0 });
            } else {
                batch.update(doc(db, "borclar", borc.id), { kalanTutar: yeniKalan });
            }
            await batch.commit();

            toast.success("Ödeme işlendi.");
            return {
                success: true,
                borcKapandi: yeniKalan <= 0,
                borcId: borc.id,
                borcAd: borc.ad
            };
        } catch (err) {
            console.error(err);
            toast.error("Ödeme işlenemedi");
            return { success: false };
        }
    }

    const borcSil = async (id) => {
        if (!id) return false;
        try {
            await deleteDoc(doc(db, "borclar", id));
            toast.success("Borç listeden kaldırıldı.");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Borç kaldırılamadı");
            return false;
        }
    }

    // --- CARİ / ŞİRKET ALACAKLARI ---
    const cariHarcamaEkle = async (e, close) => {
        if (e) e.preventDefault();
        try {
            if (!cariBaslik || !cariTutar || !cariHesapId) {
                toast.error("Başlık, tutar ve ödeme hesabı gerekli.");
                return false;
            }

            const tutar = parseFloat(cariTutar);
            if (isNaN(tutar) || tutar <= 0) {
                toast.error("Geçerli bir tutar girin.");
                return false;
            }

            const tarih = cariTarih ? new Date(cariTarih) : new Date();
            const cariRef = doc(collection(db, "cari_islemleri"));
            const batch = writeBatch(db);

            batch.set(cariRef, {
                uid: user.uid,
                alanKodu,
                baslik: cariBaslik,
                kategori: cariKategori || "Şirket Harcaması",
                tutar,
                iadeAlinan: 0,
                hesapId: cariHesapId,
                not: cariNot || "",
                durum: "bekliyor",
                tarih,
                olusturmaTarihi: new Date()
            });

            batch.set(doc(collection(db, "nakit_islemleri")), {
                uid: user.uid,
                alanKodu,
                hesapId: cariHesapId,
                islemTipi: "cari_harcama",
                kategori: "Cari Alacak",
                tutar,
                aciklama: `${cariBaslik} (şirket adına)`,
                cariId: cariRef.id,
                tarih
            });

            batch.update(doc(db, "hesaplar", cariHesapId), { guncelBakiye: increment(-tutar) });
            await batch.commit();

            setCariBaslik(""); setCariTutar(""); setCariHesapId(""); setCariKategori("Şirket Harcaması"); setCariTarih(""); setCariNot("");
            toast.success("Cari alacak kaydedildi.");
            if (close) close();
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Cari kayıt oluşturulamadı.");
            return false;
        }
    };

    const cariIadeAl = async (cari, odemeTutar, hesapId) => {
        try {
            const odeme = parseFloat(odemeTutar);
            const toplam = parseFloat(cari?.tutar) || 0;
            const alinan = parseFloat(cari?.iadeAlinan) || 0;
            const kalan = Math.max(0, toplam - alinan);

            if (isNaN(odeme) || odeme <= 0) {
                toast.error("Geçerli bir iade tutarı girin.");
                return false;
            }
            if (!hesapId) {
                toast.error("İadenin girdiği hesabı seçin.");
                return false;
            }

            const yeniAlinan = Math.min(toplam, alinan + odeme);
            const batch = writeBatch(db);
            batch.update(doc(db, "cari_islemleri", cari.id), {
                iadeAlinan: yeniAlinan,
                durum: yeniAlinan >= toplam ? "odendi" : "kismi",
                sonIadeTarihi: new Date()
            });
            batch.set(doc(collection(db, "nakit_islemleri")), {
                uid: user.uid,
                alanKodu,
                hesapId,
                islemTipi: "cari_iade",
                kategori: "Cari İade",
                tutar: odeme,
                aciklama: `${cari.baslik} iadesi`,
                cariId: cari.id,
                tarih: new Date()
            });
            batch.update(doc(db, "hesaplar", hesapId), { guncelBakiye: increment(odeme) });
            await batch.commit();

            if (odeme > kalan) {
                toast.warning("İade kaydedildi; cari kalan tutardan fazla giriş toplam alacakla sınırlandı.");
            } else {
                toast.success("İade alındı.");
            }
            return true;
        } catch (err) {
            console.error(err);
            toast.error("İade kaydedilemedi.");
            return false;
        }
    };

    const cariSil = async (cari) => {
        if (!cari?.id) return false;
        try {
            const result = await Swal.fire({
                title: 'Cari kayıt silinsin mi?',
                text: 'Bağlı bakiye hareketleri de geri alınacak.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Evet, Sil',
                cancelButtonText: 'Vazgeç'
            });
            if (!result.isConfirmed) return false;

            const q = query(collection(db, "nakit_islemleri"), where("cariId", "==", cari.id));
            const snap = await getDocs(q);
            const batch = writeBatch(db);

            snap.docs.forEach(belge => {
                const data = belge.data();
                const tutar = parseFloat(data.tutar) || 0;
                if (data.hesapId && tutar > 0) {
                    const duzeltme = data.islemTipi === 'cari_harcama' ? tutar : -tutar;
                    batch.update(doc(db, "hesaplar", data.hesapId), { guncelBakiye: increment(duzeltme) });
                }
                batch.delete(belge.ref);
            });

            batch.delete(doc(db, "cari_islemleri", cari.id));
            await batch.commit();
            toast.success("Cari kayıt silindi ve bakiyeler geri alındı.");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Cari kayıt silinemedi.");
            return false;
        }
    };

    const fillCariIadeForm = (v) => {
        const kalan = (parseFloat(v?.tutar) || 0) - (parseFloat(v?.iadeAlinan) || 0);
        setCariIadeTutar(kalan > 0 ? kalan.toFixed(2) : "");
        setCariIadeHesapId("");
    };

    const fillCariForm = (v) => {
        setCariBaslik(v.baslik || "");
        setCariTutar(v.tutar || "");
        setCariHesapId(v.hesapId || "");
        setCariKategori(v.kategori || "Şirket Harcaması");
        setCariNot(v.not || "");
        if (v.tarih?.seconds) {
            const d = new Date(v.tarih.seconds * 1000);
            setCariTarih(d.toISOString().split('T')[0]);
        } else {
            setCariTarih(v.tarih || "");
        }
    };

    const cariHarcamaDuzenle = async (e, cari, close) => {
        if (e) e.preventDefault();
        try {
            if (!cari?.id || !cariBaslik || !cariTutar || !cariHesapId) {
                toast.error("Başlık, tutar ve ödeme hesabı gerekli.");
                return false;
            }

            const yeniTutar = parseFloat(cariTutar);
            const eskiTutar = parseFloat(cari.tutar) || 0;
            if (isNaN(yeniTutar) || yeniTutar <= 0) {
                toast.error("Geçerli bir tutar girin.");
                return false;
            }

            const eskiHesapId = cari.hesapId || "";
            const yeniHesapId = cariHesapId;
            const tarih = cariTarih ? new Date(cariTarih) : (cari.tarih || new Date());

            const q = query(collection(db, "nakit_islemleri"), where("cariId", "==", cari.id), where("islemTipi", "==", "cari_harcama"));
            const snap = await getDocs(q);
            const batch = writeBatch(db);

            if (eskiHesapId === yeniHesapId) {
                const fark = yeniTutar - eskiTutar;
                if (Math.abs(fark) > 0.0001) {
                    batch.update(doc(db, "hesaplar", yeniHesapId), { guncelBakiye: increment(-fark) });
                }
            } else {
                if (eskiHesapId) batch.update(doc(db, "hesaplar", eskiHesapId), { guncelBakiye: increment(eskiTutar) });
                batch.update(doc(db, "hesaplar", yeniHesapId), { guncelBakiye: increment(-yeniTutar) });
            }

            batch.update(doc(db, "cari_islemleri", cari.id), {
                baslik: cariBaslik,
                kategori: cariKategori || "Şirket Harcaması",
                tutar: yeniTutar,
                hesapId: yeniHesapId,
                not: cariNot || "",
                tarih
            });

            snap.docs.forEach(belge => {
                batch.update(belge.ref, {
                    hesapId: yeniHesapId,
                    tutar: yeniTutar,
                    aciklama: `${cariBaslik} (şirket adına)`,
                    tarih
                });
            });

            await batch.commit();
            toast.success("Cari kayıt güncellendi.");
            if (close) close();
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Cari kayıt güncellenemedi.");
            return false;
        }
    };

    // --- FATURA ---
    // --- FATURA ---
    const faturaTanimEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!tanimBaslik) {
                toast.warning("Başlık giriniz");
                return false;
            }
            await addDoc(collection(db, "fatura_tanimlari"), { uid: user.uid, alanKodu, baslik: tanimBaslik, kurum: tanimKurum, aboneNo: tanimAboneNo, hesapId: tanimHesapId });
            toast.success("Fatura/Abone Tanımlandı!");
            setTanimBaslik(""); setTanimKurum(""); setTanimAboneNo(""); setTanimHesapId("");
            return true;
        } catch (err) {
            console.error(err); return false;
        }
    }

    const faturaGir = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!secilenTanimId || !faturaGirisTutar || !faturaGirisTarih) {
                toast.warning("Tüm alanları doldurunuz.");
                return false;
            }
            const tutar = parseFloat(faturaGirisTutar);
            if (isNaN(tutar)) {
                toast.error("Geçersiz tutar");
                return false;
            }
            await addDoc(collection(db, "bekleyen_faturalar"), { uid: user.uid, alanKodu, tanimId: secilenTanimId, tutar: tutar, sonOdemeTarihi: faturaGirisTarih, aciklama: faturaGirisAciklama, eklenmeTarihi: new Date() });
            toast.success("Fatura takibe alındı!");
            setFaturaGirisTutar(""); setFaturaGirisTarih(""); setFaturaGirisAciklama("");
            return true;
        } catch (err) { console.error(err); return false; }
    }

    const faturaOde = async (fatura, hesapId) => {
        if (!hesapId) return;
        try {
            const tanim = tanimliFaturalar.find(t => t.id === fatura.tanimId);
            const ad = tanim ? tanim.baslik : "Fatura";

            const batch = writeBatch(db);

            // 1. İşlemi Kaydet (Gider)
            batch.set(doc(collection(db, "nakit_islemleri")), { uid: user.uid, alanKodu, hesapId: hesapId, islemTipi: "gider", kategori: "Fatura", tutar: fatura.tutar, aciklama: `${ad} Ödeme (${fatura.aciklama || ''})`, tarih: new Date() });

            // 2. Bakiyeden Düş
            batch.update(doc(db, "hesaplar", hesapId), { guncelBakiye: increment(-fatura.tutar) });

            // 3. Bekleyen Listesinden Sil (Tek Seferlik Ödeme)
            // Kullanıcı her ay manuel girecek.
            batch.delete(doc(db, "bekleyen_faturalar", fatura.id));
            await batch.commit();

            toast.success("Fatura ödendi ve listeden kaldırıldı.");

            return true;
        } catch (err) { console.error(err); toast.error("Fatura ödenemedi"); return false; }
    }

    const bekleyenFaturaDuzenle = async (e, id) => {
        if (e) e.preventDefault();
        try {
            const tutar = parseFloat(faturaGirisTutar);
            if (isNaN(tutar)) return false;
            await updateDoc(doc(db, "bekleyen_faturalar", id), { tutar: tutar, sonOdemeTarihi: faturaGirisTarih, aciklama: faturaGirisAciklama });
            setFaturaGirisTutar(""); setFaturaGirisTarih(""); setFaturaGirisAciklama("");
            toast.success("Fatura güncellendi");
            return true;
        } catch (err) { console.error(err); return false; }
    }

    const faturaTanimDuzenle = async (e, id) => {
        if (e) e.preventDefault();
        try {
            await updateDoc(doc(db, "fatura_tanimlari", id), { baslik: tanimBaslik, kurum: tanimKurum, aboneNo: tanimAboneNo, hesapId: tanimHesapId });
            setTanimBaslik(""); setTanimKurum(""); setTanimAboneNo(""); setTanimHesapId("");
            toast.success("Tanım güncellendi");
            return true;
        } catch (err) { console.error(err); return false; }
    }

    const excelIndir = async (islemler) => {
        const XLSX = await import('xlsx');
        let veri = [];
        if (!islemler || islemler.length === 0) {
            // Boş Template
            veri = [{
                Tarih: "01.01.2024",
                Saat: "12:00",
                "Açıklama": "Örnek Açıklama",
                Kategori: "Market",
                Tutar: 100,
                Hesap: "Nakit"
            }];
        } else {
            veri = islemler.map(i => {
                const date = new Date(i.tarih.seconds * 1000);
                const hesap = hesaplar.find(h => h.id === i.hesapId);
                return {
                    Tarih: date.toLocaleDateString('tr-TR'),
                    Saat: date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                    "Açıklama": i.aciklama,
                    Kategori: i.kategori,
                    Tutar: i.tutar,
                    Hesap: hesap ? hesap.hesapAdi : "Bilinmiyor"
                };
            });
        }

        const ws = XLSX.utils.json_to_sheet(veri);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Islemler");
        XLSX.writeFile(wb, "Harcamalar_Sablon.xlsx");
    }

    const excelYukle = (e) => {
        const dosya = e.target.files[0];
        if (!dosya) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const XLSX = await import('xlsx');
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            let eklenenSayisi = 0;
            let hataSayisi = 0;

            for (const row of data) {
                // 1. Temel Validasyon
                if (!row.Tutar || !row.Hesap) {
                    hataSayisi++;
                    continue;
                }

                // 2. Hesap Eşleştirme (Case-insensitive)
                const hedefHesap = hesaplar.find(h => h.hesapAdi.toLowerCase() === row.Hesap.toString().trim().toLowerCase());
                if (!hedefHesap) {
                    hataSayisi++;
                    console.warn(`Hesap bulunamadı: ${row.Hesap}`);
                    continue;
                }

                // 3. Tarih ve Saat Birleştirme
                let islemTarihi = new Date(); // Varsayılan: Şimdi

                if (row.Tarih) {
                    try {
                        // String Format: DD.MM.YYYY
                        if (typeof row.Tarih === 'string' && row.Tarih.includes('.')) {
                            const [gun, ay, yil] = row.Tarih.split('.');
                            if (gun && ay && yil) {
                                islemTarihi = new Date(`${yil}-${ay}-${gun}`);
                            }
                        } else {
                            // JS Date veya Serial Date
                            const d = new Date(row.Tarih);
                            if (!isNaN(d)) islemTarihi = d;
                        }

                        // Saat Varsa Ekleyelim (HH:MM)
                        if (row.Saat) {
                            const saatStr = row.Saat.toString();
                            if (saatStr.includes(':')) {
                                const [saat, dakika] = saatStr.split(':');
                                islemTarihi.setHours(parseInt(saat), parseInt(dakika));
                            }
                        }
                    } catch (err) {
                        console.error("Tarih parslama hatası", err);
                    }
                }

                // 4. Firestore Kayıt (Tek Tek - Güvenli)
                const kategori = row.Kategori || "Genel";
                const tutarVal = parseFloat(row.Tutar);

                try {
                    const yeniIslem = {
                        uid: user.uid,
                        alanKodu,
                        tarih: islemTarihi,
                        kategori: kategori,
                        aciklama: row['Açıklama'] || "Excel İçe Aktarım",
                        tutar: tutarVal,
                        islemTipi: "gider",
                        hesapId: hedefHesap.id
                    };
                    const batch = writeBatch(db);
                    batch.set(doc(collection(db, "nakit_islemleri")), yeniIslem);

                    // Bakiyeyi güncelle
                    batch.update(doc(db, "hesaplar", hedefHesap.id), {
                        guncelBakiye: increment(-tutarVal)
                    });
                    await batch.commit();

                    eklenenSayisi++;
                } catch (error) {
                    console.error("Satır ekleme hatası:", error);
                    hataSayisi++;
                }
            }

            if (eklenenSayisi > 0) toast.success(`${eklenenSayisi} işlem başarıyla yüklendi.`);
            if (hataSayisi > 0) toast.warning(`${hataSayisi} satır hatalı/eksik olduğu için atlandı.`);
        };
        reader.readAsBinaryString(dosya);
    }

    const verileriTasi = async (e) => {
        e.preventDefault();
        if (!yeniKodInput) return toast.error("Yeni kodu girmelisiniz.");
        if (yeniKodInput === alanKodu) return toast.error("Yeni kod eskisiyle aynı olamaz.");

        const result = await Swal.fire({
            title: 'DİKKAT!',
            html: `Tüm veriler <b>"${alanKodu}"</b> kodundan <b>"${yeniKodInput}"</b> koduna taşınacaktır.<br/>Bu işlem geri alınamaz!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Evet, Taşı'
        });

        if (!result.isConfirmed) return;

        setTasimaIslemiSuruyor(true);
        const yeniKod = yeniKodInput;
        const eskiKod = alanKodu;

        try {
            const eskiAyarRef = doc(db, "ayarlar", eskiKod);
            const eskiAyarSnap = await getDoc(eskiAyarRef);
            if (eskiAyarSnap.exists()) {
                await setDoc(doc(db, "ayarlar", yeniKod), eskiAyarSnap.data());
                await deleteDoc(eskiAyarRef);
            }

            const koleksiyonlar = ["hesaplar", "nakit_islemleri", "abonelikler", "taksitler", "maaslar", "portfoy", "bekleyen_faturalar", "fatura_tanimlari"];

            for (const kolAdi of koleksiyonlar) {
                const q = query(collection(db, kolAdi), where("alanKodu", "==", eskiKod));
                const snapshot = await getDocs(q);
                const promises = snapshot.docs.map(belge =>
                    updateDoc(doc(db, kolAdi, belge.id), { alanKodu: yeniKod })
                );
                await Promise.all(promises);
            }

            Swal.fire('Başarılı!', 'Taşıma işlemi tamamlandı.', 'success');
            localStorage.setItem("alan_kodu", yeniKod);
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Taşıma hatası:", error);
            Swal.fire('Hata', error.message, 'error');
        } finally {
            setTasimaIslemiSuruyor(false);
        }
    }

    // Helpers to fill forms
    const fillAccountForm = (v) => {
        setHesapAdi(v.hesapAdi);
        setHesapTipi(v.hesapTipi || "nakit");
        setBaslangicBakiye(formatMoneyInputValue(v.guncelBakiye));
        setHesapKesimGunu(v.kesimGunu || "");
        setKartLimiti(v.kartLimiti || v.limit || v.creditLimit ? formatMoneyInputValue(v.kartLimiti || v.limit || v.creditLimit) : "");
        setKartOdemeStratejisi(v.odemeStratejisi || CREDIT_CARD_PAYMENT_STRATEGIES.FULL);
        setKartVarsayilanOdemeTutari(v.varsayilanOdemeTutari ? formatMoneyInputValue(v.varsayilanOdemeTutari) : "");
        setKartPlanlananOdemeTutari(v.planlananOdemeTutari || v.manuelOdemeTutari ? formatMoneyInputValue(v.planlananOdemeTutari || v.manuelOdemeTutari) : "");
        setKartAsgariOdemeTutari(v.asgariOdemeTutari || v.asgariOdeme ? formatMoneyInputValue(v.asgariOdemeTutari || v.asgariOdeme) : "");
        setVarsayilanOdemeAraci(Boolean(canBeDefaultPaymentAccount(v) && v.varsayilanOdemeAraci));
        setMaasHesabi(Boolean(v.maasHesabi));
        setAnaMaasHesabi(Boolean(v.anaMaasHesabi));
        setHesapMaasGunu(v.maasGunu || "");
        setBagliMaasId(v.bagliMaasId || "");
    }
    const fillTransactionForm = (v) => {
        setIslemAciklama(v.aciklama);
        setIslemTutar(formatMoneyInputValue(v.tutar));
        setSecilenHesapId(v.hesapId || "");
        setIslemTipi(v.islemTipi || "gider");
        setIslemAdet(v.adet || ""); // Fill Quantity
        setIslemBirimFiyat(formatMoneyInputValue(v.birimFiyat)); // Fill Unit Price
        if (v.islemTipi?.includes('yatirim')) { setKategori(v.yatirimTuru || "Hisse"); }
        else { setKategori(v.kategori || ""); }
        if (v.tarih) { const date = new Date(v.tarih.seconds * 1000); const isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16); setIslemTarihi(isoString); }
        setIslemGelirTuru(v.gelirTuru || v.incomeType || "Diğer Gelir");
        setIslemBagliMaasId(v.bagliMaasId || v.recurringIncomeId || v.gelirId || "");
        setIslemMaasDonemi(v.salaryPeriod || v.maasDonemi || "");
        setSecilenEtiketIds(uniqueTagIds(v.tagIds || (v.tags || []).map((tag) => tag?.id)));
    }
    const fillSubscriptionForm = (v) => { setAboAd(v.ad); setAboTutar(formatMoneyInputValue(v.tutar)); setAboGun(v.gun); setAboHesapId(v.hesapId); setAboKategori(v.kategori); }
    const fillInstallmentForm = (v) => { setTaksitBaslik(v.baslik); setTaksitToplamTutar(formatMoneyInputValue(v.toplamTutar)); setTaksitSayisi(v.taksitSayisi); setTaksitHesapId(v.hesapId); setTaksitKategori(v.kategori); if (v.alisTarihi) { const d = new Date(v.alisTarihi.seconds * 1000); setTaksitAlisTarihi(d.toISOString().split('T')[0]); } }
    const fillSalaryForm = (v) => { setMaasAd(v.ad); setMaasTutar(formatMoneyInputValue(v.tutar)); setMaasGun(v.gun); setMaasHesapId(v.beklenenHesapId || v.hesapId); setMaasTur(v.tur || v.gelirTuru || "Maaş"); }
    const fillBorcForm = (v) => { setBorcAd(v.ad); setBorcTutar(formatMoneyInputValue(v.toplamTutar)); setBorcKalanTutar(formatMoneyInputValue(v.kalanTutar)); setBorcTarih(v.sonOdemeTarihi || ""); setBorcKategori(v.kategori || (kategoriListesi && kategoriListesi[0] ? kategoriListesi[0] : "")); }
    const resetBorcForm = () => { setBorcAd(""); setBorcTutar(""); setBorcKalanTutar(""); setBorcTarih(""); setBorcKategori(kategoriListesi && kategoriListesi[0] ? kategoriListesi[0] : ""); }
    const fillBillForm = (v) => { setFaturaGirisTutar(formatMoneyInputValue(v.tutar)); setFaturaGirisTarih(v.sonOdemeTarihi); setFaturaGirisAciklama(v.aciklama || ""); }
    const fillBillDefForm = (v) => { setTanimBaslik(v.baslik); setTanimKurum(v.kurum); setTanimAboneNo(v.aboneNo); setTanimHesapId(v.hesapId || ""); }
    const fillCCForm = (v) => {
        setKkOdemeKartId(v.id);
        const paymentPlan = getCreditCardPaymentPlan(v);
        setKkOdemeTutar(paymentPlan.plannedPayment > 0 ? formatMoneyInputValue(paymentPlan.plannedPayment) : "");
        const now = new Date();
        const localDateTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setKkOdemeTarihi(localDateTime);
        setKkOdemeAciklama("");
        setKkOdemeTipi(CREDIT_CARD_PAYMENT_TYPES.STATEMENT);
    }

    return {
        // States
        hesapAdi, setHesapAdi, hesapTipi, setHesapTipi, baslangicBakiye, setBaslangicBakiye, hesapKesimGunu, setHesapKesimGunu, kartLimiti, setKartLimiti,
        kartOdemeStratejisi, setKartOdemeStratejisi, kartVarsayilanOdemeTutari, setKartVarsayilanOdemeTutari, kartPlanlananOdemeTutari, setKartPlanlananOdemeTutari, kartAsgariOdemeTutari, setKartAsgariOdemeTutari,
        varsayilanOdemeAraci, setVarsayilanOdemeAraci,
        maasHesabi, setMaasHesabi, anaMaasHesabi, setAnaMaasHesabi, hesapMaasGunu, setHesapMaasGunu, bagliMaasId, setBagliMaasId,
        secilenHesapId, setSecilenHesapId, islemTutar, setIslemTutar, islemAciklama, setIslemAciklama, islemTipi, setIslemTipi, kategori, setKategori, islemTarihi, setIslemTarihi,
        secilenEtiketIds, setSecilenEtiketIds,
        islemGelirTuru, setIslemGelirTuru, islemBagliMaasId, setIslemBagliMaasId, islemMaasDonemi, setIslemMaasDonemi,
        islemAdet, setIslemAdet, islemBirimFiyat, setIslemBirimFiyat, // Return new states
        transferKaynakId, setTransferKaynakId, transferHedefId, setTransferHedefId, transferTutar, setTransferTutar, transferUcreti, setTransferUcreti, transferAciklama, setTransferAciklama, transferTarihi, setTransferTarihi,
        aboAd, setAboAd, aboTutar, setAboTutar, aboGun, setAboGun, aboHesapId, setAboHesapId, aboKategori, setAboKategori,
        taksitBaslik, setTaksitBaslik, taksitToplamTutar, setTaksitToplamTutar, taksitSayisi, setTaksitSayisi, taksitHesapId, setTaksitHesapId, taksitKategori, setTaksitKategori, taksitAlisTarihi, setTaksitAlisTarihi,
        maasAd, setMaasAd, maasTutar, setMaasTutar, maasGun, setMaasGun, maasHesapId, setMaasHesapId, maasTur, setMaasTur,
        borcAd, setBorcAd, borcTutar, setBorcTutar, borcKalanTutar, setBorcKalanTutar, borcTarih, setBorcTarih, borcKategori, setBorcKategori,
        cariBaslik, setCariBaslik, cariTutar, setCariTutar, cariHesapId, setCariHesapId, cariKategori, setCariKategori, cariTarih, setCariTarih, cariNot, setCariNot,
        cariIadeTutar, setCariIadeTutar, cariIadeHesapId, setCariIadeHesapId,
        tanimBaslik, setTanimBaslik, tanimKurum, setTanimKurum, tanimAboneNo, setTanimAboneNo, tanimHesapId, setTanimHesapId, secilenTanimId, setSecilenTanimId, faturaGirisTutar, setFaturaGirisTutar, faturaGirisTarih, setFaturaGirisTarih, faturaGirisAciklama, setFaturaGirisAciklama,
        kkOdemeKartId, setKkOdemeKartId, kkOdemeKaynakId, setKkOdemeKaynakId, kkOdemeTutar, setKkOdemeTutar, kkOdemeTarihi, setKkOdemeTarihi, kkOdemeAciklama, setKkOdemeAciklama, kkOdemeTipi, setKkOdemeTipi,
        tasimaIslemiSuruyor, setTasimaIslemiSuruyor, yeniKodInput, setYeniKodInput,

        // Actions
        hesapEkle, hesapDuzenle,
        ensureTag, renameTag, deleteTag,
        islemEkle, islemSil: islemSilAction, islemDuzenle, normalSil,
        transferYap, krediKartiBorcOde, krediKartiBorcOdemeKaydet,
        taksitEkle, taksitOde, taksitDuzenle,
        abonelikEkle, abonelikOde, abonelikDuzenle,
        maasEkle, maasYatir, maasDuzenle,
        borcEkle, borcDuzenle, borcOrderGuncelle, borcOde, borcSil,
        cariHarcamaEkle, cariHarcamaDuzenle, cariIadeAl, cariSil,
        faturaTanimEkle, faturaGir, faturaOde, bekleyenFaturaDuzenle, faturaTanimDuzenle,
        excelIndir, excelYukle, verileriTasi,

        // Fillers
        fillAccountForm, fillTransactionForm, fillSubscriptionForm, fillInstallmentForm, fillSalaryForm, fillBorcForm, resetBorcForm, fillCariForm, fillCariIadeForm, fillBillForm, fillBillDefForm, fillCCForm
    };
};
