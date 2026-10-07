import { useEffect, useState } from 'react';
import { formatCurrencyPlain, toDateSafe } from '../utils/helpers';
import { getCreditCardStatementPaymentSummary } from '../utils/creditCardPayments';
import { buildSubscriptionOccurrences } from '../utils/recurringPayments';
import { buildDueNotificationMessage } from '../utils/notifications';

const NOTIFICATION_WINDOW_DAYS = 3;
const CREDIT_CARD_LIMIT_THRESHOLDS = [50, 20, 10];
const CREDIT_CARD_LIMIT_ACK_KEY = 'kisisel_finans_kk_limit_ack_v1';

const getAcknowledgedCreditCardLimitAlerts = () => {
    try {
        const rawValue = window.localStorage.getItem(CREDIT_CARD_LIMIT_ACK_KEY);
        const parsed = rawValue ? JSON.parse(rawValue) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
};

const getCreditCardLimitValue = (account) => parseFloat(
    account?.kartLimiti
    || account?.limit
    || account?.creditLimit
    || account?.krediKartiLimiti
) || 0;

const getCreditCardDebt = (account) => Math.max(0, -(parseFloat(account?.guncelBakiye) || 0));

const getCreditCardLimitThreshold = (availableRatio, accountId, acknowledgedAlerts) => {
    if (!Number.isFinite(availableRatio)) return null;
    return CREDIT_CARD_LIMIT_THRESHOLDS.find((threshold) => (
        availableRatio <= threshold &&
        !acknowledgedAlerts.has(`${accountId}_kk_limit_${threshold}`)
    )) || null;
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
    borclar = [],
    reminders = []
}) => {
    const [bildirimler, setBildirimler] = useState([]);

    useEffect(() => {
        if (islemler.length === 0 && abonelikler.length === 0 && taksitler.length === 0 && maaslar.length === 0 && hesaplar.length === 0 && bekleyenFaturalar.length === 0 && borclar.length === 0 && reminders.length === 0 && !besVerisi && satislar.length === 0) {
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
        const acknowledgedCreditCardLimitAlerts = getAcknowledgedCreditCardLimitAlerts();

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
                    const esik = getCreditCardLimitThreshold(kullanilabilirYuzde, h.id, acknowledgedCreditCardLimitAlerts);

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
                        const paymentPlan = getCreditCardStatementPaymentSummary(h, islemler, periodKey);
                        if (paymentPlan.remainingMinimumPayment > 0.5) {
                            tempBildirimler.push({ id: h.id + '_kk', tip: 'kk_hatirlatma', mesaj: `💳 ${h.hesapAdi} ekstresi kesildi!`, tutar: paymentPlan.remainingMinimumPayment, data: h, renk: 'orange' });
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
                    mesaj: buildDueNotificationMessage({ name: 'BES Ödemesi', daysLeft: kalanGun, overdueText: 'Gecikti' }),
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
                mesaj: buildDueNotificationMessage({ name: abo.ad, daysLeft: kalanGun, overdueText: 'ödenmedi' }),
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

            const siradakiTaksit = odenmisTaksit + 1;
            const taksitEtiketi = `${siradakiTaksit}. taksiti`;

            tempBildirimler.push({
                id: `${taksit.id}_taksit_${siradakiTaksit}`,
                tip: 'taksit',
                mesaj: buildDueNotificationMessage({ name: `${taksit.baslik} ${taksitEtiketi}`, daysLeft: kalanGun, overdueText: 'ödenmedi' }),
                tutar: parseFloat(taksit.aylikTutar) || 0,
                data: { ...taksit, odenmisTaksit, nextInstallmentNumber: siradakiTaksit, installmentCount: taksitSayisi },
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
                        mesaj: buildDueNotificationMessage({ name: ad, daysLeft: kalanGun, overdueText: 'GECİKTİ' }),
                        tutar: f.tutar,
                        data: f,
                        renk: kalanGun < 0 ? 'red' : 'orange'
                    });
                }
            }
        });

        (reminders || [])
            .filter((reminder) => (reminder.status || 'ACTIVE') === 'ACTIVE')
            .forEach((reminder) => {
                const dueDate = toDateSafe(reminder.dueDate);
                if (!dueDate) return;
                const dueDay = startOfDay(dueDate);
                const kalanGun = Math.ceil((dueDay - today0) / (1000 * 60 * 60 * 24));
                if (kalanGun > NOTIFICATION_WINDOW_DAYS) return;
                const title = reminder.title || 'Hatırlatıcı';
                const mesaj = kalanGun < 0
                    ? `🔔 ${title} ${Math.abs(kalanGun)} gün gecikti.`
                    : kalanGun === 0
                        ? `🔔 ${title} bugün.`
                        : kalanGun === 1
                            ? `🔔 ${title} yarın.`
                            : `🔔 ${title} için ${kalanGun} gün kaldı.`;
                tempBildirimler.push({
                    id: `${reminder.id}_reminder`,
                    tip: 'hatirlatici',
                    mesaj,
                    tutar: parseFloat(reminder.amount) || 0,
                    data: reminder,
                    renk: kalanGun < 0 ? 'red' : 'orange'
                });
            });

        if (borclar && borclar.length > 0) {
            borclar.forEach(b => {
                const debtType = b.type === 'ALACAK' ? 'ALACAK' : 'VERECEK';
                const isCompleted = b.durum === 'completed' || b.status === 'completed';
                const remaining = parseFloat(b.kalanTutar ?? b.tutar ?? b.toplamTutar) || 0;
                if (!isCompleted && remaining > 0 && b.sonOdemeTarihi) {
                    const sonOdeme = toDateSafe(b.sonOdemeTarihi);
                    if (!sonOdeme) return;
                    const sO = startOfDay(sonOdeme);
                    const kalanGun = Math.ceil((sO - today0) / (1000 * 60 * 60 * 24));

                    if (kalanGun <= NOTIFICATION_WINDOW_DAYS) {
                        tempBildirimler.push({
                            id: b.id + '_borc',
                            tip: debtType === 'ALACAK' ? 'alacak_hatirlatma' : 'borc_hatirlatma',
                            mesaj: buildDueNotificationMessage({ name: `${b.ad} ${debtType === 'ALACAK' ? 'Alacağı' : 'Vereceği'}`, daysLeft: kalanGun, overdueText: 'GECİKTİ' }),
                            tutar: remaining,
                            data: b,
                            renk: debtType === 'ALACAK' ? 'green' : (kalanGun < 0 ? 'red' : 'orange')
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
                        renk: 'green'
                    });
                }
            });
        }

        setBildirimler(tempBildirimler);
    }, [islemler, abonelikler, taksitler, maaslar, hesaplar, bekleyenFaturalar, tanimliFaturalar, besVerisi, satislar, borclar, reminders]);

    return bildirimler;
};
