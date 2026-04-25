import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const useDataListeners = (user, alanKodu) => {
    // Data States
    const [hesaplar, setHesaplar] = useState([]);
    const [islemler, setIslemler] = useState([]);
    const [abonelikler, setAbonelikler] = useState([]);
    const [taksitler, setTaksitler] = useState([]);
    const [maaslar, setMaaslar] = useState([]);
    const [portfoy, setPortfoy] = useState([]);
    const [bekleyenFaturalar, setBekleyenFaturalar] = useState([]);
    const [tanimliFaturalar, setTanimliFaturalar] = useState([]);
    const [borclar, setBorclar] = useState([]);
    const [cariIslemler, setCariIslemler] = useState([]);
    const [besVerisi, setBesVerisi] = useState(null);
    const [hedefler, setHedefler] = useState([]);
    const [envanter, setEnvanter] = useState([]);
    const [satislar, setSatislar] = useState([]);

    // Settings States
    // Kategoriler ve Yatırım Türleri için varsayılanlar
    const [kategoriListesi, setKategoriListesi] = useState(["Market", "Pazar", "Yemek", "Ulaşım", "Akaryakıt", "Fatura", "Kira/Aidat", "Giyim", "Eğitim", "Sağlık", "Eğlence", "Teknoloji", "Yatırım", "Diğer", "Maaş", "Freelance", "Kredi Kartı Ödemesi", "BES"]);
    const [yatirimTurleri, setYatirimTurleri] = useState(["Hisse", "Altın", "Döviz", "Fon", "Coin", "BES"]);
    const [aylikLimit, setAylikLimit] = useState(15000);

    // Varsayılan seçimler (UI için gerekli olabilir, burada tutuyoruz çünkü ayarlar yüklendiğinde güncelleniyorlar)
    const [varsayilanKategori, setVarsayilanKategori] = useState("Market");
    const [varsayilanTaksitKategori] = useState("Market");
    const [varsayilanAboKategori] = useState("Fatura");
    const [varsayilanVarlikTuru] = useState("Hisse");

    useEffect(() => {
        if (!user || !alanKodu) {
            // Temizle
            setHesaplar([]); setIslemler([]); setAbonelikler([]); setTaksitler([]); setMaaslar([]); setPortfoy([]); setBekleyenFaturalar([]); setTanimliFaturalar([]); setBorclar([]); setCariIslemler([]);
            return;
        }

        const qHesaplar = query(collection(db, "hesaplar"), where("alanKodu", "==", alanKodu));
        const qIslemler = query(collection(db, "nakit_islemleri"), where("alanKodu", "==", alanKodu));
        const qAbonelik = query(collection(db, "abonelikler"), where("alanKodu", "==", alanKodu));
        const qTaksitler = query(collection(db, "taksitler"), where("alanKodu", "==", alanKodu));
        const qMaaslar = query(collection(db, "maaslar"), where("alanKodu", "==", alanKodu));
        const qPortfoy = query(collection(db, "portfoy"), where("alanKodu", "==", alanKodu));
        const qFaturalar = query(collection(db, "bekleyen_faturalar"), where("alanKodu", "==", alanKodu));
        const qFaturaTanim = query(collection(db, "fatura_tanimlari"), where("alanKodu", "==", alanKodu));
        const qBorclar = query(collection(db, "borclar"), where("alanKodu", "==", alanKodu));
        const qCariIslemler = query(collection(db, "cari_islemleri"), where("alanKodu", "==", alanKodu));

        // TEK REFERANS: Kullanıcının kendi ayar dokümanı (hem limitler hem BES verisi burada)
        const ayarlarDocRef = doc(db, "ayarlar", alanKodu);

        const u1 = onSnapshot(qHesaplar, (s) => {
            if (s && s.docs) setHesaplar(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const u2 = onSnapshot(qIslemler, (s) => {
            if (s && s.docs) {
                const v = s.docs.map(d => ({ id: d.id, ...d.data() }));
                v.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
                setIslemler(v);
            }
        });
        const u4 = onSnapshot(qAbonelik, (s) => {
            if (s && s.docs) setAbonelikler(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const u5 = onSnapshot(qTaksitler, (s) => {
            if (s && s.docs) setTaksitler(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const u6 = onSnapshot(qMaaslar, (s) => {
            if (s && s.docs) setMaaslar(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const u7 = onSnapshot(qPortfoy, (s) => {
            if (s && s.docs) setPortfoy(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const u8 = onSnapshot(qFaturalar, (s) => {
            if (s && s.docs) setBekleyenFaturalar(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const u9 = onSnapshot(qFaturaTanim, (s) => {
            if (s && s.docs) setTanimliFaturalar(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const uBorc = onSnapshot(qBorclar, (s) => {
            if (s && s.docs) setBorclar(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const uCari = onSnapshot(qCariIslemler, (s) => {
            if (s && s.docs) {
                const v = s.docs.map(d => ({ id: d.id, ...d.data() }));
                v.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
                setCariIslemler(v);
            }
        });

        // Consolidated Listener for Settings (Limit, Categories, BES Data all in one doc)
        const u10 = onSnapshot(ayarlarDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                // 1. Genel Ayarlar
                setAylikLimit(data.limit || 15000);
                if (data.kategoriler?.length > 0) {
                    // Ensure BES is in the list from DB if not present, or trust DB?
                    // User wants BES to be valid. If DB doesn't have it, we should append it or rely on default.
                    // If DB has custom list, we use it.
                    // But if BES is critical, maybe force push it?
                    // For now, use DB list.
                    setKategoriListesi(data.kategoriler);
                    setVarsayilanKategori(data.kategoriler[0]);
                }
                if (data.yatirimTurleri?.length > 0) setYatirimTurleri(data.yatirimTurleri);

                // 2. BES Verisi (Nested Object: bes_data)
                setBesVerisi(data.bes_data || null);

                // 3. Hedefler & Envanter & Satışlar
                setHedefler(data.hedefler || []);
                setEnvanter(data.envanter || []);
                setSatislar(data.satislar || []);

            } else {
                console.log("Ayarlar dokümanı henüz yok.");
                setBesVerisi(null);
                setHedefler([]); setEnvanter([]); setSatislar([]);
            }
        });

        return () => { u1(); u2(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); uBorc(); uCari(); }
    }, [user, alanKodu]);

    return {
        hesaplar, islemler, abonelikler, taksitler, maaslar, portfoy, bekleyenFaturalar, tanimliFaturalar, besVerisi, borclar, cariIslemler,
        kategoriListesi, setKategoriListesi,
        yatirimTurleri, setYatirimTurleri,
        aylikLimit, setAylikLimit,
        varsayilanKategori, varsayilanTaksitKategori, varsayilanAboKategori, varsayilanVarlikTuru,
        hedefler, envanter, satislar
    };
};
