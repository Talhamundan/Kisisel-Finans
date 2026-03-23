import { useState, useEffect } from 'react'
import { db } from './firebase'
import { doc, setDoc } from 'firebase/firestore'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import Header from './components/Layout/Header';
import Notifications from './components/Shared/Notifications';
import BudgetDashboard from './components/Budget/BudgetDashboard';
import InvestmentDashboard from './components/Investment/InvestmentDashboard';
import GoalsInventory from './components/Budget/GoalsInventory';
import ModalManager from './components/Modals/ModalManager';
import MobileNav from './components/Layout/MobileNav';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useDataListeners } from './hooks/useDataListeners';
import { useBudgetActions } from './hooks/useBudgetActions';
import { useInvestmentActions } from './hooks/useInvestmentActions';
import { useCalculations } from './hooks/useCalculations';
import Feedback from './components/Feedback';


// Helpers
import { inputStyle } from './utils/helpers';

function App() {
    // 1. AUTH
    const { user, loading, girisYap, cikisYap: authLogout } = useAuth();

    // 2. LOCAL UI STATE
    const [anaSekme, setAnaSekme] = useState("butcem");
    const [gizliMod, setGizliMod] = useState(false);
    const [aktifModal, setAktifModal] = useState(null);
    const [seciliVeri, setSeciliVeri] = useState(null);
    const [formTab, setFormTab] = useState("islem");

    // Login / Code Login
    const [alanKodu, setAlanKodu] = useState(localStorage.getItem("alan_kodu") || "");
    const [girilenKod, setGirilenKod] = useState("");

    // 3. HOOKS initialization
    const data = useDataListeners(user, alanKodu);
    const calculations = useCalculations(data, gizliMod, data.aylikLimit);
    const budgetActions = useBudgetActions(user, alanKodu, data.hesaplar, data.kategoriListesi, data.tanimliFaturalar);
    const investmentActions = useInvestmentActions(user, alanKodu);



    // 3.1 GÜVENLİK VE UX İYİLEŞTİRMELERİ (Global Date Fix)
    useEffect(() => {
        const handleFocus = (e) => {
            if (e.target && (e.target.type === 'date' || e.target.type === 'datetime-local')) {
                // 1. 4 Haneli Yıl Sınırlaması (Max 9999)
                const isDateTime = e.target.type === 'datetime-local';
                const maxVal = isDateTime ? "9999-12-31T23:59" : "9999-12-31";
                if (!e.target.hasAttribute('max')) {
                    e.target.setAttribute('max', maxVal);
                }
            }
        };

        // Capture phase to catch all focus events
        window.addEventListener('focus', handleFocus, true);
        return () => window.removeEventListener('focus', handleFocus, true);
    }, []);

    // 3.2 URL TEMİZLİK (Soru işaretini kaldır)
    useEffect(() => {
        if (window.location.search) {
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }
    }, []);

    // Sekme değişince sayfayı en üste al (scroll container: #root)
    useEffect(() => {
        const rafId = window.requestAnimationFrame(() => {
            const rootEl = document.getElementById("root");
            if (rootEl) {
                rootEl.scrollTo({ top: 0, left: 0, behavior: "auto" });
                rootEl.scrollTop = 0;
            }
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        });

        return () => window.cancelAnimationFrame(rafId);
    }, [anaSekme]);

    // 4. HELPER FUNCTIONS (View-Specific Logic)
    const cikisYap = async () => {
        await authLogout();
        setAlanKodu("");
        localStorage.removeItem("alan_kodu");
    }

    const kodIleGiris = (e) => {
        e.preventDefault();
        if (!girilenKod) return;
        localStorage.setItem("alan_kodu", girilenKod);
        setAlanKodu(girilenKod);
        window.location.reload();
    }

    const koddanCikis = () => {
        setAktifModal('cikis_onay');
    }

    const handleConfirmLogout = () => {
        localStorage.removeItem("alan_kodu");
        setAlanKodu("");
        window.location.reload();
    }

    // Modal Control Wrapper
    const modalAc = (tip, veri) => {
        setAktifModal(tip);
        setSeciliVeri(veri);

        // Fill Forms based on Type
        if (tip === 'duzenle_hesap') budgetActions.fillAccountForm(veri);
        if (tip === 'duzenle_islem') budgetActions.fillTransactionForm(veri);
        if (tip === 'duzenle_abonelik') budgetActions.fillSubscriptionForm(veri);
        if (tip === 'duzenle_taksit') budgetActions.fillInstallmentForm(veri);
        if (tip === 'duzenle_maas') budgetActions.fillSalaryForm(veri);
        if (tip === 'duzenle_bekleyen_fatura') budgetActions.fillBillForm(veri);
        if (tip === 'fatura_tanim_duzenle') budgetActions.fillBillDefForm(veri); // If exists
        if (tip === 'kredi_karti_ode') budgetActions.fillCCForm(veri);
        if (tip === 'satis') budgetActions.setIslemTutar(veri.guncelFiyat || veri.alisFiyati);
        if (tip === 'duzenle_portfoy') investmentActions.fillPortfolioForm(veri);
        if (tip === 'tahsilat_ekle') investmentActions.setTahsilatTutar(veri.satisFiyati - veri.tahsilEdilen);
        if (tip === 'duzenle_borc') budgetActions.fillBorcForm(veri);
        if (tip === 'borc_tanimla') budgetActions.resetBorcForm();
    }

    // Settings Updaters
    const onLimitChange = (limit) => {
        data.setAylikLimit(limit);
        setDoc(doc(db, "ayarlar", alanKodu), { limit: limit }, { merge: true });
    }
    const onKategoriUpdate = (y) => {
        data.setKategoriListesi(y);
        setDoc(doc(db, "ayarlar", alanKodu), { kategoriler: y }, { merge: true });
    }
    const onYatirimTuruUpdate = (y) => {
        data.setYatirimTurleri(y);
        setDoc(doc(db, "ayarlar", alanKodu), { yatirimTurleri: y }, { merge: true });
    }

    // --- RENDERING ---

    if (loading) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Yükleniyor...</div>;

    if (!user) return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
            color: 'white',
            fontFamily: 'Segoe UI',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Pattern/Blur Effect */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0) 50%)',
                pointerEvents: 'none'
            }}></div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 1,
                padding: '20px',
                width: '100%',
                maxWidth: '400px'
            }}>
                <div style={{
                    fontSize: '4rem',
                    marginBottom: '10px',
                    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))'
                }}>
                    🚀
                </div>

                <h1 style={{
                    fontSize: '2.5rem',
                    marginBottom: '10px',
                    fontWeight: 'bold',
                    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                    CÜZDANIM
                </h1>

                <p style={{
                    marginBottom: '40px',
                    fontSize: '1.1rem',
                    opacity: 0.9,
                    fontWeight: '500'
                }}>
                    Bütçen kontrol altında.
                </p>

                <button
                    onClick={girisYap}
                    style={{
                        padding: '12px 24px',
                        width: '100%',
                        maxWidth: '320px',
                        fontSize: '1rem',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'white',
                        color: '#1f2937',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        transition: 'transform 0.1s, box-shadow 0.2s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseOver={e => e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'}
                    onMouseOut={e => e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google ile Giriş Yap
                </button>
            </div>
            <ToastContainer />
        </div>
    );

    if (!alanKodu) return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
            fontFamily: 'Segoe UI',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Logo Effect */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '15vw',
                fontWeight: 'bold',
                color: 'white',
                opacity: '0.03',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                userSelect: 'none'
            }}>
                CÜZDANIM
            </div>

            <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                width: '90%',
                maxWidth: '450px',
                textAlign: 'center',
                zIndex: 1
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    background: '#linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px auto',
                    fontSize: '24px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    🔑
                </div>

                <h2 style={{ color: '#1f2937', marginBottom: '8px', fontSize: '24px', fontWeight: 'bold' }}>Kişisel Alan Girişi</h2>
                <p style={{ fontSize: '15px', color: '#6b7280', marginBottom: '30px' }}>Verilerinize erişmek için güvenlik kodunuzu girin.</p>

                <form onSubmit={kodIleGiris}>
                    <div style={{ marginBottom: '20px' }}>
                        <input
                            placeholder="Kodunuz (Örn: TALHA_EV)"
                            value={girilenKod}
                            onChange={e => setGirilenKod(e.target.value.toUpperCase())}
                            style={{
                                ...inputStyle,
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '14px 16px',
                                fontSize: '16px',
                                background: '#f9fafb',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                transition: 'all 0.2s',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: '600',
                            fontSize: '16px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)',
                            transition: 'transform 0.1s'
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        GİRİŞ YAP
                    </button>
                </form>

                <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#6b7280', textAlign: 'left' }}>
                        <span style={{ display: 'block', marginBottom: '2px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kullanıcı</span>
                        {user.email}
                    </div>
                    <button
                        onClick={cikisYap}
                        style={{
                            background: '#fee2e2',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '13px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            transition: 'background 0.2s'
                        }}
                    >
                        Çıkış Yap
                    </button>
                </div>
            </div>
            <ToastContainer position="top-right" autoClose={3000} />
        </div>
    );

    return (
        <div className="app-shell">
            <ToastContainer position="top-right" autoClose={2000} theme="light" />

            <ModalManager
                aktifModal={aktifModal} setAktifModal={setAktifModal}
                seciliVeri={seciliVeri}
                hesaplar={data.hesaplar}
                // Budget Actions & State
                hesapAdi={budgetActions.hesapAdi} setHesapAdi={budgetActions.setHesapAdi}
                hesapTipi={budgetActions.hesapTipi} setHesapTipi={budgetActions.setHesapTipi}
                baslangicBakiye={budgetActions.baslangicBakiye} setBaslangicBakiye={budgetActions.setBaslangicBakiye}
                hesapKesimGunu={budgetActions.hesapKesimGunu} setHesapKesimGunu={budgetActions.setHesapKesimGunu}
                hesapDuzenle={budgetActions.hesapDuzenle}
                islemAciklama={budgetActions.islemAciklama} setIslemAciklama={budgetActions.setIslemAciklama}
                islemTutar={budgetActions.islemTutar} setIslemTutar={budgetActions.setIslemTutar}
                islemTarihi={budgetActions.islemTarihi} setIslemTarihi={budgetActions.setIslemTarihi}
                // NEW: Quantity & Unit Price Props
                islemAdet={budgetActions.islemAdet} setIslemAdet={budgetActions.setIslemAdet}
                islemBirimFiyat={budgetActions.islemBirimFiyat} setIslemBirimFiyat={budgetActions.setIslemBirimFiyat}
                kategori={budgetActions.kategori} setKategori={budgetActions.setKategori}
                yatirimTurleri={data.yatirimTurleri}
                kategoriListesi={data.kategoriListesi}
                islemDuzenle={budgetActions.islemDuzenle}
                aboAd={budgetActions.aboAd} setAboAd={budgetActions.setAboAd}
                aboTutar={budgetActions.aboTutar} setAboTutar={budgetActions.setAboTutar}
                aboGun={budgetActions.aboGun} setAboGun={budgetActions.setAboGun}
                aboHesapId={budgetActions.aboHesapId} setAboHesapId={budgetActions.setAboHesapId}
                aboKategori={budgetActions.aboKategori} setAboKategori={budgetActions.setAboKategori}
                abonelikDuzenle={budgetActions.abonelikDuzenle}
                taksitBaslik={budgetActions.taksitBaslik} setTaksitBaslik={budgetActions.setTaksitBaslik}
                taksitToplamTutar={budgetActions.taksitToplamTutar} setTaksitToplamTutar={budgetActions.setTaksitToplamTutar}
                taksitSayisi={budgetActions.taksitSayisi} setTaksitSayisi={budgetActions.setTaksitSayisi}
                taksitHesapId={budgetActions.taksitHesapId} setTaksitHesapId={budgetActions.setTaksitHesapId}
                taksitKategori={budgetActions.taksitKategori} setTaksitKategori={budgetActions.setTaksitKategori}
                taksitAlisTarihi={budgetActions.taksitAlisTarihi} setTaksitAlisTarihi={budgetActions.setTaksitAlisTarihi}
                taksitDuzenle={budgetActions.taksitDuzenle}
                maasAd={budgetActions.maasAd} setMaasAd={budgetActions.setMaasAd}
                maasTutar={budgetActions.maasTutar} setMaasTutar={budgetActions.setMaasTutar}
                maasGun={budgetActions.maasGun} setMaasGun={budgetActions.setMaasGun}
                maasHesapId={budgetActions.maasHesapId} setMaasHesapId={budgetActions.setMaasHesapId}
                maasDuzenle={budgetActions.maasDuzenle}
                kkOdemeKartId={budgetActions.kkOdemeKartId}
                kkOdemeKaynakId={budgetActions.kkOdemeKaynakId} setKkOdemeKaynakId={budgetActions.setKkOdemeKaynakId}
                kkOdemeTutar={budgetActions.kkOdemeTutar} setKkOdemeTutar={budgetActions.setKkOdemeTutar}
                krediKartiBorcOde={budgetActions.krediKartiBorcOde}
                faturaOde={budgetActions.faturaOde}
                tanimliFaturalar={data.tanimliFaturalar}
                faturaGirisTutar={budgetActions.faturaGirisTutar} setFaturaGirisTutar={budgetActions.setFaturaGirisTutar}
                faturaGirisTarih={budgetActions.faturaGirisTarih} setFaturaGirisTarih={budgetActions.setFaturaGirisTarih}
                faturaGirisAciklama={budgetActions.faturaGirisAciklama} setFaturaGirisAciklama={budgetActions.setFaturaGirisAciklama}
                bekleyenFaturaDuzenle={budgetActions.bekleyenFaturaDuzenle}
                tanimBaslik={budgetActions.tanimBaslik} setTanimBaslik={budgetActions.setTanimBaslik}
                tanimKurum={budgetActions.tanimKurum} setTanimKurum={budgetActions.setTanimKurum}
                tanimAboneNo={budgetActions.tanimAboneNo} setTanimAboneNo={budgetActions.setTanimAboneNo}
                faturaTanimDuzenle={budgetActions.faturaTanimDuzenle}
                alanKodu={alanKodu}
                verileriTasi={budgetActions.verileriTasi}
                yeniKodInput={budgetActions.yeniKodInput} setYeniKodInput={budgetActions.setYeniKodInput}
                tasimaIslemiSuruyor={budgetActions.tasimaIslemiSuruyor}
                satisYap={() => investmentActions.satisYap(seciliVeri, budgetActions.secilenHesapId, budgetActions.islemTutar)}
                secilenHesapId={budgetActions.secilenHesapId} setSecilenHesapId={budgetActions.setSecilenHesapId}
                onKategoriUpdate={onKategoriUpdate}
                onYatirimTuruUpdate={onYatirimTuruUpdate}
                gizliMod={gizliMod}
                besKesintiEkle={investmentActions.besKesintiEkle}
                besKesintiSil={investmentActions.besKesintiSil}
                // Investment Edit Props
                portfoyDuzenle={investmentActions.portfoyDuzenle}
                sembol={investmentActions.sembol}
                adet={investmentActions.adet} setAdet={investmentActions.setAdet}
                alisFiyati={investmentActions.alisFiyati} setAlisFiyati={investmentActions.setAlisFiyati}
                varlikTuru={investmentActions.varlikTuru} setVarlikTuru={investmentActions.setVarlikTuru}
                tahsilatTutar={investmentActions.tahsilatTutar} setTahsilatTutar={investmentActions.setTahsilatTutar}
                satisTahsilatEkle={investmentActions.satisTahsilatEkle}
                pozisyonGuncelle={investmentActions.pozisyonGuncelle} // NEW PROP assigned
                pozisyonSil={investmentActions.pozisyonSil} // NEW PROP assigned

                onConfirmLogout={handleConfirmLogout}
                maasEkle={budgetActions.maasEkle}
                hesapEkle={budgetActions.hesapEkle}
                faturaTanimEkle={budgetActions.faturaTanimEkle}
                abonelikEkle={budgetActions.abonelikEkle}
                gecmisIslemEkle={investmentActions.gecmisIslemEkle}
                islemSil={budgetActions.islemSil}

                borcAd={budgetActions.borcAd} setBorcAd={budgetActions.setBorcAd}
                borcTutar={budgetActions.borcTutar} setBorcTutar={budgetActions.setBorcTutar}
                borcKalanTutar={budgetActions.borcKalanTutar} setBorcKalanTutar={budgetActions.setBorcKalanTutar}
                borcTarih={budgetActions.borcTarih} setBorcTarih={budgetActions.setBorcTarih}
                borcKategori={budgetActions.borcKategori} setBorcKategori={budgetActions.setBorcKategori}
                borcEkle={budgetActions.borcEkle}
                borcDuzenle={budgetActions.borcDuzenle}
                borcOde={budgetActions.borcOde}
                borcSil={budgetActions.borcSil}
                // NEW PROPS FOR MOBILE TRANSACTION ADD MODAL
                islemEkle={budgetActions.islemEkle}
            />

            <Header
                anaSekme={anaSekme}
                setAnaSekme={setAnaSekme}
                gizliMod={gizliMod}
                setGizliMod={setGizliMod}
                user={user}
                setAktifModal={setAktifModal}
                koddanCikis={koddanCikis}
                cikisYap={cikisYap}
            />

            <Notifications
                bildirimler={calculations.bildirimler.filter(b => {
                    if (anaSekme === 'butcem') return ['fatura', 'abonelik', 'maas', 'kk_hatirlatma', 'borc_hatirlatma'].includes(b.tip);
                    if (anaSekme === 'yatirimlar') return ['bes_odeme'].includes(b.tip);
                    if (anaSekme === 'hedefler') return ['alacak'].includes(b.tip);
                    return false;
                })}
                gizliMod={gizliMod}
                abonelikOde={budgetActions.abonelikOde}
                taksitOde={budgetActions.taksitOde}
                maasYatir={budgetActions.maasYatir}
                modalAc={modalAc}
                besOdemeYap={() => investmentActions.besOdemeYap(null, budgetActions.islemEkle)}
            />

            {/* BÜTÇEM DASHBOARD */}
            {anaSekme === "butcem" && (
                <BudgetDashboard
                    // Data
                    aktifAy={calculations.aktifAy} setAktifAy={calculations.setAktifAy}
                    toplamGelir={calculations.toplamGelir}
                    bugunGider={calculations.bugunGider}
                    toplamGider={calculations.toplamGider}
                    gunlukVeri={calculations.gunlukVeri}
                    gunlukOrtalama={calculations.gunlukOrtalama}
                    kategoriVerisi={calculations.kategoriVerisi}
                    gizliMod={gizliMod}
                    aylikLimit={data.aylikLimit}
                    onLimitChange={onLimitChange}
                    harcananLimit={calculations.harcananLimit}
                    limitYuzdesi={calculations.limitYuzdesi}
                    limitRenk={calculations.limitRenk}
                    maaslar={data.maaslar}
                    hesaplar={data.hesaplar}
                    filtrelenmisIslemler={calculations.filtrelenmisIslemler}
                    sadeceCuzdanNakiti={calculations.sadeceCuzdanNakiti}
                    genelToplamYatirimGucu={calculations.genelToplamYatirimGucu}
                    netVarlik={calculations.netVarlik}
                    tanimliFaturalar={data.tanimliFaturalar}
                    bekleyenFaturalar={data.bekleyenFaturalar}
                    taksitler={data.taksitler}
                    toplamKalanTaksitBorcu={calculations.toplamKalanTaksitBorcu}
                    abonelikler={data.abonelikler}
                    toplamSabitGider={calculations.toplamSabitGider}
                    kategoriListesi={data.kategoriListesi}
                    mevcutAylar={calculations.mevcutAylar}
                    aramaMetni={calculations.aramaMetni} setAramaMetni={calculations.setAramaMetni}
                    filtreKategori={calculations.filtreKategori} setFiltreKategori={calculations.setFiltreKategori}

                    // Actions & States
                    modalAc={modalAc}
                    normalSil={budgetActions.normalSil}
                    maasEkle={budgetActions.maasEkle}
                    maasAd={budgetActions.maasAd} setMaasAd={budgetActions.setMaasAd}
                    maasTutar={budgetActions.maasTutar} setMaasTutar={budgetActions.setMaasTutar}
                    maasGun={budgetActions.maasGun} setMaasGun={budgetActions.setMaasGun}
                    maasHesapId={budgetActions.maasHesapId} setMaasHesapId={budgetActions.setMaasHesapId}

                    hesapEkle={budgetActions.hesapEkle}
                    hesapAdi={budgetActions.hesapAdi} setHesapAdi={budgetActions.setHesapAdi}
                    hesapTipi={budgetActions.hesapTipi} setHesapTipi={budgetActions.setHesapTipi}
                    baslangicBakiye={budgetActions.baslangicBakiye} setBaslangicBakiye={budgetActions.setBaslangicBakiye}

                    pozisyonGuncelle={investmentActions.pozisyonGuncelle} // NEW: Pass to Modal Manager

                    faturaTanimEkle={budgetActions.faturaTanimEkle}
                    tanimBaslik={budgetActions.tanimBaslik} setTanimBaslik={budgetActions.setTanimBaslik}
                    tanimKurum={budgetActions.tanimKurum} setTanimKurum={budgetActions.setTanimKurum}
                    tanimAboneNo={budgetActions.tanimAboneNo} setTanimAboneNo={budgetActions.setTanimAboneNo}

                    taksitOde={budgetActions.taksitOde}
                    abonelikOde={budgetActions.abonelikOde}

                    abonelikEkle={budgetActions.abonelikEkle}
                    aboAd={budgetActions.aboAd} setAboAd={budgetActions.setAboAd}
                    aboTutar={budgetActions.aboTutar} setAboTutar={budgetActions.setAboTutar}
                    aboGun={budgetActions.aboGun} setAboGun={budgetActions.setAboGun}
                    aboKategori={budgetActions.aboKategori} setAboKategori={budgetActions.setAboKategori}
                    aboHesapId={budgetActions.aboHesapId} setAboHesapId={budgetActions.setAboHesapId}

                    formTab={formTab} setFormTab={setFormTab}
                    islemEkle={budgetActions.islemEkle}
                    transferYap={budgetActions.transferYap}
                    taksitEkle={budgetActions.taksitEkle}
                    faturaGir={budgetActions.faturaGir}
                    secilenHesapId={budgetActions.secilenHesapId} setSecilenHesapId={budgetActions.setSecilenHesapId}
                    islemTipi={budgetActions.islemTipi} setIslemTipi={budgetActions.setIslemTipi}
                    kategori={budgetActions.kategori} setKategori={budgetActions.setKategori}
                    islemAciklama={budgetActions.islemAciklama} setIslemAciklama={budgetActions.setIslemAciklama}
                    islemTutar={budgetActions.islemTutar} setIslemTutar={budgetActions.setIslemTutar}
                    islemTarihi={budgetActions.islemTarihi} setIslemTarihi={budgetActions.setIslemTarihi}
                    transferKaynakId={budgetActions.transferKaynakId} setTransferKaynakId={budgetActions.setTransferKaynakId}
                    transferHedefId={budgetActions.transferHedefId} setTransferHedefId={budgetActions.setTransferHedefId}
                    transferTutar={budgetActions.transferTutar} setTransferTutar={budgetActions.setTransferTutar}
                    transferUcreti={budgetActions.transferUcreti} setTransferUcreti={budgetActions.setTransferUcreti}
                    transferTarihi={budgetActions.transferTarihi} setTransferTarihi={budgetActions.setTransferTarihi}
                    taksitBaslik={budgetActions.taksitBaslik} setTaksitBaslik={budgetActions.setTaksitBaslik}
                    taksitHesapId={budgetActions.taksitHesapId} setTaksitHesapId={budgetActions.setTaksitHesapId}
                    taksitToplamTutar={budgetActions.taksitToplamTutar} setTaksitToplamTutar={budgetActions.setTaksitToplamTutar}
                    taksitSayisi={budgetActions.taksitSayisi} setTaksitSayisi={budgetActions.setTaksitSayisi}
                    taksitKategori={budgetActions.taksitKategori} setTaksitKategori={budgetActions.setTaksitKategori}
                    taksitAlisTarihi={budgetActions.taksitAlisTarihi} setTaksitAlisTarihi={budgetActions.setTaksitAlisTarihi}
                    secilenTanimId={budgetActions.secilenTanimId} setSecilenTanimId={budgetActions.setSecilenTanimId}
                    faturaGirisTutar={budgetActions.faturaGirisTutar} setFaturaGirisTutar={budgetActions.setFaturaGirisTutar}
                    faturaGirisTarih={budgetActions.faturaGirisTarih} setFaturaGirisTarih={budgetActions.setFaturaGirisTarih}
                    faturaGirisAciklama={budgetActions.faturaGirisAciklama} setFaturaGirisAciklama={budgetActions.setFaturaGirisAciklama}

                    borclar={data.borclar}
                    toplamKalanBorc={calculations.toplamKalanBorc}
                    borcOde={budgetActions.borcOde}
                    borcDuzenle={budgetActions.borcDuzenle}
                    borcOrderGuncelle={budgetActions.borcOrderGuncelle}

                    excelIndir={() => budgetActions.excelIndir(data.islemler)}
                    excelYukle={budgetActions.excelYukle}
                    islemSil={budgetActions.islemSil}
                />
            )}

            {/* YATIRIM DASHBOARD */}
            {anaSekme === "yatirimlar" && (
                <InvestmentDashboard
                    gizliMod={gizliMod}
                    genelToplamYatirimGucu={calculations.genelToplamYatirimGucu}
                    portfoyGuncelDegeri={calculations.portfoyGuncelDegeri}
                    toplamKarZarar={calculations.toplamKarZarar}
                    toplamYatirimHesapNakiti={calculations.toplamYatirimHesapNakiti}
                    kartYatirimToplami={calculations.kartYatirimToplami}
                    toplamDovizVarligi={calculations.toplamDovizVarligi}
                    toplamBesVarligi={calculations.toplamBesVarligi}
                    kartNakitToplami={calculations.kartNakitToplami}
                    genelVarlikVerisi={calculations.genelVarlikVerisi}
                    portfoyVerisi={calculations.portfoyVerisi}
                    portfoy={data.portfoy}
                    modalAc={modalAc}
                    piyasalariGuncelle={() => investmentActions.piyasalariGuncelle(data.portfoy)}
                    guncelleniyor={investmentActions.guncelleniyor}
                    yatirimAl={investmentActions.yatirimAl}
                    sembol={investmentActions.sembol} setSembol={investmentActions.setSembol}
                    adet={investmentActions.adet} setAdet={investmentActions.setAdet}
                    alisFiyati={investmentActions.alisFiyati} setAlisFiyati={investmentActions.setAlisFiyati}
                    varlikTuru={investmentActions.varlikTuru} setVarlikTuru={investmentActions.setVarlikTuru}
                    yatirimHesapId={investmentActions.yatirimHesapId} setYatirimHesapId={investmentActions.setYatirimHesapId}
                    yatirimTurleri={data.yatirimTurleri}
                    hesaplar={data.hesaplar}
                    yatirimIslemleri={calculations.yatirimIslemleri}
                    tumIslemler={data.islemler} // NEW: Pass all transactions for All-Time Analysis
                    yatirimArama={calculations.yatirimArama} setYatirimArama={calculations.setYatirimArama}
                    aktifYatirimAy={calculations.aktifYatirimAy} setAktifYatirimAy={calculations.setAktifYatirimAy}
                    filtreYatirimTuru={calculations.filtreYatirimTuru} setFiltreYatirimTuru={calculations.setFiltreYatirimTuru}
                    mevcutAylar={calculations.mevcutAylar}
                    islemSil={budgetActions.islemSil}

                    fiyatGuncelle={investmentActions.fiyatGuncelle}
                    pozisyonSil={investmentActions.pozisyonSil} // NEW PROP assigned
                    // BES Module Props
                    besVerisi={data.besVerisi}
                    toplamBesYatirimi={calculations.toplamBesYatirimi}
                    besGuncelle={investmentActions.besGuncelle}
                    besOdemeYap={investmentActions.besOdemeYap}
                    besOdemeIsle={investmentActions.besOdemeIsle}
                    islemEkle={budgetActions.islemEkle}
                />
            )}

            {/* HEDEFLER & ENVANTER DASHBOARD */}
            {anaSekme === "hedefler" && (
                <GoalsInventory
                    gizliMod={gizliMod}
                    hedefler={data.hedefler}
                    envanter={data.envanter}
                    satislar={data.satislar}
                    actions={investmentActions}
                    genelToplamYatirimGucu={calculations.genelToplamYatirimGucu}
                />
            )}

            {/* Geri Bildirim Butonu */}
            <Feedback userEmail={user?.email} />

            {/* Mobil Alt Navigasyon Barı */}
            <MobileNav
                anaSekme={anaSekme}
                setAnaSekme={setAnaSekme}
                modalAc={modalAc}
            />
        </div>
    );
}

export default App;
