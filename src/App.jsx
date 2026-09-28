import { useState, useEffect, useMemo } from 'react'
import { auth, db } from './firebase'
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore'
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';

// Components
import Header from './components/Layout/Header';
import Notifications from './components/Shared/Notifications';
import BudgetDashboard from './components/Budget/BudgetDashboard';
import GlobalQuickTransaction from './components/Budget/GlobalQuickTransaction';
import FinancingDashboard from './components/Financing/FinancingDashboard';
import InvestmentDashboard from './components/Investment/InvestmentDashboard';
import GoalsInventory from './components/Budget/GoalsInventory';
import DefinitionsDashboard from './components/Definitions/DefinitionsDashboard';
import FinanceCalendarDashboard from './components/Calendar/FinanceCalendarDashboard';
import SalaryAnalysisDashboard from './components/Salary/SalaryAnalysisDashboard';
import ModalManager from './components/Modals/ModalManager';
import MobileNav from './components/Layout/MobileNav';
import AppLogo from './components/Shared/AppLogo';
import SettingsDashboard from './components/Settings/SettingsDashboard';
import { useDefaultPaymentAccount } from './utils/defaultPaymentAccount';
import {
    changeAreaAccessCode,
    createPasswordRecord,
    ensureAreaAccessRecord,
    normalizeAreaCode,
    resolveAreaLogin,
    validateAreaPassword,
    verifyAreaPassword,
} from './utils/areaSecurity';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useDataListeners } from './hooks/useDataListeners';
import { useBudgetActions } from './hooks/useBudgetActions';
import { useInvestmentActions } from './hooks/useInvestmentActions';
import { useCalculations } from './hooks/useCalculations';
import Feedback from './components/Feedback';


// Helpers
import { formatMoneyInputValue, inputStyle, toDateSafe } from './utils/helpers';
import { buildAvailablePeriods, getDefaultPeriod, getLatestAvailablePeriod, isPeriodAvailable, readInitialPeriod } from './utils/period';
import { selectHasInvestmentAccount } from './utils/accounts';

const normalizeCategoryKey = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR');

const cleanCategoryName = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

const mergeCategoryList = (categories = []) => {
    const seen = new Set();
    return categories.reduce((list, category) => {
        const name = cleanCategoryName(category);
        const key = normalizeCategoryKey(name);
        if (!name || seen.has(key)) return list;
        seen.add(key);
        list.push(name);
        return list;
    }, []);
};

const isDueBySelectedPeriodEnd = (dateLike, period) => {
    if (!period || period.month === 'all') return true;
    const date = toDateSafe(dateLike);
    if (!date) return true;
    const periodEnd = new Date(Number(period.year), Number(period.month), 0, 23, 59, 59, 999);
    return date.getTime() <= periodEnd.getTime();
};

const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'light';

    const storedTheme = window.localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getInitialTab = () => (
    typeof window !== 'undefined' && window.location.pathname.startsWith('/finansmanlar')
        ? 'finansmanlar'
        : typeof window !== 'undefined' && window.location.pathname.startsWith('/tanimlamalar')
            ? 'tanimlamalar'
            : typeof window !== 'undefined' && window.location.pathname.startsWith('/yatirimlar')
                ? 'yatirimlar'
                : 'butcem'
);

const getTabFromPath = (path) => {
    if (path.startsWith('/finansmanlar')) return 'finansmanlar';
    if (path.startsWith('/tanimlamalar')) return 'tanimlamalar';
    if (path.startsWith('/yatirimlar')) return 'yatirimlar';
    return 'butcem';
};

