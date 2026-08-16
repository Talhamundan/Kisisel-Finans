import { useEffect, useState } from 'react';
import { formatCurrencyPlain, toDateSafe } from '../utils/helpers';
import { getCreditCardPaymentPlan, isCreditCardStatementPaymentTransaction } from '../utils/creditCardPayments';
import { buildSubscriptionOccurrences } from '../utils/recurringPayments';

const NOTIFICATION_WINDOW_DAYS = 3;
const CREDIT_CARD_LIMIT_THRESHOLDS = [5, 10, 20, 50];

const getCreditCardLimitValue = (account) => parseFloat(
    account?.kartLimiti
    || account?.limit
    || account?.creditLimit
    || account?.krediKartiLimiti
) || 0;

const getCreditCardDebt = (account) => Math.max(0, -(parseFloat(account?.guncelBakiye) || 0));

const getCreditCardLimitThreshold = (availableRatio) => {
    if (!Number.isFinite(availableRatio)) return null;
    return CREDIT_CARD_LIMIT_THRESHOLDS.find((threshold) => availableRatio <= threshold) || null;
};

const getInstallmentRemainingDebt = (installment) => {
    const total = parseFloat(installment?.toplamTutar) || 0;
    const monthly = parseFloat(installment?.aylikTutar) || 0;
    const count = parseInt(installment?.taksitSayisi) || 0;
    const paid = Math.min(count, Math.max(
        parseInt(installment?.odenmisTaksit) || 0,
        parseInt(installment?.completedInstallments) || 0,
        parseInt(installment?.paidInstallmentCount) || 0
    ));

    if (count <= 0) return total;
    return Math.max(0, total - (monthly * paid));
};

const getCreditCardInstallmentExposure = (account, installments = []) => {
    if (!account?.id) return 0;
    return (installments || [])
        .filter((installment) => installment?.hesapId === account.id)
        .reduce((sum, installment) => sum + getInstallmentRemainingDebt(installment), 0);
};

