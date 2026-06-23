import { useState, useEffect, useMemo } from 'react';
import { ayIsmiGetir, normalizeAssetType, toDateSafe } from '../utils/helpers';
import { useNotifications } from './useNotifications';

export const useCalculations = (
    data, // { hesaplar, islemler, portfoy, abonelikler, taksitler, maaslar, bekleyenFaturalar, tanimliFaturalar, besVerisi, satislar, borclar }
    gizliMod,
    aylikLimit
) => {
    const { hesaplar, islemler, portfoy, abonelikler, taksitler, maaslar, bekleyenFaturalar, tanimliFaturalar, besVerisi, satislar, borclar } = data;

    // --- FILTER STATES ---
    const [aktifAy, setAktifAy] = useState(new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }));
    const [aramaMetni, setAramaMetni] = useState("");
    const [filtreKategori, setFiltreKategori] = useState("Tümü");

    // Yatırım Filtreleri
    const [yatirimArama, setYatirimArama] = useState("");
    const [aktifYatirimAy, setAktifYatirimAy] = useState(new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }));
    const [filtreYatirimTuru, setFiltreYatirimTuru] = useState("Tümü");

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
            const ayUyumu = aktifAy === "Tümü" ? true : ayIsmiGetir(i.tarih) === aktifAy;
            const aramaKucuk = aramaMetni.toLowerCase();
            const metinUyumu = !aramaMetni ? true : (
                (i.aciklama && i.aciklama.toLowerCase().includes(aramaKucuk)) ||
                (i.kategori && i.kategori.toLowerCase().includes(aramaKucuk)) ||
                i.tutar.toString().includes(aramaMetni)
            );
            const kategoriUyumu = filtreKategori === "Tümü" ? true : i.kategori === filtreKategori;
            return besDegil && yatirimAlisDegil && yatirimDegil && iadeDegil && ayUyumu && metinUyumu && kategoriUyumu;
        });
    }, [islemler, aktifAy, aramaMetni, filtreKategori]);

    // 2. Yatırım Islemleri
    const yatirimIslemleri = useMemo(() => {
        return islemler.filter(i => {
            const yatirimMi = i.kategori === "Yatırım" || i.kategori === "BES" || i.islemTipi === "yatirim_alis" || i.islemTipi === "yatirim_satis";
            const ayUyumu = aktifYatirimAy === "Tümü" ? true : ayIsmiGetir(i.tarih) === aktifYatirimAy;
            const aramaKucuk = yatirimArama.toLowerCase();
            const metinUyumu = !yatirimArama ? true : (
                (i.aciklama && i.aciklama.toLowerCase().includes(aramaKucuk)) ||
                i.tutar.toString().includes(yatirimArama)
            );
            const turUyumu = filtreYatirimTuru === "Tümü" ? true : i.yatirimTuru === filtreYatirimTuru;
            return yatirimMi && ayUyumu && metinUyumu && turUyumu;
        });
    }, [islemler, aktifYatirimAy, yatirimArama, filtreYatirimTuru]);

    // 3. Tarih Filtresi Aylarının Dinamik Hesaplanması
    const mevcutAylar = useMemo(() => {
        if (!islemler || islemler.length === 0) return ["Tümü"];

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

        const aylarListesi = ["Tümü"];
        sortedKeys.forEach(key => {
            aylarListesi.push(benzersizAylarMap.get(key));
        });

        return aylarListesi;
    }, [islemler]);

    // Sayfa açıldığında veya veriler güncellendiğinde eğer mevcut seçili ay boşsa (veri yoksa),
    // otomatik olarak verisi bulunan en güncel aya (index 1) geçiş yapmasını sağlar.
    useEffect(() => {
        if (mevcutAylar.length > 1) {
            setAktifAy(prev => (prev !== "Tümü" && !mevcutAylar.includes(prev)) ? mevcutAylar[1] : prev);
            setAktifYatirimAy(prev => (prev !== "Tümü" && !mevcutAylar.includes(prev)) ? mevcutAylar[1] : prev);
        }
    }, [mevcutAylar]);
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
    const gunlukVeri = filtrelenmisIslemler
        .filter(i => i.islemTipi === 'gider')
        .reduce((acc, curr) => {
            const d = toDateSafe(curr.tarih);
            if (!d) return acc;
            const gun = d.getDate();
            const mevcut = acc.find(item => item.name === gun);
            if (mevcut) mevcut.value += curr.tutar;
            else acc.push({ name: gun, value: curr.tutar });
            return acc;
        }, [])
        .sort((a, b) => a.name - b.name);

    let gunlukOrtalama = 0;
    if (aktifAy !== "Tümü") {
        const parcalar = aktifAy.split(" ");
        const ayIsmi = parcalar[0];
        const yil = parseInt(parcalar[1]);
        const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        const ayIndex = aylar.indexOf(ayIsmi);
        if (ayIndex > -1 && !isNaN(yil)) {
            const simdi = new Date();
            let gunSayisi = 1;
            if (simdi.getMonth() === ayIndex && simdi.getFullYear() === yil) {
                gunSayisi = Math.max(1, simdi.getDate());
            } else {
                gunSayisi = new Date(yil, ayIndex + 1, 0).getDate();
            }
            gunlukOrtalama = toplamGider / gunSayisi;
        }
    }

    // --- YATIRIM & PORTFÖY ---
    const portfoyGuncelDegeri = portfoy.reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);
    const toplamKarZarar = portfoyGuncelDegeri - portfoy.reduce((acc, p) => acc + (p.adet * p.alisFiyati), 0);
    const portfoyVerisi = portfoy.reduce((acc, curr) => { const guncelTutar = curr.adet * (curr.guncelFiyat || curr.alisFiyati); const mevcut = acc.find(item => item.name === curr.sembol); if (mevcut) { mevcut.value += guncelTutar; } else { acc.push({ name: curr.sembol, value: guncelTutar }); } return acc; }, []);

    const toplamKalanBorc = borclar ? borclar.reduce((sum, b) => sum + (b.kalanTutar || 0), 0) : 0;
    const toplamKalanTaksitBorcu = taksitler.reduce((acc, t) => acc + (t.toplamTutar - (t.aylikTutar * t.odenmisTaksit)), 0);
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
    const toplamBesYatirimi = islemler.filter(i => i.kategori === 'BES' && i.islemTipi === 'gider').reduce((acc, i) => acc + i.tutar, 0);

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
        kategoriVerisi, gunlukVeri, gunlukOrtalama,

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
