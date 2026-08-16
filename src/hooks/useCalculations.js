import { useState, useMemo } from 'react';
import { ayIsmiGetir, normalizeAssetType, toDateSafe } from '../utils/helpers';
import { useNotifications } from './useNotifications';
import { isDateInPeriod, MONTH_NAMES, periodLabel } from '../utils/period';
import { classifySalaryMovement } from '../utils/salaryPeriod';

const formatDayMonthWeekday = (date) => {
    if (!date) return 'Tarih yok';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
};

export const useCalculations = (
    data, // { hesaplar, islemler, portfoy, abonelikler, taksitler, maaslar, bekleyenFaturalar, tanimliFaturalar, besVerisi, satislar, borclar }
    gizliMod,
    aylikLimit,
    selectedPeriod
) => {
    const { hesaplar, islemler, portfoy, abonelikler, taksitler, maaslar, bekleyenFaturalar, tanimliFaturalar, besVerisi, satislar, borclar } = data;

    // --- FILTER STATES ---
    const [aramaMetni, setAramaMetni] = useState("");
    const [filtreKategori, setFiltreKategori] = useState("Tümü");

    // Yatırım Filtreleri
    const [yatirimArama, setYatirimArama] = useState("");
    const [filtreYatirimTuru, setFiltreYatirimTuru] = useState("Tümü");
    const aktifAy = periodLabel(selectedPeriod);
    const aktifYatirimAy = aktifAy;
    const setAktifAy = () => {};
    const setAktifYatirimAy = () => {};

    const bildirimler = useNotifications({ hesaplar, islemler, abonelikler, taksitler, maaslar, bekleyenFaturalar, tanimliFaturalar, besVerisi, satislar, borclar });

    // --- CALCULATIONS ---
    const formatPara = (tutar) => gizliMod ? "**** ₺" : (parseFloat(tutar) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";

    // 1. Filtrelenmis Islemler (Bütçe)
    const filtrelenmisIslemler = useMemo(() => {
        return islemler.filter(i => {
            const besDegil = i.kategori !== "BES";
            const yatirimAlisDegil = i.islemTipi !== "yatirim_alis";
            const yatirimDegil = i.kategori !== "Yatırım";
            const iadeDegil = i.islemTipi !== "cari_iade";
            const ayUyumu = isDateInPeriod(i.tarih, selectedPeriod);
            const aramaKucuk = aramaMetni.toLowerCase();
            const metinUyumu = !aramaMetni ? true : (
                (i.aciklama && i.aciklama.toLowerCase().includes(aramaKucuk)) ||
                (i.kategori && i.kategori.toLowerCase().includes(aramaKucuk)) ||
                i.tutar.toString().includes(aramaMetni)
            );
            const kategoriUyumu = filtreKategori === "Tümü" ? true : i.kategori === filtreKategori;
            return besDegil && yatirimAlisDegil && yatirimDegil && iadeDegil && ayUyumu && metinUyumu && kategoriUyumu;
        });
    }, [islemler, selectedPeriod, aramaMetni, filtreKategori]);

    // 2. Yatırım Islemleri
    const yatirimIslemleri = useMemo(() => {
        return islemler.filter(i => {
            const yatirimMi = i.kategori === "Yatırım" || i.kategori === "BES" || i.islemTipi === "yatirim_alis" || i.islemTipi === "yatirim_satis";
            const ayUyumu = isDateInPeriod(i.tarih, selectedPeriod);
            const aramaKucuk = yatirimArama.toLowerCase();
            const metinUyumu = !yatirimArama ? true : (
                (i.aciklama && i.aciklama.toLowerCase().includes(aramaKucuk)) ||
                i.tutar.toString().includes(yatirimArama)
            );
            const turUyumu = filtreYatirimTuru === "Tümü" ? true : i.yatirimTuru === filtreYatirimTuru;
            return yatirimMi && ayUyumu && metinUyumu && turUyumu;
        });
    }, [islemler, selectedPeriod, yatirimArama, filtreYatirimTuru]);

    // 3. Tarih Filtresi Aylarının Dinamik Hesaplanması
    const mevcutAylar = useMemo(() => {
        if (!islemler || islemler.length === 0) return [aktifAy];

        const benzersizAylarMap = new Map();

        islemler.forEach(i => {
            if (!i.tarih) return;
            const d = toDateSafe(i.tarih);
            if (!d) return;

            // YYYYMM format for chronological sorting
            const sortKey = d.getFullYear() * 100 + d.getMonth();
            const ayIsmi = ayIsmiGetir(i.tarih);

            if (!benzersizAylarMap.has(sortKey)) {
                benzersizAylarMap.set(sortKey, ayIsmi);
            }
        });

        // Sort descending (newest month first)
        const sortedKeys = Array.from(benzersizAylarMap.keys()).sort((a, b) => b - a);

        const aylarListesi = [];
        sortedKeys.forEach(key => {
            aylarListesi.push(benzersizAylarMap.get(key));
        });
        if (!aylarListesi.includes(aktifAy)) aylarListesi.unshift(aktifAy);

        return aylarListesi;
    }, [islemler, aktifAy]);
    // Totals
    const bugunGider = filtrelenmisIslemler.filter(i => {
        const d = toDateSafe(i.tarih);
        if (!d) return false;
        return i.islemTipi === 'gider' &&
            d.getDate() === new Date().getDate() &&
            d.getMonth() === new Date().getMonth() &&
            d.getFullYear() === new Date().getFullYear();
    }).reduce((acc, i) => acc + i.tutar, 0);

    const toplamGelir = filtrelenmisIslemler.filter(i => i.islemTipi === 'gelir').reduce((acc, i) => acc + i.tutar, 0);
    const toplamGider = filtrelenmisIslemler.filter(i => i.islemTipi === 'gider').reduce((acc, i) => acc + i.tutar, 0);
    const harcananLimit = filtrelenmisIslemler.filter(i => i.islemTipi === 'gider' && i.kategori !== 'Transfer' && i.kategori !== 'Kira' && i.kategori !== 'Kira/Aidat' && i.kategori !== 'Yatırım' && i.kategori !== 'Şirket').reduce((acc, i) => acc + i.tutar, 0);
    const safeLimit = Math.max(0, parseFloat(aylikLimit) || 0);
    const limitYuzdesi = safeLimit > 0 ? Math.min((harcananLimit / safeLimit) * 100, 100) : 0;
    const limitRenk = limitYuzdesi > 90 ? '#e53e3e' : limitYuzdesi > 75 ? '#dd6b20' : '#48bb78';

    // Charts
    const kategoriVerisi = filtrelenmisIslemler.filter(i => i.islemTipi === 'gider' && i.kategori !== 'Transfer').reduce((acc, curr) => { const mevcut = acc.find(item => item.name === curr.kategori); if (mevcut) { mevcut.value += curr.tutar; } else { acc.push({ name: curr.kategori, value: curr.tutar }); } return acc; }, []);
    const realExpenseTransactions = filtrelenmisIslemler.filter((transaction) => (
        classifySalaryMovement(transaction, transaction.hesapId || transaction.kaynakId, hesaplar) === 'realExpense'
    ));
    const dailyExpenseDataset = (() => {
        const today = new Date();
        const isCurrentYear = selectedPeriod.year === today.getFullYear();
        const isFutureYear = selectedPeriod.year > today.getFullYear();
        const visibleMonthCount = selectedPeriod.month === 'all'
            ? isFutureYear
                ? 0
                : isCurrentYear
                    ? today.getMonth() + 1
                    : 12
            : 0;
        const isCurrentMonth = selectedPeriod.month !== 'all' &&
            selectedPeriod.year === today.getFullYear() &&
            selectedPeriod.month === today.getMonth() + 1;
        const isFutureMonth = selectedPeriod.month !== 'all' &&
            new Date(selectedPeriod.year, selectedPeriod.month - 1, 1) > new Date(today.getFullYear(), today.getMonth(), 1);
        const visibleDayCount = selectedPeriod.month === 'all'
            ? visibleMonthCount
            : isFutureMonth
                ? 0
                : isCurrentMonth
                    ? today.getDate()
                    : new Date(selectedPeriod.year, selectedPeriod.month, 0).getDate();

        const buckets = selectedPeriod.month === 'all'
            ? Array.from({ length: visibleMonthCount }, (_, index) => ({
                name: MONTH_NAMES[index],
                value: 0,
                tooltipLabel: `${MONTH_NAMES[index]} ${selectedPeriod.year}`,
                isToday: isCurrentYear && index === today.getMonth(),
            }))
            : Array.from({ length: visibleDayCount }, (_, index) => {
                const day = index + 1;
                const date = new Date(selectedPeriod.year, selectedPeriod.month - 1, day);
                return {
                    name: day,
                    value: 0,
                    tooltipLabel: formatDayMonthWeekday(date),
                    isToday: isCurrentMonth && day === today.getDate(),
                };
            });

        realExpenseTransactions.forEach((curr) => {
                const d = toDateSafe(curr.tarih);
                if (!d) return;
                const index = selectedPeriod.month === 'all' ? d.getMonth() : d.getDate() - 1;
                if (buckets[index]) buckets[index].value += curr.tutar;
            });

        return buckets;
    })();

    const gunlukVeri = dailyExpenseDataset;

    let gunlukOrtalama = 0;
    {
        const realExpenseTotal = realExpenseTransactions.reduce((acc, item) => acc + (parseFloat(item.tutar) || 0), 0);
        if (selectedPeriod.month === 'all') {
            const veriBulunanAySayisi = gunlukVeri.filter((item) => item.value > 0).length || 1;
            gunlukOrtalama = realExpenseTotal / veriBulunanAySayisi;
        } else {
            const gunSayisi = Math.max(1, gunlukVeri.length || 1);
            gunlukOrtalama = realExpenseTotal / gunSayisi;
        }
    }

    // --- YATIRIM & PORTFÖY ---
    const portfoyGuncelDegeri = portfoy.reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);
    const toplamKarZarar = portfoyGuncelDegeri - portfoy.reduce((acc, p) => acc + (p.adet * p.alisFiyati), 0);
    const portfoyVerisi = portfoy.reduce((acc, curr) => { const guncelTutar = curr.adet * (curr.guncelFiyat || curr.alisFiyati); const mevcut = acc.find(item => item.name === curr.sembol); if (mevcut) { mevcut.value += guncelTutar; } else { acc.push({ name: curr.sembol, value: guncelTutar }); } return acc; }, []);

    const toplamKalanBorc = borclar ? borclar
        .filter((b) => b.sonOdemeTarihi ? isDateInPeriod(b.sonOdemeTarihi, selectedPeriod) : true)
        .reduce((sum, b) => sum + (b.kalanTutar || 0), 0) : 0;
    const taksitOdemeSayilari = useMemo(() => {
        const counts = new Map();

        const addPayment = (installmentId, paymentKey) => {
            if (!installmentId) return;
            if (!counts.has(installmentId)) counts.set(installmentId, new Set());
            counts.get(installmentId).add(paymentKey);
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

            linkedIds.forEach((installmentId) => addPayment(installmentId, paymentKey));
        });

        return counts;
    }, [islemler]);

    const toplamKalanTaksitBorcu = taksitler.reduce((acc, t) => {
        const totalCount = parseInt(t.taksitSayisi) || 0;
        const remainingCount = parseInt(t.remainingInstallments);
        const directPaid = Math.max(
            parseInt(t.odenmisTaksit) || 0,
            parseInt(t.completedInstallments) || 0,
            parseInt(t.paidInstallmentCount) || 0,
            Number.isFinite(remainingCount) && totalCount > 0 ? Math.max(0, totalCount - remainingCount) : 0,
        );
        const linkedPaid = taksitOdemeSayilari.get(t.id)?.size || 0;
        const status = String(t.status || '').toLowerCase();
        const isCompleted = t.paid === true
            || t.isPaid === true
            || Boolean(t.paidAt)
            || ['paid', 'completed', 'complete', 'odendi', 'tamamlandi'].includes(status);
        const paidCount = isCompleted && totalCount > 0
            ? totalCount
            : Math.max(directPaid, linkedPaid);
        const normalizedPaid = totalCount > 0 ? Math.min(paidCount, totalCount) : paidCount;

        return acc + Math.max(0, (t.toplamTutar || 0) - ((t.aylikTutar || 0) * normalizedPaid));
    }, 0);
    const toplamSabitGider = abonelikler.reduce((acc, abo) => acc + abo.tutar, 0);
    const toplamNakitVarlik = hesaplar.reduce((acc, h) => acc + (parseFloat(h.guncelBakiye) || 0), 0);
    const netVarlik = toplamNakitVarlik + portfoyGuncelDegeri + (besVerisi?.guncelTutar || 0);

    // Helper for categorization
    const isAltinOrGumus = (p) => {
        const t = normalizeAssetType(p.varlikTuru);
        const s = p.sembol?.toUpperCase() || "";
        return t === 'altin' || t === 'gümüş' || t === 'gumus' || s === 'GAUTRY' || s === 'GMSTR' || s === 'GOLD' || s.includes('GLD') || s === 'ALTIN' || s === 'GUMUS';
    };

    const portfoyYatirimDegeri = portfoy.filter(p => !['doviz', 'bes'].includes(normalizeAssetType(p.varlikTuru)) && !isAltinOrGumus(p)).reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);
    const toplamDovizVarligi = portfoy.filter(p => normalizeAssetType(p.varlikTuru) === 'doviz').reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);
    const toplamBesVarligi = (besVerisi?.guncelTutar || 0) + portfoy.filter(p => normalizeAssetType(p.varlikTuru) === 'bes').reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);
    const toplamAltinVarligi = portfoy.filter(p => isAltinOrGumus(p)).reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);
    const toplamYatirimHesapNakiti = hesaplar.filter(h => h.hesapTipi === 'yatirim').reduce((acc, h) => acc + (parseFloat(h.guncelBakiye) || 0), 0);
    const toplamBesYatirimi = islemler.filter(i => i.kategori === 'BES' && i.islemTipi === 'gider' && isDateInPeriod(i.tarih, selectedPeriod)).reduce((acc, i) => acc + i.tutar, 0);

    // Net nakit (cüzdan)
    const sadeceCuzdanNakiti = toplamNakitVarlik - toplamYatirimHesapNakiti;

    // FIX: Gold/Silver should be grouped with Currency (Döviz), NOT Stocks (Hisse)
    const kartYatirimToplami = portfoyYatirimDegeri; // Sadece Hisse/Fon
    const displayDovizVarligi = toplamDovizVarligi + toplamAltinVarligi; // Döviz + Altın

    const kartNakitToplami = toplamYatirimHesapNakiti;
    const genelToplamYatirimGucu = portfoyGuncelDegeri + toplamYatirimHesapNakiti + (besVerisi?.guncelTutar || 0);

    const genelVarlikVerisi = [
        { name: 'Hisse', value: kartYatirimToplami },
        { name: 'Döviz', value: displayDovizVarligi },
        { name: 'BES', value: toplamBesVarligi },
        { name: 'Nakit', value: kartNakitToplami }
    ].filter(item => item.value > 0);

    return {
        // Filters
        aktifAy, setAktifAy, aramaMetni, setAramaMetni, filtreKategori, setFiltreKategori,
        yatirimArama, setYatirimArama, aktifYatirimAy, setAktifYatirimAy, filtreYatirimTuru, setFiltreYatirimTuru,
        mevcutAylar,

        // Data
        filtrelenmisIslemler, yatirimIslemleri,
        bugunGider, toplamGelir, toplamGider, harcananLimit, limitYuzdesi, limitRenk,
        kategoriVerisi, gunlukVeri, dailyExpenseDataset, gunlukOrtalama,

        // Investment Stats
        portfoyGuncelDegeri, toplamKarZarar, portfoyVerisi,
        genelToplamYatirimGucu, genelVarlikVerisi, toplamYatirimHesapNakiti,
        netVarlik, sadeceCuzdanNakiti, toplamKalanTaksitBorcu, toplamSabitGider,
        kartYatirimToplami, toplamDovizVarligi: displayDovizVarligi, toplamBesVarligi, kartNakitToplami, toplamBesYatirimi,
        toplamKalanBorc,

        // Others
        bildirimler,
        formatPara
    };
};
