import React, { useCallback, useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';
import {
    ArrowDownRight,
    ArrowUpRight,
    Bell,
    CalendarClock,
    CreditCard,
    DollarSign,
    Download,
    Edit3,
    Landmark,
    LineChart,
    Plus,
    ReceiptText,
    Repeat2,
    Search,
    Trash2,
    Upload,
    Wallet,
} from 'lucide-react';
import { formatCurrencyPlain, tarihFormatla, titleCaseTr, toDateSafe, sortTurkishText } from '../../utils/helpers';
import { isDateInPeriod, MONTH_NAMES } from '../../utils/period';
import {
    formatSalaryPeriodRange,
    getSalaryPeriod,
    isDateInSalaryPeriod,
    isSalaryAccount,
    summarizeSalaryPeriod,
} from '../../utils/salaryPeriod';
import DescriptionInput from '../Shared/DescriptionInput';
import FinancialTrendChart from '../Shared/FinancialTrendChart';
import HighQualityModal from '../Shared/HighQualityModal';
import PremiumDonutChart from '../Shared/PremiumDonutChart';
import { DONUT_PALETTE } from '../Shared/chartPalettes';
import {
    DashboardToolbar,
    EmptyState,
    IconTile,
    PremiumCard,
    SectionHeader,
    StatusBadge,
    TransactionRow,
    UpcomingPaymentRow,
} from '../Shared/PremiumUI';
import QuickTransactionForm from './QuickTransactionForm';
import { getCreditCardPaymentPlan, isCreditCardPaymentTransaction, isCreditCardStatementPaymentTransaction } from '../../utils/creditCardPayments';
import { buildSubscriptionOccurrences } from '../../utils/recurringPayments';

const parseAmount = (value) => parseFloat(value) || 0;

const getCreditCardLimitValue = (account) => parseAmount(
    account?.kartLimiti
    || account?.limit
    || account?.creditLimit
    || account?.krediKartiLimiti
);

const getCreditCardDebt = (account) => Math.max(0, -parseAmount(account?.guncelBakiye));

const getInstallmentRemainingDebt = (installment) => {
    const total = parseAmount(installment?.toplamTutar);
    const monthly = parseAmount(installment?.aylikTutar);
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

const getCreditCardAvailableLimit = (account, installments = []) => {
    const limit = getCreditCardLimitValue(account);
    if (limit <= 0) return null;
    return Math.max(0, limit - getCreditCardDebt(account) - getCreditCardInstallmentExposure(account, installments));
};

const getAccountIcon = (account) => {
    if (account?.hesapTipi === 'krediKarti') return CreditCard;
    if (account?.hesapTipi === 'yatirim') return DollarSign;
    return Wallet;
};

const getAccountTone = (account) => {
    if (account?.hesapTipi === 'krediKarti') return 'warning';
    if (account?.hesapTipi === 'yatirim') return 'info';
    return 'accent';
};

const formatDayMonth = (date) => {
    if (!date) return 'Tarih yok';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
};

const formatDayMonthWeekday = (date) => {
    if (!date) return 'Tarih yok';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
};

const getFinancialTone = (value) => {
    const amount = parseAmount(value);
    if (amount > 0) return 'success';
    if (amount < 0) return 'danger';
    return 'neutral';
};

const addMonthsClamped = (date, monthOffset) => {
    if (!date) return null;
    const result = new Date(date);
    const originalDay = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + monthOffset);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, lastDay));
    return result;
};

const startOfDay = (date) => {
    if (!date) return null;
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
};

const getValidBillingDate = (year, month, billingDay) => {
    const day = parseInt(billingDay) || 0;
    if (day < 1 || day > 31) return null;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay), 0, 0, 0, 0);
};

const getCreditCardBillingDay = (account) => {
    const rawDay = account?.kesimGunu
        || account?.statementDay
        || account?.billingDay
        || account?.statementClosingDay
        || account?.ekstreKesimGunu;
    const day = parseInt(rawDay) || 0;
    return day >= 1 && day <= 31 ? day : null;
};

const getCreditCardPaymentsInPeriod = (transactions = [], accountId, year, month) => {
    if (!accountId) return 0;

    return (transactions || []).reduce((sum, transaction) => {
        if (!isCreditCardStatementPaymentTransaction(transaction, accountId)) return sum;

        const date = toDateSafe(transaction.tarih);
        if (!date || date.getFullYear() !== year || date.getMonth() !== month) return sum;

        return sum + parseAmount(transaction.tutar);
    }, 0);
};

const getStatementPeriod = (account, selectedPeriod) => {
    const billingDay = getCreditCardBillingDay(account);
    if (!billingDay) return null;
    const today = new Date();
    const statementYear = selectedPeriod?.year || today.getFullYear();
    const statementMonth = selectedPeriod?.month === 'all'
        ? today.getMonth()
        : (parseInt(selectedPeriod?.month) || today.getMonth() + 1) - 1;
    const end = getValidBillingDate(statementYear, statementMonth, billingDay);
    const startBase = new Date(statementYear, statementMonth - 1, 1);
    const start = getValidBillingDate(startBase.getFullYear(), startBase.getMonth(), billingDay);
    return start && end ? { start, end, statementYear, statementMonth, billingDay } : null;
};

const formatPeriodDate = (date) => date?.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) || '';

const formatStatementRange = (period) => {
    if (!period?.start || !period?.end) return '';
    const inclusiveEnd = new Date(period.end);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    return `${formatPeriodDate(period.start)} - ${inclusiveEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
};

const getVisibleRange = (selectedPeriod) => {
    const today = new Date();
    if (selectedPeriod?.month === 'all') {
        const visibleMonthCount = selectedPeriod.year === today.getFullYear()
            ? today.getMonth() + 1
            : selectedPeriod.year > today.getFullYear()
                ? 0
                : 12;

        return Array.from({ length: visibleMonthCount }, (_, index) => ({
            key: `${selectedPeriod.year}-${index + 1}`,
            name: MONTH_NAMES[index],
            tooltipLabel: `${MONTH_NAMES[index]} ${selectedPeriod.year}`,
            gelir: 0,
            gider: 0,
            net: 0,
        }));
    }

    const isFutureMonth = new Date(selectedPeriod.year, selectedPeriod.month - 1, 1) >
        new Date(today.getFullYear(), today.getMonth(), 1);
    const isCurrentMonth = selectedPeriod.year === today.getFullYear() &&
        selectedPeriod.month === today.getMonth() + 1;
    const visibleDayCount = isFutureMonth
        ? 0
        : isCurrentMonth
            ? today.getDate()
            : new Date(selectedPeriod.year, selectedPeriod.month, 0).getDate();

    return Array.from({ length: visibleDayCount }, (_, index) => {
        const day = index + 1;
        const date = new Date(selectedPeriod.year, selectedPeriod.month - 1, day);
        return {
            key: `${selectedPeriod.year}-${selectedPeriod.month}-${day}`,
            name: day,
            tooltipLabel: formatDayMonthWeekday(date),
            gelir: 0,
            gider: 0,
            net: 0,
        };
    });
};

const getDailyAverageDayCount = (selectedPeriod) => {
    if (!selectedPeriod || selectedPeriod.month === 'all') return 0;

    const today = new Date();
    const periodStart = new Date(selectedPeriod.year, selectedPeriod.month - 1, 1);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    if (periodStart > currentMonthStart) return 0;

    const isCurrentMonth = selectedPeriod.year === today.getFullYear() &&
        selectedPeriod.month === today.getMonth() + 1;

    return isCurrentMonth
        ? today.getDate()
        : new Date(selectedPeriod.year, selectedPeriod.month, 0).getDate();
};

const Sparkline = ({ data = [], color = '#6d5dfc' }) => {
    const hasData = (data || []).some((item) => parseAmount(item.value || item.gider || item.net) > 0);
    if (!hasData) return null;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#spark-${color.replace('#', '')})`}
                    dot={false}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

const QuickActionButton = ({ children, icon: Icon, variant = '', ...props }) => (
    <button type="button" className={`qw-action-button ${variant ? `qw-action-button--${variant}` : ''}`} {...props}>
        {Icon && <Icon size={16} strokeWidth={2.35} />}
        {children}
    </button>
);

const SummaryLine = ({ label, value, tone }) => (
    <div className={`qw-summary-line ${tone ? `qw-summary-line--${tone}` : ''}`}>
        <span>{titleCaseTr(label)}</span>
        <strong className={tone ? `is-${tone}` : ''}>{value}</strong>
    </div>
);

