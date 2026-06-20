import { useEffect, useState } from 'react';
import { formatCurrencyPlain, toDateSafe } from '../utils/helpers';

export const useNotifications = ({
    hesaplar,
    islemler,
    abonelikler,
    taksitler,
    maaslar,
    bekleyenFaturalar,
    tanimliFaturalar,
    besVerisi,
    satislar,
    borclar
}) => {
    const [bildirimler, setBildirimler] = useState([]);

    useEffect(() => {
        if (islemler.length === 0 && abonelikler.length === 0 && taksitler.length === 0 && maaslar.length === 0 && hesaplar.length === 0 && bekleyenFaturalar.length === 0) return;
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
        const today0 = startOfDay(now);
        let tempBildirimler = [];

        hesaplar.forEach(h => {
            if (h.hesapTipi === 'krediKarti' && h.kesimGunu) {
                const kesimGunuInt = parseInt(h.kesimGunu);
                if (mevcutGun >= kesimGunuInt && mevcutGun < kesimGunuInt + 10) {
                    const odemeYapildiMi = islemler.some(islem => {
                        const t = toDateSafe(islem.tarih);
                        if (!t) return false;
                        return t.getMonth() === mevcutAy && t.getFullYear() === mevcutYil && t.getDate() >= kesimGunuInt && (islem.hedefId === h.id || islem.hesapId === h.id) && (islem.islemTipi === 'transfer' || islem.islemTipi === 'gelir');
                    });
                    if (!odemeYapildiMi && h.guncelBakiye < 0) {
                        tempBildirimler.push({ id: h.id + '_kk', tip: 'kk_hatirlatma', mesaj: `💳 ${h.hesapAdi} ekstresi kesildi!`, tutar: Math.abs(h.guncelBakiye), data: h, renk: 'orange' });
                    }
                }
            }
        });

        if (besVerisi && besVerisi.durum !== 'durduruldu') {
            const odemeGunu = besVerisi.odemeGunu || 15;
            const besOdendi = islemler.some(i =>
                i.kategori === 'BES' &&
                i.islemTipi === 'gider' &&
                (() => {
                    const d = toDateSafe(i.tarih);
                    return d && d.getMonth() === mevcutAy && d.getFullYear() === mevcutYil;
                })()
            );

            if (!besOdendi && mevcutGun >= odemeGunu) {
                tempBildirimler.push({ id: 'bes-gecikme', tip: 'bes_odeme', mesaj: '⚠️ BES Ödemesi Gecikti!', tutar: parseFloat(besVerisi.aylikTutar) || 0, data: besVerisi, renk: 'red' });
            }
        }

        maaslar.forEach(maas => {
            if (mevcutGun >= maas.gun) {
                const yattiMi = islemler.some(islem => {
                    const islemTarih = toDateSafe(islem.tarih);
                    if (!islemTarih) return false;
                    return islemTarih.getMonth() === mevcutAy &&
                        islemTarih.getFullYear() === mevcutYil &&
                        (islem.aciklama || "").toLowerCase().includes((maas.ad || "").toLowerCase()) &&
                        islem.islemTipi === 'gelir';
                });
                if (!yattiMi) tempBildirimler.push({ id: maas.id, tip: 'maas', mesaj: `💰 ${maas.ad} günü geldi!`, tutar: maas.tutar, data: maas, renk: 'green' });
            }
        });

        abonelikler.forEach(abo => {
            if (mevcutGun >= abo.gun) {
                const odendiMi = islemler.some(islem => {
                    const islemTarih = toDateSafe(islem.tarih);
                    if (!islemTarih) return false;
                    return islemTarih.getMonth() === mevcutAy &&
                        islemTarih.getFullYear() === mevcutYil &&
                        (islem.aciklama || "").toLowerCase().includes((abo.ad || "").toLowerCase());
                });
                if (!odendiMi) tempBildirimler.push({ id: abo.id, tip: 'abonelik', mesaj: `⚠️ ${abo.ad} ödenmedi! (${abo.gun}. gün)`, tutar: abo.tutar, data: abo, renk: 'red' });
            }
        });

        taksitler.forEach(taksit => {
            const taksitSayisi = parseInt(taksit.taksitSayisi) || 0;
            const odenmisTaksit = parseInt(taksit.odenmisTaksit) || 0;
            if (taksitSayisi <= 0 || odenmisTaksit >= taksitSayisi) return;

            const baslangic = toDateSafe(taksit.alisTarihi) || toDateSafe(taksit.olusturmaTarihi);
            if (!baslangic) return;

            const sonrakiVade = startOfDay(addMonthsClamped(baslangic, odenmisTaksit));
            const kalanGun = Math.ceil((sonrakiVade - today0) / (1000 * 60 * 60 * 24));
            if (kalanGun > 0) return;

            const vadeGunu = sonrakiVade.getDate();

            tempBildirimler.push({
                id: `${taksit.id}_taksit_${odenmisTaksit + 1}`,
                tip: 'taksit',
                mesaj: `⚠️ ${taksit.baslik} taksiti ödenmedi! (${vadeGunu}. gün)`,
                tutar: parseFloat(taksit.aylikTutar) || 0,
                data: taksit,
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
                if (kalanGun < 0) {
                    tempBildirimler.push({ id: f.id, tip: 'fatura', mesaj: `🔥 ${ad} GECİKTİ! (${Math.abs(kalanGun)} gün)`, tutar: f.tutar, data: f, renk: 'red' });
                } else if (kalanGun <= 5) {
                    tempBildirimler.push({ id: f.id, tip: 'fatura', mesaj: `⚠️ ${ad} için son ${kalanGun} gün!`, tutar: f.tutar, data: f, renk: 'orange' });
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

                    if (kalanGun < 0) {
                        tempBildirimler.push({ id: b.id + '_borc', tip: 'borc_hatirlatma', mesaj: `🔥 ${b.ad} Borcu GECİKTİ! (${Math.abs(kalanGun)} gün)`, tutar: b.kalanTutar, data: b, renk: 'red' });
                    } else if (kalanGun <= 5) {
                        tempBildirimler.push({ id: b.id + '_borc', tip: 'borc_hatirlatma', mesaj: `⚠️ ${b.ad} Borcu için son ${kalanGun} gün!`, tutar: b.kalanTutar, data: b, renk: 'orange' });
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