export const useNotifications = ({
    hesaplar = [],
    islemler = [],
    abonelikler = [],
    taksitler = [],
    maaslar = [],
    bekleyenFaturalar = [],
    tanimliFaturalar = [],
    besVerisi,
    satislar = [],
    borclar = []
}) => {
    const [bildirimler, setBildirimler] = useState([]);

    useEffect(() => {
        if (islemler.length === 0 && abonelikler.length === 0 && taksitler.length === 0 && maaslar.length === 0 && hesaplar.length === 0 && bekleyenFaturalar.length === 0 && borclar.length === 0 && !besVerisi && satislar.length === 0) {
            setBildirimler([]);
            return;
        }
        const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const addMonthsClamped = (date, monthCount) => {
            const target = new Date(date.getFullYear(), date.getMonth() + monthCount, 1);
            const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
            target.setDate(Math.min(date.getDate(), lastDay));
            return target;
        };
        const now = new Date();
        const mevcutAy = now.getMonth();
        const mevcutYil = now.getFullYear();
        const mevcutGun = now.getDate();
        const periodKey = `${mevcutYil}-${String(mevcutAy + 1).padStart(2, '0')}`;
        const today0 = startOfDay(now);
        let tempBildirimler = [];
        const installmentPaymentCounts = new Map();

        const dueMessage = ({ name, daysLeft, overdueText }) => {
            if (daysLeft < 0) return `🔥 ${name} ${overdueText || 'GECİKTİ'}! (${Math.abs(daysLeft)} gün)`;
            if (daysLeft === 0) return `⚠️ ${name} için bugün son gün!`;
            return `⚠️ ${name} için son ${daysLeft} gün!`;
        };

        const addInstallmentPayment = (installmentId, paymentKey) => {
            if (!installmentId) return;
            if (!installmentPaymentCounts.has(installmentId)) installmentPaymentCounts.set(installmentId, new Set());
            installmentPaymentCounts.get(installmentId).add(paymentKey);
        };

        islemler.forEach((transaction) => {
            const linkedIds = [
                transaction.taksitId,
                transaction.installmentId,
                transaction.planId,
                transaction.sourceId,
                transaction.generatedFrom,
                transaction.linkedTransactionId,
            ].filter(Boolean);
            if (linkedIds.length === 0) return;

            const paymentKey = transaction.installmentNumber
                || transaction.taksitNo
                || transaction.taksitSirasi
                || transaction.id
                || `${transaction.tarih || ''}-${transaction.tutar || ''}-${transaction.aciklama || ''}`;

            linkedIds.forEach((installmentId) => addInstallmentPayment(installmentId, paymentKey));
        });

        hesaplar.forEach(h => {
            if (h.hesapTipi === 'krediKarti') {
                const kartLimiti = getCreditCardLimitValue(h);
                if (kartLimiti > 0) {
                    const mevcutBorc = getCreditCardDebt(h);
                    const taksitBlokaji = getCreditCardInstallmentExposure(h, taksitler);
                    const kullanilabilirLimit = Math.max(0, kartLimiti - mevcutBorc - taksitBlokaji);
                    const kullanilabilirYuzde = (kullanilabilirLimit / kartLimiti) * 100;
                    const esik = getCreditCardLimitThreshold(kullanilabilirYuzde);

                    if (esik !== null) {
                        tempBildirimler.push({
                            id: `${h.id}_kk_limit_${esik}`,
                            tip: 'kk_limit',
                            mesaj: `💳 ${h.hesapAdi} kullanılabilir limiti %${esik} altına düştü.`,
                            tutar: kullanilabilirLimit,
                            data: h,
                            renk: esik <= 10 ? 'red' : 'orange'
                        });
                    }
                }
            }

            if (h.hesapTipi === 'krediKarti' && h.kesimGunu) {
                const kesimGunuInt = parseInt(h.kesimGunu);
                if (mevcutGun >= kesimGunuInt && mevcutGun < kesimGunuInt + 10) {
                    if (h.guncelBakiye < 0) {
                        const paymentPlan = getCreditCardPaymentPlan(h, periodKey);
                        const paidThisPeriod = islemler.reduce((sum, islem) => {
                            if (!isCreditCardStatementPaymentTransaction(islem, h.id)) return sum;
                            const t = toDateSafe(islem.tarih);
                            if (!t || t.getMonth() !== mevcutAy || t.getFullYear() !== mevcutYil) return sum;
                            return sum + (parseFloat(islem.tutar) || 0);
                        }, 0);
                        const minimumRemaining = Math.max(0, paymentPlan.minimumPayment - paidThisPeriod);
                        if (paymentPlan.plannedPayment > 0 && minimumRemaining > 0.5) {
                            tempBildirimler.push({ id: h.id + '_kk', tip: 'kk_hatirlatma', mesaj: `💳 ${h.hesapAdi} ekstresi kesildi!`, tutar: paymentPlan.plannedPayment, data: h, renk: 'orange' });
                        }
                    }
                }
            }
        });

        if (besVerisi && besVerisi.durum !== 'durduruldu') {
            const odemeGunu = besVerisi.odemeGunu || 15;
            const besOdemeTarihi = startOfDay(new Date(mevcutYil, mevcutAy, odemeGunu));
            const kalanGun = Math.ceil((besOdemeTarihi - today0) / (1000 * 60 * 60 * 24));
            const besOdendi = islemler.some(i =>
                i.kategori === 'BES' &&
                i.islemTipi === 'gider' &&
                (() => {
                    const d = toDateSafe(i.tarih);
                    return d && d.getMonth() === mevcutAy && d.getFullYear() === mevcutYil;
                })()
            );

            if (!besOdendi && kalanGun <= NOTIFICATION_WINDOW_DAYS) {
                tempBildirimler.push({
                    id: 'bes-gecikme',
                    tip: 'bes_odeme',
                    mesaj: dueMessage({ name: 'BES Ödemesi', daysLeft: kalanGun, overdueText: 'Gecikti' }),
                    tutar: parseFloat(besVerisi.aylikTutar) || 0,
                    data: besVerisi,
                    renk: kalanGun < 0 ? 'red' : 'orange'
                });
            }
        }

        maaslar.forEach(maas => {
            const maasGunu = parseInt(maas.gun) || 0;
            if (maasGunu <= 0) return;
            const maasTarihi = startOfDay(new Date(mevcutYil, mevcutAy, maasGunu));
            const kalanGun = Math.ceil((maasTarihi - today0) / (1000 * 60 * 60 * 24));
            if (kalanGun > 0) return;

            const yattiMi = islemler.some(islem => {
                const islemTarih = toDateSafe(islem.tarih);
                if (!islemTarih) return false;
                return islemTarih.getMonth() === mevcutAy &&
                    islemTarih.getFullYear() === mevcutYil &&
                    (islem.aciklama || "").toLowerCase().includes((maas.ad || "").toLowerCase()) &&
                    islem.islemTipi === 'gelir';
            });
            if (!yattiMi) {
                const mesaj = kalanGun < 0
                    ? `💰 ${maas.ad} yatmadı! (${Math.abs(kalanGun)} gün gecikti)`
                    : `💰 ${maas.ad} günü geldi!`;
                tempBildirimler.push({ id: maas.id, tip: 'maas', mesaj, tutar: maas.tutar, data: maas, renk: 'green' });
            }
        });

        buildSubscriptionOccurrences({
            subscriptions: abonelikler,
            transactions: islemler,
            year: mevcutYil,
            month: mevcutAy,
            today: now,
        }).forEach((occurrence) => {
            const dueDate = startOfDay(occurrence.dueDate);
            const kalanGun = Math.ceil((dueDate - today0) / (1000 * 60 * 60 * 24));
            if (occurrence.status === 'paid' || kalanGun > NOTIFICATION_WINDOW_DAYS) return;
            const abo = occurrence.subscription;
            tempBildirimler.push({
                id: abo.id,
                tip: 'abonelik',
                mesaj: dueMessage({ name: abo.ad, daysLeft: kalanGun, overdueText: 'ödenmedi' }),
                tutar: abo.tutar,
                data: abo,
                renk: kalanGun < 0 ? 'red' : 'orange'
            });
        });

        taksitler.forEach(taksit => {
            const taksitSayisi = parseInt(taksit.taksitSayisi) || 0;
            const remainingInstallments = parseInt(taksit.remainingInstallments);
            const directPaid = Math.max(
                parseInt(taksit.odenmisTaksit) || 0,
                parseInt(taksit.completedInstallments) || 0,
                parseInt(taksit.paidInstallmentCount) || 0,
                Number.isFinite(remainingInstallments) && taksitSayisi > 0 ? Math.max(0, taksitSayisi - remainingInstallments) : 0,
            );
            const linkedPaid = installmentPaymentCounts.get(taksit.id)?.size || 0;
            const odenmisTaksit = Math.min(taksitSayisi, Math.max(directPaid, linkedPaid));
            if (taksitSayisi <= 0 || odenmisTaksit >= taksitSayisi) return;

            const baslangic = toDateSafe(taksit.alisTarihi) || toDateSafe(taksit.olusturmaTarihi);
            if (!baslangic) return;

            const sonrakiVade = startOfDay(addMonthsClamped(baslangic, odenmisTaksit));
            const kalanGun = Math.ceil((sonrakiVade - today0) / (1000 * 60 * 60 * 24));
            if (kalanGun > NOTIFICATION_WINDOW_DAYS) return;

            tempBildirimler.push({
                id: `${taksit.id}_taksit_${odenmisTaksit + 1}`,
                tip: 'taksit',
                mesaj: dueMessage({ name: `${taksit.baslik} taksiti`, daysLeft: kalanGun, overdueText: 'ödenmedi' }),
                tutar: parseFloat(taksit.aylikTutar) || 0,
                data: { ...taksit, odenmisTaksit },
                renk: kalanGun < 0 ? 'red' : 'orange'
            });
        });

        const siraliFaturalar = [...bekleyenFaturalar].sort((a, b) => new Date(a.sonOdemeTarihi) - new Date(b.sonOdemeTarihi));
        siraliFaturalar.forEach(f => {
            if (f.sonOdemeTarihi) {
                const sonOdeme = toDateSafe(f.sonOdemeTarihi);
                if (!sonOdeme) return;
                const sO = startOfDay(sonOdeme);
                const kalanGun = Math.ceil((sO - today0) / (1000 * 60 * 60 * 24));
                const tanim = tanimliFaturalar.find(t => t.id === f.tanimId);
                const ad = tanim ? tanim.baslik : "Bilinmeyen Fatura";
                if (kalanGun <= NOTIFICATION_WINDOW_DAYS) {
                    tempBildirimler.push({
                        id: f.id,
                        tip: 'fatura',
                        mesaj: dueMessage({ name: ad, daysLeft: kalanGun, overdueText: 'GECİKTİ' }),
                        tutar: f.tutar,
                        data: f,
                        renk: kalanGun < 0 ? 'red' : 'orange'
                    });
                }
            }
        });

        if (borclar && borclar.length > 0) {
            borclar.forEach(b => {
                if (b.kalanTutar > 0 && b.sonOdemeTarihi) {
                    const sonOdeme = toDateSafe(b.sonOdemeTarihi);
                    if (!sonOdeme) return;
                    const sO = startOfDay(sonOdeme);
                    const kalanGun = Math.ceil((sO - today0) / (1000 * 60 * 60 * 24));

                    if (kalanGun <= NOTIFICATION_WINDOW_DAYS) {
                        tempBildirimler.push({
                            id: b.id + '_borc',
                            tip: 'borc_hatirlatma',
                            mesaj: dueMessage({ name: `${b.ad} Borcu`, daysLeft: kalanGun, overdueText: 'GECİKTİ' }),
                            tutar: b.kalanTutar,
                            data: b,
                            renk: kalanGun < 0 ? 'red' : 'orange'
                        });
                    }
                }
            });
        }

        if (satislar && satislar.length > 0) {
            satislar.forEach(s => {
                const kalan = s.satisFiyati - s.tahsilEdilen;
                if (kalan > 1) {
                    tempBildirimler.push({
                        id: s.id + '_alacak',
                        tip: 'alacak',
                        mesaj: `🔔 ${s.alici}, ${s.urunAdi} için kalan ${formatCurrencyPlain(kalan)} ödemesini henüz yapmadı.`,
                        tutar: kalan,
                        data: s,
                        renk: 'purple'
                    });
                }
            });
        }

        setBildirimler(tempBildirimler);
    }, [islemler, abonelikler, taksitler, maaslar, hesaplar, bekleyenFaturalar, tanimliFaturalar, besVerisi, satislar, borclar]);

    return bildirimler;
};