function App() {
    // 1. AUTH
    const { user, loading, girisYap, cikisYap: authLogout } = useAuth();

    // 2. LOCAL UI STATE
    const [anaSekme, setAnaSekme] = useState(getInitialTab);
    const [routePath, setRoutePath] = useState(() => (typeof window === 'undefined' ? '/' : window.location.pathname));
    const [gizliMod, setGizliMod] = useState(false);
    const [aktifModal, setAktifModal] = useState(null);
    const [seciliVeri, setSeciliVeri] = useState(null);
    const [formTab, setFormTab] = useState("islem");
    const [globalQuickOpen, setGlobalQuickOpen] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(readInitialPeriod);
    const [theme, setTheme] = useState(getInitialTheme);

    // Login / Code Login
    const [alanKodu, setAlanKodu] = useState(localStorage.getItem("alan_kodu") || "");
    const [veriAlanKodu, setVeriAlanKodu] = useState(localStorage.getItem("veri_alan_kodu") || localStorage.getItem("alan_kodu") || "");
    const [areaRecord, setAreaRecord] = useState(null);
    const [girilenKod, setGirilenKod] = useState("");
    const [alanSifresi, setAlanSifresi] = useState("");
    const [alanSifresiTekrar, setAlanSifresiTekrar] = useState("");
    const [areaLoginStep, setAreaLoginStep] = useState("code");
    const [areaLoginSubmitting, setAreaLoginSubmitting] = useState(false);
    const [areaPasswordVisible, setAreaPasswordVisible] = useState(false);
    const [showPasswordSetupPrompt, setShowPasswordSetupPrompt] = useState(false);
    const [passwordSetupForm, setPasswordSetupForm] = useState({ password: "", confirm: "" });
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginRemember, setLoginRemember] = useState(false);
    const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);
    const [loginSubmitting, setLoginSubmitting] = useState(false);
    const [passwordResetSubmitting, setPasswordResetSubmitting] = useState(false);

    // 3. HOOKS initialization
    const data = useDataListeners(user, veriAlanKodu);
    const calculations = useCalculations(data, gizliMod, data.aylikLimit, selectedPeriod);
    const budgetActions = useBudgetActions(user, veriAlanKodu, data.hesaplar, data.kategoriListesi, data.tanimliFaturalar, data.etiketler, data.transactionTags, data.cariler);
    const investmentActions = useInvestmentActions(user, veriAlanKodu);
    const defaultPaymentAccount = useDefaultPaymentAccount(data.hesaplar);
    const defaultPaymentAccountId = defaultPaymentAccount?.id || "";
    const selectedFinancingId = routePath.match(/^\/finansmanlar\/([^/]+)/)?.[1] || null;
    const hasInvestmentAccount = useMemo(() => selectHasInvestmentAccount(data.hesaplar), [data.hesaplar]);
    const showInvestmentFeature = data.hesaplarLoaded ? hasInvestmentAccount : true;

    const navigateTo = (path) => {
        const url = new URL(window.location.href);
        url.pathname = path;
        window.history.pushState({}, '', `${url.pathname}${url.search}`);
        setRoutePath(path);
        setAnaSekme(getTabFromPath(path));
    };

    const changeTab = (tab) => {
        const nextTab = tab === 'yatirimlar' && data.hesaplarLoaded && !hasInvestmentAccount
            ? 'butcem'
            : tab;

        setAnaSekme(nextTab);
        if (nextTab === 'finansmanlar' || nextTab === 'tanimlamalar' || nextTab === 'yatirimlar') {
            const url = new URL(window.location.href);
            url.pathname = nextTab === 'finansmanlar'
                ? '/finansmanlar'
                : nextTab === 'tanimlamalar'
                    ? '/tanimlamalar'
                    : '/yatirimlar';
            window.history.pushState({}, '', `${url.pathname}${url.search}`);
            setRoutePath(url.pathname);
            return;
        }
        if (
            window.location.pathname.startsWith('/finansmanlar')
            || window.location.pathname.startsWith('/tanimlamalar')
            || window.location.pathname.startsWith('/yatirimlar')
        ) {
            const url = new URL(window.location.href);
            url.pathname = '/';
            window.history.pushState({}, '', `${url.pathname}${url.search}`);
            setRoutePath('/');
        }
    };

    useEffect(() => {
        if (!data.hesaplarLoaded) return;
        if (anaSekme !== 'yatirimlar') return;
        if (hasInvestmentAccount) return;
        changeTab('butcem');
    }, [anaSekme, data.hesaplarLoaded, hasInvestmentAccount]);

    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname;
            setRoutePath(path);
            setAnaSekme(getTabFromPath(path));
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        const current = getDefaultPeriod();
        const currentKey = `${current.year}-${String(current.month).padStart(2, '0')}`;
        const selectedKey = selectedPeriod.month === 'all'
            ? `${selectedPeriod.year}-99`
            : `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`;
        const lastRolloverKey = localStorage.getItem('tm_finance_period_last_rollover');

        if (selectedPeriod.month !== 'all' && selectedKey < currentKey && lastRolloverKey !== currentKey) {
            localStorage.setItem('tm_finance_period_last_rollover', currentKey);
            setSelectedPeriod(current);
        }
    }, [selectedPeriod]);

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
        const dates = [
            ...data.islemler.map((item) => item.tarih),
            ...data.bekleyenFaturalar.map((item) => item.sonOdemeTarihi || item.tarih),
            ...data.borclar.map((item) => item.sonOdemeTarihi),
            ...data.finansmanlar.map((item) => item.usageDate || item.closureDate),
            ...data.cariIslemler.map((item) => item.sonOdemeTarihi || item.tarih),
        ];
        const periods = buildAvailablePeriods(dates);
        if (periods.years.length > 0) return periods;

        const fallback = getDefaultPeriod();
        return {
            years: [fallback.year],
            monthsByYear: { [fallback.year]: [fallback.month] },
        };
    }, [data.islemler, data.bekleyenFaturalar, data.borclar, data.finansmanlar, data.cariIslemler]);

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
        isDueBySelectedPeriodEnd(bill.sonOdemeTarihi, selectedPeriod)
    ));

    const filteredDebts = data.borclar.filter((debt) => (
        isDueBySelectedPeriodEnd(debt.sonOdemeTarihi, selectedPeriod)
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
        setVeriAlanKodu("");
        setAreaRecord(null);
        localStorage.removeItem("alan_kodu");
        localStorage.removeItem("veri_alan_kodu");
        sessionStorage.clear();
    }

    const completeAreaLogin = async ({ accessCode, dataCode, record }) => {
        localStorage.setItem("alan_kodu", accessCode);
        localStorage.setItem("veri_alan_kodu", dataCode);
        sessionStorage.setItem(`area_authenticated:${accessCode}`, "1");
        setAlanKodu(accessCode);
        setVeriAlanKodu(dataCode);
        setAreaRecord(record);
        setGirilenKod("");
        setAlanSifresi("");
        setAlanSifresiTekrar("");
        setAreaLoginStep("code");

        const promptKey = `area_password_prompt_seen:${accessCode}`;
        if (!record?.passwordConfigured && sessionStorage.getItem(promptKey) !== "1") {
            sessionStorage.setItem(promptKey, "1");
            setShowPasswordSetupPrompt(true);
        }
    };

    useEffect(() => {
        if (!user || !alanKodu) return;
        let cancelled = false;

        const syncStoredArea = async () => {
            try {
                const loginContext = await resolveAreaLogin(alanKodu);
                if (cancelled) return;
                if (
                    loginContext.areaRecord?.passwordConfigured
                    && sessionStorage.getItem(`area_authenticated:${loginContext.accessCode}`) !== "1"
                ) {
                    localStorage.removeItem("alan_kodu");
                    localStorage.removeItem("veri_alan_kodu");
                    setAlanKodu("");
                    setVeriAlanKodu("");
                    setAreaRecord(null);
                    setGirilenKod(loginContext.accessCode);
                    setAreaLoginStep("password");
                    return;
                }
                setAreaRecord(loginContext.areaRecord);
                setVeriAlanKodu(loginContext.dataCode);
                localStorage.setItem("veri_alan_kodu", loginContext.dataCode);
            } catch (error) {
                console.error("Kayıtlı alan kodu doğrulanamadı:", error);
                localStorage.removeItem("alan_kodu");
                localStorage.removeItem("veri_alan_kodu");
                setAlanKodu("");
                setVeriAlanKodu("");
                setAreaRecord(null);
            }
        };

        syncStoredArea();
        return () => {
            cancelled = true;
        };
    }, [user, alanKodu]);

    const kodIleGiris = async (e) => {
        e.preventDefault();
        if (areaLoginSubmitting) return;

        setAreaLoginSubmitting(true);
        try {
            if (areaLoginStep === "code") {
                const loginContext = await resolveAreaLogin(girilenKod);
                if (loginContext.areaRecord?.passwordConfigured) {
                    setAreaRecord(loginContext.areaRecord);
                    setGirilenKod(loginContext.accessCode);
                    setVeriAlanKodu("");
                    setAreaLoginStep("password");
                    return;
                }

                if (loginContext.isLegacy) {
                    const settingsSnap = await getDoc(doc(db, "ayarlar", loginContext.dataCode));
                    if (!settingsSnap.exists()) {
                        setAreaRecord(loginContext.areaRecord);
                        setGirilenKod(loginContext.accessCode);
                        setVeriAlanKodu(loginContext.dataCode);
                        setAreaLoginStep("create-password");
                        return;
                    }
                }

                await completeAreaLogin({
                    accessCode: loginContext.accessCode,
                    dataCode: loginContext.dataCode,
                    record: loginContext.areaRecord,
                });
                return;
            }

            if (areaLoginStep === "create-password") {
                if (alanSifresi !== alanSifresiTekrar) {
                    toast.warning("Şifreler uyuşmuyor.");
                    return;
                }
                const passwordRecord = await createPasswordRecord(alanSifresi);
                const loginContext = await resolveAreaLogin(girilenKod);
                await ensureAreaAccessRecord({
                    accessCode: loginContext.accessCode,
                    dataCode: loginContext.dataCode,
                    uid: user?.uid,
                    passwordRecord,
                });
                await completeAreaLogin({
                    accessCode: loginContext.accessCode,
                    dataCode: loginContext.dataCode,
                    record: { ...loginContext.areaRecord, ...passwordRecord, passwordConfigured: true },
                });
                toast.success("Yeni alan şifresi oluşturuldu.");
                return;
            }

            const loginContext = await resolveAreaLogin(girilenKod);
            const verified = await verifyAreaPassword(alanSifresi, loginContext.areaRecord);
            if (!verified) {
                toast.error("Alan şifresi hatalı.");
                return;
            }
            await completeAreaLogin({
                accessCode: loginContext.accessCode,
                dataCode: loginContext.dataCode,
                record: loginContext.areaRecord,
            });
        } catch (error) {
            console.error("Alan girişi başarısız:", error);
            toast.error(error?.message || "Alan girişi yapılamadı.");
        } finally {
            setAreaLoginSubmitting(false);
        }
    }

    const premiumLoginSubmit = async (e) => {
        e.preventDefault();
        if (loginSubmitting) return;
        const email = loginEmail.trim().toLowerCase();
        if (!email || !loginPassword) {
            toast.warning("E-posta ve şifreyi gir.");
            return;
        }
        setLoginSubmitting(true);
        try {
            await signInWithEmailAndPassword(auth, email, loginPassword);
        } catch (error) {
            console.error("Firebase email/password login failed:", {
                code: error?.code,
                message: error?.message,
            });
            if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') {
                toast.error("E-posta veya şifre hatalı.");
            } else if (error?.code === 'auth/user-not-found') {
                toast.error("Bu e-posta ile kayıtlı kullanıcı bulunamadı.");
            } else {
                toast.error("Giriş başarısız. Lütfen tekrar dene.");
            }
        } finally {
            setLoginSubmitting(false);
        }
    }

    const handlePasswordReset = async () => {
        if (passwordResetSubmitting) return;
        const enteredEmail = loginEmail.trim().toLowerCase();
        const email = enteredEmail || window.prompt("Şifre sıfırlama e-postası için adresini gir:");
        const normalizedEmail = email?.trim().toLowerCase();

        if (!normalizedEmail) {
            toast.info("Şifre sıfırlama için e-posta gerekli.");
            return;
        }

        setPasswordResetSubmitting(true);
        try {
            await sendPasswordResetEmail(auth, normalizedEmail);
            toast.success("Şifre sıfırlama e-postası gönderildi.");
        } catch (error) {
            console.error("Firebase password reset failed:", {
                code: error?.code,
                message: error?.message,
            });
            toast.error("Şifre sıfırlama e-postası gönderilemedi.");
        } finally {
            setPasswordResetSubmitting(false);
        }
    }

    const koddanCikis = () => {
        setAktifModal('cikis_onay');
    }

    const handleConfirmLogout = () => {
        localStorage.removeItem("alan_kodu");
        localStorage.removeItem("veri_alan_kodu");
        sessionStorage.removeItem(`area_authenticated:${alanKodu}`);
        setAlanKodu("");
        setVeriAlanKodu("");
        setAreaRecord(null);
        setAreaLoginStep("code");
    }

    const refreshAreaRecord = async () => {
        if (!alanKodu) return null;
        const loginContext = await resolveAreaLogin(alanKodu);
        setAreaRecord(loginContext.areaRecord);
        setVeriAlanKodu(loginContext.dataCode);
        localStorage.setItem("veri_alan_kodu", loginContext.dataCode);
        return loginContext.areaRecord;
    };

    const handleCreateAreaPassword = async ({ password, confirm } = passwordSetupForm) => {
        if (!alanKodu || !veriAlanKodu) return false;
        if (password !== confirm) {
            toast.warning("Şifreler uyuşmuyor.");
            return false;
        }
        const validation = validateAreaPassword(password);
        if (validation) {
            toast.warning(validation);
            return false;
        }

        try {
            const passwordRecord = await createPasswordRecord(password);
            await ensureAreaAccessRecord({
                accessCode: alanKodu,
                dataCode: veriAlanKodu,
                uid: user?.uid,
                passwordRecord,
            });
            await refreshAreaRecord();
            setShowPasswordSetupPrompt(false);
            setPasswordSetupForm({ password: "", confirm: "" });
            toast.success("Alan şifresi oluşturuldu.");
            return true;
        } catch (error) {
            console.error("Alan şifresi oluşturulamadı:", error);
            toast.error(error?.message || "Alan şifresi oluşturulamadı.");
            return false;
        }
    };

    const handleChangeAreaPassword = async ({ currentPassword, nextPassword, confirmPassword }) => {
        if (!alanKodu || !veriAlanKodu) return false;
        if (nextPassword !== confirmPassword) {
            toast.warning("Yeni şifreler uyuşmuyor.");
            return false;
        }
        const validation = validateAreaPassword(nextPassword);
        if (validation) {
            toast.warning(validation);
            return false;
        }

        try {
            const currentRecord = await refreshAreaRecord();
            if (currentRecord?.passwordConfigured) {
                const verified = await verifyAreaPassword(currentPassword, currentRecord);
                if (!verified) {
                    toast.error("Mevcut şifre hatalı.");
                    return false;
                }
            }
            const passwordRecord = await createPasswordRecord(nextPassword);
            await ensureAreaAccessRecord({
                accessCode: alanKodu,
                dataCode: veriAlanKodu,
                uid: user?.uid,
                passwordRecord,
            });
            await refreshAreaRecord();
            toast.success(currentRecord?.passwordConfigured ? "Alan şifresi değiştirildi." : "Alan şifresi oluşturuldu.");
            return true;
        } catch (error) {
            console.error("Alan şifresi güncellenemedi:", error);
            toast.error(error?.message || "Alan şifresi güncellenemedi.");
            return false;
        }
    };

    const handleChangeAreaCode = async ({ nextCode, confirmCode, currentPassword }) => {
        const normalizedNextCode = normalizeAreaCode(nextCode);
        if (normalizedNextCode !== normalizeAreaCode(confirmCode)) {
            toast.warning("Yeni alan kodları uyuşmuyor.");
            return false;
        }

        try {
            const currentRecord = await refreshAreaRecord();
            if (currentRecord?.passwordConfigured) {
                const verified = await verifyAreaPassword(currentPassword, currentRecord);
                if (!verified) {
                    toast.error("Alan şifresi hatalı.");
                    return false;
                }
            }
            await changeAreaAccessCode({
                currentAccessCode: alanKodu,
                currentDataCode: veriAlanKodu,
                nextAccessCode: normalizedNextCode,
                uid: user?.uid,
            });
            localStorage.setItem("alan_kodu", normalizedNextCode);
            localStorage.setItem("veri_alan_kodu", veriAlanKodu);
            sessionStorage.setItem(`area_authenticated:${normalizedNextCode}`, "1");
            sessionStorage.removeItem(`area_authenticated:${alanKodu}`);
            setAlanKodu(normalizedNextCode);
            const loginContext = await resolveAreaLogin(normalizedNextCode);
            setAreaRecord(loginContext.areaRecord);
            toast.success("Alan kodu değiştirildi.");
            return true;
        } catch (error) {
            console.error("Alan kodu değiştirilemedi:", error);
            toast.error(error?.message || "Alan kodu değiştirilemedi.");
            return false;
        }
    };

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
        setDoc(doc(db, "ayarlar", veriAlanKodu), { limit: limit }, { merge: true });
    }
    const commitCategoryReferenceUpdates = async (updates) => {
        for (let i = 0; i < updates.length; i += 450) {
            const batch = writeBatch(db);
            updates.slice(i, i + 450).forEach(({ collectionName, id, kategori: nextCategory }) => {
                batch.update(doc(db, collectionName, id), { kategori: nextCategory });
            });
            await batch.commit();
        }
    };

    const onKategoriUpdate = async (y) => {
        const nextCategories = mergeCategoryList(y);
        data.setKategoriListesi(nextCategories);
        await setDoc(doc(db, "ayarlar", veriAlanKodu), { kategoriler: nextCategories }, { merge: true });
    }

    const onKategoriRename = async (oldName, newName) => {
        const from = cleanCategoryName(oldName);
        const to = cleanCategoryName(newName);
        if (!from || !to) {
            toast.warning("Kategori adlarını doldurun.");
            return false;
        }
        if (normalizeCategoryKey(from) === normalizeCategoryKey(to)) {
            toast.info("Kategori adı değişmedi.");
            return false;
        }

        const categoryCollections = [
            { collectionName: "nakit_islemleri", items: data.islemler },
            { collectionName: "abonelikler", items: data.abonelikler },
            { collectionName: "taksitler", items: data.taksitler },
            { collectionName: "borclar", items: data.borclar },
            { collectionName: "cari_islemleri", items: data.cariIslemler },
        ];
        const updates = categoryCollections.flatMap(({ collectionName, items }) => (
            (items || [])
                .filter((item) => item.id && normalizeCategoryKey(item.kategori) === normalizeCategoryKey(from))
                .map((item) => ({ collectionName, id: item.id, kategori: to }))
        ));
        const nextCategories = mergeCategoryList((data.kategoriListesi || []).map((category) => (
            normalizeCategoryKey(category) === normalizeCategoryKey(from) ? to : category
        )).concat(to));

        await setDoc(doc(db, "ayarlar", veriAlanKodu), { kategoriler: nextCategories }, { merge: true });
        data.setKategoriListesi(nextCategories);
        await commitCategoryReferenceUpdates(updates);
        toast.success(`${updates.length} kayıt "${to}" kategorisine güncellendi.`);
        return true;
    };

    const onBulkCategoryMove = async ({ fromCategory, toCategory, descriptionFilter, transactionIds }) => {
        const from = cleanCategoryName(fromCategory);
        const to = cleanCategoryName(toCategory);
        const filter = cleanCategoryName(descriptionFilter);
        const ids = Array.isArray(transactionIds) ? transactionIds.filter(Boolean) : [];
        if (!to) {
            toast.warning("Hedef kategori seçin.");
            return false;
        }
        if (!ids.length && !from) {
            toast.warning("Kaynak kategori seçin.");
            return false;
        }
        if (!ids.length && normalizeCategoryKey(from) === normalizeCategoryKey(to)) {
            toast.info("Kaynak ve hedef kategori aynı.");
            return false;
        }

        const normalizedFilter = normalizeCategoryKey(filter);
        const updates = (data.islemler || [])
            .filter((item) => {
                if (ids.length > 0) return item.id && ids.includes(item.id);
                if (!item.id || normalizeCategoryKey(item.kategori) !== normalizeCategoryKey(from)) return false;
                if (!normalizedFilter) return true;
                return normalizeCategoryKey(item.aciklama).includes(normalizedFilter);
            })
            .filter((item) => normalizeCategoryKey(item.kategori) !== normalizeCategoryKey(to))
            .map((item) => ({ collectionName: "nakit_islemleri", id: item.id, kategori: to }));

        if (updates.length === 0) {
            toast.info("Taşınacak işlem bulunamadı.");
            return false;
        }

        const nextCategories = mergeCategoryList([...(data.kategoriListesi || []), to]);
        await setDoc(doc(db, "ayarlar", veriAlanKodu), { kategoriler: nextCategories }, { merge: true });
        data.setKategoriListesi(nextCategories);
        await commitCategoryReferenceUpdates(updates);
        toast.success(`${updates.length} işlem "${to}" kategorisine taşındı.`);
        return true;
    };
    const onYatirimTuruUpdate = async (y) => {
        const nextTypes = mergeCategoryList(y);
        data.setYatirimTurleri(nextTypes);
        await setDoc(doc(db, "ayarlar", veriAlanKodu), { yatirimTurleri: nextTypes }, { merge: true });
    }

    const onYatirimTuruRename = async (oldName, newName) => {
        const from = cleanCategoryName(oldName);
        const to = cleanCategoryName(newName);
        if (!from || !to) {
            toast.warning("Tür adlarını doldurun.");
            return false;
        }
        if (normalizeCategoryKey(from) === normalizeCategoryKey(to)) {
            toast.info("Tür adı değişmedi.");
            return false;
        }

        const updates = [
            ...(data.portfoy || [])
                .filter((item) => item.id && normalizeCategoryKey(item.varlikTuru) === normalizeCategoryKey(from))
                .map((item) => ({ collectionName: "portfoy", id: item.id, field: "varlikTuru", value: to })),
            ...(data.islemler || [])
                .filter((item) => item.id && normalizeCategoryKey(item.yatirimTuru) === normalizeCategoryKey(from))
                .map((item) => ({ collectionName: "nakit_islemleri", id: item.id, field: "yatirimTuru", value: to })),
        ];

        const nextTypes = mergeCategoryList((data.yatirimTurleri || []).map((type) => (
            normalizeCategoryKey(type) === normalizeCategoryKey(from) ? to : type
        )).concat(to));
        await setDoc(doc(db, "ayarlar", veriAlanKodu), { yatirimTurleri: nextTypes }, { merge: true });
        data.setYatirimTurleri(nextTypes);

        for (let i = 0; i < updates.length; i += 450) {
            const batch = writeBatch(db);
            updates.slice(i, i + 450).forEach(({ collectionName, id, field, value }) => {
                batch.update(doc(db, collectionName, id), { [field]: value });
            });
            await batch.commit();
        }

        toast.success(`${updates.length} yatırım kaydı "${to}" olarak güncellendi.`);
        return true;
    };

    const quickTransactionFormProps = {
        formTab, setFormTab,
        hesaplar: data.hesaplar,
        kategoriListesi: data.kategoriListesi,
        maaslar: data.maaslar,
        tanimliFaturalar: data.tanimliFaturalar,
        etiketler: data.etiketler,
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
        secilenEtiketIds: budgetActions.secilenEtiketIds,
        setSecilenEtiketIds: budgetActions.setSecilenEtiketIds,
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
                        <button type="button" onClick={handlePasswordReset} disabled={passwordResetSubmitting}>
                            {passwordResetSubmitting ? 'Gönderiliyor...' : 'Şifremi unuttum'}
                        </button>
                    </div>

                    <button type="submit" className="qw-login-submit" disabled={loginSubmitting}>
                        {loginSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                    </button>

                    <button type="button" className="qw-login-google" onClick={girisYap}>
                        Google ile giriş yap
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
            position: 'fixed',
            inset: 0,
            width: 'calc(100vw / var(--app-zoom, 1))',
            height: 'calc(100dvh / var(--app-zoom, 1))',
            minHeight: 'calc(100dvh / var(--app-zoom, 1))',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
            fontFamily: 'Segoe UI',
            overflow: 'hidden',
            zIndex: 0
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
                <p style={{ fontSize: '15px', color: '#6b7280', marginBottom: '30px' }}>
                    {areaLoginStep === 'password'
                        ? 'Bu alan şifreyle korunuyor. Devam etmek için alan şifresini girin.'
                        : areaLoginStep === 'create-password'
                            ? 'Yeni alan için bir şifre oluşturun.'
                            : 'Verilerinize erişmek için alan kodunuzu girin.'}
                </p>

                <form onSubmit={kodIleGiris}>
                    <div style={{ marginBottom: '20px' }}>
                        <input
                            placeholder="Alan kodu (Örn: AİLE_EV)"
                            value={girilenKod}
                            onChange={e => {
                                setGirilenKod(normalizeAreaCode(e.target.value));
                                if (areaLoginStep !== 'code') {
                                    setAreaLoginStep('code');
                                    setAlanSifresi('');
                                    setAreaRecord(null);
                                }
                            }}
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
                            disabled={areaLoginStep !== 'code'}
                            required
                        />
                    </div>
                    {(areaLoginStep === 'password' || areaLoginStep === 'create-password') && (
                        <div style={{ marginBottom: '20px', position: 'relative' }}>
                            <input
                                type={areaPasswordVisible ? 'text' : 'password'}
                                placeholder={areaLoginStep === 'create-password' ? 'Yeni alan şifresi' : 'Alan şifresi'}
                                value={alanSifresi}
                                onChange={e => setAlanSifresi(e.target.value)}
                                style={{
                                    ...inputStyle,
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '14px 46px 14px 16px',
                                    fontSize: '16px',
                                    background: '#f9fafb',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                }}
                                autoFocus
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setAreaPasswordVisible((value) => !value)}
                                aria-label={areaPasswordVisible ? 'Şifreyi gizle' : 'Şifreyi göster'}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#6b7280',
                                    cursor: 'pointer',
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                            >
                                {areaPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    )}
                    {areaLoginStep === 'create-password' && (
                        <div style={{ marginBottom: '20px' }}>
                            <input
                                type={areaPasswordVisible ? 'text' : 'password'}
                                placeholder="Yeni alan şifresi tekrar"
                                value={alanSifresiTekrar}
                                onChange={e => setAlanSifresiTekrar(e.target.value)}
                                style={{
                                    ...inputStyle,
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '14px 16px',
                                    fontSize: '16px',
                                    background: '#f9fafb',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '12px',
                                }}
                                required
                            />
                            <div style={{ marginTop: '8px', color: '#6b7280', fontSize: '12px', textAlign: 'left' }}>
                                En az 8 karakter, bir büyük harf, bir küçük harf ve bir rakam.
                            </div>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={areaLoginSubmitting}
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
                        {areaLoginSubmitting ? 'KONTROL EDİLİYOR...' : areaLoginStep === 'password' ? 'ŞİFREYLE GİRİŞ YAP' : areaLoginStep === 'create-password' ? 'ŞİFRE OLUŞTUR VE GİR' : 'DEVAM ET'}
                    </button>
                    {areaLoginStep !== 'code' && (
                        <button
                            type="button"
                            onClick={() => {
                                setAreaLoginStep('code');
                                setAlanSifresi('');
                                setAlanSifresiTekrar('');
                                setAreaRecord(null);
                            }}
                            style={{
                                width: '100%',
                                marginTop: '10px',
                                padding: '12px',
                                background: '#f3f4f6',
                                color: '#374151',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                            }}
                        >
                            Alan kodunu değiştir
                        </button>
                    )}
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

            {showPasswordSetupPrompt && (
                <div className="area-security-dialog-layer" role="presentation">
                    <button
                        type="button"
                        className="area-security-dialog-backdrop"
                        aria-label="Kapat"
                        onClick={() => setShowPasswordSetupPrompt(false)}
                    />
                    <div className="area-security-dialog" role="dialog" aria-modal="true">
                        <h3>Alanınızı şifreyle koruyun</h3>
                        <p>Bu alan için ek bir şifre oluşturarak finansal verilerinize erişimi daha güvenli hale getirebilirsiniz.</p>
                        <form onSubmit={async (event) => {
                            event.preventDefault();
                            await handleCreateAreaPassword();
                        }}>
                            <label>
                                Şifre
                                <input
                                    type="password"
                                    value={passwordSetupForm.password}
                                    onChange={(event) => setPasswordSetupForm((current) => ({ ...current, password: event.target.value }))}
                                    style={inputStyle}
                                    autoComplete="new-password"
                                />
                            </label>
                            <label>
                                Şifre Tekrar
                                <input
                                    type="password"
                                    value={passwordSetupForm.confirm}
                                    onChange={(event) => setPasswordSetupForm((current) => ({ ...current, confirm: event.target.value }))}
                                    style={inputStyle}
                                    autoComplete="new-password"
                                />
                            </label>
                            <small>En az 8 karakter, bir büyük harf, bir küçük harf ve bir rakam.</small>
                            <div>
                                <button type="button" onClick={() => setShowPasswordSetupPrompt(false)}>Şimdi Değil</button>
                                <button type="submit">Şifre Oluştur</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ModalManager
                aktifModal={aktifModal} setAktifModal={setAktifModal}
                seciliVeri={seciliVeri}
                hesaplar={data.hesaplar}
                cariler={data.cariler}
                tumIslemler={data.islemler}
                // Budget Actions & State
                hesapAdi={budgetActions.hesapAdi} setHesapAdi={budgetActions.setHesapAdi}
                hesapTipi={budgetActions.hesapTipi} setHesapTipi={budgetActions.setHesapTipi}
                baslangicBakiye={budgetActions.baslangicBakiye} setBaslangicBakiye={budgetActions.setBaslangicBakiye}
                hesapKesimGunu={budgetActions.hesapKesimGunu} setHesapKesimGunu={budgetActions.setHesapKesimGunu}
                kartLimiti={budgetActions.kartLimiti} setKartLimiti={budgetActions.setKartLimiti}
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
                secilenEtiketIds={budgetActions.secilenEtiketIds} setSecilenEtiketIds={budgetActions.setSecilenEtiketIds}
                // NEW: Quantity & Unit Price Props
                islemAdet={budgetActions.islemAdet} setIslemAdet={budgetActions.setIslemAdet}
                islemBirimFiyat={budgetActions.islemBirimFiyat} setIslemBirimFiyat={budgetActions.setIslemBirimFiyat}
                kategori={budgetActions.kategori} setKategori={budgetActions.setKategori}
                yatirimTurleri={data.yatirimTurleri}
                etiketler={data.etiketler}
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
                kkOdemeTarihi={budgetActions.kkOdemeTarihi} setKkOdemeTarihi={budgetActions.setKkOdemeTarihi}
                kkOdemeAciklama={budgetActions.kkOdemeAciklama} setKkOdemeAciklama={budgetActions.setKkOdemeAciklama}
                kkOdemeTipi={budgetActions.kkOdemeTipi} setKkOdemeTipi={budgetActions.setKkOdemeTipi}
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
                satisYap={() => investmentActions.satisYap(seciliVeri, budgetActions.secilenHesapId, budgetActions.islemTutar)}
                secilenHesapId={budgetActions.secilenHesapId} setSecilenHesapId={budgetActions.setSecilenHesapId}
                defaultPaymentAccountId={defaultPaymentAccountId}
                onKategoriUpdate={onKategoriUpdate}
                onKategoriRename={onKategoriRename}
                onBulkCategoryMove={onBulkCategoryMove}
                onYatirimTuruUpdate={onYatirimTuruUpdate}
                ensureTag={budgetActions.ensureTag}
                renameTag={budgetActions.renameTag}
                deleteTag={budgetActions.deleteTag}
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

                borcTipi={budgetActions.borcTipi} setBorcTipi={budgetActions.setBorcTipi}
                borcAd={budgetActions.borcAd} setBorcAd={budgetActions.setBorcAd}
                borcAciklama={budgetActions.borcAciklama} setBorcAciklama={budgetActions.setBorcAciklama}
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
                setAnaSekme={changeTab}
                gizliMod={gizliMod}
                setGizliMod={setGizliMod}
                user={user}
                cikisYap={cikisYap}
                selectedPeriod={selectedPeriod}
                setSelectedPeriod={setSelectedPeriod}
                availablePeriods={availablePeriods}
                showPeriodFilter={!['hedefler', 'takvim', 'ayarlar', 'finansmanlar', 'tanimlamalar'].includes(anaSekme)}
                theme={theme}
                onThemeToggle={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
                hasInvestmentAccount={showInvestmentFeature}
            />

            <Notifications
                bildirimler={calculations.bildirimler.filter(b => {
                    if (anaSekme === 'butcem') return ['fatura', 'abonelik', 'maas', 'taksit', 'kk_hatirlatma', 'kk_limit', 'borc_hatirlatma', 'alacak_hatirlatma'].includes(b.tip);
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

            {/* DASHBOARD */}
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
                    hasInvestmentAccount={hasInvestmentAccount}
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
                    filtreHesap={calculations.filtreHesap} setFiltreHesap={calculations.setFiltreHesap}
                    filtreKategori={calculations.filtreKategori} setFiltreKategori={calculations.setFiltreKategori}
                    filtreEtiket={calculations.filtreEtiket} setFiltreEtiket={calculations.setFiltreEtiket}

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
                    secilenEtiketIds={budgetActions.secilenEtiketIds} setSecilenEtiketIds={budgetActions.setSecilenEtiketIds}
                    etiketler={data.etiketler}
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
                    cariler={data.cariler}
                    finansmanlar={data.finansmanlar}
                    navigateTo={navigateTo}
                    toplamKalanBorc={calculations.toplamKalanBorc}
                    borcOde={budgetActions.borcOde}
                    borcDuzenle={budgetActions.borcDuzenle}
                    borcOrderGuncelle={budgetActions.borcOrderGuncelle}

                    excelIndir={() => budgetActions.excelIndir(data.islemler)}
                    excelYukle={budgetActions.excelYukle}
                    islemSil={budgetActions.islemSil}
                    hesapSil={budgetActions.hesapSil}
                    setAnaSekme={changeTab}
                />
            )}

            {anaSekme === "finansmanlar" && (
                <FinancingDashboard
                    user={user}
                    alanKodu={veriAlanKodu}
                    financings={data.finansmanlar}
                    hesaplar={data.hesaplar}
                    taksitler={data.taksitler}
                    islemler={data.islemler}
                    gizliMod={gizliMod}
                    selectedFinancingId={selectedFinancingId}
                    navigateTo={navigateTo}
                />
            )}

            {anaSekme === "tanimlamalar" && (
                <DefinitionsDashboard
                    data={data}
                    gizliMod={gizliMod}
                    routePath={routePath}
                    navigateTo={navigateTo}
                    modalAc={modalAc}
                    cariler={data.cariler}
                    borcOde={budgetActions.borcOde}
                />
            )}

            {anaSekme === "ayarlar" && (
                <SettingsDashboard
                    aylikLimit={data.aylikLimit}
                    onLimitChange={onLimitChange}
                    kategoriListesi={data.kategoriListesi}
                    tumIslemler={data.islemler}
                    onKategoriUpdate={onKategoriUpdate}
                    onKategoriRename={onKategoriRename}
                    onBulkCategoryMove={onBulkCategoryMove}
                    etiketler={data.etiketler}
                    ensureTag={budgetActions.ensureTag}
                    renameTag={budgetActions.renameTag}
                    deleteTag={budgetActions.deleteTag}
                    yatirimTurleri={data.yatirimTurleri}
                    onYatirimTuruUpdate={onYatirimTuruUpdate}
                    onYatirimTuruRename={onYatirimTuruRename}
                    alanKodu={alanKodu}
                    veriAlanKodu={veriAlanKodu}
                    areaRecord={areaRecord}
                    koddanCikis={koddanCikis}
                    onCreateAreaPassword={handleChangeAreaPassword}
                    onChangeAreaPassword={handleChangeAreaPassword}
                    onChangeAreaCode={handleChangeAreaCode}
                    gizliMod={gizliMod}
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
                    hasInvestmentAccount={hasInvestmentAccount}
                    gizliMod={gizliMod}
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
                    alanKodu={veriAlanKodu}
                    gizliMod={gizliMod}
                    onDebtAction={(debt) => modalAc('borc_ode', debt)}
                    sourceData={{
                        accounts: data.hesaplar,
                        transactions: data.islemler,
                        subscriptions: data.abonelikler,
                        installments: data.taksitler,
                        bills: data.bekleyenFaturalar,
                        billDefinitions: data.tanimliFaturalar,
                        debts: data.borclar,
                        cariler: data.cariler,
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
                setAnaSekme={changeTab}
                modalAc={modalAc}
                hasInvestmentAccount={showInvestmentFeature}
            />
        </div>
    );
}

export default App;
