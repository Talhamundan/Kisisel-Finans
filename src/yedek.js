import { useState, useEffect } from 'react'
import { db } from './firebase'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, increment, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import * as XLSX from 'xlsx';

// --- EK KÜTÜPHANELER ---
import Swal from 'sweetalert2';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- AUTH ---
const auth = getAuth();
const provider = new GoogleAuthProvider();

// --- YARDIMCI: Formatlı Para ---
const formatCurrencyPlain = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

function App() {
    // --- STATE ---
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // NAVİGASYON TAB STATE
    const [anaSekme, setAnaSekme] = useState("butcem"); // 'butcem' veya 'yatirimlar'

    // KOD SİSTEMİ
    const [alanKodu, setAlanKodu] = useState(localStorage.getItem("alan_kodu") || "");
    const [girilenKod, setGirilenKod] = useState("");

    const [hesaplar, setHesaplar] = useState([])
    const [islemler, setIslemler] = useState([])
    const [abonelikler, setAbonelikler] = useState([])
    const [taksitler, setTaksitler] = useState([])
    const [maaslar, setMaaslar] = useState([])
    const [portfoy, setPortfoy] = useState([])
    const [bekleyenFaturalar, setBekleyenFaturalar] = useState([]);
    const [tanimliFaturalar, setTanimliFaturalar] = useState([]);
    const [bildirimler, setBildirimler] = useState([]);

    const [gizliMod, setGizliMod] = useState(false);
    const [aktifAy, setAktifAy] = useState(new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }));
    const [aylikLimit, setAylikLimit] = useState(15000);

    const [formTab, setFormTab] = useState("islem");
    const [aktifModal, setAktifModal] = useState(null);
    const [seciliVeri, setSeciliVeri] = useState(null);
    const [guncelleniyor, setGuncelleniyor] = useState(false);

    // FİLTRELEME
    const [aramaMetni, setAramaMetni] = useState("");
    const [filtreKategori, setFiltreKategori] = useState("Tümü");

    // YATIRIM FİLTRELEME
    const [yatirimArama, setYatirimArama] = useState("");
    const [aktifYatirimAy, setAktifYatirimAy] = useState("Tümü");
    const [filtreYatirimTuru, setFiltreYatirimTuru] = useState("Tümü");

    const [yeniKodInput, setYeniKodInput] = useState("");
    const [tasimaIslemiSuruyor, setTasimaIslemiSuruyor] = useState(false);

    // --- AYARLAR ---
    const [kategoriListesi, setKategoriListesi] = useState(["Market", "Pazar", "Yemek", "Ulaşım", "Akaryakıt", "Fatura", "Kira/Aidat", "Giyim", "Eğitim", "Sağlık", "Eğlence", "Teknoloji", "Yatırım", "Diğer", "Maaş", "Freelance", "Kredi Kartı Ödemesi"]);
    const [yatirimTurleri, setYatirimTurleri] = useState(["Hisse", "Altın", "Döviz", "Fon", "Coin", "BES"]);
    const [yeniKategoriAdi, setYeniKategoriAdi] = useState("");
    const [yeniYatirimTuruAdi, setYeniYatirimTuruAdi] = useState("");

    // Form Değişkenleri
    const [hesapAdi, setHesapAdi] = useState(""); const [hesapTipi, setHesapTipi] = useState("nakit"); const [baslangicBakiye, setBaslangicBakiye] = useState(""); const [hesapKesimGunu, setHesapKesimGunu] = useState("");
    const [secilenHesapId, setSecilenHesapId] = useState(""); const [islemTutar, setIslemTutar] = useState(""); const [islemAciklama, setIslemAciklama] = useState("")
    const [islemTipi, setIslemTipi] = useState("gider"); const [kategori, setKategori] = useState(""); const [islemTarihi, setIslemTarihi] = useState("")

    const [transferKaynakId, setTransferKaynakId] = useState(""); const [transferHedefId, setTransferHedefId] = useState(""); const [transferTutar, setTransferTutar] = useState("");

    const [aboAd, setAboAd] = useState(""); const [aboTutar, setAboTutar] = useState(""); const [aboGun, setAboGun] = useState(""); const [aboHesapId, setAboHesapId] = useState("");
    const [aboKategori, setAboKategori] = useState("Fatura");

    const [taksitBaslik, setTaksitBaslik] = useState(""); const [taksitToplamTutar, setTaksitToplamTutar] = useState(""); const [taksitSayisi, setTaksitSayisi] = useState("");
    const [taksitHesapId, setTaksitHesapId] = useState(""); const [taksitKategori, setTaksitKategori] = useState(""); const [taksitAlisTarihi, setTaksitAlisTarihi] = useState("");

    const [maasAd, setMaasAd] = useState(""); const [maasTutar, setMaasTutar] = useState(""); const [maasGun, setMaasGun] = useState(""); const [maasHesapId, setMaasHesapId] = useState("");

    const [sembol, setSembol] = useState(""); const [adet, setAdet] = useState(""); const [alisFiyati, setAlisFiyati] = useState(""); const [varlikTuru, setVarlikTuru] = useState(""); const [yatirimHesapId, setYatirimHesapId] = useState("");

    const [tanimBaslik, setTanimBaslik] = useState(""); const [tanimKurum, setTanimKurum] = useState(""); const [tanimAboneNo, setTanimAboneNo] = useState("");

    const [secilenTanimId, setSecilenTanimId] = useState(""); const [faturaGirisTutar, setFaturaGirisTutar] = useState(""); const [faturaGirisTarih, setFaturaGirisTarih] = useState(""); const [faturaGirisAciklama, setFaturaGirisAciklama] = useState("");

    const [kkOdemeKartId, setKkOdemeKartId] = useState(""); const [kkOdemeKaynakId, setKkOdemeKaynakId] = useState(""); const [kkOdemeTutar, setKkOdemeTutar] = useState("");

    // --- STİL SABİTLERİ ---
    const inputStyle = {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #cbd5e0',
        backgroundColor: '#ffffff',
        color: '#2d3748',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box'
    };

    const cardStyle = {
        background: '#ffffff',
        padding: '20px',
        borderRadius: '15px',
        boxShadow: '0 5px 15px rgba(0,0,0,0.05)',
        color: '#333'
    };

    // --- OTURUM ---
    useEffect(() => { const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }); return () => unsubscribe(); }, []);

    // --- KOD GİRİŞ ---
    const kodIleGiris = (e) => {
        e.preventDefault();
        if (!girilenKod) return toast.warning("Lütfen bir kod belirleyin!");
        localStorage.setItem("alan_kodu", girilenKod);
        setAlanKodu(girilenKod);
        window.location.reload();
    }

    const koddanCikis = () => {
        Swal.fire({
            title: 'Çıkış Yapılsın mı?',
            text: "Bu alandan çıkmak istediğine emin misin?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Evet, Çık'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem("alan_kodu");
                setAlanKodu("");
                window.location.reload();
            }
        });
    }

    // --- VERİ TAŞIMA ---
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

    // --- VERİLERİ ÇEKME ---
    useEffect(() => {
        if (!user || !alanKodu) return;

        const qHesaplar = query(collection(db, "hesaplar"), where("alanKodu", "==", alanKodu));
        const qIslemler = query(collection(db, "nakit_islemleri"), where("alanKodu", "==", alanKodu));
        const qAbonelik = query(collection(db, "abonelikler"), where("alanKodu", "==", alanKodu));
        const qTaksitler = query(collection(db, "taksitler"), where("alanKodu", "==", alanKodu));
        const qMaaslar = query(collection(db, "maaslar"), where("alanKodu", "==", alanKodu));
        const qPortfoy = query(collection(db, "portfoy"), where("alanKodu", "==", alanKodu));
        const qFaturalar = query(collection(db, "bekleyen_faturalar"), where("alanKodu", "==", alanKodu));
        const qFaturaTanim = query(collection(db, "fatura_tanimlari"), where("alanKodu", "==", alanKodu));

        const u1 = onSnapshot(qHesaplar, (s) => setHesaplar(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const u2 = onSnapshot(qIslemler, (s) => {
            const v = s.docs.map(d => ({ id: d.id, ...d.data() }));
            v.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
            setIslemler(v);
        });
        const u4 = onSnapshot(qAbonelik, (s) => setAbonelikler(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const u5 = onSnapshot(qTaksitler, (s) => setTaksitler(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const u6 = onSnapshot(qMaaslar, (s) => setMaaslar(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const u7 = onSnapshot(qPortfoy, (s) => setPortfoy(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const u8 = onSnapshot(qFaturalar, (s) => setBekleyenFaturalar(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const u9 = onSnapshot(qFaturaTanim, (s) => setTanimliFaturalar(s.docs.map(d => ({ id: d.id, ...d.data() }))));

        const ayarGetir = async () => {
            const d = await getDoc(doc(db, "ayarlar", alanKodu));
            if (d.exists()) {
                const data = d.data();
                setAylikLimit(data.limit || 15000);
                if (data.kategoriler?.length > 0) {
                    setKategoriListesi(data.kategoriler);
                    setKategori(data.kategoriler[0]);
                    setTaksitKategori(data.kategoriler[0]);
                    setAboKategori("Fatura");
                }
                if (data.yatirimTurleri?.length > 0) {
                    setYatirimTurleri(data.yatirimTurleri);
                    setVarlikTuru(data.yatirimTurleri[0]);
                } else {
                    setVarlikTuru("Hisse");
                }
            } else {
                setKategori(kategoriListesi[0]);
                setTaksitKategori(kategoriListesi[0]);
                setAboKategori("Fatura");
                setVarlikTuru("Hisse");
            }
        }
        ayarGetir();
        return () => { u1(); u2(); u4(); u5(); u6(); u7(); u8(); u9(); }
    }, [user, alanKodu])

    // --- BİLDİRİM MOTORU ---
    useEffect(() => {
        if (islemler.length === 0 && abonelikler.length === 0 && taksitler.length === 0 && maaslar.length === 0 && hesaplar.length === 0 && bekleyenFaturalar.length === 0) return;
        const bugun = new Date();
        const mevcutAy = bugun.getMonth();
        const mevcutYil = bugun.getFullYear();
        const mevcutGun = bugun.getDate();
        let tempBildirimler = [];

        // 1. Kredi Kartı
        hesaplar.forEach(h => {
            if (h.hesapTipi === 'krediKarti' && h.kesimGunu) {
                const kesimGunuInt = parseInt(h.kesimGunu);
                if (mevcutGun >= kesimGunuInt && mevcutGun < kesimGunuInt + 10) {
                    const odemeYapildiMi = islemler.some(islem => {
                        const t = new Date(islem.tarih.seconds * 1000);
                        return t.getMonth() === mevcutAy &&
                            t.getFullYear() === mevcutYil &&
                            t.getDate() >= kesimGunuInt &&
                            (islem.hedefId === h.id || islem.hesapId === h.id) &&
                            (islem.islemTipi === 'transfer' || islem.islemTipi === 'gelir');
                    });

                    if (!odemeYapildiMi && h.guncelBakiye < 0) {
                        tempBildirimler.push({
                            id: h.id + '_kk',
                            tip: 'kk_hatirlatma',
                            mesaj: `💳 ${h.hesapAdi} ekstresi kesildi!`,
                            tutar: Math.abs(h.guncelBakiye),
                            data: h,
                            renk: 'orange'
                        });
                    }
                }
            }
        });

        // 2. Maaş
        maaslar.forEach(maas => {
            if (mevcutGun >= maas.gun) {
                const yattiMi = islemler.some(islem => {
                    const islemTarih = new Date(islem.tarih.seconds * 1000);
                    return islemTarih.getMonth() === mevcutAy &&
                        islemTarih.getFullYear() === mevcutYil &&
                        islem.aciklama.toLowerCase().includes(maas.ad.toLowerCase()) &&
                        islem.islemTipi === 'gelir';
                });
                if (!yattiMi) tempBildirimler.push({ id: maas.id, tip: 'maas', mesaj: `💰 ${maas.ad} günü geldi!`, tutar: maas.tutar, data: maas, renk: 'green' });
            }
        });

        // 3. Abonelik
        abonelikler.forEach(abo => {
            if (mevcutGun >= abo.gun) {
                const odendiMi = islemler.some(islem => {
                    const islemTarih = new Date(islem.tarih.seconds * 1000);
                    return islemTarih.getMonth() === mevcutAy &&
                        islemTarih.getFullYear() === mevcutYil &&
                        islem.aciklama.toLowerCase().includes(abo.ad.toLowerCase());
                });
                if (!odendiMi) tempBildirimler.push({ id: abo.id, tip: 'abonelik', mesaj: `⚠️ ${abo.ad} ödenmedi! (${abo.gun}. gün)`, tutar: abo.tutar, data: abo, renk: 'red' });
            }
        });

        // 4. Faturalar
        bekleyenFaturalar.forEach(f => {
            if (f.sonOdemeTarihi) {
                const sonOdeme = new Date(f.sonOdemeTarihi);
                const sO = new Date(sonOdeme.setHours(0, 0, 0, 0));
                const bG = new Date(bugun.setHours(0, 0, 0, 0));

                const tanim = tanimliFaturalar.find(t => t.id === f.tanimId);
                const ad = tanim ? tanim.baslik : "Bilinmeyen Fatura";

                if (kalanGun < 0) {
                    tempBildirimler.push({ id: f.id, tip: 'fatura', mesaj: `🔥 ${ad} GECİKTİ! (${Math.abs(kalanGun)} gün)`, tutar: f.tutar, data: f, renk: 'red' });
                } else if (kalanGun <= 5) {
                    tempBildirimler.push({ id: f.id, tip: 'fatura', mesaj: `⚠️ ${ad} için son ${kalanGun} gün!`, tutar: f.tutar, data: f, renk: 'orange' });
                }
            }
        });

        setBildirimler(tempBildirimler);
    }, [islemler, abonelikler, taksitler, maaslar, hesaplar, bekleyenFaturalar, tanimliFaturalar]);


    // --- HESAPLAMALAR ---
    const formatPara = (tutar) => gizliMod ? "**** ₺" : (parseFloat(tutar) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
    const tarihFormatla = (t) => { if (!t) return ""; const d = new Date(t.seconds * 1000); return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' }); };
    const tarihSadeceGunAyYil = (t) => { if (!t) return ""; const d = new Date(t); return d.toLocaleDateString("tr-TR"); };
    const ayIsmiGetir = (firebaseTarih) => { if (!firebaseTarih) return "Bilinmiyor"; const date = new Date(firebaseTarih.seconds * 1000); return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }); }

    // -- FİLTRELERİ AYIRMA (YATIRIM VS BÜTÇE) --
    // Bütçe işlemleri: Kategori 'Yatırım' OLMAYANLAR
    const filtrelenmisIslemler = islemler.filter(i => {
        const yatirimDegil = i.kategori !== "Yatırım";
        const ayUyumu = aktifAy === "Tümü" ? true : ayIsmiGetir(i.tarih) === aktifAy;
        const aramaKucuk = aramaMetni.toLowerCase();
        const metinUyumu = !aramaMetni ? true : (
            (i.aciklama && i.aciklama.toLowerCase().includes(aramaKucuk)) ||
            (i.kategori && i.kategori.toLowerCase().includes(aramaKucuk)) ||
            i.tutar.toString().includes(aramaMetni)
        );
        const kategoriUyumu = filtreKategori === "Tümü" ? true : i.kategori === filtreKategori;
        return yatirimDegil && ayUyumu && metinUyumu && kategoriUyumu;
    });

    // Yatırım İşlemleri: Kategori 'Yatırım' OLANLAR
    const yatirimIslemleri = islemler.filter(i => {
        const yatirimMi = i.kategori === "Yatırım";
        const ayUyumu = aktifYatirimAy === "Tümü" ? true : ayIsmiGetir(i.tarih) === aktifYatirimAy;
        const aramaKucuk = yatirimArama.toLowerCase();
        const metinUyumu = !yatirimArama ? true : (
            (i.aciklama && i.aciklama.toLowerCase().includes(aramaKucuk)) ||
            i.tutar.toString().includes(yatirimArama)
        );
        const turUyumu = filtreYatirimTuru === "Tümü" ? true : i.yatirimTuru === filtreYatirimTuru;
        return yatirimMi && ayUyumu && metinUyumu && turUyumu;
    });


    const mevcutAylar = ["Tümü", ...new Set(islemler.map(i => ayIsmiGetir(i.tarih)))];

    const bugunGider = islemler.filter(i => {
        const d = new Date(i.tarih.seconds * 1000);
        return i.islemTipi === 'gider' &&
            d.getDate() === new Date().getDate() &&
            d.getMonth() === new Date().getMonth() &&
            d.getFullYear() === new Date().getFullYear();
    }).reduce((acc, i) => acc + i.tutar, 0);

    const toplamGelir = filtrelenmisIslemler.filter(i => i.islemTipi === 'gelir').reduce((acc, i) => acc + i.tutar, 0);
    const toplamGider = filtrelenmisIslemler.filter(i => i.islemTipi === 'gider').reduce((acc, i) => acc + i.tutar, 0);
    const harcananLimit = filtrelenmisIslemler.filter(i => i.islemTipi === 'gider' && i.kategori !== 'Transfer' && i.kategori !== 'Kira' && i.kategori !== 'Kira/Aidat' && i.kategori !== 'Yatırım').reduce((acc, i) => acc + i.tutar, 0);
    const limitYuzdesi = Math.min((harcananLimit / aylikLimit) * 100, 100);
    const limitRenk = limitYuzdesi > 90 ? '#e53e3e' : limitYuzdesi > 75 ? '#dd6b20' : '#48bb78';

    const kategoriVerisi = filtrelenmisIslemler.filter(i => i.islemTipi === 'gider' && i.kategori !== 'Transfer').reduce((acc, curr) => { const mevcut = acc.find(item => item.name === curr.kategori); if (mevcut) { mevcut.value += curr.tutar; } else { acc.push({ name: curr.kategori, value: curr.tutar }); } return acc; }, []);
    const gunlukVeri = filtrelenmisIslemler.filter(i => i.islemTipi === 'gider').reduce((acc, curr) => { const gun = new Date(curr.tarih.seconds * 1000).getDate(); const mevcut = acc.find(item => item.name === gun); if (mevcut) mevcut.value += curr.tutar; else acc.push({ name: gun, value: curr.tutar }); return acc; }, []).sort((a, b) => a.name - b.name);
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919', '#e15fed', '#82ca9d'];

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

    const portfoyGuncelDegeri = portfoy.reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);
    const toplamKarZarar = portfoyGuncelDegeri - portfoy.reduce((acc, p) => acc + (p.adet * p.alisFiyati), 0);
    const portfoyVerisi = portfoy.reduce((acc, curr) => { const guncelTutar = curr.adet * (curr.guncelFiyat || curr.alisFiyati); const mevcut = acc.find(item => item.name === curr.sembol); if (mevcut) { mevcut.value += guncelTutar; } else { acc.push({ name: curr.sembol, value: guncelTutar }); } return acc; }, []);
    const COLORS_PORTFOLIO = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#a4de6c', '#d0ed57'];

    const toplamKalanTaksitBorcu = taksitler.reduce((acc, t) => acc + (t.toplamTutar - (t.aylikTutar * t.odenmisTaksit)), 0);
    const toplamSabitGider = abonelikler.reduce((acc, abo) => acc + abo.tutar, 0);
    const toplamNakitVarlik = hesaplar.reduce((acc, h) => acc + (parseFloat(h.guncelBakiye) || 0), 0);
    const netVarlik = toplamNakitVarlik + portfoyGuncelDegeri;

    // --- YENİ MANTIK: YATIRIM KARTI HESAPLAMALARI ---
    // Yatırım (Hisse, Fon vb.) Portföydeki Değer
    const portfoyYatirimDegeri = portfoy.filter(p => !['doviz', 'bes', 'altin'].includes(p.varlikTuru?.toLowerCase())).reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);

    // Altın, Döviz, BES Portföydeki Değerleri
    const toplamDovizVarligi = portfoy.filter(p => p.varlikTuru?.toLowerCase() === 'doviz').reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);
    const toplamBesVarligi = portfoy.filter(p => p.varlikTuru?.toLowerCase() === 'bes').reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);
    const toplamAltinVarligi = portfoy.filter(p => p.varlikTuru?.toLowerCase() === 'altin').reduce((acc, p) => acc + (p.adet * (p.guncelFiyat || p.alisFiyati)), 0);

    // YENİ: Sadece "Yatırım Hesabı" türündeki hesapların nakit bakiyesi
    const toplamYatirimHesapNakiti = hesaplar
        .filter(h => h.hesapTipi === 'yatirim')
        .reduce((acc, h) => acc + (parseFloat(h.guncelBakiye) || 0), 0);

    // Sadece cüzdan ve kart bakiyesi (Net Nakit Varlık Gösterimi İçin)
    const sadeceCuzdanNakiti = toplamNakitVarlik - toplamYatirimHesapNakiti;

    // Karttaki "Yatırım" kalemi: Hisse + Altın + Fon vs. (Portföydeki)
    const kartYatirimToplami = portfoyYatirimDegeri + toplamAltinVarligi;

    // Karttaki "Nakit" kalemi: Sadece Yatırım Hesaplarındaki Nakit
    const kartNakitToplami = toplamYatirimHesapNakiti;

    // GENEL TOPLAM YATIRIM GÜCÜ (Yatırım Sekmesindeki Büyük Rakam)
    const genelToplamYatirimGucu = portfoyGuncelDegeri + toplamYatirimHesapNakiti;

    // --- YENİ: GENEL VARLIK GRAFİK VERİSİ ---
    // --- GÜNCELLENDİ: İSİM "HİSSE" OLDU ---
    const genelVarlikVerisi = [
        { name: 'Hisse', value: kartYatirimToplami },
        { name: 'Döviz', value: toplamDovizVarligi },
        { name: 'BES', value: toplamBesVarligi },
        { name: 'Nakit', value: kartNakitToplami }
    ].filter(item => item.value > 0);

    // Grafik Renkleri (Mavi, Yeşil, Mor, Turuncu)
    const COLORS_GENEL = ['#3182ce', '#38a169', '#805ad5', '#dd6b20'];


    // --- FONKSİYONLAR ---
    const girisYap = async () => { try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); toast.error("Giriş başarısız!"); } }
    const cikisYap = async () => { await signOut(auth); setAlanKodu(""); localStorage.removeItem("alan_kodu"); }

    const hesapEkle = async (e) => {
        e.preventDefault();
        if (!hesapAdi) return;
        await addDoc(collection(db, "hesaplar"), {
            uid: user.uid,
            alanKodu,
            hesapAdi,
            hesapTipi,
            guncelBakiye: parseFloat(baslangicBakiye),
            kesimGunu: hesapTipi === 'krediKarti' ? hesapKesimGunu : ""
        });
        setHesapAdi(""); setBaslangicBakiye(""); setHesapKesimGunu("");
        toast.success("Hesap eklendi.");
    }

    // SİLME İŞLEMİ (SWEETALERT2)
    const islemSil = async (id) => {
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
                    let duzeltmeMiktari = 0;
                    if (data.islemTipi === 'gider' || data.islemTipi === 'yatirim_alis') duzeltmeMiktari = data.tutar;
                    if (data.islemTipi === 'gelir' || data.islemTipi === 'yatirim_satis') duzeltmeMiktari = -data.tutar;

                    if (data.kategori === "Kredi Kartı Ödemesi") {
                        await updateDoc(doc(db, "hesaplar", data.kaynakId), { guncelBakiye: increment(data.tutar) });
                        await updateDoc(doc(db, "hesaplar", data.hedefId), { guncelBakiye: increment(-data.tutar) });
                    } else if (data.hesapId && duzeltmeMiktari !== 0) {
                        await updateDoc(doc(db, "hesaplar", data.hesapId), { guncelBakiye: increment(duzeltmeMiktari) });
                    }
                    if (data.kategori === "Taksit" && data.taksitId) {
                        await updateDoc(doc(db, "taksitler", data.taksitId), { odenmisTaksit: increment(-1) });
                    }
                    await deleteDoc(docRef);
                    toast.success("İşlem silindi.");
                }
            });
        }
    }

    const normalSil = async (koleksiyon, id) => {
        Swal.fire({
            title: 'Emin misin?',
            text: "Bu kayıt kalıcı olarak silinecek.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Evet, Sil'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await deleteDoc(doc(db, koleksiyon, id));
                toast.info("Kayıt silindi.");
            }
        });
    }

    const islemEkle = async (e) => {
        e.preventDefault();
        if (!secilenHesapId || !islemTutar) return toast.warning("Lütfen hesap ve tutar girin");
        const tutar = parseFloat(islemTutar);
        const tarih = islemTarihi ? new Date(islemTarihi) : new Date();
        const secilenKategori = kategori || kategoriListesi[0];
        await addDoc(collection(db, "nakit_islemleri"), { uid: user.uid, alanKodu, hesapId: secilenHesapId, islemTipi, kategori: secilenKategori, tutar, aciklama: islemAciklama, tarih });
        await updateDoc(doc(db, "hesaplar", secilenHesapId), { guncelBakiye: increment(islemTipi === 'gelir' ? tutar : -tutar) });
        setIslemTutar(""); setIslemAciklama(""); setIslemTarihi("");
        toast.success("İşlem kaydedildi!");
    }

    const yatirimAl = async (e) => {
        e.preventDefault();
        if (!sembol || !adet || !alisFiyati || !yatirimHesapId || !varlikTuru) return toast.error("Tüm bilgileri girin");
        const sAdet = parseFloat(adet);
        const sFiyat = parseFloat(alisFiyati);
        const toplam = sAdet * sFiyat;
        const tarih = new Date();
        await addDoc(collection(db, "portfoy"), { uid: user.uid, alanKodu, sembol: sembol.toUpperCase(), varlikTuru, adet: sAdet, alisFiyati: sFiyat, guncelFiyat: sFiyat, tarih: tarih });
        await updateDoc(doc(db, "hesaplar", yatirimHesapId), { guncelBakiye: increment(-toplam) });
        await addDoc(collection(db, "nakit_islemleri"), {
            uid: user.uid,
            alanKodu,
            hesapId: yatirimHesapId,
            islemTipi: "yatirim_alis",
            kategori: "Yatırım", // Sistem için
            yatirimTuru: varlikTuru, // Gösterim için
            tutar: toplam,
            aciklama: `${sembol.toUpperCase()} Alış`,
            tarih: tarih
        });
        toast.success(`${sembol.toUpperCase()} alındı!`); setSembol(""); setAdet(""); setAlisFiyati("");
    }

    const satisYap = async (e) => {
        e.preventDefault();
        if (!secilenHesapId || !islemTutar) return toast.error("Hesap ve Fiyat Girin");
        const toplam = parseFloat(islemTutar) * seciliVeri.adet;
        await deleteDoc(doc(db, "portfoy", seciliVeri.id));
        await updateDoc(doc(db, "hesaplar", secilenHesapId), { guncelBakiye: increment(toplam) });
        await addDoc(collection(db, "nakit_islemleri"), {
            uid: user.uid,
            alanKodu,
            hesapId: secilenHesapId,
            islemTipi: "yatirim_satis",
            kategori: "Yatırım",
            yatirimTuru: seciliVeri.varlikTuru,
            tutar: toplam,
            aciklama: `${seciliVeri.sembol} Satış`,
            tarih: new Date()
        });
        toast.success("Satış gerçekleşti!"); setAktifModal(null); setIslemTutar(""); setSecilenHesapId("");
    }

    const fiyatGuncelle = async (id, yeniFiyat) => { if (!yeniFiyat) return; await updateDoc(doc(db, "portfoy", id), { guncelFiyat: parseFloat(yeniFiyat) }); }

    const piyasalariGuncelle = async () => {
        setGuncelleniyor(true);
        try {
            const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY,EUR");
            const data = await res.json();
            const usdTry = data.rates.TRY;
            const eurTry = (1 / data.rates.EUR) * usdTry;
            const gramAltin = (2650 * usdTry) / 31.1035;
            const promises = portfoy.map(async (p) => {
                let y = null;
                if (p.varlikTuru === 'doviz') { if (p.sembol === 'USD') y = usdTry; else if (p.sembol === 'EUR') y = eurTry; }
                else if (p.varlikTuru === 'altin') y = gramAltin;
                else { const eski = parseFloat(p.guncelFiyat || p.alisFiyati); y = eski * (1 + ((Math.random() * 0.04) - 0.02)); }
                if (y) await updateDoc(doc(db, "portfoy", p.id), { guncelFiyat: y });
            });
            await Promise.all(promises);
            toast.success("Fiyatlar güncellendi!");
        } catch (e) { console.error(e); toast.error("Güncelleme hatası"); }
        finally { setGuncelleniyor(false); }
    }

    const taksitEkle = async (e) => {
        e.preventDefault();
        if (!taksitHesapId || !taksitToplamTutar || !taksitSayisi) return toast.error("Eksik bilgi!");
        const toplam = parseFloat(taksitToplamTutar); const sayi = parseInt(taksitSayisi); const aylik = toplam / sayi;
        const secilenTaksitKategori = taksitKategori || kategoriListesi[0];
        const tarih = taksitAlisTarihi ? new Date(taksitAlisTarihi) : new Date();
        await addDoc(collection(db, "taksitler"), { uid: user.uid, alanKodu, baslik: taksitBaslik, toplamTutar: toplam, taksitSayisi: sayi, aylikTutar: aylik, odenmisTaksit: 0, hesapId: taksitHesapId, kategori: secilenTaksitKategori, olusturmaTarihi: new Date(), alisTarihi: tarih });
        toast.success("Taksit planı oluşturuldu!");
        setTaksitBaslik(""); setTaksitToplamTutar(""); setTaksitSayisi(""); setTaksitHesapId(""); setTaksitAlisTarihi("");
    }

    const taksitOde = async (t) => {
        const result = await Swal.fire({
            title: 'Taksit İşlensin mi?',
            html: `<b>${t.baslik}</b> için bu ayın taksiti işlenecek.<br/><br/><span style="font-size:1.2em; color:#4f46e5; font-weight:bold">${formatCurrencyPlain(t.aylikTutar)}</span>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Evet, İşle',
            cancelButtonText: 'İptal'
        });

        if (!result.isConfirmed) return;

        await addDoc(collection(db, "nakit_islemleri"), { uid: user.uid, alanKodu, hesapId: t.hesapId, islemTipi: "gider", kategori: t.kategori || "Taksit", tutar: t.aylikTutar, aciklama: `${t.baslik} (${t.odenmisTaksit + 1}/${t.taksitSayisi})`, tarih: new Date(), taksitId: t.id });
        await updateDoc(doc(db, "hesaplar", t.hesapId), { guncelBakiye: increment(-t.aylikTutar) });
        const yeniSayac = t.odenmisTaksit + 1;
        if (yeniSayac >= t.taksitSayisi) {
            Swal.fire({
                title: 'Bitti!', text: 'Taksit bitti! Listeden kaldırılsın mı?', icon: 'success', showCancelButton: true, confirmButtonText: 'Kaldır'
            }).then(async (res) => {
                if (res.isConfirmed) await deleteDoc(doc(db, "taksitler", t.id));
                else await updateDoc(doc(db, "taksitler", t.id), { odenmisTaksit: yeniSayac });
            });
        } else { await updateDoc(doc(db, "taksitler", t.id), { odenmisTaksit: yeniSayac }); }
        toast.success("Taksit işlendi.");
    }

    const transferYap = async (e) => { e.preventDefault(); if (!transferKaynakId || !transferHedefId || !transferTutar) return toast.error("Alanları seçin"); if (transferKaynakId === transferHedefId) return toast.error("Aynı hesaba transfer yapılamaz"); const tutar = parseFloat(transferTutar); const k = hesaplar.find(h => h.id === transferKaynakId); const h = hesaplar.find(h => h.id === transferHedefId); await addDoc(collection(db, "nakit_islemleri"), { uid: user.uid, alanKodu, islemTipi: "transfer", kategori: "Transfer", tutar: tutar, aciklama: `${k?.hesapAdi} ➝ ${h?.hesapAdi}`, tarih: new Date(), kaynakId: transferKaynakId, hedefId: transferHedefId }); await updateDoc(doc(db, "hesaplar", transferKaynakId), { guncelBakiye: increment(-tutar) }); await updateDoc(doc(db, "hesaplar", transferHedefId), { guncelBakiye: increment(tutar) }); toast.success("Transfer Başarılı!"); setTransferTutar(""); setTransferKaynakId(""); setTransferHedefId(""); }

    const abonelikEkle = async (e) => {
        e.preventDefault();
        if (!aboAd || !aboTutar || !aboHesapId) return toast.error("Eksik bilgi");
        const secilenAboKategori = aboKategori || kategoriListesi[0];
        await addDoc(collection(db, "abonelikler"), { uid: user.uid, alanKodu, ad: aboAd, tutar: parseFloat(aboTutar), gun: aboGun, hesapId: aboHesapId, kategori: secilenAboKategori });
        setAboAd(""); setAboTutar(""); setAboGun(""); setAboHesapId("");
        toast.success("Sabit gider eklendi.");
    }

    const abonelikOde = async (abonelik) => {
        const result = await Swal.fire({
            title: 'Ödeme Onayı',
            html: `${abonelik.ad} (<b>${formatCurrencyPlain(abonelik.tutar)}</b>) ödensin mi?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Evet, Öde',
            cancelButtonText: 'İptal'
        });
        if (!result.isConfirmed) return;

        await addDoc(collection(db, "nakit_islemleri"), { uid: user.uid, alanKodu, hesapId: abonelik.hesapId, islemTipi: "gider", kategori: abonelik.kategori || "Fatura", tutar: abonelik.tutar, aciklama: abonelik.ad + " (Otomatik)", tarih: new Date() });
        await updateDoc(doc(db, "hesaplar", abonelik.hesapId), { guncelBakiye: increment(-abonelik.tutar) });
        toast.success("Ödeme işlendi.");
    }

    const maasEkle = async (e) => {
        e.preventDefault();
        if (!maasAd || !maasTutar || !maasHesapId) return toast.error("Eksik bilgi");
        await addDoc(collection(db, "maaslar"), { uid: user.uid, alanKodu, ad: maasAd, tutar: parseFloat(maasTutar), gun: maasGun, hesapId: maasHesapId });
        setMaasAd(""); setMaasTutar(""); setMaasGun(""); setMaasHesapId("");
        toast.success("Gelir kalemi eklendi.");
    }

    const maasYatir = async (maas) => {
        const result = await Swal.fire({
            title: 'Maaş Yatırılsın mı?',
            html: `💰 <b>${maas.ad}</b> tutarı (${formatCurrencyPlain(maas.tutar)}) hesaba işlensin mi?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Evet, Yatır',
            confirmButtonColor: 'green'
        });

        if (!result.isConfirmed) return;

        await addDoc(collection(db, "nakit_islemleri"), {
            uid: user.uid,
            alanKodu,
            hesapId: maas.hesapId,
            islemTipi: "gelir",
            kategori: "Maaş/Gelir",
            tutar: maas.tutar,
            aciklama: `${maas.ad} (Otomatik)`,
            tarih: new Date()
        });
        await updateDoc(doc(db, "hesaplar", maas.hesapId), { guncelBakiye: increment(maas.tutar) });
        toast.success("Gelir hesaba işlendi!");
    }

    // --- YENİ FATURA SİSTEMİ FONKSİYONLARI ---
    const faturaTanimEkle = async (e) => {
        e.preventDefault();
        if (!tanimBaslik) return toast.warning("Başlık giriniz");
        await addDoc(collection(db, "fatura_tanimlari"), {
            uid: user.uid,
            alanKodu,
            baslik: tanimBaslik,
            kurum: tanimKurum,
            aboneNo: tanimAboneNo
        });
        toast.success("Fatura/Abone Tanımlandı!");
        setTanimBaslik(""); setTanimKurum(""); setTanimAboneNo("");
    }

    const faturaGir = async (e) => {
        e.preventDefault();
        if (!secilenTanimId || !faturaGirisTutar || !faturaGirisTarih) return toast.warning("Tüm alanları doldurunuz.");

        await addDoc(collection(db, "bekleyen_faturalar"), {
            uid: user.uid,
            alanKodu,
            tanimId: secilenTanimId,
            tutar: parseFloat(faturaGirisTutar),
            sonOdemeTarihi: faturaGirisTarih,
            aciklama: faturaGirisAciklama,
            eklenmeTarihi: new Date()
        });

        toast.success("Fatura takibe alındı!");
        setFaturaGirisTutar(""); setFaturaGirisTarih(""); setFaturaGirisAciklama("");
    }

    const faturaOde = async (fatura, hesapId) => {
        if (!hesapId) return;
        const tanim = tanimliFaturalar.find(t => t.id === fatura.tanimId);
        const ad = tanim ? tanim.baslik : "Fatura";

        const result = await Swal.fire({
            title: 'Fatura Ödensin mi?',
            html: `${ad} (<b>${formatCurrencyPlain(fatura.tutar)}</b>) ödendi olarak işlenecek.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Evet, Öde',
            cancelButtonText: 'İptal'
        });

        if (!result.isConfirmed) return;

        await addDoc(collection(db, "nakit_islemleri"), {
            uid: user.uid,
            alanKodu,
            hesapId: hesapId,
            islemTipi: "gider",
            kategori: "Fatura",
            tutar: fatura.tutar,
            aciklama: `${ad} Ödeme (${fatura.aciklama || ''})`,
            tarih: new Date()
        });

        await updateDoc(doc(db, "hesaplar", hesapId), { guncelBakiye: increment(-fatura.tutar) });
        await deleteDoc(doc(db, "bekleyen_faturalar", fatura.id));

        toast.success("Fatura ödendi ve arşivlendi.");
        setAktifModal(null);
    }

    const bekleyenFaturaDuzenle = async (e) => {
        e.preventDefault();
        await updateDoc(doc(db, "bekleyen_faturalar", seciliVeri.id), {
            tutar: parseFloat(faturaGirisTutar),
            sonOdemeTarihi: faturaGirisTarih,
            aciklama: faturaGirisAciklama
        });
        setAktifModal(null);
        setFaturaGirisTutar(""); setFaturaGirisTarih(""); setFaturaGirisAciklama("");
        toast.success("Fatura güncellendi");
    }

    const krediKartiBorcOde = async (e) => {
        e.preventDefault();
        if (!kkOdemeKartId || !kkOdemeKaynakId || !kkOdemeTutar) return toast.error("Eksik bilgi");

        const tutar = parseFloat(kkOdemeTutar);
        const kart = hesaplar.find(h => h.id === kkOdemeKartId);
        const kaynak = hesaplar.find(h => h.id === kkOdemeKaynakId);

        await addDoc(collection(db, "nakit_islemleri"), {
            uid: user.uid,
            alanKodu,
            islemTipi: "transfer",
            kategori: "Kredi Kartı Ödemesi",
            tutar: tutar,
            aciklama: `${kaynak.hesapAdi} ➝ ${kart.hesapAdi} Borç Ödeme`,
            tarih: new Date(),
            kaynakId: kkOdemeKaynakId,
            hedefId: kkOdemeKartId
        });

        await updateDoc(doc(db, "hesaplar", kkOdemeKaynakId), { guncelBakiye: increment(-tutar) });
        await updateDoc(doc(db, "hesaplar", kkOdemeKartId), { guncelBakiye: increment(tutar) });

        toast.success("Kredi kartı ödemesi yapıldı!");
        setAktifModal(null); setKkOdemeTutar(""); setKkOdemeKaynakId(""); setKkOdemeKartId("");
    }

    const excelIndir = () => { const veri = islemler.map(i => ({ Tarih: new Date(i.tarih.seconds * 1000).toLocaleDateString(), IslemTipi: i.islemTipi, Kategori: i.kategori, Aciklama: i.aciklama, Tutar: i.tutar, })); const ws = XLSX.utils.json_to_sheet(veri); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Islemler"); XLSX.writeFile(wb, "Kisisel_Finans.xlsx"); }
    const excelYukle = (e) => { const dosya = e.target.files[0]; if (!dosya) return; const reader = new FileReader(); reader.onload = (evt) => { const bstr = evt.target.result; const wb = XLSX.read(bstr, { type: 'binary' }); const wsname = wb.SheetNames[0]; const ws = wb.Sheets[wsname]; const data = XLSX.utils.sheet_to_json(ws); if (!secilenHesapId) return toast.error("Hesap seçin!"); let sayac = 0; data.forEach(async (row) => { if (row.Tutar) { await addDoc(collection(db, "nakit_islemleri"), { uid: user.uid, alanKodu, tarih: new Date(), kategori: row.Kategori || "Genel", aciklama: row.Aciklama || "Excel", tutar: parseFloat(row.Tutar), islemTipi: "gider", hesapId: secilenHesapId }); await updateDoc(doc(db, "hesaplar", secilenHesapId), { guncelBakiye: increment(-parseFloat(row.Tutar)) }); sayac++; } }); toast.success(`${sayac} işlem eklendi!`); }; reader.readAsBinaryString(dosya); }

    const modalAc = (tip, veri) => {
        setSeciliVeri(veri); setAktifModal(tip);
        if (tip === 'duzenle_hesap') {
            setHesapAdi(veri.hesapAdi);
            setHesapTipi(veri.hesapTipi || "nakit"); // VARSAYILAN DEĞER ATANDI
            setBaslangicBakiye(veri.guncelBakiye);
            setHesapKesimGunu(veri.kesimGunu || "");
        }
        if (tip === 'duzenle_islem') {
            setIslemAciklama(veri.aciklama); setIslemTutar(veri.tutar);
            // EĞER YATIRIM İŞLEMİYSE KATEGORİ YERİNE TÜRÜ GETİR
            if (veri.islemTipi.includes('yatirim')) {
                setKategori(veri.yatirimTuru || "Hisse");
            } else {
                setKategori(veri.kategori);
            }

            if (veri.tarih) {
                const date = new Date(veri.tarih.seconds * 1000);
                const isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                setIslemTarihi(isoString);
            }
        }
        if (tip === 'duzenle_abonelik') { setAboAd(veri.ad); setAboTutar(veri.tutar); setAboGun(veri.gun); setAboHesapId(veri.hesapId); setAboKategori(veri.kategori || kategoriListesi[0]); }
        if (tip === 'duzenle_taksit') {
            setTaksitBaslik(veri.baslik);
            setTaksitToplamTutar(veri.toplamTutar);
            setTaksitSayisi(veri.taksitSayisi);
            setTaksitHesapId(veri.hesapId);
            setTaksitKategori(veri.kategori);
            if (veri.alisTarihi) {
                const d = new Date(veri.alisTarihi.seconds * 1000);
                setTaksitAlisTarihi(d.toISOString().split('T')[0]);
            }
        }
        if (tip === 'duzenle_maas') { setMaasAd(veri.ad); setMaasTutar(veri.tutar); setMaasGun(veri.gun); setMaasHesapId(veri.hesapId); }
        if (tip === 'kredi_karti_ode') { setKkOdemeKartId(veri.id); }
        if (tip === 'satis') { setIslemTutar(veri.guncelFiyat || veri.alisFiyati); }
        if (tip === 'duzenle_bekleyen_fatura') { setFaturaGirisTutar(veri.tutar); setFaturaGirisTarih(veri.sonOdemeTarihi); setFaturaGirisAciklama(veri.aciklama || ""); }
    }

    const hesapDuzenle = async (e) => {
        e.preventDefault();
        await updateDoc(doc(db, "hesaplar", seciliVeri.id), {
            hesapAdi,
            hesapTipi,
            guncelBakiye: parseFloat(baslangicBakiye),
            kesimGunu: hesapTipi === 'krediKarti' ? hesapKesimGunu : ""
        });
        setAktifModal(null);
        toast.success("Hesap güncellendi.");
    }

    const islemDuzenle = async (e) => {
        e.preventDefault();
        const guncelTarih = islemTarihi ? new Date(islemTarihi) : new Date();
        const updateData = { aciklama: islemAciklama, tutar: parseFloat(islemTutar), tarih: guncelTarih };

        // EĞER YATIRIMSA TÜRÜ GÜNCELLE, DEĞİLSE KATEGORİYİ
        if (seciliVeri.islemTipi.includes('yatirim')) {
            updateData.yatirimTuru = kategori;
        } else {
            updateData.kategori = kategori;
        }

        await updateDoc(doc(db, "nakit_islemleri", seciliVeri.id), updateData);
        setAktifModal(null); toast.success("İşlem güncellendi.");
    }
    const abonelikDuzenle = async (e) => { e.preventDefault(); await updateDoc(doc(db, "abonelikler", seciliVeri.id), { ad: aboAd, tutar: parseFloat(aboTutar), gun: aboGun, hesapId: aboHesapId, kategori: aboKategori }); setAktifModal(null); setAboAd(""); setAboTutar(""); setAboGun(""); setAboHesapId(""); toast.success("Sabit gider güncellendi."); }
    const taksitDuzenle = async (e) => {
        e.preventDefault();
        const toplam = parseFloat(taksitToplamTutar);
        const sayi = parseInt(taksitSayisi);
        const aylik = toplam / sayi;
        const tarih = taksitAlisTarihi ? new Date(taksitAlisTarihi) : new Date();
        await updateDoc(doc(db, "taksitler", seciliVeri.id), { baslik: taksitBaslik, toplamTutar: toplam, taksitSayisi: sayi, aylikTutar: aylik, hesapId: taksitHesapId, kategori: taksitKategori, alisTarihi: tarih });
        setAktifModal(null); setTaksitBaslik(""); setTaksitToplamTutar(""); setTaksitSayisi(""); setTaksitHesapId(""); setTaksitAlisTarihi(""); toast.success("Taksit güncellendi.");
    }
    const maasDuzenle = async (e) => {
        e.preventDefault();
        await updateDoc(doc(db, "maaslar", seciliVeri.id), { ad: maasAd, tutar: parseFloat(maasTutar), gun: maasGun, hesapId: maasHesapId });
        setAktifModal(null); setMaasAd(""); setMaasTutar(""); setMaasGun(""); setMaasHesapId(""); toast.success("Gelir kalemi güncellendi.");
    }

    const faturaTanimDuzenle = async (e) => {
        e.preventDefault();
        await updateDoc(doc(db, "fatura_tanimlari", seciliVeri.id), {
            baslik: tanimBaslik,
            kurum: tanimKurum,
            aboneNo: tanimAboneNo
        });
        setAktifModal(null);
        setTanimBaslik(""); setTanimKurum(""); setTanimAboneNo("");
        toast.success("Tanım güncellendi");
    }

    if (loading) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Yükleniyor...</div>;
    if (!user) return (<div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)', color: 'white', fontFamily: 'Segoe UI' }}> <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>Kişisel Finans</h1> <p style={{ marginBottom: '40px' }}>Finansal hesabına devam et.</p> <button onClick={girisYap} style={{ padding: '15px 40px', fontSize: '1.1rem', borderRadius: '50px', border: 'none', cursor: 'pointer', background: 'white', color: '#1a2980', fontWeight: 'bold' }}>Giriş Yap</button> <ToastContainer /> </div>);

    if (!alanKodu) return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f7fafc', fontFamily: 'Segoe UI' }}>
            <h2 style={{ color: '#2d3748', marginBottom: '20px' }}>🔑 Kişisel Alan Girişi</h2>
            <div style={{ background: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', width: '300px', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: '#718096', marginBottom: '20px' }}>Verilerini sakladığın kodu gir.</p>
                <form onSubmit={kodIleGiris}>
                    <input placeholder="Kod Belirle (Örn: TALHA_EV)" value={girilenKod} onChange={e => setGirilenKod(e.target.value.toUpperCase())} style={inputStyle} required />
                    <button type="submit" style={{ width: '100%', padding: '12px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>GİRİŞ YAP</button>
                </form>
                <div style={{ marginTop: '15px', fontSize: '12px', color: '#a0aec0' }}>Kullanıcı: {user.email}</div>
                <button onClick={cikisYap} style={{ marginTop: '10px', background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Hesaptan Çık</button>
            </div>
            <ToastContainer position="top-right" autoClose={3000} />
        </div>
    );

    return (
        <div style={{ padding: '30px', fontFamily: 'Segoe UI', width: '100vw', boxSizing: 'border-box', background: '#f7f9fc', minHeight: '100vh', color: '#333', overflowX: 'hidden' }}>

            <ToastContainer position="top-right" autoClose={2000} theme="light" />

            {/* MODALLAR */}
            {aktifModal && (<div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
                <div style={{ ...cardStyle, width: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
                    {/* YENİ: SATIŞ MODALI */}
                    {aktifModal === 'satis' && <form onSubmit={satisYap}><h3>💰 Satış Yap</h3><div style={{ marginBottom: '10px' }}><b>{seciliVeri.sembol}</b> - {seciliVeri.adet} Adet</div><input type="number" value={islemTutar} onChange={e => setIslemTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} placeholder="Birim Satış Fiyatı" /><select value={secilenHesapId} onChange={e => setSecilenHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }} required><option value="">Para Hangi Hesaba Gitsin?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select><div style={{ marginBottom: '10px', fontSize: '13px' }}>Toplam Tutar: {islemTutar ? formatPara(parseFloat(islemTutar) * seciliVeri.adet) : '0 ₺'}</div><button type="submit" style={{ width: '100%', background: 'green', color: 'white', padding: '10px', border: 'none', borderRadius: '5px' }}>ONAYLA</button><button type="button" onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '10px', background: '#eee', border: 'none', padding: '10px', borderRadius: '5px' }}>İptal</button></form>}

                    {/* HESAP DÜZENLE MODALI - GÜNCELLENDİ (TÜR SEÇİMİ EKLENDİ) */}
                    {aktifModal === 'duzenle_hesap' && <form onSubmit={hesapDuzenle}>
                        <h3>Düzenle</h3>
                        <input value={hesapAdi} onChange={e => setHesapAdi(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

                        {/* HESAP TÜRÜ SEÇİMİ EKLENDİ */}
                        <select value={hesapTipi} onChange={e => setHesapTipi(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }}>
                            <option value="nakit">Nakit</option>
                            <option value="krediKarti">Kart</option>
                            <option value="yatirim">Yatırım H.</option>
                        </select>

                        <input type="number" value={baslangicBakiye} onChange={e => setBaslangicBakiye(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

                        {/* KREDİ KARTI İSE KESİM GÜNÜNÜ GÖSTER */}
                        {hesapTipi === 'krediKarti' && <input type="number" placeholder="Kesim Günü (1-31)" value={hesapKesimGunu} onChange={e => setHesapKesimGunu(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }} />}

                        <button type="submit" style={{ width: '100%', background: 'blue', color: 'white', padding: '10px', border: 'none', borderRadius: '5px' }}>Kaydet</button>
                        <button type="button" onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '10px', background: '#eee', padding: '10px', borderRadius: '5px' }}>İptal</button>
                    </form>}

                    {/* AKILLI DÜZENLEME MODALI */}
                    {aktifModal === 'duzenle_islem' && <form onSubmit={islemDuzenle}><h3>Düzenle</h3><input value={islemAciklama} onChange={e => setIslemAciklama(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} /><input type="number" value={islemTutar} onChange={e => setIslemTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} /><input type="datetime-local" value={islemTarihi} onChange={e => setIslemTarihi(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

                        {/* EĞER YATIRIMSA YATIRIM TÜRLERİ, DEĞİLSE HARCAMA KATEGORİLERİ GÖSTER */}
                        {(seciliVeri.islemTipi.includes('yatirim')) ? (
                            <select value={kategori} onChange={e => setKategori(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }}>
                                {yatirimTurleri.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        ) : (
                            <select value={kategori} onChange={e => setKategori(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }}>
                                {kategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        )}

                        <button type="submit" style={{ width: '100%', background: 'blue', color: 'white', padding: '10px', borderRadius: '5px', border: 'none' }}>Kaydet</button><button type="button" onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '10px', background: '#eee', padding: '10px', borderRadius: '5px' }}>İptal</button></form>}

                    {aktifModal === 'duzenle_abonelik' && <form onSubmit={abonelikDuzenle}><h3>Sabit Gider Düzenle</h3><input value={aboAd} onChange={e => setAboAd(e.target.value)} placeholder="Gider Adı" style={{ ...inputStyle, marginBottom: '10px' }} /><input type="number" value={aboTutar} onChange={e => setAboTutar(e.target.value)} placeholder="Tutar" style={{ ...inputStyle, marginBottom: '10px' }} /><input type="number" value={aboGun} onChange={e => setAboGun(e.target.value)} placeholder="Gün (1-31)" style={{ ...inputStyle, marginBottom: '10px' }} /><select value={aboKategori} onChange={e => setAboKategori(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }}>{kategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}</select><select value={aboHesapId} onChange={e => setAboHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}><option value="">Hangi Hesaptan?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select><button type="submit" style={{ width: '100%', background: 'blue', color: 'white', padding: '10px', borderRadius: '5px', border: 'none' }}>Kaydet</button><button type="button" onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '10px', background: '#eee', padding: '10px', borderRadius: '5px' }}>İptal</button></form>}
                    {aktifModal === 'duzenle_taksit' && <form onSubmit={taksitDuzenle}><h3>Taksit Planını Düzenle</h3><input value={taksitBaslik} onChange={e => setTaksitBaslik(e.target.value)} placeholder="Ne aldın?" style={{ ...inputStyle, marginBottom: '10px' }} /><input type="number" value={taksitToplamTutar} onChange={e => setTaksitToplamTutar(e.target.value)} placeholder="Toplam Borç" style={{ ...inputStyle, marginBottom: '10px' }} /><input type="number" value={taksitSayisi} onChange={e => setTaksitSayisi(e.target.value)} placeholder="Taksit Sayısı" style={{ ...inputStyle, marginBottom: '10px' }} /><select value={taksitKategori} onChange={e => setTaksitKategori(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }}>{kategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}</select><select value={taksitHesapId} onChange={e => setTaksitHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }}><option value="">Hangi Karttan?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select><label style={{ fontSize: '12px' }}>Alış Tarihi:</label><input type="date" value={taksitAlisTarihi} onChange={e => setTaksitAlisTarihi(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }} /><div style={{ marginBottom: '15px', fontSize: '13px', color: 'blue' }}>Yeni Aylık Tutar: {taksitToplamTutar && taksitSayisi ? formatPara(taksitToplamTutar / taksitSayisi) : '0 ₺'}</div><button type="submit" style={{ width: '100%', background: 'blue', color: 'white', padding: '10px', borderRadius: '5px', border: 'none' }}>Kaydet</button><button type="button" onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '10px', background: '#eee', padding: '10px', borderRadius: '5px' }}>İptal</button></form>}
                    {aktifModal === 'duzenle_maas' && <form onSubmit={maasDuzenle}><h3>Maaş Düzenle</h3><input value={maasAd} onChange={e => setMaasAd(e.target.value)} placeholder="Maaş Adı (Örn: Baba Maaş)" style={{ ...inputStyle, marginBottom: '10px' }} /><input type="number" value={maasTutar} onChange={e => setMaasTutar(e.target.value)} placeholder="Tutar" style={{ ...inputStyle, marginBottom: '10px' }} /><input type="number" value={maasGun} onChange={e => setMaasGun(e.target.value)} placeholder="Yatma Günü (1-31)" style={{ ...inputStyle, marginBottom: '10px' }} /><select value={maasHesapId} onChange={e => setMaasHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}><option value="">Hangi Hesaba?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select><button type="submit" style={{ width: '100%', background: 'blue', color: 'white', padding: '10px', borderRadius: '5px', border: 'none' }}>Kaydet</button><button type="button" onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '10px', background: '#eee', padding: '10px', borderRadius: '5px' }}>İptal</button></form>}

                    {aktifModal === 'kredi_karti_ode' && <form onSubmit={krediKartiBorcOde}>
                        <h3>💳 Kredi Kartı Borcu Öde</h3>
                        {(() => {
                            const kart = hesaplar.find(h => h.id === kkOdemeKartId);
                            const borc = Math.abs(kart?.guncelBakiye || 0);
                            const asgari = borc * 0.20;
                            return (
                                <div style={{ marginBottom: '20px', padding: '10px', background: '#f3e8ff', borderRadius: '8px', color: '#333' }}>
                                    <p style={{ margin: 0 }}><strong>Kart:</strong> {kart?.hesapAdi}</p>
                                    <p style={{ margin: '5px 0' }}><strong>Güncel Borç:</strong> {formatPara(borc)}</p>
                                    <p style={{ margin: 0, color: '#6b46c1' }}><strong>Asgari (%20):</strong> {formatPara(asgari)}</p>
                                </div>
                            )
                        })()}
                        <select value={kkOdemeKaynakId} onChange={e => setKkOdemeKaynakId(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} required><option value="">Parayı Hangi Hesaptan Çekelim?</option>{hesaplar.filter(h => h.id !== kkOdemeKartId).map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatPara(h.guncelBakiye)})</option>)}</select>
                        <input type="number" placeholder="Ödenecek Tutar (₺)" value={kkOdemeTutar} onChange={e => setKkOdemeTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }} required />
                        <button type="submit" style={{ width: '100%', background: '#805ad5', color: 'white', padding: '10px', borderRadius: '5px', border: 'none', fontWeight: 'bold' }}>ÖDEMEYİ YAP</button>
                        <button type="button" onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '10px', background: '#eee', padding: '10px', borderRadius: '5px' }}>İptal</button>
                    </form>}

                    {/* FATURA ÖDEME MODALI (YENİ) */}
                    {aktifModal === 'fatura_ode' && <div style={{ textAlign: 'center' }}>
                        {(() => {
                            const tanim = tanimliFaturalar.find(t => t.id === seciliVeri.tanimId);
                            const ad = tanim ? tanim.baslik : "Fatura";
                            return (
                                <>
                                    <h3>🧾 Fatura Öde</h3>
                                    <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{ad}</p>
                                    <p style={{ color: '#c53030', fontSize: '20px', fontWeight: 'bold' }}>{formatPara(seciliVeri.tutar)}</p>
                                    <p style={{ fontSize: '13px', color: '#777' }}>Son Ödeme: {tarihSadeceGunAyYil(seciliVeri.sonOdemeTarihi)}</p>
                                </>
                            )
                        })()}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                            {hesaplar.map(h => (
                                <button key={h.id} onClick={() => faturaOde(seciliVeri, h.id)} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#333' }}>
                                    <span>{h.hesapAdi}</span>
                                    <span style={{ fontWeight: 'bold' }}>{formatPara(h.guncelBakiye)}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setAktifModal(null)} style={{ marginTop: '15px', padding: '10px', width: '100%', border: 'none', background: '#eee', borderRadius: '5px' }}>İptal</button>
                    </div>}

                    {/* BEKLEYEN FATURA DÜZENLEME MODALI (YENİ) */}
                    {aktifModal === 'duzenle_bekleyen_fatura' && <form onSubmit={bekleyenFaturaDuzenle}>
                        <h3>Faturayı Düzenle</h3>
                        <input type="number" value={faturaGirisTutar} onChange={e => setFaturaGirisTutar(e.target.value)} placeholder="Tutar" style={{ ...inputStyle, marginBottom: '10px' }} />
                        <input type="date" value={faturaGirisTarih} onChange={e => setFaturaGirisTarih(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />
                        <input value={faturaGirisAciklama} onChange={e => setFaturaGirisAciklama(e.target.value)} placeholder="Açıklama" style={{ ...inputStyle, marginBottom: '20px' }} />
                        <button type="submit" style={{ width: '100%', background: 'blue', color: 'white', padding: '10px', borderRadius: '5px', border: 'none' }}>Kaydet</button>
                        <button type="button" onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '10px', background: '#eee', padding: '10px', borderRadius: '5px' }}>İptal</button></form>}

                    {/* FATURA TANIM DÜZENLEME MODALI (YENİ) */}
                    {aktifModal === 'duzenle_fatura_tanim' && <form onSubmit={faturaTanimDuzenle}><h3>Fatura Tanımı Düzenle</h3><input value={tanimBaslik} onChange={e => setTanimBaslik(e.target.value)} placeholder="Başlık" style={{ ...inputStyle, marginBottom: '10px' }} /><input value={tanimKurum} onChange={e => setTanimKurum(e.target.value)} placeholder="Kurum" style={{ ...inputStyle, marginBottom: '10px' }} /><input value={tanimAboneNo} onChange={e => setTanimAboneNo(e.target.value)} placeholder="Abone No" style={{ ...inputStyle, marginBottom: '20px' }} /><button type="submit" style={{ width: '100%', background: 'blue', color: 'white', padding: '10px', borderRadius: '5px', border: 'none' }}>Kaydet</button><button type="button" onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '10px', background: '#eee', padding: '10px', borderRadius: '5px' }}>İptal</button></form>}

                    {aktifModal === 'ayarlar_yonetim' && <div><h3>⚙️ Ayarlar</h3>

                        <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '15px 0' }} />
                        <h4>📂 Bütçe Kategorileri</h4>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>{kategoriListesi.map(k => (<li key={k} style={{ background: '#f0fff4', padding: '5px 10px', borderRadius: '15px', fontSize: '13px' }}>{k} <span onClick={() => { if (window.confirm("Silinsin mi?")) { const y = kategoriListesi.filter(x => x !== k); setKategoriListesi(y); setDoc(doc(db, "ayarlar", alanKodu), { kategoriler: y }, { merge: true }); } }} style={{ color: 'red', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' }}>X</span></li>))}</ul>
                        <form onSubmit={(e) => { e.preventDefault(); if (!yeniKategoriAdi) return; const y = [...kategoriListesi, yeniKategoriAdi]; setKategoriListesi(y); setDoc(doc(db, "ayarlar", alanKodu), { kategoriler: y }, { merge: true }); setYeniKategoriAdi(""); toast.success("Kategori eklendi"); }} style={{ display: 'flex', gap: '5px', marginTop: '10px' }}><input value={yeniKategoriAdi} onChange={e => setYeniKategoriAdi(e.target.value)} placeholder="Yeni Kategori" style={{ flex: 1, ...inputStyle }} /><button type="submit" style={{ background: 'green', color: 'white', border: 'none', padding: '8px', borderRadius: '5px' }}>Ekle</button></form>

                        <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '15px 0' }} />
                        <h4>💎 Yatırım Türleri (Hisse, Fon vb.)</h4>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>{yatirimTurleri.map(k => (<li key={k} style={{ background: '#ebf8ff', padding: '5px 10px', borderRadius: '15px', fontSize: '13px' }}>{k} <span onClick={() => { if (window.confirm("Silinsin mi?")) { const y = yatirimTurleri.filter(x => x !== k); setYatirimTurleri(y); setDoc(doc(db, "ayarlar", alanKodu), { yatirimTurleri: y }, { merge: true }); } }} style={{ color: 'red', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' }}>X</span></li>))}</ul>
                        <form onSubmit={(e) => { e.preventDefault(); if (!yeniYatirimTuruAdi) return; const y = [...yatirimTurleri, yeniYatirimTuruAdi]; setYatirimTurleri(y); setDoc(doc(db, "ayarlar", alanKodu), { yatirimTurleri: y }, { merge: true }); setYeniYatirimTuruAdi(""); toast.success("Tür eklendi"); }} style={{ display: 'flex', gap: '5px', marginTop: '10px' }}><input value={yeniYatirimTuruAdi} onChange={e => setYeniYatirimTuruAdi(e.target.value)} placeholder="Yeni Tür (Fon, Coin...)" style={{ flex: 1, ...inputStyle }} /><button type="submit" style={{ background: '#3182ce', color: 'white', border: 'none', padding: '8px', borderRadius: '5px' }}>Ekle</button></form>

                        <div style={{ marginTop: '30px', padding: '15px', background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: '8px', color: '#7b341e' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#c05621' }}>🚚 Verileri Başka Koda Taşı</h4>
                            <p style={{ fontSize: '12px' }}>Şu anki kod: <b>{alanKodu}</b>. Tüm verilerini yeni bir koda taşımak için aşağıya yeni kodu yaz.</p>
                            <form onSubmit={verileriTasi} style={{ display: 'flex', gap: '5px' }}>
                                <input value={yeniKodInput} onChange={e => setYeniKodInput(e.target.value.toUpperCase())} placeholder="YENİ KOD" style={{ flex: 1, ...inputStyle, border: '1px solid #fbd38d' }} />
                                <button type="submit" disabled={tasimaIslemiSuruyor} style={{ background: '#c05621', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>{tasimaIslemiSuruyor ? 'Taşınıyor...' : 'TAŞI'}</button>
                            </form>
                        </div>

                        <button onClick={() => setAktifModal(null)} style={{ width: '100%', marginTop: '20px', padding: '10px', border: 'none', background: '#eee', borderRadius: '5px' }}>Kapat</button></div>}
                </div>
            </div>)}

            {/* --- HEADER & NAVİGASYON BİR ARADA --- */}
            <div style={{
                marginBottom: '25px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#ffffff',
                padding: '10px 20px',
                borderRadius: '16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}>

                {/* SOL: LOGO & KOD */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>Kişisel Finans</span>
                    </h1>
                    <span style={{ fontSize: '11px', background: '#edf2f7', padding: '4px 8px', borderRadius: '6px', color: '#718096', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {alanKodu}
                    </span>
                </div>

                {/* ORTA: NAVİGASYON BUTONLARI */}
                <div style={{ display: 'flex', background: '#edf2f7', padding: '4px', borderRadius: '12px' }}>
                    <button
                        onClick={() => setAnaSekme("butcem")}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            transition: 'all 0.2s',
                            outline: 'none', // <--- BU SATIR EKLENDİ (Siyah çerçeveyi kaldırır)
                            background: anaSekme === "butcem" ? '#ffffff' : 'transparent',
                            color: anaSekme === "butcem" ? '#2b6cb0' : '#718096',
                            boxShadow: anaSekme === "butcem" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}>
                        📊 Bütçem
                    </button>
                    <button
                        onClick={() => setAnaSekme("yatirimlar")}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            transition: 'all 0.2s',
                            outline: 'none', // <--- BU SATIR EKLENDİ (Siyah çerçeveyi kaldırır)
                            background: anaSekme === "yatirimlar" ? '#ffffff' : 'transparent',
                            color: anaSekme === "yatirimlar" ? '#2f855a' : '#718096',
                            boxShadow: anaSekme === "yatirimlar" ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}>
                        💎 Yatırımlarım
                    </button>
                </div>

                {/* SAĞ: KULLANICI KONTROLLERİ */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => setGizliMod(!gizliMod)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '5px', outline: 'none' }}>
                        {gizliMod ? '🙈' : '👁️'}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', marginRight: '5px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#2d3748' }}>{user?.displayName?.split(' ')[0]}</span>
                    </div>

                    <button onClick={() => setAktifModal('ayarlar_yonetim')} style={{ background: '#edf2f7', color: '#4a5568', border: 'none', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', outline: 'none' }}>⚙️</button>
                    <button onClick={koddanCikis} style={{ background: '#edf2f7', color: '#4a5568', border: 'none', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', outline: 'none' }}>🔑</button>
                    <button onClick={cikisYap} style={{ background: '#fee2e2', color: '#c53030', border: 'none', width: '35px', height: '35px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', outline: 'none' }}>🚪</button>
                </div>
            </div>

            {/* BİLDİRİM ALANI */}
            {bildirimler.length > 0 && (
                <div style={{ marginBottom: '30px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '10px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4 style={{ margin: 0, color: '#c53030', display: 'flex', alignItems: 'center', gap: '5px' }}>⚠️ Bekleyen İşlemler</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                        {bildirimler.map((b, i) => (
                            <div key={i} style={{ ...cardStyle, padding: '10px', borderRadius: '8px', borderLeft: `4px solid ${b.renk === 'green' ? '#48bb78' : b.renk === 'orange' ? '#ed8936' : '#fc8181'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748' }}>{b.mesaj}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: 'bold', color: b.renk === 'green' ? '#48bb78' : b.renk === 'orange' ? '#ed8936' : '#e53e3e' }}>{formatPara(b.tutar)}</span>
                                    {b.tip !== 'kk_hatirlatma' && <button onClick={() => {
                                        if (b.tip === 'abonelik') abonelikOde(b.data);
                                        if (b.tip === 'taksit') taksitOde(b.data);
                                        if (b.tip === 'maas') maasYatir(b.data);
                                        if (b.tip === 'fatura') modalAc('fatura_ode', b.data);
                                    }} style={{ background: b.renk === 'green' ? '#48bb78' : '#c53030', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>{b.tip === 'maas' ? 'Yatır' : 'Öde'}</button>}
                                    {b.tip === 'kk_hatirlatma' && <button onClick={() => modalAc('kredi_karti_ode', b.data)} style={{ background: '#ed8936', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Öde</button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- ANA İÇERİK: BÜTÇEM SEKMESİ --- */}
            {anaSekme === "butcem" && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '25px', marginBottom: '30px' }}>

                        {/* 1. SATIR: KARTLAR */}
                        <div style={{ ...cardStyle, borderLeft: '5px solid #48bb78' }}>
                            <h3 style={{ margin: 0, color: '#888', fontSize: '11px', letterSpacing: '1px' }}>TOPLAM GELİR ({aktifAy})</h3>
                            <h1 style={{ fontSize: '26px', margin: '10px 0', color: '#333' }}>{formatPara(toplamGelir)}</h1>
                        </div>
                        <div style={{ ...cardStyle, borderLeft: '5px solid #F59E0B' }}>
                            <span style={{ color: '#888', fontSize: '11px', letterSpacing: '1px' }}>BUGÜN HARCANAN</span>
                            <h2 style={{ color: '#333', margin: '10px 0', fontSize: '26px' }}>{formatPara(bugunGider)}</h2>
                        </div>
                        <div style={{ ...cardStyle, borderLeft: '5px solid #f56565' }}>
                            <span style={{ color: '#888', fontSize: '11px', letterSpacing: '1px' }}>GİDER ({aktifAy})</span>
                            <h2 style={{ color: '#333', margin: '10px 0', fontSize: '24px' }}>{formatPara(toplamGider)}</h2>
                        </div>

                        {/* 2. SATIR: GRAFİK (2 Sütun) ve PASTA (1 Sütun) */}
                        <div style={{ ...cardStyle, gridColumn: 'span 2', minHeight: '300px' }}>
                            <h4 style={{ margin: '0 0 20px 0', color: '#2d3748' }}>📅 Günlük Harcama Trendi ({aktifAy})</h4>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={gunlukVeri}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(val) => `${val} ₺`} />
                                    <Bar dataKey="value" fill="#8884d8" radius={[5, 5, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            {aktifAy !== "Tümü" && (
                                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '13px', color: '#718096', fontStyle: 'italic' }}>
                                    ✨ Bu ay günlük ortalama harcamanız: <span style={{ fontWeight: 'bold', color: '#2d3748' }}>{formatPara(gunlukOrtalama)}</span>
                                </div>
                            )}
                        </div>

                        <div style={{ ...cardStyle, gridColumn: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <h4 style={{ color: '#2d3748', marginBottom: '10px' }}>Kategori Dağılımı</h4>
                            <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={kategoriVerisi} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name }) => name.substring(0, 10)}>{kategoriVerisi.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip formatter={(value) => formatPara(value)} /></PieChart></ResponsiveContainer>
                        </div>
                    </div>

                    {/* --- ALT BÖLÜM (FORMLAR VE LİSTE) --- */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px' }}>

                        {/* SOL SÜTUN */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            {/* LİMİT */}
                            <div style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: 0, color: '#2d3748' }}>🎯 Aylık Bütçe Limiti</h4>
                                    <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}><input type="number" value={aylikLimit} onChange={(e) => { setAylikLimit(e.target.value); setDoc(doc(db, "ayarlar", alanKodu), { limit: e.target.value }, { merge: true }); }} style={{ width: '70px', border: '1px solid #ddd', borderRadius: '5px', padding: '2px', background: 'white', color: '#333' }} /></div>
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px', fontWeight: 'bold' }}><span style={{ color: limitRenk }}>Harcanan: {formatPara(harcananLimit)}</span><span>{limitYuzdesi.toFixed(0)}%</span></div>
                                    <div style={{ width: '100%', height: '15px', background: '#edf2f7', borderRadius: '10px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}><div style={{ width: `${limitYuzdesi}%`, height: '100%', background: limitRenk, transition: 'width 0.5s', borderRadius: '10px' }}></div></div>
                                </div>
                            </div>

                            {/* MAAŞ MODÜLÜ */}
                            <div style={cardStyle}>
                                <h4 style={{ marginTop: 0, marginBottom: '15px', color: '#2d3748' }}>💰 Maaşlar & Gelirler</h4>
                                <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '15px' }}>
                                    {maaslar.map(m => {
                                        const hesap = hesaplar.find(h => h.id === m.hesapId);
                                        return (
                                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                                                <div><div style={{ fontWeight: 'bold' }}>{m.ad}</div><div style={{ fontSize: '11px', color: '#999' }}>Her ayın {m.gun}. günü • {hesap?.hesapAdi}</div></div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span style={{ color: 'green', fontWeight: 'bold' }}>{formatPara(m.tutar)}</span>
                                                    <span onClick={() => modalAc('duzenle_maas', m)} style={{ cursor: 'pointer', fontSize: '12px', marginLeft: '5px' }}>✏️</span>
                                                    <span onClick={() => normalSil("maaslar", m.id)} style={{ cursor: 'pointer', color: 'red', fontSize: '12px' }}>🗑️</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <form onSubmit={maasEkle} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input placeholder="Gelir Adı (Maaş vb.)" value={maasAd} onChange={e => setMaasAd(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
                                        <input placeholder="Tutar" type="number" value={maasTutar} onChange={e => setMaasTutar(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input placeholder="Gün" type="number" value={maasGun} onChange={e => setMaasGun(e.target.value)} style={{ ...inputStyle, width: '70px', flex: 'none', textAlign: 'center' }} />
                                        <select value={maasHesapId} onChange={e => setMaasHesapId(e.target.value)} style={{ ...inputStyle, flex: 1 }}><option value="">Hesap Seç</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select>
                                        <button type="submit" style={{ background: '#48bb78', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '0 15px', fontWeight: 'bold' }}>+</button>
                                    </div>
                                </form>
                            </div>

                            {/* HESAPLAR */}
                            <div style={cardStyle}>
                                <h4 style={{ marginTop: 0, marginBottom: '15px', color: '#2d3748' }}>Hesaplar & Kartlar</h4>
                                <div style={{ marginBottom: '15px' }}>
                                    {hesaplar.map(h => {
                                        let toplamBakiye = parseFloat(h.guncelBakiye) || 0;
                                        let aylikFark = 0;
                                        filtrelenmisIslemler.forEach(i => {
                                            if (i.hesapId === h.id) {
                                                if (i.islemTipi === 'gelir') aylikFark += i.tutar;
                                                if (i.islemTipi === 'gider') aylikFark -= i.tutar;
                                            }
                                            if (i.islemTipi === 'transfer') {
                                                if (i.kaynakId === h.id) aylikFark -= i.tutar;
                                                if (i.hedefId === h.id) aylikFark += i.tutar;
                                            }
                                        });

                                        return (
                                            <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                                                <div>
                                                    <b>{h.hesapAdi}</b> <small style={{ color: '#aaa' }}>({h.hesapTipi})</small>
                                                    {h.hesapTipi === 'yatirim' && <span style={{ fontSize: '10px', marginLeft: '5px' }}>📈</span>}
                                                    <span onClick={() => modalAc('duzenle_hesap', h)} style={{ fontSize: '10px', cursor: 'pointer', marginLeft: '5px', color: 'blue' }}>✏️</span>
                                                    {aktifAy !== "Tümü" && <div style={{ fontSize: '10px', color: '#aaa' }}>Bu ay: {aylikFark > 0 ? '+' : ''}{formatPara(aylikFark)}</div>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                    <span style={{ color: toplamBakiye < 0 ? 'red' : 'green', fontWeight: '600', fontSize: '15px' }}>{formatPara(toplamBakiye)}</span>
                                                    {h.hesapTipi === 'krediKarti' && <button onClick={() => modalAc('kredi_karti_ode', h)} style={{ background: '#805ad5', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', marginLeft: '5px' }}>Borç Öde</button>}
                                                    <span onClick={() => normalSil("hesaplar", h.id)} style={{ cursor: 'pointer', color: 'red', fontSize: '12px' }}>🗑️</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee', textAlign: 'right', fontSize: '14px' }}>
                                    <div style={{ color: '#666' }}>Nakit Varlık: <b>{formatPara(sadeceCuzdanNakiti)}</b></div>
                                    <div style={{ color: '#666' }}>+ Portföy/Yatırım: <b>{formatPara(genelToplamYatirimGucu)}</b></div>
                                    <div style={{ color: '#2d3748', fontSize: '16px', marginTop: '5px' }}>NET VARLIK: <b style={{ color: netVarlik >= 0 ? 'green' : 'red' }}>{formatPara(netVarlik)}</b></div>
                                </div>
                                <form onSubmit={hesapEkle} style={{ display: 'flex', gap: '8px', marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                                    <input placeholder="Ad" value={hesapAdi} onChange={e => setHesapAdi(e.target.value)} style={{ flex: 2, ...inputStyle }} />
                                    <select value={hesapTipi} onChange={e => setHesapTipi(e.target.value)} style={{ flex: 1, ...inputStyle }}><option value="nakit">Nakit</option><option value="krediKarti">Kart</option><option value="yatirim">Yatırım H.</option></select>
                                    <input placeholder="Bakiye" type="number" value={baslangicBakiye} onChange={e => setBaslangicBakiye(e.target.value)} style={{ flex: 1, ...inputStyle }} />
                                    <button type="submit" style={{ background: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '0 15px', fontWeight: 'bold' }}>+</button>
                                </form>
                            </div>

                            {/* FATURALAR (YENİ MODÜL) */}
                            <div style={cardStyle}>
                                <h4 style={{ marginTop: 0, marginBottom: '15px', color: '#2d3748' }}>🧾 Faturalar & Abonelikler</h4>
                                <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '15px' }}>
                                    {/* Faturalar */}
                                    {tanimliFaturalar.map(tanim => {
                                        const bekleyen = bekleyenFaturalar.find(f => f.tanimId === tanim.id);
                                        return (
                                            <div key={tanim.id} style={{ marginBottom: '10px', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden' }}>
                                                <div style={{ padding: '10px', background: '#f7fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#2d3748' }}>{tanim.baslik}</div>
                                                        <div style={{ fontSize: '10px', color: '#718096' }}>
                                                            {tanim.kurum} {tanim.aboneNo ? `• ${tanim.aboneNo}` : ''}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '5px' }}>
                                                        <span onClick={() => modalAc('duzenle_fatura_tanim', tanim)} style={{ cursor: 'pointer', fontSize: '12px' }}>✏️</span>
                                                        <span onClick={() => normalSil("fatura_tanimlari", tanim.id)} style={{ cursor: 'pointer', fontSize: '12px', color: '#e53e3e' }}>🗑️</span>
                                                    </div>
                                                </div>
                                                {bekleyen ? (
                                                    <div style={{ padding: '8px', background: '#fff5f5', borderTop: '1px solid #feb2b2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div><div style={{ fontWeight: 'bold', color: '#c53030', fontSize: '13px' }}>{formatPara(bekleyen.tutar)}</div><div style={{ fontSize: '10px', color: '#c53030' }}>Son: {tarihSadeceGunAyYil(bekleyen.sonOdemeTarihi)}</div></div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <span onClick={() => modalAc('duzenle_bekleyen_fatura', bekleyen)} style={{ cursor: 'pointer', fontSize: '12px' }}>✏️</span>
                                                            <button onClick={() => modalAc('fatura_ode', bekleyen)} style={{ background: '#c53030', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>ÖDE</button>
                                                        </div>
                                                    </div>
                                                ) : (<div style={{ padding: '5px', fontSize: '10px', color: '#ccc', textAlign: 'center' }}>Bekleyen yok</div>)}
                                            </div>
                                        )
                                    })}
                                </div>
                                <form onSubmit={faturaTanimEkle} style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                                    <p style={{ fontSize: '11px', color: '#718096', marginBottom: '5px' }}>Yeni Fatura Tanımı Ekle:</p>
                                    <input placeholder="Başlık (Ev İnternet)" value={tanimBaslik} onChange={e => setTanimBaslik(e.target.value)} style={{ ...inputStyle, padding: '8px', marginBottom: '5px' }} required />
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input placeholder="Kurum" value={tanimKurum} onChange={e => setTanimKurum(e.target.value)} style={{ ...inputStyle, padding: '8px' }} />
                                        <input placeholder="Abone No" value={tanimAboneNo} onChange={e => setTanimAboneNo(e.target.value)} style={{ ...inputStyle, padding: '8px' }} />
                                    </div>
                                    <button type="submit" style={{ width: '100%', marginTop: '5px', background: '#4a5568', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>Tanımla</button>
                                </form>
                            </div>

                            {/* TAKSİTLER */}
                            <div style={cardStyle}>
                                <h4 style={{ marginTop: 0, marginBottom: '15px', color: '#2d3748' }}>📦 Taksitli Alışverişler</h4>
                                {taksitler.length === 0 ? <p style={{ fontSize: '13px', color: '#aaa' }}>Aktif taksit borcu yok.</p> :
                                    <div style={{ marginBottom: '15px' }}>
                                        {taksitler.map(t => {
                                            const yuzde = (t.odenmisTaksit / t.taksitSayisi) * 100;
                                            return (
                                                <div key={t.id} style={{ padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                        <div><b>{t.baslik}</b><div style={{ fontSize: '10px', color: '#999' }}>{t.kategori}</div></div>
                                                        <span style={{ fontWeight: 'bold' }}>{formatPara(t.toplamTutar - (t.aylikTutar * t.odenmisTaksit))} <small style={{ color: '#999' }}>Kaldı</small></span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#666', marginBottom: '5px' }}>
                                                        <span>{t.odenmisTaksit}/{t.taksitSayisi} Ödendi</span>
                                                        <span>Aylık: {formatPara(t.aylikTutar)}</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', marginBottom: '10px' }}><div style={{ width: `${yuzde}%`, height: '100%', background: '#805ad5', borderRadius: '4px', transition: 'width 0.5s' }}></div></div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <button onClick={() => taksitOde(t)} style={{ background: '#805ad5', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Bu Ayı İşle ({formatPara(t.aylikTutar)})</button>
                                                        <span onClick={() => modalAc('duzenle_taksit', t)} style={{ cursor: 'pointer', marginLeft: '10px' }}>✏️</span>
                                                        <span onClick={() => normalSil("taksitler", t.id)} style={{ cursor: 'pointer', marginLeft: '10px' }}>🗑️</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                }
                                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: '#718096' }}>Kalan Toplam Borç: <b style={{ color: '#e53e3e' }}>{formatPara(toplamKalanTaksitBorcu)}</b></span>
                                </div>
                            </div>

                            {/* ABONELİKLER */}
                            <div style={cardStyle}>
                                <h4 style={{ marginTop: 0, marginBottom: '15px', color: '#2d3748' }}>🔄 Sabit Giderler</h4>
                                <div style={{ marginBottom: '15px' }}>
                                    {abonelikler.map(abo => {
                                        const hesap = hesaplar.find(h => h.id === abo.hesapId);
                                        return (
                                            <div key={abo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                                                <div><div style={{ fontWeight: 'bold' }}>{abo.ad}</div><div style={{ fontSize: '11px', color: '#999' }}>{abo.gun}. gün • {abo.kategori} • {hesap?.hesapAdi}</div></div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ fontWeight: 'bold', color: '#e53e3e' }}>{formatPara(abo.tutar)}</div>
                                                    <button onClick={() => abonelikOde(abo)} style={{ background: '#e2e8f0', color: '#333', fontWeight: 'bold', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: '5px', fontSize: '12px' }}>Öde</button>
                                                    <span onClick={() => modalAc('duzenle_abonelik', abo)} style={{ cursor: 'pointer', fontSize: '12px' }}>✏️</span>
                                                    <span onClick={() => normalSil("abonelikler", abo.id)} style={{ cursor: 'pointer', fontSize: '12px' }}>🗑️</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee', textAlign: 'right', fontSize: '13px' }}>
                                    <span style={{ color: '#718096' }}>Aylık Sabit Gider: <b style={{ color: '#e53e3e' }}>{formatPara(toplamSabitGider)}</b></span>
                                </div>
                                <form onSubmit={abonelikEkle} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '15px' }}>
                                    <input placeholder="Ad" value={aboAd} onChange={e => setAboAd(e.target.value)} style={{ ...inputStyle }} />
                                    <input placeholder="Tutar" type="number" value={aboTutar} onChange={e => setAboTutar(e.target.value)} style={{ ...inputStyle }} />
                                    <input placeholder="Gün" type="number" value={aboGun} onChange={e => setAboGun(e.target.value)} style={{ ...inputStyle }} />
                                    <select value={aboKategori} onChange={e => setAboKategori(e.target.value)} style={{ gridColumn: 'span 3', ...inputStyle }}>{kategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}</select>
                                    <select value={aboHesapId} onChange={e => setAboHesapId(e.target.value)} style={{ gridColumn: 'span 3', ...inputStyle }}><option value="">Hangi Hesaptan?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select>
                                    <button type="submit" style={{ gridColumn: 'span 3', background: '#805ad5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '10px', fontWeight: 'bold' }}>EKLE</button>
                                </form>
                            </div>
                        </div>

                        {/* --- SAĞ SÜTUN (İKİ AYRI KART) --- */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

                            {/* 1. KART: VERİ GİRİŞ FORMLARI */}
                            <div style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        <button onClick={() => setFormTab("islem")} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: formTab === "islem" ? '#ed8936' : '#edf2f7', color: formTab === "islem" ? 'white' : '#4a5568', fontWeight: 'bold', fontSize: '12px' }}>İşlem</button>
                                        <button onClick={() => setFormTab("transfer")} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: formTab === "transfer" ? '#3182ce' : '#edf2f7', color: formTab === "transfer" ? 'white' : '#4a5568', fontWeight: 'bold', fontSize: '12px' }}>Transfer</button>
                                        <button onClick={() => setFormTab("taksit")} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: formTab === "taksit" ? '#805ad5' : '#edf2f7', color: formTab === "taksit" ? 'white' : '#4a5568', fontWeight: 'bold', fontSize: '12px' }}>Taksit</button>
                                        <button onClick={() => setFormTab("fatura")} style={{ padding: '8px 15px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: formTab === "fatura" ? '#c53030' : '#edf2f7', color: formTab === "fatura" ? 'white' : '#4a5568', fontWeight: 'bold', fontSize: '12px' }}>Fatura</button>
                                    </div>
                                </div>

                                {formTab === "islem" && (
                                    <form onSubmit={islemEkle} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <select value={secilenHesapId} onChange={e => setSecilenHesapId(e.target.value)} style={{ flex: 1, ...inputStyle, backgroundColor: '#f7fafc' }}><option value="">Hangi Hesaptan?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({h.guncelBakiye}₺)</option>)}</select>
                                            <select value={islemTipi} onChange={e => setIslemTipi(e.target.value)} style={{ flex: 1, ...inputStyle }}><option value="gider">🔴 Gider</option><option value="gelir">🟢 Gelir</option></select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <select value={kategori || kategoriListesi[0]} onChange={e => setKategori(e.target.value)} style={{ flex: 1, ...inputStyle }}>{kategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}</select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input placeholder="Açıklama" value={islemAciklama} onChange={e => setIslemAciklama(e.target.value)} style={{ flex: 1, ...inputStyle }} />
                                            <input type="number" placeholder="Tutar (₺)" value={islemTutar} onChange={e => setIslemTutar(e.target.value)} style={{ flex: 1, ...inputStyle }} />
                                        </div>
                                        <input type="datetime-local" value={islemTarihi} onChange={e => setIslemTarihi(e.target.value)} style={{ ...inputStyle }} />
                                        <button type="submit" style={{ padding: '15px', background: '#ed8936', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>KAYDET</button>
                                    </form>
                                )}

                                {formTab === "transfer" && (
                                    <form onSubmit={transferYap} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: '#ebf8ff', padding: '20px', borderRadius: '10px' }}>
                                        <div><label style={{ fontSize: '12px', color: '#2b6cb0' }}>Nereden?</label><select value={transferKaynakId} onChange={e => setTransferKaynakId(e.target.value)} style={{ ...inputStyle }}><option value="">Seçiniz...</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({h.guncelBakiye}₺)</option>)}</select></div>
                                        <div><label style={{ fontSize: '12px', color: '#2b6cb0' }}>Nereye?</label><select value={transferHedefId} onChange={e => setTransferHedefId(e.target.value)} style={{ ...inputStyle }}><option value="">Seçiniz...</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({h.guncelBakiye}₺)</option>)}</select></div>
                                        <input type="number" placeholder="Tutar (₺)" value={transferTutar} onChange={e => setTransferTutar(e.target.value)} style={{ gridColumn: 'span 2', ...inputStyle }} />
                                        <button type="submit" style={{ gridColumn: 'span 2', padding: '15px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>TRANSFER YAP / BORÇ ÖDE</button>
                                    </form>
                                )}

                                {formTab === "taksit" && (
                                    <form onSubmit={taksitEkle} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: '#f3e8ff', padding: '20px', borderRadius: '10px' }}>
                                        <div style={{ gridColumn: 'span 2' }}><h4 style={{ margin: '0 0 10px 0', color: '#6b46c1' }}>📦 Yeni Taksit Planı Oluştur</h4></div>
                                        <input placeholder="Ne aldın?" value={taksitBaslik} onChange={e => setTaksitBaslik(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} required />
                                        <select value={taksitHesapId} onChange={e => setTaksitHesapId(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} required><option value="">Hangi Karttan?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select>
                                        <input type="number" placeholder="Toplam Borç (₺)" value={taksitToplamTutar} onChange={e => setTaksitToplamTutar(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} required />
                                        <input type="number" placeholder="Kaç Taksit?" value={taksitSayisi} onChange={e => setTaksitSayisi(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} required />
                                        <select value={taksitKategori || kategoriListesi[0]} onChange={e => setTaksitKategori(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }}>{kategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}</select>
                                        <div style={{ gridColumn: 'span 2' }}><label style={{ fontSize: '12px', color: '#6b46c1' }}>Alış Tarihi</label><input type="date" value={taksitAlisTarihi} onChange={e => setTaksitAlisTarihi(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} /></div>
                                        <div style={{ gridColumn: 'span 2', fontSize: '14px', color: '#553c9a', fontWeight: 'bold', padding: '10px', background: 'white', borderRadius: '8px' }}>ℹ️ Aylık: {taksitToplamTutar && taksitSayisi ? formatPara(taksitToplamTutar / taksitSayisi) : '0,00 ₺'}</div>
                                        <button type="submit" style={{ gridColumn: 'span 2', padding: '15px', background: '#805ad5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>KAYDET</button>
                                    </form>
                                )}

                                {formTab === "fatura" && (
                                    <div style={{ background: '#fff5f5', padding: '20px', borderRadius: '10px' }}>
                                        <h4 style={{ margin: '0 0 15px 0', color: '#c53030' }}>🧾 Dönemsel Fatura Tutarı Gir</h4>
                                        {tanimliFaturalar.length === 0 ? (
                                            <div style={{ textAlign: 'center', color: '#c53030', padding: '10px', fontSize: '13px' }}>
                                                ⚠️ Önce sol taraftaki panelden bir fatura/abone tanımı eklemelisiniz.
                                            </div>
                                        ) : (
                                            <form onSubmit={faturaGir} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <select value={secilenTanimId} onChange={e => setSecilenTanimId(e.target.value)} style={{ ...inputStyle, border: '1px solid #feb2b2' }} required>
                                                        <option value="">Hangi Fatura?</option>
                                                        {tanimliFaturalar.map(t => <option key={t.id} value={t.id}>{t.baslik} ({t.kurum})</option>)}
                                                    </select>
                                                </div>
                                                <input type="number" placeholder="Tutar (₺)" value={faturaGirisTutar} onChange={e => setFaturaGirisTutar(e.target.value)} style={{ ...inputStyle, border: '1px solid #feb2b2' }} required />
                                                <input type="date" value={faturaGirisTarih} onChange={e => setFaturaGirisTarih(e.target.value)} style={{ ...inputStyle, border: '1px solid #feb2b2' }} required />
                                                <input placeholder="Açıklama (Opsiyonel)" value={faturaGirisAciklama} onChange={e => setFaturaGirisAciklama(e.target.value)} style={{ gridColumn: 'span 2', ...inputStyle, border: '1px solid #feb2b2' }} />
                                                <button type="submit" style={{ gridColumn: 'span 2', padding: '15px', background: '#c53030', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>KAYDET</button>
                                            </form>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. KART: GEÇMİŞ LİSTESİ VE TABLO */}
                            <div style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                                    <h4 style={{ marginTop: 0, color: '#2c3e50', margin: 0 }}>📜 Harcama Geçmişi</h4>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                        {mevcutAylar.map(ay => (
                                            <button key={ay} onClick={() => setAktifAy(ay)} style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '15px', border: 'none', cursor: 'pointer', background: aktifAy === ay ? '#2c3e50' : '#edf2f7', color: aktifAy === ay ? 'white' : '#4a5568', fontWeight: 'bold' }}>{ay}</button>
                                        ))}
                                    </div>
                                </div>

                                {/* YENİ FİLTRE ALANI */}
                                <div style={{ background: '#f7fafc', padding: '15px', borderRadius: '10px', marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid #edf2f7' }}>
                                    <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 10px' }}>
                                        <span style={{ fontSize: '16px' }}>🔍</span>
                                        <input
                                            type="text"
                                            placeholder="Harcama, market, tutar ara..."
                                            value={aramaMetni}
                                            onChange={(e) => setAramaMetni(e.target.value)}
                                            style={{ border: 'none', outline: 'none', padding: '10px', width: '100%', fontSize: '13px', background: 'transparent', color: '#333' }}
                                        />
                                        {aramaMetni && <span onClick={() => setAramaMetni("")} style={{ cursor: 'pointer', color: '#aaa', fontWeight: 'bold' }}>X</span>}
                                    </div>
                                    <select
                                        value={filtreKategori}
                                        onChange={e => setFiltreKategori(e.target.value)}
                                        style={{ flex: 1, minWidth: '120px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '13px', backgroundColor: '#ffffff', color: '#333' }}
                                    >
                                        <option value="Tümü">Tüm Kategoriler</option>
                                        {kategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}
                                        <option value="Transfer">Transfer</option>
                                    </select>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <button onClick={excelIndir} style={{ background: '#276749', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>📥 XLS</button>
                                        <label style={{ background: '#2b6cb0', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>📤 Yükle <input type="file" accept=".xlsx,.xls,.csv" onChange={excelYukle} style={{ display: 'none' }} /></label>
                                    </div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', color: '#333' }}>
                                    <thead><tr style={{ textAlign: 'left', color: '#718096', borderBottom: '2px solid #e2e8f0' }}><th style={{ padding: '10px' }}>Tarih</th><th style={{ padding: '10px' }}>Hesap</th><th style={{ padding: '10px' }}>Kategori</th><th style={{ padding: '10px' }}>Açıklama</th><th style={{ padding: '10px' }}>Tutar</th><th></th><th></th></tr></thead>
                                    <tbody>
                                        {filtrelenmisIslemler.map(i => {
                                            const hesap = hesaplar.find(h => h.id === i.hesapId);
                                            let hesapAdi = hesap?.hesapAdi || "Bilinmeyen";
                                            let renk = 'black';
                                            if (i.islemTipi === 'transfer') {
                                                const kaynak = hesaplar.find(h => h.id === i.kaynakId)?.hesapAdi;
                                                const hedef = hesaplar.find(h => h.id === i.hedefId)?.hesapAdi;
                                                hesapAdi = `${kaynak} ➝ ${hedef}`;
                                                renk = '#3182ce';
                                            } else if (i.islemTipi === 'gelir' || i.islemTipi === 'yatirim_satis') {
                                                renk = 'green';
                                            } else {
                                                renk = '#e53e3e';
                                            }

                                            return (
                                                <tr key={i.id} style={{ borderBottom: '1px solid #f7fafc' }}>
                                                    <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', color: '#718096', cursor: 'pointer' }}>{tarihFormatla(i.tarih)}</td>
                                                    <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>{hesapAdi}</td>
                                                    <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', cursor: 'pointer' }}>{i.kategori}</td>
                                                    <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', cursor: 'pointer' }}>{i.aciklama}</td>
                                                    <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', fontWeight: 'bold', color: renk, cursor: 'pointer' }}>{formatPara(i.tutar)}</td>
                                                    <td><span onClick={() => modalAc('duzenle_islem', i)} style={{ cursor: 'pointer' }}>✏️</span></td>
                                                    <td><span onClick={() => islemSil(i.id)} style={{ cursor: 'pointer' }}>🗑️</span></td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>

                                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #f0f0f0', textAlign: 'right', color: '#2d3748', fontSize: '16px', fontWeight: 'bold' }}>
                                    Net Nakit Akışı ({aktifAy}): <span style={{ color: (toplamGelir - toplamGider) >= 0 ? 'green' : '#e53e3e' }}>{formatPara(toplamGelir - toplamGider)}</span>
                                </div>

                                <footer style={{ textAlign: 'center', marginTop: '30px', padding: '10px', color: '#a0aec0', fontSize: '12px' }}>
                                    <p style={{ margin: 0, fontWeight: 'bold' }}>MUNDAN BİLİŞİM</p>
                                    <p style={{ margin: 0 }}>v8.0 (Nakit Ayrımı Fix)</p>
                                </footer>
                            </div>

                        </div>
                    </div>
                </>
            )}

            {/* --- YATIRIMLAR SEKMESİ --- */}
            {anaSekme === "yatirimlar" && (
                <div>
                    {/* 1. SATIR: İKİ AYRI KART DÜZENİ (Aşağıdaki satırla aynı hizada) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', marginBottom: '30px' }}>

                        {/* SOL KART: TOPLAM ÖZET */}
                        <div style={{ ...cardStyle, padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <h3 style={{ margin: 0, color: '#2d3748', textTransform: 'uppercase', fontSize: '18px', fontWeight: '800', letterSpacing: '0.5px' }}>
                                TOPLAM YATIRIM VARLIĞI
                            </h3>
                            <div style={{ fontSize: '13px', color: '#718096', marginTop: '5px' }}>Portföy + Yatırım Hesabı Bakiyesi</div>

                            <h1 style={{ fontSize: '48px', margin: '20px 0', fontWeight: '800', color: '#1a202c', letterSpacing: '-2px' }}>
                                {formatPara(genelToplamYatirimGucu)}
                            </h1>

                            {/* Alt Bilgi Çubuğu */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '25px', fontSize: '14px', color: '#4a5568', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #edf2f7' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3182ce' }}></div>
                                    <span>Hisse: <b>{formatPara(kartYatirimToplami)}</b></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#38a169' }}></div>
                                    <span>Döviz: <b>{formatPara(toplamDovizVarligi)}</b></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#805ad5' }}></div>
                                    <span>BES: <b>{formatPara(toplamBesVarligi)}</b></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#dd6b20' }}></div>
                                    <span>Nakit: <b>{formatPara(kartNakitToplami)}</b></span>
                                </div>
                            </div>
                        </div>

                        {/* SAĞ KART: GENEL DAĞILIM GRAFİĞİ */}
                        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '280px' }}>
                            <h4 style={{ color: '#2d3748', marginBottom: '20px' }}>Genel Dağılım</h4>
                            {genelToplamYatirimGucu > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie
                                            data={genelVarlikVerisi}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={85}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                            // LABEL ÖZELLİĞİ EKLENDİ (Yazılar Çıksın Diye)
                                            label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`}
                                        >
                                            {genelVarlikVerisi.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS_GENEL[index % COLORS_GENEL.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) => gizliMod ? "****" : formatPara(value)}
                                            contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ color: '#cbd5e0', fontSize: '13px' }}>Veri Yok</div>
                            )}
                        </div>

                    </div>

                    {/* 2. SATIR: TABLO VE GRAFİK */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', marginBottom: '30px' }}>

                        {/* SOL: PORTFÖY TABLOSU */}
                        <div style={cardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h4 style={{ margin: 0, color: '#2d3748' }}>💎 Portföy Detayları</h4>
                                    <span style={{ fontSize: '12px', color: toplamKarZarar >= 0 ? 'green' : 'red', fontWeight: 'bold', background: toplamKarZarar >= 0 ? '#f0fff4' : '#fff5f5', padding: '2px 8px', borderRadius: '10px' }}>(K/Z: {toplamKarZarar > 0 ? '+' : ''}{formatPara(toplamKarZarar)})</span>
                                </div>
                                <button onClick={piyasalariGuncelle} disabled={guncelleniyor} style={{ background: '#3182ce', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '15px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    {guncelleniyor ? 'Güncelleniyor...' : '🔄 Fiyatları Güncelle'}
                                </button>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', color: '#333', minWidth: '500px' }}>
                                    <thead><tr style={{ textAlign: 'left', color: '#aaa', borderBottom: '1px solid #eee' }}><th style={{ padding: '10px' }}>Varlık</th><th style={{ padding: '10px' }}>Adet</th><th style={{ padding: '10px' }}>Maliyet</th><th style={{ padding: '10px' }}>Güncel F.</th><th style={{ padding: '10px' }}>Değer</th><th style={{ padding: '10px' }}>K/Z</th><th></th><th></th></tr></thead>
                                    <tbody>{portfoy.map(p => { const guncel = p.adet * (p.guncelFiyat || p.alisFiyati); const kar = guncel - (p.adet * p.alisFiyati); const yuzde = (kar / (p.adet * p.alisFiyati)) * 100; return (<tr key={p.id} style={{ borderBottom: '1px solid #f9f9f9' }}><td style={{ padding: '12px 0' }}><b>{p.sembol}</b></td><td>{p.adet}</td><td>{formatPara(p.alisFiyati)}</td><td style={{ padding: '5px' }}><input key={p.guncelFiyat} type="number" defaultValue={p.guncelFiyat} onBlur={(e) => fiyatGuncelle(p.id, e.target.value)} style={{ ...inputStyle, width: '80px', padding: '5px', background: '#f7fafc' }} disabled={gizliMod} /></td><td style={{ fontWeight: 'bold' }}>{formatPara(guncel)}</td><td style={{ color: kar >= 0 ? 'green' : 'red' }}>{gizliMod ? '***' : <>{formatPara(kar)}</>}</td><td><button onClick={() => modalAc('satis', p)} style={{ background: '#edf2f7', color: '#333', border: 'none', borderRadius: '5px', fontSize: '12px', padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold' }}>Sat</button></td><td><span onClick={() => normalSil("portfoy", p.id)} style={{ cursor: 'pointer', fontSize: '14px' }}>🗑️</span></td></tr>) })}</tbody>
                                </table>
                            </div>
                        </div>

                        {/* SAĞ: VARLIK DAĞILIMI */}
                        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <h4 style={{ color: '#2d3748', marginBottom: '20px' }}>Varlık Dağılımı</h4>
                            {portfoy.length > 0 ?
                                <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={portfoyVerisi} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name }) => name}>{portfoyVerisi.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS_PORTFOLIO[index % COLORS_PORTFOLIO.length]} />))}</Pie><Tooltip formatter={(value) => gizliMod ? "****" : `${value.toLocaleString()} ₺`} /></PieChart></ResponsiveContainer>
                                : <p style={{ fontSize: '12px', color: '#aaa' }}>Henüz varlık yok.</p>}
                        </div>

                    </div>

                    {/* 3. SATIR: YENİ İŞLEM VE GEÇMİŞ TABLOSU (YAN YANA) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px', marginBottom: '30px' }}>

                        {/* SOL: YENİ YATIRIM FORMU */}
                        <div style={{ ...cardStyle, background: '#f0fff4', border: '1px solid #9ae6b4' }}>
                            <h4 style={{ marginTop: 0, marginBottom: '20px', color: '#2f855a' }}>📈 Yeni Yatırım Varlığı Al</h4>
                            <form onSubmit={yatirimAl} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <input placeholder="Sembol (THYAO, GRAM...)" value={sembol} onChange={e => setSembol(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }} />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input type="number" placeholder="Adet" value={adet} onChange={e => setAdet(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }} />
                                    <select value={varlikTuru} onChange={e => setVarlikTuru(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }}>
                                        {yatirimTurleri.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <input type="number" placeholder="Birim Alış Fiyatı" value={alisFiyati} onChange={e => setAlisFiyati(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }} />
                                <select value={yatirimHesapId} onChange={e => setYatirimHesapId(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }} required><option value="">Ödeme Hangi Hesaptan?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatPara(h.guncelBakiye)})</option>)}</select>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'green' }}>Toplam Tutar: {adet && alisFiyati ? formatPara(adet * alisFiyati) : '0 ₺'}</div>
                                <button type="submit" style={{ width: '100%', background: '#38a169', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>SATIN AL</button>
                            </form>
                        </div>

                        {/* SAĞ: YATIRIM İŞLEM GEÇMİŞİ */}
                        <div style={cardStyle}>
                            {/* ÜST BÖLÜM: AYLAR */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                                <h4 style={{ marginTop: 0, color: '#2c3e50', margin: 0 }}>📜 Yatırım İşlem Geçmişi</h4>
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                    {mevcutAylar.map(ay => (
                                        <button key={ay} onClick={() => setAktifYatirimAy(ay)} style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '15px', border: 'none', cursor: 'pointer', background: aktifYatirimAy === ay ? '#2c3e50' : '#edf2f7', color: aktifYatirimAy === ay ? 'white' : '#4a5568', fontWeight: 'bold' }}>{ay}</button>
                                    ))}
                                </div>
                            </div>

                            {/* GELİŞMİŞ FİLTRELEME ALANI */}
                            <div style={{ background: '#f7fafc', padding: '15px', borderRadius: '10px', marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid #edf2f7' }}>
                                <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 10px' }}>
                                    <span style={{ fontSize: '16px' }}>🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Yatırım işlem ara..."
                                        value={yatirimArama}
                                        onChange={(e) => setYatirimArama(e.target.value)}
                                        style={{ border: 'none', outline: 'none', padding: '10px', width: '100%', fontSize: '13px', background: 'transparent', color: '#333' }}
                                    />
                                    {yatirimArama && <span onClick={() => setYatirimArama("")} style={{ cursor: 'pointer', color: '#aaa', fontWeight: 'bold' }}>X</span>}
                                </div>
                                <select
                                    value={filtreYatirimTuru}
                                    onChange={e => setFiltreYatirimTuru(e.target.value)}
                                    style={{ flex: 1, minWidth: '120px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '13px', backgroundColor: '#ffffff', color: '#333' }}
                                >
                                    <option value="Tümü">Tüm Türler</option>
                                    {yatirimTurleri.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#333' }}>
                                <thead><tr style={{ textAlign: 'left', color: '#718096', borderBottom: '2px solid #e2e8f0' }}><th style={{ padding: '10px' }}>Tarih</th><th style={{ padding: '10px' }}>Hesap</th><th style={{ padding: '10px' }}>Tür</th><th style={{ padding: '10px' }}>İşlem</th><th style={{ padding: '10px' }}>Tutar</th><th></th><th></th></tr></thead>
                                <tbody>
                                    {yatirimIslemleri.map(i => {
                                        const hesap = hesaplar.find(h => h.id === i.hesapId);
                                        const hesapAdi = hesap ? hesap.hesapAdi : "Bilinmeyen Hesap";
                                        return (
                                            <tr key={i.id} style={{ borderBottom: '1px solid #f7fafc' }}>
                                                <td style={{ padding: '10px', color: '#718096' }}>{tarihFormatla(i.tarih)}</td>
                                                <td style={{ padding: '10px' }}>{hesapAdi}</td>
                                                <td style={{ padding: '10px' }}>{i.yatirimTuru || "Diğer"}</td>
                                                <td style={{ padding: '10px' }}>{i.aciklama}</td>
                                                <td style={{ padding: '10px', fontWeight: 'bold', color: i.islemTipi === 'yatirim_alis' ? 'red' : 'green' }}>{formatPara(i.tutar)}</td>
                                                <td><span onClick={() => modalAc('duzenle_islem', i)} style={{ cursor: 'pointer' }}>✏️</span></td>
                                                <td><span onClick={() => islemSil(i.id)} style={{ cursor: 'pointer' }}>🗑️</span></td>
                                            </tr>
                                        )
                                    })}
                                    {yatirimIslemleri.length === 0 && <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>Henüz işlem yok.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}

export default App;
