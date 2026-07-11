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
import { inputStyle, formatCurrencyPlain, tarihFormatla, toDateSafe, sortTurkishText } from '../../utils/helpers';
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

const parseAmount = (value) => parseFloat(value) || 0;

const formatDayMonth = (date) => {
    if (!date) return 'Tarih yok';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
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
        return {
            key: `${selectedPeriod.year}-${selectedPeriod.month}-${day}`,
            name: day,
            tooltipLabel: `${day} ${MONTH_NAMES[selectedPeriod.month - 1]} ${selectedPeriod.year}`,
            gelir: 0,
            gider: 0,
            net: 0,
        };
    });
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
    <div className="qw-summary-line">
        <span>{label}</span>
        <strong className={tone ? `is-${tone}` : ''}>{value}</strong>
    </div>
);

const ModuleRow = ({ icon, tone = 'neutral', title, meta, amount, amountTone, badge, onClick, actions }) => (
    <div className={`qw-module-row ${onClick ? 'is-clickable' : ''}`} onClick={onClick}>
        <IconTile icon={icon} tone={tone} />
        <div className="qw-module-row__main">
            <strong>{title}</strong>
            {meta && <span>{meta}</span>}
        </div>
        <div className="qw-module-row__side">
            {amount !== undefined && <b className={amountTone ? `is-${amountTone}` : ''}>{amount}</b>}
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

const getBillStatus = (date, hasDebt) => {
    if (hasDebt) return { label: 'Borç oluştu', tone: 'danger' };
    if (!date) return { label: 'Bekliyor', tone: 'neutral' };

    const todayTime = new Date().setHours(0, 0, 0, 0);
    const dueTime = new Date(date).setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueTime - todayTime) / 86400000);

    if (diffDays >= 0 && diffDays <= 7) return { label: 'Yaklaşıyor', tone: 'warning' };
    return { label: 'Bekliyor', tone: 'neutral' };
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
    formTab, setFormTab,
    islemEkle,
    transferYap,
    taksitEkle,
    faturaGir,
    secilenHesapId, setSecilenHesapId,
    islemTipi, setIslemTipi,
    kategori, setKategori,
    islemAciklama, setIslemAciklama,
    islemTutar, setIslemTutar,
    islemTarihi, setIslemTarihi,
    transferKaynakId, setTransferKaynakId,
    transferHedefId, setTransferHedefId,
    transferTutar, setTransferTutar,
    transferUcreti, setTransferUcreti,
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
    filtreKategori, setFiltreKategori,
    borclar,
    excelIndir,
    excelYukle,
    islemSil,
    setAnaSekme
}) => {
    const [historyAccount, setHistoryAccount] = useState(null);
    const [salaryHistoryMode, setSalaryHistoryMode] = useState('calendar');
    const isNestedModalOpen = Boolean(historyAccount && aktifModal);
    const formatPara = (tutar) => gizliMod ? '****' : formatCurrencyPlain(parseAmount(tutar));
    const siraliKategoriListesi = sortTurkishText(kategoriListesi || []);
    const siraliHesaplar = [...(hesaplar || [])].sort((a, b) =>
        String(a?.hesapAdi || '').localeCompare(String(b?.hesapAdi || ''), 'tr-TR', { sensitivity: 'base' })
    );

    const cashFlowData = useMemo(() => {
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
            if (transaction.islemTipi === 'gelir') bucket.gelir += amount;
            if (transaction.islemTipi === 'gider') bucket.gider += amount;
            bucket.net = bucket.gelir - bucket.gider;
        });

        return buckets;
    }, [filtrelenmisIslemler, selectedPeriod]);

    const expenseSparkline = useMemo(() => (gunlukVeri || []).map((item) => ({
        name: item.name,
        value: parseAmount(item.value),
    })), [gunlukVeri]);

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

    const kategoriToplam = (kategoriVerisi || []).reduce((sum, item) => sum + parseAmount(item.value), 0);
    const donutData = useMemo(() => {
        const sorted = [...(kategoriVerisi || [])]
            .map((item) => ({ ...item, value: parseAmount(item.value) }))
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value);
        return sorted.map((item, index) => ({
            ...item,
            color: DONUT_PALETTE[index % DONUT_PALETTE.length],
            yuzde: kategoriToplam > 0 ? Math.round((item.value / kategoriToplam) * 100) : 0,
        }));
    }, [kategoriVerisi, kategoriToplam]);

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

    const upcomingPayments = useMemo(() => {
        const periodDate = selectedPeriod?.month === 'all'
            ? new Date()
            : new Date(selectedPeriod.year, selectedPeriod.month - 1, 1);
        const currentYear = periodDate.getFullYear();
        const currentMonth = periodDate.getMonth();

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
                if (!dueDate) return;
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
                rows.push({
                    id: `card-statement-${account.id}`,
                    title: account.hesapAdi || 'Kart ekstresi',
                    type: 'Kart ekstresi',
                    badgeLabel: 'Kart ekstresi',
                    date: dueDate,
                    amount: Math.abs(parseAmount(account.guncelBakiye)),
                    icon: CreditCard,
                    tone: 'warning',
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

        (abonelikler || []).forEach((subscription) => {
            const day = parseInt(subscription.gun) || null;
            const dueDate = day ? new Date(currentYear, currentMonth, Math.min(day, 28)) : null;
            rows.push({
                id: `subscription-${subscription.id}`,
                title: subscription.ad || 'Abonelik',
                type: 'Abonelik',
                badgeLabel: 'Abonelik',
                date: dueDate,
                amount: parseAmount(subscription.tutar),
                icon: Repeat2,
                tone: 'info',
                onClick: () => abonelikOde(subscription),
            });
        });

        return rows
            .filter((row) => row.date)
            .sort((a, b) => {
                if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
                return (a.date?.getTime() || Number.MAX_SAFE_INTEGER) - (b.date?.getTime() || Number.MAX_SAFE_INTEGER);
            });
    }, [abonelikler, abonelikOde, bekleyenFaturalar, getInstallmentPaidCount, hesaplar, modalAc, selectedPeriod, taksitOde, taksitler, tanimliFaturalar]);

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

    const installmentRows = [...(taksitler || [])]
        .filter((item) => {
            const paid = getInstallmentPaidCount(item);
            const count = parseInt(item.taksitSayisi) || 0;
            return !(count > 0 && paid >= count);
        })
        .sort((a, b) => (toDateSafe(a.alisTarihi || a.olusturmaTarihi)?.getTime() || Number.MAX_SAFE_INTEGER) - (toDateSafe(b.alisTarihi || b.olusturmaTarihi)?.getTime() || Number.MAX_SAFE_INTEGER))
        .slice(0, 8);

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
                status: getBillStatus(dueDate, true),
                data: bill,
                mode: 'pending',
            };
        }),
        ...(tanimliFaturalar || [])
            .filter((definition) => !(bekleyenFaturalar || []).some((bill) => bill.tanimId === definition.id))
            .map((definition) => {
                const today = new Date();
                const dueDate = getMonthlyDueDate(definition, today.getFullYear(), today.getMonth());
                if (!dueDate) return null;
                return {
                    id: `definition-${definition.id}`,
                    title: definition.baslik || definition.kurum || 'Fatura',
                    date: dueDate,
                    amount: parseAmount(definition.tutar || definition.ortalamaTutar),
                    status: getBillStatus(dueDate, false),
                    data: definition,
                    mode: 'definition',
                };
            })
            .filter(Boolean),
    ]
        .sort((a, b) => (a.date?.getTime() || Number.MAX_SAFE_INTEGER) - (b.date?.getTime() || Number.MAX_SAFE_INTEGER))
        .slice(0, 8);
    const debtOriginalTotal = (borclar || []).reduce((sum, item) => sum + parseAmount(item.tutar), 0);
    const debtTotal = (borclar || []).reduce((sum, item) => sum + parseAmount(item.kalanTutar ?? item.tutar), 0);
    const currentMonthDebtDue = (borclar || []).reduce((sum, item) => {
        const dueDate = toDateSafe(item.sonOdemeTarihi || item.tarih);
        return isSameCalendarMonth(dueDate, new Date()) ? sum + parseAmount(item.kalanTutar ?? item.tutar) : sum;
    }, 0);
    const filteredCount = (filtrelenmisIslemler || []).length;
    const isFiltering = Boolean(aramaMetni) || filtreKategori !== 'Tümü';
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
                        <SummaryLine label="Aktif işlem" value={`${filteredCount} kayıt`} />
                    </div>
                </PremiumCard>
            </div>

            <div className="qw-priority-grid">
                <FinancialTrendChart
                        title="Nakit Akışı"
                        subtitle={`${aktifAy} hareket görünümü`}
                        data={cashFlowData}
                        series={[
                            { key: 'gelir', label: 'Gelir', tone: 'success', color: '#16a36a' },
                            { key: 'gider', label: 'Gider', tone: 'danger', color: '#e25555', fillOpacity: 0.14, fillOpacityEnd: 0.01 },
                        ]}
                        summary={{
                            label: 'Net',
                            value: formatPara(selectedPeriodNet),
                            tone: getFinancialTone(selectedPeriodNet),
                        }}
                        valueFormatter={(value) => gizliMod ? '****' : formatCurrencyPlain(value)}
                        yTickFormatter={(value) => gizliMod ? '****' : `${new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} ₺`}
                        tooltipRows={(item, formatter) => {
                            const income = parseAmount(item?.gelir);
                            const expense = -Math.abs(parseAmount(item?.gider));
                            const net = parseAmount(item?.net);
                            return [
                                { label: 'Gelir', value: formatter(income), tone: 'success' },
                                { label: 'Gider', value: formatter(expense), tone: 'danger' },
                                { label: 'Net', value: formatter(net), tone: getFinancialTone(net) },
                            ];
                        }}
                        emptyTitle="Nakit akışı oluşmadı"
                        emptyDescription="Seçili dönemde gelir veya gider hareketi yok."
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

            <div className="qw-transactions-accounts-grid">
                <PremiumCard className="qw-transactions-card">
                    <SectionHeader
                        title="Son İşlemler"
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
                        categoryValue={filtreKategori}
                        onCategoryChange={setFiltreKategori}
                        categories={sortTurkishText([...siraliKategoriListesi, 'Transfer'])}
                    />
                    <div className="qw-transaction-list qw-transaction-list--scroll">
                        {recentTransactions.map((transaction) => {
                            const amountTone = transaction.islemTipi === 'gelir' ? 'success' : transaction.islemTipi === 'transfer' ? 'info' : 'danger';
                            const prefix = transaction.islemTipi === 'gelir' ? '+' : transaction.islemTipi === 'gider' ? '-' : '';
                            return (
                                <TransactionRow
                                    key={transaction.id}
                                    icon={transactionIcon(transaction)}
                                    tone={transactionTone(transaction)}
                                    title={transaction.aciklama || transaction.kategori || 'İşlem'}
                                    meta={getTransactionMeta(transaction)}
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
                        {siraliHesaplar.map((account) => (
                            <button key={account.id} type="button" className="qw-account-row" title={account.hesapAdi} onClick={() => { setSalaryHistoryMode('calendar'); setHistoryAccount(account); }}>
                                <IconTile icon={Landmark} tone={account.hesapTipi === 'krediKarti' ? 'warning' : 'accent'} />
                                <span>
                                    <strong>{account.hesapAdi}</strong>
                                    <small>{account.hesapTipi === 'krediKarti' ? 'Kredi kartı' : account.hesapTipi === 'yatirim' ? 'Yatırım hesabı' : 'Vadesiz hesap'}</small>
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
                        ))}
                        {siraliHesaplar.length === 0 && <EmptyState title="Hesap yok" description="Yeni hesap ekleyerek başlayın." icon={Wallet} />}
                    </div>
                </PremiumCard>
            </div>

            <div className="qw-secondary-grid">
                <PremiumCard>
                    <SectionHeader
                        title="Harcama Dağılımı"
                        description="En yüksek kategoriler"
                    />
                    {donutData.length > 0 ? (
                        <div className="qw-donut-layout">
                            <div className="qw-donut-chart">
                                <PremiumDonutChart
                                    data={donutData}
                                    centerValue={formatPara(kategoriToplam)}
                                    centerLabel="Toplam gider"
                                    formatValue={formatPara}
                                    height={220}
                                    innerRadius={64}
                                    outerRadius={88}
                                />
                            </div>
                            <div className="qw-category-list">
                                {donutData.map((item) => (
                                    <div className="qw-category-row" key={item.name}>
                                        <span style={{ background: item.color }} />
                                        <div>
                                            <strong>{item.name}</strong>
                                            <small>%{item.yuzde}</small>
                                        </div>
                                        <b>{formatPara(item.value)}</b>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState title="Harcama kategorisi yok" description="Seçili dönemde gider kategorisi bulunmadı." icon={PiePlaceholder} />
                    )}
                </PremiumCard>

                <PremiumCard className="qw-quick-entry-card qw-quick-entry-card--compact">
                    <SectionHeader title="Hızlı İşlem" />
                    <div className="qw-form-tabs">
                        {[
                            ['islem', 'İşlem'],
                            ['transfer', 'Transfer'],
                            ['taksit', 'Taksit'],
                            ['fatura', 'Fatura'],
                        ].map(([id, label]) => (
                            <button key={id} type="button" className={formTab === id ? 'is-active' : ''} onClick={() => setFormTab(id)}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {formTab === 'islem' && (
                        <form onSubmit={islemEkle} className="qw-quick-form">
                            <div className="qw-form-row">
                                <select value={secilenHesapId} onChange={e => setSecilenHesapId(e.target.value)} style={inputStyle}>
                                    <option value="">Hangi hesaptan?</option>
                                    {siraliHesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatPara(h.guncelBakiye)})</option>)}
                                </select>
                                <select value={islemTipi} onChange={e => setIslemTipi(e.target.value)} style={inputStyle}>
                                    <option value="gider">Gider</option>
                                    <option value="gelir">Gelir</option>
                                </select>
                            </div>
                            <select value={kategori || (siraliKategoriListesi && siraliKategoriListesi[0])} onChange={e => setKategori(e.target.value)} style={inputStyle}>
                                {siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                            <div className="qw-form-row">
                                <DescriptionInput
                                    value={islemAciklama}
                                    onChange={e => setIslemAciklama(e.target.value)}
                                    historyItems={tumIslemler}
                                    inputStyle={inputStyle}
                                    wrapperStyle={{ flex: 1 }}
                                />
                                <input type="number" placeholder="Tutar" value={islemTutar} onChange={e => setIslemTutar(e.target.value)} style={inputStyle} />
                            </div>
                            <input type="datetime-local" value={islemTarihi} onChange={e => setIslemTarihi(e.target.value)} style={inputStyle} />
                            <button type="submit" className="qw-submit-button">Kaydet</button>
                        </form>
                    )}

                    {formTab === 'transfer' && (
                        <form onSubmit={transferYap} className="qw-quick-form">
                            <div className="qw-form-row">
                                <select value={transferKaynakId} onChange={e => setTransferKaynakId(e.target.value)} style={inputStyle}>
                                    <option value="">Nereden?</option>
                                    {siraliHesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}
                                </select>
                                <select value={transferHedefId} onChange={e => setTransferHedefId(e.target.value)} style={inputStyle}>
                                    <option value="">Nereye?</option>
                                    {siraliHesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}
                                </select>
                            </div>
                            <div className="qw-form-row">
                                <input type="number" placeholder="İşlem tutarı" value={transferTutar} onChange={e => setTransferTutar(e.target.value)} style={inputStyle} />
                                <input type="number" placeholder="Ücret" value={transferUcreti} onChange={e => setTransferUcreti(e.target.value)} style={inputStyle} />
                            </div>
                            <input type="datetime-local" value={transferTarihi} onChange={e => setTransferTarihi(e.target.value)} style={inputStyle} />
                            <button type="submit" className="qw-submit-button">Transfer yap</button>
                        </form>
                    )}

                    {formTab === 'taksit' && (
                        <form onSubmit={taksitEkle} className="qw-quick-form">
                            <div className="qw-form-row">
                                <select value={taksitHesapId} onChange={e => setTaksitHesapId(e.target.value)} style={inputStyle} required>
                                    <option value="">Hangi karttan?</option>
                                    {siraliHesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}
                                </select>
                                <input placeholder="Ne aldın?" value={taksitBaslik} onChange={e => setTaksitBaslik(e.target.value)} style={inputStyle} required />
                            </div>
                            <div className="qw-form-row">
                                <input type="number" placeholder="Toplam borç" value={taksitToplamTutar} onChange={e => setTaksitToplamTutar(e.target.value)} style={inputStyle} required />
                                <input type="number" placeholder="Kaç taksit?" value={taksitSayisi} onChange={e => setTaksitSayisi(e.target.value)} style={inputStyle} required />
                            </div>
                            <div className="qw-form-row">
                                <select value={taksitKategori || (siraliKategoriListesi && siraliKategoriListesi[0])} onChange={e => setTaksitKategori(e.target.value)} style={inputStyle}>
                                    {siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                                <input type="date" value={taksitAlisTarihi} onChange={e => setTaksitAlisTarihi(e.target.value)} style={inputStyle} />
                            </div>
                            <StatusBadge tone="purple">Aylık {taksitToplamTutar && taksitSayisi ? formatPara(taksitToplamTutar / taksitSayisi) : formatPara(0)}</StatusBadge>
                            <button type="submit" className="qw-submit-button">Kaydet</button>
                        </form>
                    )}

                    {formTab === 'fatura' && (
                        <form onSubmit={faturaGir} className="qw-quick-form">
                            {(tanimliFaturalar || []).length === 0 ? (
                                <EmptyState title="Fatura tanımı yok" description="Önce bir fatura tanımı ekleyin." icon={ReceiptText} />
                            ) : (
                                <>
                                    <select value={secilenTanimId} onChange={e => setSecilenTanimId(e.target.value)} style={inputStyle} required>
                                        <option value="">Hangi fatura?</option>
                                        {(tanimliFaturalar || []).map(t => <option key={t.id} value={t.id}>{t.baslik} ({t.kurum})</option>)}
                                    </select>
                                    <div className="qw-form-row">
                                        <input type="number" placeholder="Tutar" value={faturaGirisTutar} onChange={e => setFaturaGirisTutar(e.target.value)} style={inputStyle} required />
                                        <input type="date" value={faturaGirisTarih} onChange={e => setFaturaGirisTarih(e.target.value)} style={inputStyle} required />
                                    </div>
                                    <input placeholder="Açıklama" value={faturaGirisAciklama} onChange={e => setFaturaGirisAciklama(e.target.value)} style={inputStyle} />
                                    <button type="submit" className="qw-submit-button">Kaydet</button>
                                </>
                            )}
                        </form>
                    )}
                </PremiumCard>
            </div>

            <div className="qw-module-grid">
                <PremiumCard className="qw-module-card">
                    <SectionHeader
                        title="Abonelikler"
                        description={`${(abonelikler || []).length} abonelik`}
                        action={<QuickActionButton icon={Plus} onClick={() => modalAc('abonelik_ekle')}>Abonelik</QuickActionButton>}
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
                                title={subscription.ad || 'Abonelik'}
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
                        {subscriptionRows.length === 0 && <EmptyState title="Abonelik yok" description="Abonelik ekleyerek takip edebilirsiniz." icon={Repeat2} />}
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
                                meta={bill.date ? `${formatDayMonth(bill.date)} · Fatura` : 'Tarih tanımsız'}
                                amount={bill.amount > 0 ? formatPara(bill.amount) : undefined}
                                amountTone={bill.mode === 'pending' ? 'danger' : undefined}
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
                        {billDisplayRows.length === 0 && <EmptyState title="Bekleyen fatura yok" description="Borcu oluşan veya tarihi yaklaşan faturalar burada görünür." icon={ReceiptText} />}
                    </div>
                </PremiumCard>

                <PremiumCard className="qw-module-card">
                    <SectionHeader title="Taksitler" description={`${installmentRows.length} aktif plan`} />
                    <div className="qw-summary-lines">
                        <SummaryLine label="Kalan taksit borcu" value={formatPara(toplamKalanTaksitBorcu)} tone="purple" />
                        <SummaryLine label="Bu ay taksitler" value={formatPara(monthlyInstallmentLoad)} />
                    </div>
                    <div className="qw-module-list">
                        {installmentRows.map((installment) => {
                            const paid = getInstallmentPaidCount(installment);
                            const count = parseInt(installment.taksitSayisi) || 0;
                            const installmentForPayment = { ...installment, odenmisTaksit: paid };
                            return (
                                <ModuleRow
                                    key={installment.id}
                                    icon={CalendarClock}
                                    tone="purple"
                                    title={installment.baslik || 'Taksit'}
                                    meta={`${paid}/${count || '-'} taksit`}
                                    amount={formatPara(installment.aylikTutar)}
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
                    <div className="qw-summary-lines qw-summary-lines--wide">
                        <SummaryLine label="Toplam Borç" value={formatPara(debtOriginalTotal)} tone="warning" />
                        <SummaryLine label="Bu Ay Ödenecek" value={formatPara(currentMonthDebtDue)} />
                        <SummaryLine label="Kalan Borç" value={formatPara(debtTotal)} tone="danger" />
                        <SummaryLine label="Borç Sayısı" value={`${(borclar || []).length} kayıt`} />
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
                            />
                        ))}
                        {debtRows.length === 0 && <EmptyState title="Borç kaydı yok" description="Yeni borç ekleyerek takip edebilirsiniz." icon={CreditCard} />}
                    </div>
                </PremiumCard>
            </div>

            <HighQualityModal
                isOpen={Boolean(historyAccount)}
                onClose={() => setHistoryAccount(null)}
                title={historyAccount?.hesapAdi || ''}
                subtitle={historySubtitle}
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
                {historyAccountIsSalary && (
                    <div style={{ padding: '18px 28px 0' }}>
                        <div className="qw-form-tabs" style={{ marginBottom: '16px' }}>
                            <button type="button" className={salaryHistoryMode === 'calendar' ? 'is-active' : ''} onClick={() => setSalaryHistoryMode('calendar')}>Takvim Ayı</button>
                            <button type="button" className={salaryHistoryMode === 'salary' ? 'is-active' : ''} onClick={() => setSalaryHistoryMode('salary')}>Maaş Dönemi</button>
                        </div>
                        {salaryHistoryMode === 'salary' && !historyAccountSalaryPeriod && (
                            <div className="qw-empty-state" style={{ padding: '16px', alignItems: 'flex-start', textAlign: 'left' }}>
                                <strong>Maaş günü eksik</strong>
                                <span>Maaş dönemi analizi için hesap düzenleme alanından maaş günü tanımlayın.</span>
                            </div>
                        )}
                        {salaryHistoryMode === 'salary' && historyAccountSalaryPeriod && selectedSalarySummary && (
                            <div className="qw-summary-lines qw-summary-lines--wide" style={{ marginBottom: '16px' }}>
                                <SummaryLine label="Gelir" value={formatPara(selectedSalarySummary.income + selectedSalarySummary.refund)} tone="success" />
                                <SummaryLine label="Harcama" value={formatPara(selectedSalarySummary.expense)} tone="danger" />
                                <SummaryLine label="Transfer" value={formatPara(selectedSalarySummary.transfer)} tone="purple" />
                                <SummaryLine label="Yatırım" value={formatPara(selectedSalarySummary.investment)} tone="info" />
                                <SummaryLine label="Kalan" value={formatPara(selectedSalarySummary.remaining)} tone={getFinancialTone(selectedSalarySummary.remaining)} />
                                <button
                                    type="button"
                                    className="qw-submit-button"
                                    onClick={() => {
                                        setHistoryAccount(null);
                                        setAnaSekme?.('maasAnalizi');
                                    }}
                                >
                                    Detaylı Maaş Analizi
                                </button>
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
                            <div className="qw-summary-lines qw-summary-lines--wide">
                                <SummaryLine label="Ekstre Harcamaları" value={formatPara(statementExpenseTotal)} tone="danger" />
                                <SummaryLine label="İadeler" value={statementRefundTotal > 0 ? `-${formatPara(statementRefundTotal)}` : formatPara(0)} tone={statementRefundTotal > 0 ? 'success' : 'neutral'} />
                                <SummaryLine label="Net Ekstre Tutarı" value={formatPara(statementNetTotal)} tone={getFinancialTone(-statementNetTotal)} />
                                <SummaryLine label="Kart Ödemeleri" value={formatPara(statementPaymentTotal)} tone="info" />
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
