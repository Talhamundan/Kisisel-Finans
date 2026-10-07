import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { isActiveAccount } from '../utils/accounts';
import { getTransactionTags } from '../utils/tags';

export const useDataListeners = (user, alanKodu) => {
    // Data States
    const [hesaplar, setHesaplar] = useState([]);
    const [hesaplarLoaded, setHesaplarLoaded] = useState(false);
    const [rawIslemler, setRawIslemler] = useState([]);
    const [etiketler, setEtiketler] = useState([]);
    const [transactionTags, setTransactionTags] = useState([]);
    const [abonelikler, setAbonelikler] = useState([]);
    const [taksitler, setTaksitler] = useState([]);
    const [maaslar, setMaaslar] = useState([]);
    const [portfoy, setPortfoy] = useState([]);
    const [bekleyenFaturalar, setBekleyenFaturalar] = useState([]);
    const [tanimliFaturalar, setTanimliFaturalar] = useState([]);
    const [borclar, setBorclar] = useState([]);
    const [cariler, setCariler] = useState([]);
    const [finansmanlar, setFinansmanlar] = useState([]);
    const [cariIslemler, setCariIslemler] = useState([]);
    const [reminders, setReminders] = useState([]);
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
            setHesaplar([]); setRawIslemler([]); setEtiketler([]); setTransactionTags([]); setAbonelikler([]); setTaksitler([]); setMaaslar([]); setPortfoy([]); setBekleyenFaturalar([]); setTanimliFaturalar([]); setBorclar([]); setCariler([]); setFinansmanlar([]); setCariIslemler([]); setReminders([]);
            setHesaplarLoaded(false);
            return;
        }

        setHesaplarLoaded(false);

        const qHesaplar = query(collection(db, "hesaplar"), where("alanKodu", "==", alanKodu));
        const qIslemler = query(collection(db, "nakit_islemleri"), where("alanKodu", "==", alanKodu));
        const qEtiketler = query(collection(db, "tags"), where("alanKodu", "==", alanKodu));
        const qTransactionTags = query(collection(db, "transaction_tags"), where("alanKodu", "==", alanKodu));
        const qAbonelik = query(collection(db, "abonelikler"), where("alanKodu", "==", alanKodu));
        const qTaksitler = query(collection(db, "taksitler"), where("alanKodu", "==", alanKodu));
        const qMaaslar = query(collection(db, "maaslar"), where("alanKodu", "==", alanKodu));
        const qPortfoy = query(collection(db, "portfoy"), where("alanKodu", "==", alanKodu));
        const qFaturalar = query(collection(db, "bekleyen_faturalar"), where("alanKodu", "==", alanKodu));
        const qFaturaTanim = query(collection(db, "fatura_tanimlari"), where("alanKodu", "==", alanKodu));
        const qBorclar = query(collection(db, "borclar"), where("alanKodu", "==", alanKodu));
        const qCariler = query(collection(db, "cariler"), where("alanKodu", "==", alanKodu));
        const qFinansmanlar = query(collection(db, "finansmanlar"), where("alanKodu", "==", alanKodu));
        const qCariIslemler = query(collection(db, "cari_islemleri"), where("alanKodu", "==", alanKodu));
        const qReminders = query(collection(db, "reminders"), where("alanKodu", "==", alanKodu));

        // TEK REFERANS: Kullanıcının kendi ayar dokümanı (hem limitler hem BES verisi burada)
        const ayarlarDocRef = doc(db, "ayarlar", alanKodu);

        const u1 = onSnapshot(qHesaplar, (s) => {
            if (s && s.docs) setHesaplar(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(isActiveAccount));
            setHesaplarLoaded(true);
        });
        const u2 = onSnapshot(qIslemler, (s) => {
            if (s && s.docs) {
                const v = s.docs.map(d => ({ id: d.id, ...d.data() }));
                v.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
                setRawIslemler(v);
            }
        });
        const uTags = onSnapshot(qEtiketler, (s) => {
            if (s && s.docs) {
                const v = s.docs.map(d => ({ id: d.id, ...d.data() }));
                v.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'tr-TR', { sensitivity: 'base' }));
                setEtiketler(v);
            }
        });
        const uTransactionTags = onSnapshot(qTransactionTags, (s) => {
            if (s && s.docs) setTransactionTags(s.docs.map(d => ({ id: d.id, ...d.data() })));
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
        const uCariler = onSnapshot(qCariler, (s) => {
            if (s && s.docs) setCariler(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const uFinansman = onSnapshot(qFinansmanlar, (s) => {
            if (s && s.docs) setFinansmanlar(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const uCari = onSnapshot(qCariIslemler, (s) => {
            if (s && s.docs) {
                const v = s.docs.map(d => ({ id: d.id, ...d.data() }));
                v.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
                setCariIslemler(v);
            }
        });
        const uReminders = onSnapshot(qReminders, (s) => {
            if (s && s.docs) setReminders(s.docs.map(d => ({ id: d.id, ...d.data() })));
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

        return () => { u1(); u2(); uTags(); uTransactionTags(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); uBorc(); uCariler(); uFinansman(); uCari(); uReminders(); }
    }, [user, alanKodu]);

    useEffect(() => {
        if (!alanKodu || typeof window === 'undefined') return undefined;

        const handleReminderLocalChange = (event) => {
            const { type, reminder } = event.detail || {};
            if (!reminder?.id || reminder.alanKodu !== alanKodu) return;

            setReminders((current) => {
                if (type === 'delete') return current.filter((item) => item.id !== reminder.id);
                const next = current.filter((item) => item.id !== reminder.id);
                return [{ ...reminder }, ...next];
            });
        };

        window.addEventListener('finance-reminder-local-change', handleReminderLocalChange);
        return () => window.removeEventListener('finance-reminder-local-change', handleReminderLocalChange);
    }, [alanKodu]);

    useEffect(() => {
        if (!alanKodu || typeof window === 'undefined') return undefined;

        const handleCariLocalChange = (event) => {
            const { type, cari } = event.detail || {};
            if (!cari?.id || cari.alanKodu !== alanKodu) return;

            setCariler((current) => {
                if (type === 'delete') return current.filter((item) => item.id !== cari.id);
                const next = current.filter((item) => item.id !== cari.id);
                return [{ ...cari }, ...next];
            });
        };

        window.addEventListener('finance-cari-local-change', handleCariLocalChange);
        return () => window.removeEventListener('finance-cari-local-change', handleCariLocalChange);
    }, [alanKodu]);

    const islemler = useMemo(() => {
        const tagById = new Map((etiketler || []).map((tag) => [tag.id, tag]));
        const linksByTransaction = new Map();

        (transactionTags || []).forEach((link) => {
            const transactionId = link.transaction_id || link.transactionId;
            const tagId = link.tag_id || link.tagId;
            if (!transactionId || !tagId) return;
            if (!linksByTransaction.has(transactionId)) linksByTransaction.set(transactionId, []);
            const tag = tagById.get(tagId);
            if (tag) linksByTransaction.get(transactionId).push(tag);
        });

        return (rawIslemler || []).map((transaction) => {
            const linkedTags = linksByTransaction.get(transaction.id) || getTransactionTags(transaction);
            return {
                ...transaction,
                tags: linkedTags,
                tagIds: linkedTags.map((tag) => tag.id).filter(Boolean),
            };
        });
    }, [rawIslemler, etiketler, transactionTags]);

    return {
        hesaplar, hesaplarLoaded, islemler, abonelikler, taksitler, maaslar, portfoy, bekleyenFaturalar, tanimliFaturalar, besVerisi, borclar, cariler, finansmanlar, cariIslemler, reminders,
        etiketler, transactionTags,
        kategoriListesi, setKategoriListesi,
        yatirimTurleri, setYatirimTurleri,
        aylikLimit, setAylikLimit,
        varsayilanKategori, varsayilanTaksitKategori, varsayilanAboKategori, varsayilanVarlikTuru,
        hedefler, envanter, satislar
    };
};
