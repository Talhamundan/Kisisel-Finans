import { useState, useEffect, useMemo } from 'react'
import { db } from './firebase'
import { doc, setDoc } from 'firebase/firestore'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';

// Components
import Header from './components/Layout/Header';
import Notifications from './components/Shared/Notifications';
import BudgetDashboard from './components/Budget/BudgetDashboard';
import GlobalQuickTransaction from './components/Budget/GlobalQuickTransaction';
import InvestmentDashboard from './components/Investment/InvestmentDashboard';
import GoalsInventory from './components/Budget/GoalsInventory';
import FinanceCalendarDashboard from './components/Calendar/FinanceCalendarDashboard';
import SalaryAnalysisDashboard from './components/Salary/SalaryAnalysisDashboard';
import ModalManager from './components/Modals/ModalManager';
import MobileNav from './components/Layout/MobileNav';
import AppLogo from './components/Shared/AppLogo';
import { useDefaultPaymentAccount } from './utils/defaultPaymentAccount';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useDataListeners } from './hooks/useDataListeners';
import { useBudgetActions } from './hooks/useBudgetActions';
import { useInvestmentActions } from './hooks/useInvestmentActions';
import { useCalculations } from './hooks/useCalculations';
import Feedback from './components/Feedback';


// Helpers
import { formatMoneyInputValue, inputStyle } from './utils/helpers';
import { buildAvailablePeriods, getDefaultPeriod, getLatestAvailablePeriod, isDateInPeriod, isPeriodAvailable, readInitialPeriod } from './utils/period';