const ModuleRow = ({ icon, tone = 'neutral', title, meta, amount, amountTone, amountMeta, badge, onClick, actions }) => (
    <div className={`qw-module-row ${onClick ? 'is-clickable' : ''}`} onClick={onClick}>
        <IconTile icon={icon} tone={tone} />
        <div className="qw-module-row__main">
            <strong>{title}</strong>
            {meta && <span>{meta}</span>}
        </div>
        <div className="qw-module-row__side">
            {amount !== undefined && <b className={amountTone ? `is-${amountTone}` : ''}>{amount}</b>}
            {amountMeta && <small>{amountMeta}</small>}
            {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
            {actions && <div className="qw-row-actions">{actions}</div>}
        </div>
    </div>
);

const isBudgetTransaction = (transaction) => (
    transaction?.kategori !== 'BES' &&
    transaction?.islemTipi !== 'yatirim_alis' &&
    transaction?.kategori !== 'Yatırım' &&
    transaction?.islemTipi !== 'cari_iade'
);

const isCreditCardCashOutTransaction = (transaction, accounts = []) => (
    (accounts || []).some((account) => (
        account?.hesapTipi === 'krediKarti' &&
        isCreditCardPaymentTransaction(transaction, account.id)
    ))
);

const isSameCalendarDay = (date, target) => (
    date &&
    date.getDate() === target.getDate() &&
    date.getMonth() === target.getMonth() &&
    date.getFullYear() === target.getFullYear()
);

const isSameCalendarMonth = (date, target) => (
    date &&
    date.getMonth() === target.getMonth() &&
    date.getFullYear() === target.getFullYear()
);

const getMonthlyDueDate = (item, year, month) => {
    const explicitDate = toDateSafe(item?.sonOdemeTarihi || item?.tarih || item?.vadeTarihi);
    if (explicitDate) return explicitDate;

    const rawDay = item?.gun || item?.vadeGunu || item?.sonOdemeGunu || item?.odemeGunu;
    const day = parseInt(rawDay);
    if (!Number.isFinite(day) || day < 1) return null;

    return new Date(year, month, Math.min(day, 28));
};

const getBillStatus = (hasDebt) => {
    if (hasDebt) return { label: 'Borç oluştu', tone: 'danger' };
    return null;
};

const BudgetDashboard = ({
    aktifAy,
    toplamGelir,
    toplamGider,
    gunlukVeri,
    kategoriVerisi,
    gizliMod,
    aylikLimit,
    hesaplar,
    aktifModal,
    modalAc,
    normalSil,
    filtrelenmisIslemler,
    tumIslemler,
    selectedPeriod,
    sadeceCuzdanNakiti,
    genelToplamYatirimGucu,
    netVarlik,
    tanimliFaturalar,
    bekleyenFaturalar,
    taksitler,
    taksitOde,
    toplamKalanTaksitBorcu,
    abonelikler,
    abonelikOde,
    toplamSabitGider,
    kategoriListesi,
    etiketler = [],
    defaultPaymentAccountId,
    formTab, setFormTab,
    islemEkle,
    transferYap,
    taksitEkle,
    faturaGir,
    secilenHesapId, setSecilenHesapId,
    islemTipi, setIslemTipi,
    islemGelirTuru, setIslemGelirTuru,
    islemBagliMaasId, setIslemBagliMaasId,
    islemMaasDonemi, setIslemMaasDonemi,
    secilenEtiketIds, setSecilenEtiketIds,
    kategori, setKategori,
    islemAciklama, setIslemAciklama,
    islemTutar, setIslemTutar,
    islemTarihi, setIslemTarihi,
    transferKaynakId, setTransferKaynakId,
    transferHedefId, setTransferHedefId,
    transferTutar, setTransferTutar,
    transferUcreti, setTransferUcreti,
    transferAciklama, setTransferAciklama,
    transferTarihi, setTransferTarihi,
    taksitBaslik, setTaksitBaslik,
    taksitHesapId, setTaksitHesapId,
    taksitToplamTutar, setTaksitToplamTutar,
    taksitSayisi, setTaksitSayisi,
    taksitKategori, setTaksitKategori,
    taksitAlisTarihi, setTaksitAlisTarihi,
    secilenTanimId, setSecilenTanimId,
    faturaGirisTutar, setFaturaGirisTutar,
    faturaGirisTarih, setFaturaGirisTarih,
    faturaGirisAciklama, setFaturaGirisAciklama,
    aramaMetni, setAramaMetni,
    filtreHesap, setFiltreHesap,
    filtreKategori, setFiltreKategori,
    filtreEtiket, setFiltreEtiket,
    borclar,
    maaslar = [],
    excelIndir,
    excelYukle,
    islemSil,
    setAnaSekme
}) => {
    const [historyAccount, setHistoryAccount] = useState(null);
    const [salaryHistoryMode, setSalaryHistoryMode] = useState('calendar');
    const [flowChartMode, setFlowChartMode] = useState('expense');
    const [hiddenExpenseCategories, setHiddenExpenseCategories] = useState(() => new Set());
    const isNestedModalOpen = Boolean(historyAccount && aktifModal);
    const formatPara = (tutar) => gizliMod ? '****' : formatCurrencyPlain(parseAmount(tutar));
    const siraliKategoriListesi = sortTurkishText(kategoriListesi || []);
    const siraliHesaplar = [...(hesaplar || [])].sort((a, b) =>
        String(a?.hesapAdi || '').localeCompare(String(b?.hesapAdi || ''), 'tr-TR', { sensitivity: 'base' })
    );
    const usedTransactionTags = useMemo(() => {
        const tagMap = new Map();
        (tumIslemler || []).forEach((transaction) => {
            (transaction.tags || []).forEach((tag) => {
                const key = tag?.id || tag?.name;
                if (key && tag?.name) tagMap.set(key, { ...tag, id: key });
            });
        });
        return [...tagMap.values()].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'tr-TR', { sensitivity: 'base' })
        );
    }, [tumIslemler]);
    const quickTransactionFormProps = {
        formTab, setFormTab,
        hesaplar,
        kategoriListesi,
        etiketler,
        defaultPaymentAccountId,
        maaslar,
        tanimliFaturalar,
        tumIslemler,
        islemEkle,
        transferYap,
        taksitEkle,
        faturaGir,
        secilenHesapId, setSecilenHesapId,
        islemTipi, setIslemTipi,
        islemGelirTuru, setIslemGelirTuru,
        islemBagliMaasId, setIslemBagliMaasId,
        islemMaasDonemi, setIslemMaasDonemi,
        secilenEtiketIds, setSecilenEtiketIds,
        kategori, setKategori,
        islemAciklama, setIslemAciklama,
        islemTutar, setIslemTutar,
        islemTarihi, setIslemTarihi,
        transferKaynakId, setTransferKaynakId,
        transferHedefId, setTransferHedefId,
        transferTutar, setTransferTutar,
        transferUcreti, setTransferUcreti,
        transferAciklama, setTransferAciklama,
        transferTarihi, setTransferTarihi,
        taksitBaslik, setTaksitBaslik,
        taksitHesapId, setTaksitHesapId,
        taksitToplamTutar, setTaksitToplamTutar,
        taksitSayisi, setTaksitSayisi,
        taksitKategori, setTaksitKategori,
        taksitAlisTarihi, setTaksitAlisTarihi,
        secilenTanimId, setSecilenTanimId,
        faturaGirisTutar, setFaturaGirisTutar,
        faturaGirisTarih, setFaturaGirisTarih,
        faturaGirisAciklama, setFaturaGirisAciklama,
    };

    const cashflowDataset = useMemo(() => {
        const buckets = getVisibleRange(selectedPeriod || {});
        const bucketMap = new Map(buckets.map((item, index) => [item.key, { item, index }]));

        (filtrelenmisIslemler || []).forEach((transaction) => {
            const date = toDateSafe(transaction.tarih);
            if (!date) return;
            const key = selectedPeriod?.month === 'all'
                ? `${date.getFullYear()}-${date.getMonth() + 1}`
                : `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            const bucket = bucketMap.get(key)?.item;
            if (!bucket) return;

            const amount = parseAmount(transaction.tutar);
            const isCreditCardCashOut = isCreditCardCashOutTransaction(transaction, hesaplar);
            const isInternalTransfer = transaction.islemTipi === 'transfer' || transaction.kategori === 'Transfer';

            if (transaction.islemTipi === 'gelir' && !isInternalTransfer) bucket.gelir += amount;
            if (isCreditCardCashOut || (transaction.islemTipi === 'gider' && !isInternalTransfer)) {
                bucket.gider += amount;
            }
            bucket.net = bucket.gelir - bucket.gider;
        });

        return buckets;
    }, [filtrelenmisIslemler, hesaplar, selectedPeriod]);

    const expenseSparkline = useMemo(() => (gunlukVeri || []).map((item) => ({
        name: item.name,
        value: parseAmount(item.value),
    })), [gunlukVeri]);
    const dailyExpenseTotal = useMemo(() => (
        (gunlukVeri || []).reduce((sum, item) => sum + parseAmount(item.value), 0)
    ), [gunlukVeri]);
    const dailyExpenseAverageDayCount = useMemo(() => (
        getDailyAverageDayCount(selectedPeriod)
    ), [selectedPeriod]);
    const dailyExpenseAverage = dailyExpenseAverageDayCount > 0
        ? dailyExpenseTotal / dailyExpenseAverageDayCount
        : 0;

    const todayStats = useMemo(() => {
        const today = new Date();
        return (tumIslemler || [])
            .filter(isBudgetTransaction)
            .reduce((acc, transaction) => {
                const date = toDateSafe(transaction.tarih);
                if (!isSameCalendarDay(date, today)) return acc;
                const amount = parseAmount(transaction.tutar);
                if (transaction.islemTipi === 'gelir') acc.income += amount;
                if (transaction.islemTipi === 'gider') acc.expense += amount;
                acc.count += 1;
                return acc;
            }, { income: 0, expense: 0, count: 0 });
    }, [tumIslemler]);

    const currentMonthStats = useMemo(() => {
        const today = new Date();
        return (tumIslemler || [])
            .filter(isBudgetTransaction)
            .reduce((acc, transaction) => {
                const date = toDateSafe(transaction.tarih);
                if (!isSameCalendarMonth(date, today)) return acc;
                const amount = parseAmount(transaction.tutar);
                if (transaction.islemTipi === 'gelir') acc.income += amount;
                if (transaction.islemTipi === 'gider') acc.expense += amount;
                acc.count += 1;
                return acc;
            }, { income: 0, expense: 0, count: 0 });
    }, [tumIslemler]);

    const toggleExpenseCategory = useCallback((categoryName) => {
        setHiddenExpenseCategories((current) => {
            const next = new Set(current);
            if (next.has(categoryName)) {
                next.delete(categoryName);
            } else {
                next.add(categoryName);
            }
            return next;
        });
    }, []);

    const clearHiddenExpenseCategories = useCallback(() => {
        setHiddenExpenseCategories(new Set());
    }, []);

    const categoryRows = useMemo(() => {
        const sorted = [...(kategoriVerisi || [])]
            .map((item) => ({ ...item, value: parseAmount(item.value) }))
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value);
        return sorted.map((item, index) => ({
            ...item,
            color: DONUT_PALETTE[index % DONUT_PALETTE.length],
            isActive: !hiddenExpenseCategories.has(item.name),
        }));
    }, [kategoriVerisi, hiddenExpenseCategories]);

    const donutData = useMemo(() => {
        const activeData = categoryRows.filter((item) => item.isActive);
        const activeTotal = activeData.reduce((sum, item) => sum + item.value, 0);

        return activeData.map((item) => ({
            ...item,
            yuzde: activeTotal > 0 ? Math.round((item.value / activeTotal) * 100) : 0,
        }));
    }, [categoryRows]);

    const kategoriToplam = useMemo(
        () => categoryRows.filter((item) => item.isActive).reduce((sum, item) => sum + parseAmount(item.value), 0),
        [categoryRows],
    );

    const hasHiddenExpenseCategories = categoryRows.some((item) => !item.isActive);

    const linkedInstallmentPaymentCounts = useMemo(() => {
        const counts = new Map();

        const addPayment = (installmentId, paymentKey) => {
            if (!installmentId) return;
            if (!counts.has(installmentId)) counts.set(installmentId, new Set());
            counts.get(installmentId).add(paymentKey);
        };

        (tumIslemler || []).forEach((transaction) => {
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
    }, [tumIslemler]);

    const getInstallmentPaidCount = useCallback((installment) => {
        const count = parseInt(installment.taksitSayisi) || 0;
        const remaining = parseInt(installment.remainingInstallments);
        const directPaid = Math.max(
            parseInt(installment.odenmisTaksit) || 0,
            parseInt(installment.completedInstallments) || 0,
            parseInt(installment.paidInstallmentCount) || 0,
            Number.isFinite(remaining) && count > 0 ? Math.max(0, count - remaining) : 0,
        );
        const linkedPaid = linkedInstallmentPaymentCounts.get(installment.id)?.size || 0;
        const status = String(installment.status || '').toLowerCase();
        const isCompleted = installment.paid === true
            || installment.isPaid === true
            || Boolean(installment.paidAt)
            || ['paid', 'completed', 'complete', 'odendi', 'tamamlandi'].includes(status);
        const paidCount = isCompleted && count > 0
            ? count
            : Math.max(directPaid, linkedPaid);

        return count > 0 ? Math.min(paidCount, count) : paidCount;
    }, [linkedInstallmentPaymentCounts]);

    const monthlyInstallmentLoad = (taksitler || []).reduce((acc, item) => {
        const total = parseAmount(item.toplamTutar);
        const monthly = parseAmount(item.aylikTutar);
        const paid = getInstallmentPaidCount(item);
        const count = parseInt(item.taksitSayisi) || 0;
        if (count > 0 && paid >= count) return acc;
        return acc + Math.min(monthly, Math.max(0, total - (monthly * paid)));
    }, 0);
    const getInstallmentFinancials = useCallback((item) => {
        const total = parseAmount(item.toplamTutar);
        const monthly = parseAmount(item.aylikTutar);
        const paid = getInstallmentPaidCount(item);
        const count = parseInt(item.taksitSayisi) || 0;
        const remainingCount = count > 0 ? Math.max(0, count - paid) : 0;
        const remainingDebt = count > 0
            ? Math.max(0, monthly * remainingCount)
            : Math.max(0, total - (monthly * paid));

        return { total, monthly, paid, count, remainingCount, remainingDebt };
    }, [getInstallmentPaidCount]);

    const upcomingPayments = useMemo(() => {
        const periodDate = selectedPeriod?.month === 'all'
            ? new Date()
            : new Date(selectedPeriod.year, selectedPeriod.month - 1, 1);
        const currentYear = periodDate.getFullYear();
        const currentMonth = periodDate.getMonth();
        const periodKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

        const rows = [];

        (bekleyenFaturalar || []).forEach((bill) => {
            const definition = (tanimliFaturalar || []).find((item) => item.id === bill.tanimId);
            const dueDate = toDateSafe(bill.sonOdemeTarihi || bill.tarih);
            rows.push({
                id: `bill-${bill.id}`,
                title: bill.baslik || definition?.baslik || definition?.kurum || 'Bekleyen fatura',
                type: 'Fatura',
                badgeLabel: 'Fatura',
                date: dueDate,
                amount: parseAmount(bill.tutar),
                icon: ReceiptText,
                tone: 'danger',
                onClick: () => modalAc('fatura_ode', bill),
            });
        });

        (tanimliFaturalar || [])
            .filter((definition) => !(bekleyenFaturalar || []).some((bill) => bill.tanimId === definition.id))
            .forEach((definition) => {
                const dueDate = getMonthlyDueDate(definition, currentYear, currentMonth);
                rows.push({
                    id: `bill-definition-${definition.id}`,
                    title: definition.baslik || definition.kurum || 'Fatura',
                    type: 'Fatura',
                    badgeLabel: 'Fatura',
                    date: dueDate,
                    amount: parseAmount(definition.tutar || definition.ortalamaTutar),
                    icon: ReceiptText,
                    tone: 'danger',
                    onClick: () => modalAc('duzenle_fatura_tanim', definition),
                });
            });

        (hesaplar || [])
            .filter((account) => account.hesapTipi === 'krediKarti' && account.kesimGunu && parseAmount(account.guncelBakiye) < 0)
            .forEach((account) => {
                const day = parseInt(account.kesimGunu) || null;
                const dueDate = day ? new Date(currentYear, currentMonth, Math.min(day, 28)) : null;
                const paymentPlan = getCreditCardPaymentPlan(account, periodKey);
                const paidThisPeriod = getCreditCardPaymentsInPeriod(tumIslemler, account.id, currentYear, currentMonth);
                const displayAmount = paymentPlan.plannedPayment;
                if (displayAmount <= 0) return;
                rows.push({
                    id: `card-statement-${account.id}`,
                    title: account.hesapAdi || 'Kart ekstresi',
                    type: 'Kart ekstresi',
                    badgeLabel: 'Kart ekstresi',
                    date: dueDate,
                    amount: displayAmount,
                    icon: CreditCard,
                    tone: 'warning',
                    paidThisPeriod,
                    onClick: () => modalAc('kredi_karti_ode', account),
                });
            });

        (taksitler || []).forEach((installment) => {
            const paid = getInstallmentPaidCount(installment);
            const count = parseInt(installment.taksitSayisi) || 0;
            if (count > 0 && paid >= count) return;
            const baseDate = toDateSafe(installment.alisTarihi || installment.olusturmaTarihi);
            const dueDate = addMonthsClamped(baseDate, paid);
            const isOverdue = dueDate && startOfDay(dueDate) < startOfDay(new Date());
            const installmentForPayment = { ...installment, odenmisTaksit: paid };
            rows.push({
                id: `installment-${installment.id}-${paid + 1}`,
                title: installment.baslik || 'Taksit',
                type: `${paid + 1}/${count || '-'} taksit`,
                badgeLabel: isOverdue ? 'Gecikti' : 'Taksit',
                date: dueDate,
                amount: parseAmount(installment.aylikTutar),
                icon: CalendarClock,
                tone: isOverdue ? 'danger' : 'purple',
                isOverdue,
                onClick: () => taksitOde(installmentForPayment),
            });
        });

        buildSubscriptionOccurrences({
            subscriptions: abonelikler,
            transactions: tumIslemler,
            year: currentYear,
            month: currentMonth,
        }).forEach((occurrence) => {
            if (occurrence.status === 'paid') return;
            const subscription = occurrence.subscription;
            const isOverdue = occurrence.status === 'overdue';
            rows.push({
                id: occurrence.id,
                title: subscription.ad || 'Sabit gider',
                type: 'Sabit gider',
                badgeLabel: isOverdue ? 'Gecikti' : 'Sabit gider',
                date: occurrence.dueDate,
                amount: occurrence.expectedAmount,
                icon: Repeat2,
                tone: isOverdue ? 'danger' : 'info',
                isOverdue,
                onClick: () => abonelikOde(subscription),
            });
        });

        return rows
            .filter((row) => row.date)
            .sort((a, b) => {
                if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
                return (a.date?.getTime() || Number.MAX_SAFE_INTEGER) - (b.date?.getTime() || Number.MAX_SAFE_INTEGER);
            });
    }, [abonelikler, abonelikOde, bekleyenFaturalar, getInstallmentPaidCount, hesaplar, modalAc, selectedPeriod, taksitOde, taksitler, tanimliFaturalar, tumIslemler]);

    const recentTransactions = [...(filtrelenmisIslemler || [])]
        .sort((a, b) => (toDateSafe(b.tarih)?.getTime() || 0) - (toDateSafe(a.tarih)?.getTime() || 0));
    const filteredTransactionsNet = recentTransactions.reduce((sum, transaction) => {
        const amount = parseAmount(transaction.tutar);
        if (transaction.islemTipi === 'gelir') return sum + amount;
        if (transaction.islemTipi === 'gider') return sum - amount;
        return sum;
    }, 0);

    const subscriptionRows = [...(abonelikler || [])]
        .sort((a, b) => (parseInt(a.gun) || 32) - (parseInt(b.gun) || 32))
        .slice(0, 8);

    const debtRows = [...(borclar || [])]
        .sort((a, b) => (toDateSafe(a.sonOdemeTarihi || a.tarih)?.getTime() || Number.MAX_SAFE_INTEGER) - (toDateSafe(b.sonOdemeTarihi || b.tarih)?.getTime() || Number.MAX_SAFE_INTEGER))
        .slice(0, 8);

    const allInstallmentRows = [...(taksitler || [])]
        .map((item) => {
            const financials = getInstallmentFinancials(item);
            const { paid, count } = financials;
            const baseDate = toDateSafe(item.alisTarihi || item.olusturmaTarihi);
            const dueDate = addMonthsClamped(baseDate, paid);
            const nextInstallmentNumber = count > 0 ? Math.min(paid + 1, count) : paid + 1;
            return { ...item, ...financials, nextDueDate: dueDate, paidCount: paid, installmentCount: count, nextInstallmentNumber };
        })
        .filter((item) => !(item.installmentCount > 0 && item.paidCount >= item.installmentCount))
        .sort((a, b) => (a.nextDueDate?.getTime() || Number.MAX_SAFE_INTEGER) - (b.nextDueDate?.getTime() || Number.MAX_SAFE_INTEGER));
    const installmentRows = allInstallmentRows.slice(0, 8);
    const installmentRemainingTotal = allInstallmentRows.reduce((sum, item) => sum + item.remainingDebt, 0);

    const selectedPeriodNet = toplamGelir - toplamGider;
    const todayNet = todayStats.income - todayStats.expense;
    const currentMonthNet = currentMonthStats.income - currentMonthStats.expense;
    const budgetUsagePercent = parseAmount(aylikLimit) > 0 ? Math.round((currentMonthStats.expense / parseAmount(aylikLimit)) * 100) : null;
    const billTotal = (bekleyenFaturalar || []).reduce((sum, item) => sum + parseAmount(item.tutar), 0);
    const billDisplayRows = [
        ...(bekleyenFaturalar || []).map((bill) => {
            const definition = (tanimliFaturalar || []).find((item) => item.id === bill.tanimId);
            const dueDate = toDateSafe(bill.sonOdemeTarihi || bill.tarih);
            return {
                id: `pending-${bill.id}`,
                title: bill.baslik || definition?.baslik || definition?.kurum || 'Fatura',
                date: dueDate,
                amount: parseAmount(bill.tutar),
                status: getBillStatus(true),
                data: bill,
                mode: 'pending',
            };
        }),
        ...(tanimliFaturalar || [])
            .filter((definition) => !(bekleyenFaturalar || []).some((bill) => bill.tanimId === definition.id))
            .map((definition) => {
                const today = new Date();
                const dueDate = getMonthlyDueDate(definition, today.getFullYear(), today.getMonth());
                return {
                    id: `definition-${definition.id}`,
                    title: definition.baslik || definition.kurum || 'Fatura',
                    date: dueDate,
                    meta: definition.aboneNo || 'Abone no yok',
                    amount: parseAmount(definition.tutar || definition.ortalamaTutar),
                    amountMeta: 'Borç yoktur',
                    status: getBillStatus(false),
                    data: definition,
                    mode: 'definition',
                };
            })
            .filter(Boolean),
    ]
        .sort((a, b) => (a.date?.getTime() || Number.MAX_SAFE_INTEGER) - (b.date?.getTime() || Number.MAX_SAFE_INTEGER))
        .slice(0, 8);
    const debtTotal = (borclar || []).reduce((sum, item) => sum + parseAmount(item.kalanTutar ?? item.tutar), 0);
    const currentMonthDebtDue = (borclar || []).reduce((sum, item) => {
        const dueDate = toDateSafe(item.sonOdemeTarihi || item.tarih);
        return isSameCalendarMonth(dueDate, new Date()) ? sum + parseAmount(item.kalanTutar ?? item.tutar) : sum;
    }, 0);
    const filteredCount = (filtrelenmisIslemler || []).length;
    const isFiltering = Boolean(aramaMetni) || filtreHesap !== 'Tümü' || filtreKategori !== 'Tümü' || filtreEtiket !== 'Tümü';
    const totalComparableTransactions = isFiltering ? (tumIslemler || []).filter(isBudgetTransaction).length : filteredCount;
    const transactionDescription = isFiltering
        ? `${totalComparableTransactions} işlemden ${filteredCount} sonuç`
        : `${filteredCount} işlem`;
    const accountNameById = useMemo(() => new Map(
        (hesaplar || []).map((account) => [account.id, account.hesapAdi || 'İsimsiz hesap'])
    ), [hesaplar]);

    const getAccountName = (accountId) => accountNameById.get(accountId) || 'Hesap yok';

    const getTransactionAccountLabel = (transaction) => {
        if (transaction.islemTipi === 'transfer') {
            const sourceName = transaction.kaynakId ? getAccountName(transaction.kaynakId) : null;
            const targetName = transaction.hedefId ? getAccountName(transaction.hedefId) : null;
            if (sourceName && targetName) return `${sourceName} → ${targetName}`;
            return sourceName || targetName || 'Hesap yok';
        }

        return transaction.hesapId ? getAccountName(transaction.hesapId) : 'Hesap yok';
    };

    const getTransactionMeta = (transaction) => [
        transaction.kategori || (transaction.islemTipi === 'transfer' ? 'Transfer' : 'Kategori yok'),
        getTransactionAccountLabel(transaction),
        tarihFormatla(transaction.tarih),
    ].filter(Boolean).join(' · ');

    const transactionIcon = (transaction) => {
        if (transaction.islemTipi === 'gelir') return ArrowDownRight;
        if (transaction.islemTipi === 'transfer') return Repeat2;
        return ArrowUpRight;
    };

    const transactionTone = (transaction) => {
        if (transaction.islemTipi === 'gelir') return 'success';
        if (transaction.islemTipi === 'transfer') return 'info';
        return 'danger';
    };

    const getAccountMovementAmount = (transaction, accountId) => {
        const amount = parseAmount(transaction.tutar);
        if (transaction.islemTipi === 'transfer') {
            if (transaction.kaynakId === accountId) return -amount;
            if (transaction.hedefId === accountId) return amount;
            return 0;
        }

        if (transaction.hesapId !== accountId) return 0;
        if (['gelir', 'yatirim_satis', 'cari_iade'].includes(transaction.islemTipi)) return amount;
        return -amount;
    };

    const historyAccountStatementPeriod = historyAccount?.hesapTipi === 'krediKarti'
        ? getStatementPeriod(historyAccount, selectedPeriod)
        : null;
    const historyAccountBillingDay = historyAccount?.hesapTipi === 'krediKarti'
        ? getCreditCardBillingDay(historyAccount)
        : null;
    const historyAccountIsSalary = historyAccount ? isSalaryAccount(historyAccount) : false;
    const historyAccountSalaryPeriod = historyAccountIsSalary
        ? getSalaryPeriod(historyAccount, selectedPeriod)
        : null;

    const getAccountMovements = (account) => {
        if (!account) return [];
        const seen = new Map();
        const isCreditCard = account.hesapTipi === 'krediKarti';
        const useSalaryPeriod = isSalaryAccount(account) && salaryHistoryMode === 'salary' && historyAccountSalaryPeriod;

        (tumIslemler || []).forEach((transaction) => {
            const transactionDate = toDateSafe(transaction.tarih);
            if (!transactionDate) return;
            const isLinkedToAccount = transaction.hesapId === account.id ||
                transaction.kaynakId === account.id ||
                transaction.hedefId === account.id;
            if (!isLinkedToAccount) return;

            const isInPeriod = isCreditCard && historyAccountStatementPeriod
                ? transactionDate >= historyAccountStatementPeriod.start && transactionDate < historyAccountStatementPeriod.end
                : useSalaryPeriod
                    ? isDateInSalaryPeriod(transactionDate, historyAccountSalaryPeriod)
                : isDateInPeriod(transactionDate, selectedPeriod);
            if (!isInPeriod) return;

            seen.set(transaction.id || `${transactionDate.getTime()}-${transaction.tutar}-${transaction.aciklama}`, transaction);
        });

        return Array.from(seen.values())
            .sort((a, b) => (toDateSafe(b.tarih)?.getTime() || 0) - (toDateSafe(a.tarih)?.getTime() || 0));
    };

    const selectedAccountMovements = historyAccount ? getAccountMovements(historyAccount) : [];
    const selectedSalarySummary = historyAccountIsSalary && salaryHistoryMode === 'salary'
        ? summarizeSalaryPeriod({ transactions: selectedAccountMovements, account: historyAccount, accounts: hesaplar })
        : null;
    const accountInflowTotal = historyAccount
        ? selectedAccountMovements.reduce((sum, transaction) => Math.max(0, getAccountMovementAmount(transaction, historyAccount.id)) + sum, 0)
        : 0;
    const accountOutflowTotal = historyAccount
        ? selectedAccountMovements.reduce((sum, transaction) => Math.max(0, -getAccountMovementAmount(transaction, historyAccount.id)) + sum, 0)
        : 0;
    const accountNetMovement = accountInflowTotal - accountOutflowTotal;
    const accountCurrentBalance = parseAmount(historyAccount?.guncelBakiye);
    const statementExpenseTotal = historyAccount?.hesapTipi === 'krediKarti'
        ? selectedAccountMovements
            .filter((transaction) => transaction.islemTipi === 'gider' && transaction.hesapId === historyAccount.id)
            .reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0)
        : 0;
    const statementRefundTotal = historyAccount?.hesapTipi === 'krediKarti'
        ? selectedAccountMovements
            .filter((transaction) => ['gelir', 'yatirim_satis', 'cari_iade'].includes(transaction.islemTipi) && transaction.hesapId === historyAccount.id)
            .reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0)
        : 0;
    const statementPaymentTotal = historyAccount?.hesapTipi === 'krediKarti'
        ? selectedAccountMovements
            .filter((transaction) => transaction.islemTipi === 'transfer' && transaction.hedefId === historyAccount.id)
            .reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0)
        : 0;
    const statementNetTotal = statementExpenseTotal - statementRefundTotal;
    const statementRemainingTotal = Math.max(0, statementNetTotal - statementPaymentTotal);
    const historyCreditCardLimit = historyAccount?.hesapTipi === 'krediKarti'
        ? getCreditCardLimitValue(historyAccount)
        : 0;
    const historyCreditCardDebt = historyAccount?.hesapTipi === 'krediKarti'
        ? getCreditCardDebt(historyAccount)
        : 0;
    const historyCreditCardInstallmentExposure = historyAccount?.hesapTipi === 'krediKarti'
        ? getCreditCardInstallmentExposure(historyAccount, taksitler)
        : 0;
    const historyCreditCardAvailableLimit = historyAccount?.hesapTipi === 'krediKarti'
        ? getCreditCardAvailableLimit(historyAccount, taksitler)
        : null;
    const historyCreditCardUsedLimit = Math.min(
        historyCreditCardLimit,
        historyCreditCardDebt + historyCreditCardInstallmentExposure
    );
    const historyCreditCardLimitRatio = historyCreditCardLimit > 0
        ? Math.min(100, Math.max(0, (historyCreditCardUsedLimit / historyCreditCardLimit) * 100))
        : 0;
    const historySubtitle = (() => {
        if (!historyAccount) return '';
        if (historyAccountIsSalary && salaryHistoryMode === 'salary' && historyAccountSalaryPeriod) {
            return `${selectedAccountMovements.length} hareket · ${historyAccountSalaryPeriod.label} · ${formatSalaryPeriodRange(historyAccountSalaryPeriod)}`;
        }
        if (historyAccount.hesapTipi !== 'krediKarti') return `${selectedAccountMovements.length} hareket`;
        if (!historyAccountBillingDay) return `${selectedAccountMovements.length} hareket · Ekstre dönemini hesaplamak için kesim günü tanımlayın.`;
        const statementMonthName = MONTH_NAMES[historyAccountStatementPeriod?.statementMonth] || '';
        return `${selectedAccountMovements.length} hareket · ${statementMonthName} ekstresi · ${formatStatementRange(historyAccountStatementPeriod)}`;
    })();

    const getAccountMovementMeta = (transaction, accountId) => {
        if (transaction.islemTipi !== 'transfer') return `${transaction.kategori || 'Kategori yok'} · ${tarihFormatla(transaction.tarih)}`;
        if (transaction.kaynakId === accountId) return `Transfer çıkış · ${tarihFormatla(transaction.tarih)}`;
        if (transaction.hedefId === accountId) return `Transfer giriş · ${tarihFormatla(transaction.tarih)}`;
        return `Transfer · ${tarihFormatla(transaction.tarih)}`;
    };

    return (
        <div className="qw-page qw-budget-page">
            <div className="qw-top-summary-grid">
                <PremiumCard tone="hero" className="qw-net-worth-card">
                    <div className="qw-hero-copy">
                        <span className="qw-eyebrow">Toplam Net Varlık</span>
                        <h2>{formatPara(netVarlik)}</h2>
                    </div>
                    <div className="qw-hero-chart">
                        <Sparkline data={expenseSparkline} color="#6d5dfc" />
                    </div>
                </PremiumCard>

                <PremiumCard className="qw-compact-summary-card">
                    <SectionHeader title="Bugün" description={`${todayStats.count} işlem`} />
                    <div className="qw-summary-lines">
                        <SummaryLine label="Gelir" value={formatPara(todayStats.income)} tone="success" />
                        <SummaryLine label="Gider" value={formatPara(todayStats.expense)} tone="danger" />
                        <SummaryLine label="Net" value={formatPara(todayNet)} tone={getFinancialTone(todayNet)} />
                    </div>
                </PremiumCard>

                <PremiumCard className="qw-compact-summary-card">
                    <SectionHeader
                        title="Bu Ay"
                        description={budgetUsagePercent === null ? 'Limit tanımsız' : `Bütçe %${budgetUsagePercent}`}
                        action={budgetUsagePercent !== null && budgetUsagePercent > 100 ? <StatusBadge tone="warning">Limit aşıldı</StatusBadge> : null}
                    />
                    <div className="qw-summary-lines">
                        <SummaryLine label="Gelir" value={formatPara(currentMonthStats.income)} tone="success" />
                        <SummaryLine label="Gider" value={formatPara(currentMonthStats.expense)} tone="danger" />
                        <SummaryLine label="Net" value={formatPara(currentMonthNet)} tone={getFinancialTone(currentMonthNet)} />
                    </div>
                    {budgetUsagePercent !== null && (
                        <div className="qw-progress-track">
                            <span style={{ width: `${Math.min(100, budgetUsagePercent)}%` }} className={budgetUsagePercent > 100 ? 'is-warning' : ''} />
                        </div>
                    )}
                </PremiumCard>

                <PremiumCard className="qw-compact-summary-card">
                    <SectionHeader title="Mevcut Durum" description="Hesap ve varlık özeti" />
                    <div className="qw-summary-lines">
                        <SummaryLine label="Cüzdan nakdi" value={formatPara(sadeceCuzdanNakiti)} tone={sadeceCuzdanNakiti >= 0 ? undefined : 'danger'} />
                        <SummaryLine label="Yatırım gücü" value={formatPara(genelToplamYatirimGucu)} tone="info" />
                        <SummaryLine label="Hesap sayısı" value={`${(hesaplar || []).length} hesap`} />
                        <SummaryLine label="Hareket sayısı" value={`${filteredCount} kayıt`} />
                    </div>
                </PremiumCard>
            </div>

            <div className="qw-priority-grid">
                <FinancialTrendChart
                        title={null}
                        subtitle={null}
                        data={flowChartMode === 'cashflow' ? cashflowDataset : gunlukVeri}
                        headerControl={(
                            <div className="qw-chart-tabs" aria-label="Grafik türü">
                                <button
                                    type="button"
                                    className={flowChartMode === 'expense' ? 'is-active' : ''}
                                    onClick={() => setFlowChartMode('expense')}
                                >
                                    Günlük Harcama
                                </button>
                                <button
                                    type="button"
                                    className={flowChartMode === 'cashflow' ? 'is-active' : ''}
                                    onClick={() => setFlowChartMode('cashflow')}
                                >
                                    Nakit Akışı
                                </button>
                            </div>
                        )}
                        series={flowChartMode === 'cashflow' ? [
                            { key: 'gelir', label: 'Gelir', tone: 'success', color: '#16a36a' },
                            { key: 'gider', label: 'Gider', tone: 'danger', color: '#e25555', fillOpacity: 0.14, fillOpacityEnd: 0.01 },
                        ] : [
                            { key: 'value', label: 'Gerçek Harcama', tone: 'danger', color: '#e25555', fillOpacity: 0.16, fillOpacityEnd: 0.01 },
                        ]}
                        summary={flowChartMode === 'cashflow' ? {
                            label: 'Net',
                            value: formatPara(selectedPeriodNet),
                            tone: getFinancialTone(selectedPeriodNet),
                        } : {
                            items: [
                                {
                                    key: 'daily-average',
                                    label: 'Günlük Ortalama',
                                    value: formatPara(dailyExpenseAverage),
                                    tone: 'neutral',
                                    showDot: false,
                                },
                                {
                                    key: 'total',
                                    label: 'Toplam',
                                    value: formatPara(dailyExpenseTotal),
                                    tone: 'danger',
                                    showDot: false,
                                },
                            ],
                        }}
                        summaryPlacement={flowChartMode === 'expense' ? 'footer' : 'header'}
                        valueFormatter={(value) => gizliMod ? '****' : formatCurrencyPlain(value)}
                        yTickFormatter={(value) => gizliMod ? '****' : `${new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} ₺`}
                        tooltipRows={flowChartMode === 'cashflow' ? ((item, formatter) => {
                            const income = parseAmount(item?.gelir);
                            const expense = -Math.abs(parseAmount(item?.gider));
                            const net = parseAmount(item?.net);
                            return [
                                { label: 'Gelir', value: formatter(income), tone: 'success' },
                                { label: 'Gider', value: formatter(expense), tone: 'danger' },
                                { label: 'Net', value: formatter(net), tone: getFinancialTone(net) },
                            ];
                        }) : ((item, formatter) => [
                            { label: 'Gerçek Harcama', value: formatter(parseAmount(item?.value)), tone: 'danger' },
                        ])}
                        emptyTitle={flowChartMode === 'cashflow' ? 'Nakit akışı oluşmadı' : 'Günlük harcama yok'}
                        emptyDescription={flowChartMode === 'cashflow' ? 'Seçili dönemde gelir veya gider hareketi yok.' : 'Seçili dönemde gerçek tüketim harcaması görünmüyor.'}
                        emptyIcon={LineChart}
                    />

                <PremiumCard className="qw-scroll-card qw-upcoming-card">
                    <SectionHeader
                        title="Yaklaşan Ödemeler"
                        description={`${upcomingPayments.length} ödeme`}
                    />
                    <div className="qw-payment-list qw-payment-list--scroll">
                        {upcomingPayments.map((payment) => {
                            const dueTime = payment.date ? new Date(payment.date).setHours(0, 0, 0, 0) : null;
                            const todayTime = new Date().setHours(0, 0, 0, 0);
                            const diffDays = dueTime !== null ? Math.ceil((dueTime - todayTime) / 86400000) : null;
                            const dueMeta = diffDays !== null && diffDays >= 0 && diffDays <= 3
                                ? `${formatDayMonth(payment.date)} · ${payment.type} · Yakın`
                                : `${formatDayMonth(payment.date)} · ${payment.type}`;
                            return (
                                <UpcomingPaymentRow
                                    key={payment.id}
                                    icon={payment.icon}
                                    tone={payment.tone}
                                    title={payment.title}
                                    meta={dueMeta}
                                    amount={formatPara(payment.amount)}
                                    badge={payment.badgeLabel}
                                    onClick={payment.onClick}
                                />
                            );
                        })}
                        {upcomingPayments.length === 0 && (
                            <EmptyState title="Yaklaşan ödeme yok" description="Seçili dönemde bekleyen ödeme görünmüyor." icon={Bell} />
                        )}
                    </div>
                </PremiumCard>
            </div>

            <div
                className="qw-transactions-accounts-grid"
                style={{ '--accounts-panel-height': `${Math.max(360, 120 + (siraliHesaplar.length * 62))}px` }}
            >
                <PremiumCard className="qw-transactions-card">
                    <SectionHeader
                        title="Hareket geçmişi"
                        description={transactionDescription}
                        action={(
                            <div className="qw-export-actions">
                                <QuickActionButton icon={Download} onClick={excelIndir}>XLS</QuickActionButton>
                                <label className="qw-action-button">
                                    <Upload size={16} strokeWidth={2.35} />
                                    Yükle
                                    <input type="file" accept=".xlsx,.xls,.csv" onChange={excelYukle} hidden />
                                </label>
                            </div>
                        )}
                    />
                    <DashboardToolbar
                        searchValue={aramaMetni}
                        onSearchChange={setAramaMetni}
                        accountValue={filtreHesap}
                        onAccountChange={setFiltreHesap}
                        accounts={siraliHesaplar}
                        categoryValue={filtreKategori}
                        onCategoryChange={setFiltreKategori}
                        categories={sortTurkishText([...siraliKategoriListesi, 'Transfer'])}
                        tagValue={filtreEtiket}
                        onTagChange={setFiltreEtiket}
                        tags={usedTransactionTags}
                    />
                    <div className="qw-transaction-list qw-transaction-list--scroll">
                        {recentTransactions.map((transaction) => {
                            const isCreditCardCashOut = isCreditCardCashOutTransaction(transaction, hesaplar);
                            const amountTone = transaction.islemTipi === 'gelir'
                                ? 'success'
                                : transaction.islemTipi === 'transfer' && !isCreditCardCashOut
                                    ? 'info'
                                    : 'danger';
                            const prefix = transaction.islemTipi === 'gelir'
                                ? '+'
                                : transaction.islemTipi === 'gider' || isCreditCardCashOut
                                    ? '-'
                                    : '';
                            return (
                                <TransactionRow
                                    key={transaction.id}
                                    icon={transactionIcon(transaction)}
                                    tone={transactionTone(transaction)}
                                    title={transaction.aciklama || transaction.kategori || 'İşlem'}
                                    meta={getTransactionMeta(transaction)}
                                    tags={transaction.tags || []}
                                    amount={`${prefix}${formatPara(transaction.tutar)}`}
                                    amountTone={amountTone}
                                    onClick={() => modalAc('duzenle_islem', transaction)}
                                    actions={(
                                        <>
                                            <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={(event) => { event.stopPropagation(); modalAc('duzenle_islem', transaction); }}>
                                                <Edit3 size={14} />
                                            </button>
                                            <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={(event) => { event.stopPropagation(); islemSil(transaction.id); }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                />
                            );
                        })}
                        {recentTransactions.length === 0 && <EmptyState title="İşlem bulunamadı" description="Arama veya kategori filtrenizi değiştirin." icon={Search} />}
                    </div>
                    <div className="qw-card-sticky-footer">
                        <span>Filtrelenen işlemler toplamı</span>
                        <strong className={`is-${getFinancialTone(filteredTransactionsNet)}`}>{formatPara(filteredTransactionsNet)}</strong>
                    </div>
                </PremiumCard>

                <PremiumCard className="qw-accounts-card">
                    <SectionHeader
                        title="Hesaplar"
                        description={`${(hesaplar || []).length} hesap`}
                        action={<QuickActionButton icon={Plus} onClick={() => modalAc('hesap_ekle')}>Hesap ekle</QuickActionButton>}
                    />
                    <div className="qw-account-list">
                        {siraliHesaplar.map((account) => {
                            return (
                                <button key={account.id} type="button" className="qw-account-row" title={account.hesapAdi} onClick={() => { setSalaryHistoryMode('calendar'); setHistoryAccount(account); }}>
                                    <IconTile icon={getAccountIcon(account)} tone={getAccountTone(account)} />
                                    <span>
                                        <strong>
                                            <span>{account.hesapAdi}</span>
                                            {account.varsayilanOdemeAraci && <em className="qw-default-account-badge">Varsayılan</em>}
                                        </strong>
                                        <small>{account.hesapTipi === 'krediKarti' ? 'Kredi Kartı' : account.hesapTipi === 'yatirim' ? 'Yatırım Hesabı' : 'Vadesiz Hesap'}</small>
                                    </span>
                                    <span className="qw-account-row__side">
                                        <b className={parseAmount(account.guncelBakiye) < 0 ? 'is-danger' : ''}>{formatPara(account.guncelBakiye)}</b>
                                        <span className="qw-row-actions">
                                            <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={(event) => { event.stopPropagation(); modalAc('duzenle_hesap', account); }}>
                                                <Edit3 size={14} />
                                            </button>
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                        {siraliHesaplar.length === 0 && <EmptyState title="Hesap yok" description="Yeni hesap ekleyerek başlayın." icon={Wallet} />}
                    </div>
                </PremiumCard>
            </div>

            <div className="qw-secondary-grid">
                <PremiumCard>
                    <SectionHeader
                        title="Harcama Dağılımı"
                        description="Kategorileri tıklayarak grafikten çıkarın"
                        action={hasHiddenExpenseCategories ? (
                            <QuickActionButton onClick={clearHiddenExpenseCategories}>Tümünü göster</QuickActionButton>
                        ) : null}
                    />
                    {categoryRows.length > 0 ? (
                        <div className="qw-donut-layout">
                            <div className="qw-donut-chart">
                                {donutData.length > 0 ? (
                                    <PremiumDonutChart
                                        data={donutData}
                                        centerValue={formatPara(kategoriToplam)}
                                        centerLabel="Aktif gider"
                                        formatValue={formatPara}
                                        height={220}
                                        innerRadius={64}
                                        outerRadius={88}
                                    />
                                ) : (
                                    <EmptyState title="Tüm kategoriler kapalı" description="Grafiği görmek için bir kategoriyi tekrar açın." icon={PiePlaceholder} />
                                )}
                            </div>
                            <div className="qw-category-list">
                                {categoryRows.map((item) => {
                                    const activePercent = kategoriToplam > 0 ? Math.round((item.value / kategoriToplam) * 100) : 0;

                                    return (
                                        <button
                                            type="button"
                                            className={[
                                                'qw-category-row',
                                                !item.isActive ? 'is-muted' : '',
                                            ].filter(Boolean).join(' ')}
                                            key={item.name}
                                            aria-pressed={item.isActive}
                                            onClick={() => toggleExpenseCategory(item.name)}
                                            title={`${item.name} kategorisini ${item.isActive ? 'grafikten çıkar' : 'grafiğe ekle'}`}
                                        >
                                            <span style={{ background: item.color }} />
                                            <div>
                                                <strong>{item.name}</strong>
                                                <small>{item.isActive ? `%${activePercent}` : 'Kapalı'}</small>
                                            </div>
                                            <b>{formatPara(item.value)}</b>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <EmptyState title="Harcama kategorisi yok" description="Seçili dönemde gider kategorisi bulunmadı." icon={PiePlaceholder} />
                    )}
                </PremiumCard>

                <PremiumCard className="qw-quick-entry-card qw-quick-entry-card--compact">
                    <SectionHeader title="Hızlı İşlem" />
                    <QuickTransactionForm {...quickTransactionFormProps} />
                </PremiumCard>
            </div>

            <div className="qw-module-grid">
                <PremiumCard className="qw-module-card">
                    <SectionHeader
                        title="Sabit Giderler"
                        description={`${(abonelikler || []).length} sabit gider`}
                        action={<QuickActionButton icon={Plus} onClick={() => modalAc('abonelik_ekle')}>Sabit gider</QuickActionButton>}
                    />
                    <div className="qw-summary-lines">
                        <SummaryLine label="Aylık toplam" value={formatPara(toplamSabitGider)} tone="info" />
                    </div>
                    <div className="qw-module-list">
                        {subscriptionRows.map((subscription) => (
                            <ModuleRow
                                key={subscription.id}
                                icon={Repeat2}
                                tone="info"
                                title={subscription.ad || 'Sabit gider'}
                                meta={`Her ayın ${subscription.gun || '-'} günü`}
                                amount={formatPara(subscription.tutar)}
                                onClick={() => abonelikOde(subscription)}
                                actions={(
                                    <>
                                        <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={(event) => { event.stopPropagation(); modalAc('duzenle_abonelik', subscription); }}>
                                            <Edit3 size={14} />
                                        </button>
                                        <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={(event) => { event.stopPropagation(); normalSil('abonelikler', subscription.id); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            />
                        ))}
                        {subscriptionRows.length === 0 && <EmptyState title="Sabit gider yok" description="Sabit gider ekleyerek takip edebilirsiniz." icon={Repeat2} />}
                    </div>
                </PremiumCard>

                <PremiumCard className="qw-module-card">
                    <SectionHeader
                        title="Faturalar"
                        description={`${billDisplayRows.length} fatura`}
                        action={<QuickActionButton icon={Plus} onClick={() => modalAc('fatura_tanim_ekle')}>Fatura tanımı</QuickActionButton>}
                    />
                    <div className="qw-summary-lines">
                        <SummaryLine label="Bekleyen toplam tutar" value={formatPara(billTotal)} tone="danger" />
                    </div>
                    <div className="qw-module-list">
                        {billDisplayRows.map((bill) => (
                            <ModuleRow
                                key={bill.id}
                                icon={ReceiptText}
                                tone={bill.mode === 'pending' ? 'danger' : 'neutral'}
                                title={bill.title}
                                meta={bill.meta || (bill.date ? `${formatDayMonth(bill.date)} · Fatura` : 'Tarih tanımsız')}
                                amount={bill.amount > 0 ? formatPara(bill.amount) : undefined}
                                amountTone={bill.mode === 'pending' ? 'danger' : undefined}
                                amountMeta={bill.amountMeta}
                                badge={bill.status}
                                onClick={() => modalAc(bill.mode === 'pending' ? 'fatura_ode' : 'duzenle_fatura_tanim', bill.data)}
                                actions={(
                                    <>
                                        <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={(event) => { event.stopPropagation(); modalAc(bill.mode === 'pending' ? 'duzenle_bekleyen_fatura' : 'duzenle_fatura_tanim', bill.data); }}>
                                            <Edit3 size={14} />
                                        </button>
                                        <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={(event) => { event.stopPropagation(); normalSil(bill.mode === 'pending' ? 'bekleyen_faturalar' : 'tanimli_faturalar', bill.data.id); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            />
                        ))}
                        {billDisplayRows.length === 0 && <EmptyState title="Fatura tanımı yok" description="Fatura tanımı ekleyerek takip edebilirsiniz." icon={ReceiptText} />}
                    </div>
                </PremiumCard>

                <PremiumCard className="qw-module-card">
                    <SectionHeader title="Taksitler" description={`${allInstallmentRows.length} taksit`} />
                    <div className="qw-summary-lines qw-installment-summary">
                        <SummaryLine label="Kalan Taksit Borcu" value={formatPara(installmentRemainingTotal)} tone="purple" />
                        <SummaryLine label="Bu Ay Taksitler" value={formatPara(monthlyInstallmentLoad)} tone="danger" />
                    </div>
                    <div className="qw-module-list">
                        {installmentRows.map((installment) => {
                            const paid = installment.paidCount;
                            const count = installment.installmentCount;
                            const dueDate = installment.nextDueDate;
                            const nextInstallmentNumber = installment.nextInstallmentNumber;
                            const dueText = dueDate ? `${formatDayMonth(dueDate)} · ` : '';
                            const installmentForPayment = { ...installment, odenmisTaksit: paid };
                            return (
                                <ModuleRow
                                    key={installment.id}
                                    icon={CalendarClock}
                                    tone="purple"
                                    title={installment.baslik || 'Taksit'}
                                    meta={`${dueText}${formatPara(installment.remainingDebt)} · ${nextInstallmentNumber}/${count || '-'} taksit`}
                                    amount={formatPara(installment.monthly)}
                                    amountTone="purple"
                                    onClick={() => taksitOde(installmentForPayment)}
                                    actions={(
                                        <>
                                            <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={(event) => { event.stopPropagation(); modalAc('duzenle_taksit', installment); }}>
                                                <Edit3 size={14} />
                                            </button>
                                            <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={(event) => { event.stopPropagation(); normalSil('taksitler', installment.id); }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                />
                            );
                        })}
                        {installmentRows.length === 0 && <EmptyState title="Aktif taksit yok" description="Taksit planlarınız burada görünür." icon={CalendarClock} />}
                    </div>
                </PremiumCard>
            </div>

            <div className="qw-debt-grid qw-debt-grid--single">
                <PremiumCard className="qw-module-card">
                    <SectionHeader
                        title="Borçlar"
                        description={`${(borclar || []).length} borç kaydı`}
                        action={<QuickActionButton icon={Plus} onClick={() => modalAc('borc_tanimla')}>Borç ekle</QuickActionButton>}
                    />
                    <div className="qw-summary-lines qw-debt-summary">
                        <SummaryLine label="Kalan Borç" value={formatPara(debtTotal)} tone="danger" />
                        <SummaryLine label="Bu Ay Ödenecek" value={formatPara(currentMonthDebtDue)} />
                    </div>
                    <div className="qw-module-list qw-module-list--debt">
                        {debtRows.map((debt) => (
                            <ModuleRow
                                key={debt.id}
                                icon={CreditCard}
                                tone="warning"
                                title={debt.ad || debt.baslik || 'Borç'}
                                meta={debt.sonOdemeTarihi ? `${formatDayMonth(toDateSafe(debt.sonOdemeTarihi))} · Borç` : 'Borç'}
                                amount={formatPara(debt.kalanTutar ?? debt.tutar)}
                                amountTone="danger"
                                onClick={() => modalAc('borc_ode', debt)}
                                actions={(
                                    <>
                                        <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={(event) => { event.stopPropagation(); modalAc('duzenle_borc', debt); }}>
                                            <Edit3 size={14} />
                                        </button>
                                        <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={(event) => { event.stopPropagation(); normalSil('borclar', debt.id); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            />
                        ))}
                        {debtRows.length === 0 && <EmptyState title="Borç kaydı yok" description="Yeni borç ekleyerek takip edebilirsiniz." icon={CreditCard} />}
                    </div>
                </PremiumCard>
            </div>

            <HighQualityModal
                isOpen={Boolean(historyAccount)}
                onClose={() => setHistoryAccount(null)}
                title={(
                    <>
                        <span>{historyAccount?.hesapAdi || ''}</span>
                        {historyAccount?.varsayilanOdemeAraci && <em className="qw-default-account-badge">Varsayılan</em>}
                    </>
                )}
                subtitle={historySubtitle}
                headerActions={historyAccount?.hesapTipi === 'krediKarti' ? (
                    <button
                        type="button"
                        className="qw-action-button qw-cc-pay-header-button"
                        onClick={() => modalAc('kredi_karti_ode', historyAccount)}
                    >
                        <CreditCard size={16} strokeWidth={2.35} />
                        Borç Öde
                    </button>
                ) : null}
                width="min(760px, calc(100vw - 48px))"
                maxHeight="min(760px, calc(100vh - 80px))"
                className="qw-account-history-modal"
                bodyClassName="qw-account-history-body"
                overlayClassName="qw-account-history-overlay"
                overlayStyle={{
                    background: isNestedModalOpen ? 'transparent' : 'rgba(15, 23, 42, 0.36)',
                    backdropFilter: isNestedModalOpen ? 'none' : 'blur(6px)',
                    WebkitBackdropFilter: isNestedModalOpen ? 'none' : 'blur(6px)',
                    padding: '24px'
                }}
                contentStyle={{
                    borderRadius: '24px',
                    overflow: 'hidden'
                }}
                headerStyle={{
                    padding: '24px 28px 18px',
                    flexShrink: 0,
                    alignItems: 'flex-start'
                }}
                bodyStyle={{
                    padding: 0,
                    minHeight: 0
                }}
            >
                {historyAccount && historyAccount.hesapTipi !== 'krediKarti' && (
                    <div className="qw-account-detail-summary">
                        {historyAccountIsSalary && (
                            <div className="qw-account-detail-toolbar">
                                <div className="qw-form-tabs qw-account-detail-tabs">
                                    <button type="button" className={salaryHistoryMode === 'calendar' ? 'is-active' : ''} onClick={() => setSalaryHistoryMode('calendar')}>Takvim Ayı</button>
                                    <button type="button" className={salaryHistoryMode === 'salary' ? 'is-active' : ''} onClick={() => setSalaryHistoryMode('salary')}>Maaş Dönemi</button>
                                </div>
                                {historyAccountSalaryPeriod && selectedSalarySummary && (
                                    <button
                                        type="button"
                                        className="qw-account-detail-link-button"
                                        onClick={() => {
                                            setHistoryAccount(null);
                                            setAnaSekme?.('maasAnalizi');
                                        }}
                                    >
                                        Detaylı Maaş Analizi
                                    </button>
                                )}
                            </div>
                        )}
                        <div className="qw-account-detail-summary__grid">
                            <div className="qw-account-detail-metric">
                                <span>Güncel Bakiye</span>
                                <strong className={getFinancialTone(accountCurrentBalance) ? `is-${getFinancialTone(accountCurrentBalance)}` : ''}>{formatPara(accountCurrentBalance)}</strong>
                                <small>{historyAccount.hesapTipi === 'yatirim' ? 'Yatırım Hesabı' : historyAccountIsSalary ? 'Maaş Hesabı' : 'Vadesiz Hesap'}</small>
                            </div>
                            <div className="qw-account-detail-metric is-success">
                                <span>Giriş</span>
                                <strong>{formatPara(salaryHistoryMode === 'salary' && selectedSalarySummary ? selectedSalarySummary.income + selectedSalarySummary.refund : accountInflowTotal)}</strong>
                                <small>Gelir ve gelen transferler</small>
                            </div>
                            <div className="qw-account-detail-metric is-danger">
                                <span>Çıkış</span>
                                <strong>{formatPara(salaryHistoryMode === 'salary' && selectedSalarySummary ? selectedSalarySummary.expense + selectedSalarySummary.investment : accountOutflowTotal)}</strong>
                                <small>Harcama ve aktarımlar</small>
                            </div>
                            <div className="qw-account-detail-metric">
                                <span>Net Hareket</span>
                                <strong className={getFinancialTone(salaryHistoryMode === 'salary' && selectedSalarySummary ? selectedSalarySummary.remaining : accountNetMovement) ? `is-${getFinancialTone(salaryHistoryMode === 'salary' && selectedSalarySummary ? selectedSalarySummary.remaining : accountNetMovement)}` : ''}>
                                    {formatPara(salaryHistoryMode === 'salary' && selectedSalarySummary ? selectedSalarySummary.remaining : accountNetMovement)}
                                </strong>
                                <small>{selectedAccountMovements.length} hareket</small>
                            </div>
                        </div>
                        {salaryHistoryMode === 'salary' && !historyAccountSalaryPeriod && (
                            <div className="qw-empty-state" style={{ padding: '16px', alignItems: 'flex-start', textAlign: 'left' }}>
                                <strong>Maaş günü eksik</strong>
                                <span>Maaş dönemi analizi için hesap düzenleme alanından maaş günü tanımlayın.</span>
                            </div>
                        )}
                    </div>
                )}
                {historyAccount?.hesapTipi === 'krediKarti' && (
                    <div style={{ padding: '18px 28px 0' }}>
                        {!historyAccountBillingDay ? (
                            <div className="qw-empty-state" style={{ padding: '16px', alignItems: 'flex-start', textAlign: 'left' }}>
                                <strong>Ekstre kesim günü eksik</strong>
                                <span>Ekstre dönemini hesaplamak için hesap düzenleme alanından kesim günü tanımlayın. Şimdilik seçili takvim dönemi gösteriliyor.</span>
                            </div>
                        ) : (
                            <div className="qw-credit-card-summary">
                                <div className="qw-credit-card-summary__primary">
                                    <div className="qw-credit-card-metric is-danger">
                                        <span>Kalan Ekstre</span>
                                        <strong>{formatPara(statementRemainingTotal)}</strong>
                                        <small>Net {formatPara(statementNetTotal)}</small>
                                    </div>
                                    <div className="qw-credit-card-metric is-info">
                                        <span>Ödenen</span>
                                        <strong>{formatPara(statementPaymentTotal)}</strong>
                                        <small>Kart ödemeleri</small>
                                    </div>
                                    <div className="qw-credit-card-metric">
                                        <span>Harcama / İade</span>
                                        <strong>{formatPara(statementExpenseTotal)}</strong>
                                        <small>{statementRefundTotal > 0 ? `${formatPara(statementRefundTotal)} iade` : 'İade yok'}</small>
                                    </div>
                                </div>
                                {historyCreditCardLimit > 0 && (
                                    <div className="qw-credit-limit-panel">
                                        <div className="qw-credit-limit-panel__top">
                                            <span>Kullanılabilir Limit</span>
                                            <strong className={historyCreditCardAvailableLimit <= historyCreditCardLimit * 0.1 ? 'is-danger' : 'is-success'}>
                                                {formatPara(historyCreditCardAvailableLimit)}
                                            </strong>
                                        </div>
                                        <div className="qw-credit-limit-track" aria-hidden="true">
                                            <span style={{ width: `${historyCreditCardLimitRatio}%` }} />
                                        </div>
                                        <div className="qw-credit-limit-panel__meta">
                                            <span>Kullanılan {formatPara(historyCreditCardUsedLimit)}</span>
                                            <span>Toplam limit {formatPara(historyCreditCardLimit)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                <div className="qw-transaction-list qw-account-history-list">
                    {historyAccount && selectedAccountMovements.map((transaction) => {
                        const movementAmount = getAccountMovementAmount(transaction, historyAccount.id);
                        const amountTone = getFinancialTone(movementAmount);
                        const prefix = movementAmount > 0 ? '+' : movementAmount < 0 ? '-' : '';
                        return (
                            <TransactionRow
                                key={transaction.id}
                                icon={transactionIcon(transaction)}
                                tone={movementAmount > 0 ? 'success' : movementAmount < 0 ? 'danger' : 'neutral'}
                                title={transaction.aciklama || transaction.kategori || 'İşlem'}
                                meta={getAccountMovementMeta(transaction, historyAccount.id)}
                                tags={transaction.tags || []}
                                amount={`${prefix}${formatPara(Math.abs(movementAmount))}`}
                                amountTone={amountTone}
                                onClick={() => modalAc('duzenle_islem', transaction)}
                                actions={(
                                    <>
                                        <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={(event) => { event.stopPropagation(); modalAc('duzenle_islem', transaction); }}>
                                            <Edit3 size={14} />
                                        </button>
                                        <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={(event) => { event.stopPropagation(); islemSil(transaction.id); }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            />
                        );
                    })}
                    {selectedAccountMovements.length === 0 && <EmptyState title="Hareket yok" description="Bu hesaba bağlı işlem bulunmuyor." icon={Wallet} />}
                </div>
            </HighQualityModal>
        </div>
    );
};

const PiePlaceholder = ReceiptText;

export default BudgetDashboard;