const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light';

    const storedTheme = window.localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
    // 1. AUTH
    const { user, loading, girisYap, cikisYap: authLogout } = useAuth();

    // 2. LOCAL UI STATE
    const [anaSekme, setAnaSekme] = useState("butcem");
    const [gizliMod, setGizliMod] = useState(false);
    const [aktifModal, setAktifModal] = useState(null);
    const [seciliVeri, setSeciliVeri] = useState(null);
    const [formTab, setFormTab] = useState("islem");
    const [globalQuickOpen, setGlobalQuickOpen] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(readInitialPeriod);
    const [theme, setTheme] = useState(getInitialTheme);

    // Login / Code Login
    const [alanKodu, setAlanKodu] = useState(localStorage.getItem("alan_kodu") || "");
    const [girilenKod, setGirilenKod] = useState("");
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginRemember, setLoginRemember] = useState(false);
    const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);
    const [loginSubmitting, setLoginSubmitting] = useState(false);

    // 3. HOOKS initialization
    const data = useDataListeners(user, alanKodu);
    const calculations = useCalculations(data, gizliMod, data.aylikLimit, selectedPeriod);
    const budgetActions = useBudgetActions(user, alanKodu, data.hesaplar, data.kategoriListesi, data.tanimliFaturalar);
    const investmentActions = useInvestmentActions(user, alanKodu);
    const defaultPaymentAccount = useDefaultPaymentAccount(data.hesaplar);
    const defaultPaymentAccountId = defaultPaymentAccount?.id || "";

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        localStorage.setItem('theme', theme);

        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.setAttribute('content', theme === 'dark' ? '#111318' : '#6d5dfc');
        }
    }, [theme]);

    const availablePeriods = useMemo(() => {
        const dates = data.islemler.map((item) => item.tarih);
        const periods = buildAvailablePeriods(dates);
        if (periods.years.length > 0) return periods;

        const fallback = getDefaultPeriod();
        return {
            years: [fallback.year],
            monthsByYear: { [fallback.year]: [fallback.month] },
        };
    }, [data.islemler]);

    useEffect(() => {
        if (!availablePeriods.years.length) return;
        if (isPeriodAvailable(selectedPeriod, availablePeriods)) return;

        const current = getDefaultPeriod();
        const nextPeriod = isPeriodAvailable(current, availablePeriods)
            ? current
            : getLatestAvailablePeriod(availablePeriods);
        setSelectedPeriod(nextPeriod);
    }, [availablePeriods, selectedPeriod]);



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
            const params = new URLSearchParams(window.location.search);
            if (!params.has('year') && !params.has('month')) {
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('tm_finance_period', JSON.stringify(selectedPeriod));
        const url = new URL(window.location.href);
        url.searchParams.set('year', String(selectedPeriod.year));
        url.searchParams.set('month', selectedPeriod.month === 'all' ? 'all' : String(selectedPeriod.month));
        window.history.replaceState({}, document.title, `${url.pathname}?${url.searchParams.toString()}`);
    }, [selectedPeriod]);

    const filteredPendingBills = data.bekleyenFaturalar.filter((bill) => (
        isDateInPeriod(bill.sonOdemeTarihi, selectedPeriod)
    ));

    const filteredDebts = data.borclar.filter((debt) => (
        debt.sonOdemeTarihi ? isDateInPeriod(debt.sonOdemeTarihi, selectedPeriod) : true
    ));

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

    const premiumLoginSubmit = async (e) => {
        e.preventDefault();
        if (loginSubmitting) return;
        setLoginSubmitting(true);
        try {
            // TODO: Replace temporary Google sign-in submit flow
            // with username/password authentication.
            await girisYap();
        } finally {
            setLoginSubmitting(false);
        }
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
        if (tip === 'hesap_ekle') budgetActions.setVarsayilanOdemeAraci(false);
        if (tip === 'duzenle_islem') budgetActions.fillTransactionForm(veri);
        if (tip === 'duzenle_abonelik') budgetActions.fillSubscriptionForm(veri);
        if (tip === 'duzenle_taksit') budgetActions.fillInstallmentForm(veri);
        if (tip === 'duzenle_maas') budgetActions.fillSalaryForm(veri);
        if (tip === 'duzenle_bekleyen_fatura') budgetActions.fillBillForm(veri);
        if (tip === 'duzenle_fatura_tanim' || tip === 'fatura_tanim_duzenle') budgetActions.fillBillDefForm(veri); // If exists
        if (tip === 'fatura_ode') {
            const tanim = data.tanimliFaturalar.find(t => t.id === veri?.tanimId);
            budgetActions.setSecilenHesapId(tanim?.hesapId || defaultPaymentAccountId || "");
        }
        if (tip === 'kredi_karti_ode') {
            budgetActions.fillCCForm(veri);
            if (defaultPaymentAccountId && defaultPaymentAccountId !== veri?.id) {
                budgetActions.setKkOdemeKaynakId(defaultPaymentAccountId);
            }
        }
        if (tip === 'abonelik_ekle') budgetActions.setAboHesapId(defaultPaymentAccountId || "");
        if (tip === 'taksit_ekle') budgetActions.setTaksitHesapId(defaultPaymentAccountId || "");
        if (tip === 'fatura_tanim_ekle') budgetActions.setTanimHesapId(defaultPaymentAccountId || "");
        if (tip === 'satis') budgetActions.setIslemTutar(formatMoneyInputValue(veri.guncelFiyat || veri.alisFiyati));
        if (tip === 'duzenle_portfoy') investmentActions.fillPortfolioForm(veri);
        if (tip === 'tahsilat_ekle') investmentActions.setTahsilatTutar(formatMoneyInputValue(veri.satisFiyati - veri.tahsilEdilen));
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

    const quickTransactionFormProps = {
        formTab, setFormTab,
        hesaplar: data.hesaplar,
        kategoriListesi: data.kategoriListesi,
        maaslar: data.maaslar,
        tanimliFaturalar: data.tanimliFaturalar,
        tumIslemler: data.islemler,
        defaultPaymentAccountId,
        islemEkle: budgetActions.islemEkle,
        transferYap: budgetActions.transferYap,
        taksitEkle: budgetActions.taksitEkle,
        faturaGir: budgetActions.faturaGir,
        secilenHesapId: budgetActions.secilenHesapId,
        setSecilenHesapId: budgetActions.setSecilenHesapId,
        islemTipi: budgetActions.islemTipi,
        setIslemTipi: budgetActions.setIslemTipi,
        islemGelirTuru: budgetActions.islemGelirTuru,
        setIslemGelirTuru: budgetActions.setIslemGelirTuru,
        islemBagliMaasId: budgetActions.islemBagliMaasId,
        setIslemBagliMaasId: budgetActions.setIslemBagliMaasId,
        islemMaasDonemi: budgetActions.islemMaasDonemi,
        setIslemMaasDonemi: budgetActions.setIslemMaasDonemi,
        kategori: budgetActions.kategori,
        setKategori: budgetActions.setKategori,
        islemAciklama: budgetActions.islemAciklama,
        setIslemAciklama: budgetActions.setIslemAciklama,
        islemTutar: budgetActions.islemTutar,
        setIslemTutar: budgetActions.setIslemTutar,
        islemTarihi: budgetActions.islemTarihi,
        setIslemTarihi: budgetActions.setIslemTarihi,
        transferKaynakId: budgetActions.transferKaynakId,
        setTransferKaynakId: budgetActions.setTransferKaynakId,
        transferHedefId: budgetActions.transferHedefId,
        setTransferHedefId: budgetActions.setTransferHedefId,
        transferTutar: budgetActions.transferTutar,
        setTransferTutar: budgetActions.setTransferTutar,
        transferUcreti: budgetActions.transferUcreti,
        setTransferUcreti: budgetActions.setTransferUcreti,
        transferAciklama: budgetActions.transferAciklama,
        setTransferAciklama: budgetActions.setTransferAciklama,
        transferTarihi: budgetActions.transferTarihi,
        setTransferTarihi: budgetActions.setTransferTarihi,
        taksitBaslik: budgetActions.taksitBaslik,
        setTaksitBaslik: budgetActions.setTaksitBaslik,
        taksitHesapId: budgetActions.taksitHesapId,
        setTaksitHesapId: budgetActions.setTaksitHesapId,
        taksitToplamTutar: budgetActions.taksitToplamTutar,
        setTaksitToplamTutar: budgetActions.setTaksitToplamTutar,
        taksitSayisi: budgetActions.taksitSayisi,
        setTaksitSayisi: budgetActions.setTaksitSayisi,
        taksitKategori: budgetActions.taksitKategori,
        setTaksitKategori: budgetActions.setTaksitKategori,
        taksitAlisTarihi: budgetActions.taksitAlisTarihi,
        setTaksitAlisTarihi: budgetActions.setTaksitAlisTarihi,
        secilenTanimId: budgetActions.secilenTanimId,
        setSecilenTanimId: budgetActions.setSecilenTanimId,
        faturaGirisTutar: budgetActions.faturaGirisTutar,
        setFaturaGirisTutar: budgetActions.setFaturaGirisTutar,
        faturaGirisTarih: budgetActions.faturaGirisTarih,
        setFaturaGirisTarih: budgetActions.setFaturaGirisTarih,
        faturaGirisAciklama: budgetActions.faturaGirisAciklama,
        setFaturaGirisAciklama: budgetActions.setFaturaGirisAciklama,
    };

    // --- RENDERING ---

    if (loading) return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Yükleniyor...</div>;

    if (!user) return (
        <div className="qw-login-shell">
            <section className="qw-login-brand-panel">
                <AppLogo size="md" showText className="qw-login-brand" />

                <div className="qw-login-copy">
                    <h1>Finansal hayatın,<br />tek ve sakin bir yerde.</h1>
                    <p>Hesaplarını, yatırımlarını, ödemelerini ve hedeflerini tek ekrandan yönet.</p>
                </div>

                <div className="qw-login-preview" aria-hidden="true">
                    <div className="qw-preview-card qw-preview-card--main">
                        <div>
                            <span>Toplam Net Varlık</span>
                            <strong>••••••</strong>
                        </div>
                        <ShieldCheck size={22} strokeWidth={2.2} />
                        <div className="qw-preview-chart">
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>
                    <div className="qw-preview-grid">
                        <div className="qw-preview-card">
                            <TrendingUp size={18} strokeWidth={2.2} />
                            <span>Bu Ay Gelir</span>
                            <strong>Gizli</strong>
                        </div>
                        <div className="qw-preview-card">
                            <TrendingDown size={18} strokeWidth={2.2} />
                            <span>Bu Ay Gider</span>
                            <strong>Gizli</strong>
                        </div>
                    </div>
                </div>
            </section>

            <main className="qw-login-card-wrap">
                <form className="qw-login-card" onSubmit={premiumLoginSubmit}>
                    <div className="qw-login-card-brand">
                        <AppLogo size="md" showText />
                    </div>

                    <div className="qw-login-card-heading">
                        <h2>Tekrar hoş geldin</h2>
                        <p>Finansal hesabına devam etmek için giriş yap.</p>
                    </div>

                    <label className="qw-login-field">
                        <span>Kullanıcı adı veya e-posta</span>
                        <div>
                            <Mail size={18} strokeWidth={2.2} />
                            <input
                                type="email"
                                value={loginEmail}
                                onChange={(event) => setLoginEmail(event.target.value)}
                                placeholder="kullanici@kisisel-finans.app"
                                autoComplete="username"
                            />
                        </div>
                    </label>

                    <label className="qw-login-field">
                        <span>Şifre</span>
                        <div>
                            <LockKeyhole size={18} strokeWidth={2.2} />
                            <input
                                type={loginPasswordVisible ? 'text' : 'password'}
                                value={loginPassword}
                                onChange={(event) => setLoginPassword(event.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="qw-login-password-toggle"
                                onClick={() => setLoginPasswordVisible((value) => !value)}
                                aria-label={loginPasswordVisible ? 'Şifreyi gizle' : 'Şifreyi göster'}
                            >
                                {loginPasswordVisible ? <EyeOff size={18} strokeWidth={2.2} /> : <Eye size={18} strokeWidth={2.2} />}
                            </button>
                        </div>
                    </label>

                    <div className="qw-login-options">
                        <label>
                            <input
                                type="checkbox"
                                checked={loginRemember}
                                onChange={(event) => setLoginRemember(event.target.checked)}
                            />
                            <span>Beni hatırla</span>
                        </label>
                        <button type="button" title="Yakında">Şifremi unuttum</button>
                    </div>

                    <button type="submit" className="qw-login-submit" disabled={loginSubmitting}>
                        {loginSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                    </button>

                    <p className="qw-login-trust">Giriş yaparak güvenli oturum akışını başlatırsın.</p>
                </form>

                <footer className="qw-login-footer">
                    <span>© 2026 Kişisel Finans</span>
                    <span>Gizlilik · Yardım</span>
                </footer>
            </main>
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
                Kişisel Finans
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
            <ToastContainer position="top-right" autoClose={2000} theme={theme === 'dark' ? 'dark' : 'light'} />

            <ModalManager
                aktifModal={aktifModal} setAktifModal={setAktifModal}
                seciliVeri={seciliVeri}
                hesaplar={data.hesaplar}
                tumIslemler={data.islemler}
                // Budget Actions & State
                hesapAdi={budgetActions.hesapAdi} setHesapAdi={budgetActions.setHesapAdi}
                hesapTipi={budgetActions.hesapTipi} setHesapTipi={budgetActions.setHesapTipi}
                baslangicBakiye={budgetActions.baslangicBakiye} setBaslangicBakiye={budgetActions.setBaslangicBakiye}
                hesapKesimGunu={budgetActions.hesapKesimGunu} setHesapKesimGunu={budgetActions.setHesapKesimGunu}
                kartOdemeStratejisi={budgetActions.kartOdemeStratejisi} setKartOdemeStratejisi={budgetActions.setKartOdemeStratejisi}
                kartVarsayilanOdemeTutari={budgetActions.kartVarsayilanOdemeTutari} setKartVarsayilanOdemeTutari={budgetActions.setKartVarsayilanOdemeTutari}
                kartPlanlananOdemeTutari={budgetActions.kartPlanlananOdemeTutari} setKartPlanlananOdemeTutari={budgetActions.setKartPlanlananOdemeTutari}
                kartAsgariOdemeTutari={budgetActions.kartAsgariOdemeTutari} setKartAsgariOdemeTutari={budgetActions.setKartAsgariOdemeTutari}
                varsayilanOdemeAraci={budgetActions.varsayilanOdemeAraci} setVarsayilanOdemeAraci={budgetActions.setVarsayilanOdemeAraci}
                maasHesabi={budgetActions.maasHesabi} setMaasHesabi={budgetActions.setMaasHesabi}
                anaMaasHesabi={budgetActions.anaMaasHesabi} setAnaMaasHesabi={budgetActions.setAnaMaasHesabi}
                hesapMaasGunu={budgetActions.hesapMaasGunu} setHesapMaasGunu={budgetActions.setHesapMaasGunu}
                bagliMaasId={budgetActions.bagliMaasId} setBagliMaasId={budgetActions.setBagliMaasId}
                hesapDuzenle={budgetActions.hesapDuzenle}
                islemAciklama={budgetActions.islemAciklama} setIslemAciklama={budgetActions.setIslemAciklama}
                islemTutar={budgetActions.islemTutar} setIslemTutar={budgetActions.setIslemTutar}
                islemTarihi={budgetActions.islemTarihi} setIslemTarihi={budgetActions.setIslemTarihi}
                islemGelirTuru={budgetActions.islemGelirTuru} setIslemGelirTuru={budgetActions.setIslemGelirTuru}
                islemBagliMaasId={budgetActions.islemBagliMaasId} setIslemBagliMaasId={budgetActions.setIslemBagliMaasId}
                islemMaasDonemi={budgetActions.islemMaasDonemi} setIslemMaasDonemi={budgetActions.setIslemMaasDonemi}
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
                maasTur={budgetActions.maasTur} setMaasTur={budgetActions.setMaasTur}
                maasDuzenle={budgetActions.maasDuzenle}
                maaslar={data.maaslar}
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
                tanimHesapId={budgetActions.tanimHesapId} setTanimHesapId={budgetActions.setTanimHesapId}
                faturaTanimDuzenle={budgetActions.faturaTanimDuzenle}
                alanKodu={alanKodu}
                verileriTasi={budgetActions.verileriTasi}
                yeniKodInput={budgetActions.yeniKodInput} setYeniKodInput={budgetActions.setYeniKodInput}
                tasimaIslemiSuruyor={budgetActions.tasimaIslemiSuruyor}
                satisYap={() => investmentActions.satisYap(seciliVeri, budgetActions.secilenHesapId, budgetActions.islemTutar)}
                secilenHesapId={budgetActions.secilenHesapId} setSecilenHesapId={budgetActions.setSecilenHesapId}
                defaultPaymentAccountId={defaultPaymentAccountId}
                onKategoriUpdate={onKategoriUpdate}
                onYatirimTuruUpdate={onYatirimTuruUpdate}
                aylikLimit={data.aylikLimit}
                onLimitChange={onLimitChange}
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
                selectedPeriod={selectedPeriod}
                setSelectedPeriod={setSelectedPeriod}
                availablePeriods={availablePeriods}
                showPeriodFilter={!['hedefler', 'takvim', 'maasAnalizi'].includes(anaSekme)}
                theme={theme}
                onThemeToggle={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
            />

            <Notifications
                bildirimler={calculations.bildirimler.filter(b => {
                    if (anaSekme === 'butcem') return ['fatura', 'abonelik', 'maas', 'taksit', 'kk_hatirlatma', 'borc_hatirlatma'].includes(b.tip);
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
                    maaslar={data.maaslar}
                    hesaplar={data.hesaplar}
                    filtrelenmisIslemler={calculations.filtrelenmisIslemler}
                    tumIslemler={data.islemler}
                    selectedPeriod={selectedPeriod}
                    sadeceCuzdanNakiti={calculations.sadeceCuzdanNakiti}
                    genelToplamYatirimGucu={calculations.genelToplamYatirimGucu}
                    netVarlik={calculations.netVarlik}
                    tanimliFaturalar={data.tanimliFaturalar}
                    bekleyenFaturalar={filteredPendingBills}
                    taksitler={data.taksitler}
                    toplamKalanTaksitBorcu={calculations.toplamKalanTaksitBorcu}
                    abonelikler={data.abonelikler}
                    toplamSabitGider={calculations.toplamSabitGider}
                    kategoriListesi={data.kategoriListesi}
                    defaultPaymentAccountId={defaultPaymentAccountId}
                    mevcutAylar={calculations.mevcutAylar}
                    aramaMetni={calculations.aramaMetni} setAramaMetni={calculations.setAramaMetni}
                    filtreKategori={calculations.filtreKategori} setFiltreKategori={calculations.setFiltreKategori}

                    // Actions & States
                    aktifModal={aktifModal}
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
                    islemGelirTuru={budgetActions.islemGelirTuru} setIslemGelirTuru={budgetActions.setIslemGelirTuru}
                    islemBagliMaasId={budgetActions.islemBagliMaasId} setIslemBagliMaasId={budgetActions.setIslemBagliMaasId}
                    islemMaasDonemi={budgetActions.islemMaasDonemi} setIslemMaasDonemi={budgetActions.setIslemMaasDonemi}
                    transferKaynakId={budgetActions.transferKaynakId} setTransferKaynakId={budgetActions.setTransferKaynakId}
                    transferHedefId={budgetActions.transferHedefId} setTransferHedefId={budgetActions.setTransferHedefId}
                    transferTutar={budgetActions.transferTutar} setTransferTutar={budgetActions.setTransferTutar}
                    transferUcreti={budgetActions.transferUcreti} setTransferUcreti={budgetActions.setTransferUcreti}
                    transferAciklama={budgetActions.transferAciklama} setTransferAciklama={budgetActions.setTransferAciklama}
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

                    borclar={filteredDebts}
                    toplamKalanBorc={calculations.toplamKalanBorc}
                    borcOde={budgetActions.borcOde}
                    borcDuzenle={budgetActions.borcDuzenle}
                    borcOrderGuncelle={budgetActions.borcOrderGuncelle}

                    excelIndir={() => budgetActions.excelIndir(data.islemler)}
                    excelYukle={budgetActions.excelYukle}
                    islemSil={budgetActions.islemSil}
                    setAnaSekme={setAnaSekme}
                />
            )}

            {/* MAAŞ ANALİZİ */}
            {anaSekme === "maasAnalizi" && (
                <SalaryAnalysisDashboard
                    hesaplar={data.hesaplar}
                    maaslar={data.maaslar}
                    taksitler={data.taksitler}
                    tumIslemler={data.islemler}
                    selectedPeriod={selectedPeriod}
                    modalAc={modalAc}
                    islemSil={budgetActions.islemSil}
                    normalSil={budgetActions.normalSil}
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
                    selectedPeriod={selectedPeriod}
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

            {/* FİNANS TAKVİMİ */}
            {anaSekme === "takvim" && (
                <FinanceCalendarDashboard
                    user={user}
                    alanKodu={alanKodu}
                    gizliMod={gizliMod}
                    sourceData={{
                        accounts: data.hesaplar,
                        transactions: data.islemler,
                        subscriptions: data.abonelikler,
                        installments: data.taksitler,
                        bills: data.bekleyenFaturalar,
                        billDefinitions: data.tanimliFaturalar,
                        debts: data.borclar,
                        salaries: data.maaslar,
                        goals: data.hedefler,
                        inventory: data.envanter,
                    }}
                />
            )}

            <GlobalQuickTransaction
                isOpen={globalQuickOpen}
                onOpen={() => setGlobalQuickOpen(true)}
                onClose={() => setGlobalQuickOpen(false)}
                quickFormProps={quickTransactionFormProps}
            />

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
