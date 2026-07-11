import React, { useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    ArrowDownRight,
    ArrowLeft,
    ArrowRight,
    Banknote,
    CreditCard,
    Edit3,
    Landmark,
    PiggyBank,
    Plus,
    ReceiptText,
    Search,
    Trash2,
    TrendingDown,
    Wallet,
} from 'lucide-react';
import { formatCurrencyPlain, tarihFormatla, toDateSafe } from '../../utils/helpers';
import { MONTH_NAMES } from '../../utils/period';
import {
    formatSalaryPeriodRange,
    getSalaryPeriod,
    isDateInSalaryPeriod,
    isSalaryAccount,
    summarizeSalaryPeriod,
} from '../../utils/salaryPeriod';
import {
    EmptyState,
    IconTile,
    PremiumCard,
    SectionHeader,
    StatCard,
    StatusBadge,
    TransactionRow,
} from '../Shared/PremiumUI';

const parseAmount = (value) => parseFloat(value) || 0;
const formatPara = (value) => formatCurrencyPlain(parseAmount(value));
const normalizeText = (value) => String(value || '').toLocaleLowerCase('tr-TR').trim();
const moneyTone = (value) => (parseAmount(value) > 0 ? 'success' : parseAmount(value) < 0 ? 'danger' : 'neutral');
const toLocalDateKey = (value) => {
    const date = toDateSafe(value);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const bucketMeta = {
    income: { label: 'Gelir', tone: 'success', color: '#10b981', icon: ArrowDownRight },
    realExpense: { label: 'Gerçek Harcama', tone: 'danger', color: '#ef4444', icon: TrendingDown },
    debtPayment: { label: 'Borç Ödemesi', tone: 'warning', color: '#f59e0b', icon: CreditCard },
    investment: { label: 'Yatırım', tone: 'info', color: '#3b82f6', icon: PiggyBank },
    transfer: { label: 'Transfer', tone: 'purple', color: '#8b5cf6', icon: Landmark },
    refund: { label: 'İade', tone: 'success', color: '#14b8a6', icon: ArrowDownRight },
    neutral: { label: 'İncelenmemiş', tone: 'neutral', color: '#94a3b8', icon: ReceiptText },
};

const addMonths = (period, offset) => {
    const date = new Date(period.year, period.month - 1 + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
};

const clampDate = (year, month, day) => {
    const parsed = parseInt(day);
    if (!Number.isFinite(parsed) || parsed < 1) return null;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(parsed, lastDay), 0, 0, 0, 0);
};

const formatDayMonth = (date) => date
    ? date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
    : 'Tarih yok';

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

const getPeriodKey = (period) => period ? `${period.periodYear}-${String(period.periodMonth + 1).padStart(2, '0')}` : '';

const getTransactionSalaryPeriod = (transaction) => String(transaction.salaryPeriod || transaction.maasDonemi || '').trim();

const getTransactionIncomeType = (transaction) => transaction.gelirTuru || transaction.incomeType || transaction.maasOdemeTuru || transaction.salaryPartType || '';

const getLinkedSalaryId = (transaction) => String(transaction.bagliMaasId || transaction.maasId || transaction.recurringIncomeId || transaction.gelirId || transaction.sourceId || '').trim();

const isNearAmount = (left, right) => {
    const a = Math.abs(parseAmount(left));
    const b = Math.abs(parseAmount(right));
    return Math.abs(a - b) <= Math.max(1, Math.max(a, b) * 0.01);
};

const findStrongFlowTarget = ({ transfer, transactions, accounts }) => {
    if (transfer?.islemTipi !== 'transfer' || !transfer?.hedefId) return null;
    const transferDate = toDateSafe(transfer.tarih);
    if (!transferDate) return null;
    const maxDate = new Date(transferDate);
    maxDate.setDate(maxDate.getDate() + 3);
    const candidates = (transactions || [])
        .filter((transaction) => {
            if (!transaction || transaction.id === transfer.id) return false;
            const date = toDateSafe(transaction.tarih);
            if (!date || date < transferDate || date > maxDate) return false;
            if (!isNearAmount(transaction.tutar, transfer.tutar)) return false;
            const startsFromTarget = transaction.hesapId === transfer.hedefId || transaction.kaynakId === transfer.hedefId;
            if (!startsFromTarget) return false;
            const targetAccount = accounts.find((account) => account.id === transaction.hedefId);
            const text = normalizeText(`${transaction.kategori || ''} ${transaction.aciklama || ''}`);
            return targetAccount?.hesapTipi === 'krediKarti' ||
                targetAccount?.hesapTipi === 'yatirim' ||
                transaction.taksitId ||
                transaction.borcId ||
                transaction.islemTipi === 'yatirim_alis' ||
                transaction.islemTipi === 'gider' ||
                transaction.islemTipi === 'transfer' ||
                text.includes('kredi') ||
                text.includes('kart') ||
                text.includes('taksit') ||
                text.includes('yatırım');
        })
        .sort((a, b) => (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0));

    return candidates.length === 1 ? candidates[0] : null;
};

const buildPeriodMovements = ({ transactions, account, accounts, period }) => {
    const periodKey = getPeriodKey(period);
    const primaryRows = (transactions || [])
        .filter((transaction) => {
            const linked = transaction.hesapId === account.id || transaction.kaynakId === account.id || transaction.hedefId === account.id;
            const linkedToSalaryPeriod = getTransactionSalaryPeriod(transaction) === periodKey;
            return linked && (isDateInSalaryPeriod(transaction.tarih, period) || linkedToSalaryPeriod);
        })
        .sort((a, b) => (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0));
    const downstreamRows = primaryRows
        .map((transaction) => findStrongFlowTarget({ transfer: transaction, transactions, accounts }))
        .filter(Boolean);
    const rows = Array.from(new Map([...primaryRows, ...downstreamRows].map((transaction) => [transaction.id, transaction])).values())
        .sort((a, b) => (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0));
    return { rows, summary: summarizeSalaryPeriod({ transactions: rows, account, accounts }) };
};

const estimateBalances = ({ transactions, account, period, periodAccountNet }) => {
    const currentBalance = parseAmount(account?.guncelBakiye);
    const afterPeriodMovement = (transactions || []).reduce((sum, transaction) => {
        const date = toDateSafe(transaction.tarih);
        if (!date || !period?.end || date < period.end) return sum;
        return sum + getAccountMovementAmount(transaction, account.id);
    }, 0);
    const endBalance = currentBalance - afterPeriodMovement;
    return { startBalance: endBalance - periodAccountNet, endBalance };
};

const buildDailyRemaining = ({ period, movements, startBalance, accountId }) => {
    const days = [];
    const cursor = new Date(period.start);
    let running = startBalance;

    while (cursor < period.end) {
        days.push({
            key: toLocalDateKey(cursor),
            date: new Date(cursor),
            label: cursor.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
            start: running,
            income: 0,
            realExpense: 0,
            debtPayment: 0,
            investment: 0,
            transfer: 0,
            transferIn: 0,
            outflow: 0,
            netMovement: 0,
            remaining: running,
        });
        cursor.setDate(cursor.getDate() + 1);
    }

    const map = new Map(days.map((day) => [day.key, day]));
    movements.filter((movement) => movement.counted !== false).forEach(({ transaction, bucket, amount: movementAmount }) => {
        const date = toDateSafe(transaction.tarih);
        const target = date ? map.get(toLocalDateKey(date)) : null;
        if (!target) return;
        const amount = movementAmount ?? parseAmount(transaction.tutar);
        const signedAmount = getAccountMovementAmount(transaction, accountId);
        target.netMovement += signedAmount;
        if (bucket === 'income' || bucket === 'refund') target.income += amount;
        if (bucket === 'realExpense') target.realExpense += amount;
        if (bucket === 'debtPayment') target.debtPayment += amount;
        if (bucket === 'investment') target.investment += amount;
        if (bucket === 'transfer' && signedAmount < 0) target.transfer += amount;
        if (signedAmount > 0 && bucket !== 'income' && bucket !== 'refund') target.transferIn += signedAmount;
    });

    days.forEach((day) => {
        day.start = running;
        day.outflow = day.realExpense + day.debtPayment + day.investment + day.transfer;
        running += day.netMovement;
        day.remaining = running;
    });
    return days;
};

const isStrongSalaryMatch = (salary, transaction, period) => {
    const periodKey = getPeriodKey(period);
    if (getLinkedSalaryId(transaction) !== String(salary.id)) return false;
    const linkedPeriod = getTransactionSalaryPeriod(transaction);
    if (linkedPeriod) return linkedPeriod === periodKey;
    return isDateInSalaryPeriod(transaction.tarih, period);
};

const getSalaryPartType = (transaction) => {
    const explicitType = normalizeText(transaction.gelirTuru || transaction.incomeType || transaction.maasOdemeTuru || transaction.salaryPartType);
    const text = normalizeText(`${transaction.kategori || ''} ${transaction.aciklama || ''}`);
    if (explicitType.includes('avans') || text.includes('maaş avansı') || text.includes('maas avansi')) return 'advance';
    if (explicitType.includes('fark') || text.includes('maaş fark') || text.includes('maas fark')) return 'difference';
    if (explicitType.includes('ek maaş') || explicitType.includes('ek maas') || text.includes('ek maaş') || text.includes('ek maas')) return 'extra';
    return 'salary';
};

const salaryPartLabels = {
    advance: 'Avans',
    salary: 'Maaş Ödemesi',
    difference: 'Maaş Farkı',
    extra: 'Ek Maaş',
};

const isExplicitSalaryLike = (transaction) => {
    const text = normalizeText(`${transaction.kategori || ''} ${transaction.aciklama || ''} ${transaction.gelirTuru || ''} ${transaction.incomeType || ''}`);
    return text.includes('maaş') ||
        text.includes('maas') ||
        text.includes('avans') ||
        text.includes('fark');
};

const findSalaryTransactions = ({ salary, incomeTransactions, period }) => {
    const salaryName = normalizeText(salary.ad);
    const salaryAmount = parseAmount(salary.tutar);
    const strongMatches = incomeTransactions.filter((transaction) => isStrongSalaryMatch(salary, transaction, period));
    if (strongMatches.length) {
        return Array.from(new Map(strongMatches.map((transaction) => [transaction.id, transaction])).values())
            .sort((a, b) => (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0));
    }
    const candidates = incomeTransactions.filter((transaction) => {
        if (getTransactionSalaryPeriod(transaction) || getLinkedSalaryId(transaction)) return false;
        if (salary.hesapId && transaction.hesapId !== salary.hesapId) return false;
        if (!isDateInSalaryPeriod(transaction.tarih, period)) return false;
        const amountDiff = Math.abs(parseAmount(transaction.tutar) - salaryAmount);
        if (amountDiff > Math.max(1, salaryAmount * 0.01)) return false;
        const transactionName = normalizeText(transaction.aciklama || transaction.kategori);
        return salaryName && transactionName.includes(salaryName) && isExplicitSalaryLike(transaction);
    });

    const exactAmountMatch = candidates.find((transaction) => {
        const amountDiff = Math.abs(parseAmount(transaction.tutar) - salaryAmount);
        return amountDiff <= Math.max(1, salaryAmount * 0.01);
    });
    const expectedDate = getExpectedDate(salary, period);
    return (exactAmountMatch ? [exactAmountMatch] : candidates.sort((a, b) => {
        if (!expectedDate) return 0;
        return Math.abs((toDateSafe(a.tarih)?.getTime() || 0) - expectedDate.getTime()) -
            Math.abs((toDateSafe(b.tarih)?.getTime() || 0) - expectedDate.getTime());
    }).slice(0, 1));
};

const getExpectedDate = (salary, period) => clampDate(period.periodYear, period.periodMonth, salary.gun);

const getIncomeStatus = ({ salary, transactions, expectedDate }) => {
    const rawStatus = normalizeText(salary?.status || salary?.durum);
    if (salary?.atlandi || salary?.skipped || rawStatus.includes('atland')) return { label: 'Atlandı', tone: 'neutral' };
    const actualAmount = (transactions || []).reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0);
    if (actualAmount > 0) {
        const expectedAmount = parseAmount(salary?.tutar);
        const diff = actualAmount - expectedAmount;
        const tolerance = Math.max(1, expectedAmount * 0.005);
        const today = new Date();
        const hasOnlyAdvance = (transactions || []).length > 0 && (transactions || []).every((transaction) => getSalaryPartType(transaction) === 'advance');
        if (hasOnlyAdvance && expectedDate && today < expectedDate) return { label: 'Avans Ödendi', tone: 'info' };
        if (expectedAmount > 0 && diff < -tolerance) return { label: 'Kısmi Ödendi', tone: 'warning' };
        if (expectedAmount > 0 && diff > tolerance) return { label: 'Fazla Ödendi', tone: 'success' };
        return { label: 'Tam Ödendi', tone: 'success' };
    }
    if (!expectedDate) return { label: 'Bekleniyor', tone: 'warning' };
    const today = new Date();
    if (today > expectedDate) return { label: 'Gecikti', tone: 'danger' };
    return { label: 'Bekleniyor', tone: 'warning' };
};

const buildIncomeRows = ({ salaries, incomeTransactions, period }) => {
    const usedTransactions = new Set();
    const salaryRows = (salaries || [])
        .map((salary) => {
            const transactions = findSalaryTransactions({ salary, incomeTransactions, period });
            transactions.forEach((transaction) => {
                if (transaction?.id) usedTransactions.add(transaction.id);
            });
            const expectedDate = getExpectedDate(salary, period);
            const status = getIncomeStatus({ salary, transactions, expectedDate });
            const parts = transactions.map((transaction) => ({
                transaction,
                type: getSalaryPartType(transaction),
                amount: parseAmount(transaction.tutar),
                date: toDateSafe(transaction.tarih),
            }));
            const partTotals = parts.reduce((acc, part) => {
                acc[part.type] = (acc[part.type] || 0) + part.amount;
                return acc;
            }, {});
            const actualAmount = parts.reduce((sum, part) => sum + part.amount, 0);
            const firstTransaction = transactions[0] || null;
            return {
                id: `salary-${salary.id}`,
                salary,
                transaction: firstTransaction,
                transactions,
                parts,
                partTotals,
                name: salary.ad || 'Gelir',
                type: salary.tur || salary.gelirTuru || 'Düzenli gelir',
                expectedDate,
                expectedAmount: parseAmount(salary.tutar),
                actualDate: firstTransaction ? toDateSafe(firstTransaction.tarih) : null,
                actualAmount,
                remainingAmount: Math.max(0, parseAmount(salary.tutar) - actualAmount),
                difference: actualAmount ? actualAmount - parseAmount(salary.tutar) : 0,
                graphKey: firstTransaction ? toLocalDateKey(firstTransaction.tarih) : '',
                status,
            };
        });

    const extraRows = incomeTransactions
        .filter((transaction) => !usedTransactions.has(transaction.id))
        .map((transaction) => ({
            id: `transaction-${transaction.id}`,
            salary: null,
            transaction,
            name: transaction.aciklama || transaction.kategori || 'Gelir',
            type: 'Gerçekleşen gelir',
            expectedDate: null,
            expectedAmount: 0,
            actualDate: toDateSafe(transaction.tarih),
            actualAmount: parseAmount(transaction.tutar),
            remainingAmount: 0,
            difference: parseAmount(transaction.tutar),
            graphKey: toLocalDateKey(transaction.tarih),
            status: { label: 'Geldi', tone: 'success' },
        }));

    return [...salaryRows, ...extraRows].sort((a, b) => {
        const left = a.expectedDate || a.actualDate || new Date(8640000000000000);
        const right = b.expectedDate || b.actualDate || new Date(8640000000000000);
        return left - right;
    });
};

const getNextIncomeDate = ({ salaries, analysisPeriod, account }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const candidates = (salaries || [])
        .map((salary) => {
            let cursor = { year: analysisPeriod.year, month: analysisPeriod.month };
            let guard = 0;
            let period = getSalaryPeriod({ ...account, maasGunu: salary.gun || account?.maasGunu || 1 }, cursor);
            let date = period ? getExpectedDate(salary, period) : null;
            while (date && date < today && guard < 24) {
                cursor = addMonths(cursor, 1);
                period = getSalaryPeriod({ ...account, maasGunu: salary.gun || account?.maasGunu || 1 }, cursor);
                date = period ? getExpectedDate(salary, period) : null;
                guard += 1;
            }
            return date ? { salary, date } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.date - b.date);
    return candidates[0] || null;
};

const SalaryTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
        <div className="salary-chart-tooltip">
            <strong>{item.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            <span><em>Gün başı bakiye</em><b>{formatPara(item.start)}</b></span>
            <span><em>Gelir</em><b className="is-success">{formatPara(item.income)}</b></span>
            <span><em>Harcama</em><b className="is-danger">{formatPara(item.realExpense)}</b></span>
            <span><em>Borç</em><b className="is-warning">{formatPara(item.debtPayment)}</b></span>
            <span><em>Yatırım</em><b className="is-info">{formatPara(item.investment)}</b></span>
            <span><em>Transfer girişi</em><b className="is-success">{formatPara(item.transferIn)}</b></span>
            <span><em>Transfer</em><b className="is-purple">{formatPara(item.transfer)}</b></span>
            <span><em>Gün sonu kalan</em><b className={moneyTone(item.remaining) === 'danger' ? 'is-danger' : 'is-success'}>{formatPara(item.remaining)}</b></span>
        </div>
    );
};

const SalaryAnalysisDashboard = ({
    hesaplar = [],
    maaslar = [],
    tumIslemler = [],
    selectedPeriod,
    modalAc,
    islemSil,
    normalSil,
}) => {
    const salaryAccounts = useMemo(() => (hesaplar || []).filter(isSalaryAccount), [hesaplar]);
    const defaultAccount = salaryAccounts.find((account) => account.anaMaasHesabi) || salaryAccounts[0] || null;
    const [selectedAccountId, setSelectedAccountId] = useState(defaultAccount?.id || '');
    const [analysisPeriod, setAnalysisPeriod] = useState({
        year: selectedPeriod?.year || new Date().getFullYear(),
        month: selectedPeriod?.month === 'all' ? new Date().getMonth() + 1 : selectedPeriod?.month || new Date().getMonth() + 1,
    });
    const [classFilter, setClassFilter] = useState('Tümü');
    const [categoryFilter, setCategoryFilter] = useState('Tümü');
    const [searchText, setSearchText] = useState('');

    const selectedAccount = salaryAccounts.find((account) => account.id === selectedAccountId) || defaultAccount;
    const period = selectedAccount ? getSalaryPeriod(selectedAccount, analysisPeriod) : null;
    const previousPeriod = addMonths(analysisPeriod, -1);
    const previousSalaryPeriod = selectedAccount ? getSalaryPeriod(selectedAccount, previousPeriod) : null;

    const { rows: periodTransactions, summary } = selectedAccount && period
        ? buildPeriodMovements({ transactions: tumIslemler, account: selectedAccount, accounts: hesaplar, period })
        : { rows: [], summary: summarizeSalaryPeriod({ transactions: [], account: selectedAccount, accounts: hesaplar }) };
    const { rows: previousTransactions, summary: previousSummary } = selectedAccount && previousSalaryPeriod
        ? buildPeriodMovements({ transactions: tumIslemler, account: selectedAccount, accounts: hesaplar, period: previousSalaryPeriod })
        : { rows: [], summary: null };

    const periodIncome = summary.income + summary.refund;
    const periodNet = periodIncome - summary.totalOutflow;
    const periodAccountNet = periodTransactions.reduce((sum, transaction) => (
        sum + getAccountMovementAmount(transaction, selectedAccount?.id)
    ), 0);
    const incomeTransactions = summary.movements
        .filter((movement) => movement.bucket === 'income' || movement.bucket === 'refund')
        .map((movement) => movement.transaction);
    const incomeRows = selectedAccount && period
        ? buildIncomeRows({ salaries: maaslar, incomeTransactions, period })
        : [];
    const expectedIncomeTotal = incomeRows.reduce((sum, row) => sum + row.expectedAmount, 0);
    const receivedIncomeTotal = incomeRows.reduce((sum, row) => sum + row.actualAmount, 0);
    const definedIncomeRows = incomeRows.filter((row) => row.salary);
    const otherIncomeRows = incomeRows.filter((row) => !row.salary);
    const nextIncome = selectedAccount ? getNextIncomeDate({ salaries: maaslar, analysisPeriod, account: selectedAccount }) : null;

    const balances = selectedAccount && period
        ? estimateBalances({ transactions: tumIslemler, account: selectedAccount, period, periodAccountNet })
        : { startBalance: 0, endBalance: periodNet };
    const chartStart = periodTransactions.reduce((earliest, transaction) => {
        const transactionDate = toDateSafe(transaction.tarih);
        const linkedToCurrentSalaryPeriod = getTransactionSalaryPeriod(transaction) === getPeriodKey(period);
        if (!transactionDate || !linkedToCurrentSalaryPeriod || transactionDate >= earliest) return earliest;
        const start = new Date(transactionDate);
        start.setHours(0, 0, 0, 0);
        return start;
    }, period?.start || null);
    const chartPeriod = period ? { ...period, start: chartStart || period.start } : null;
    const dailyRemaining = chartPeriod ? buildDailyRemaining({ period: chartPeriod, movements: summary.movements, startBalance: balances.startBalance, accountId: selectedAccount?.id }) : [];

    const distributionRows = [
        { key: 'realExpense', label: 'Gerçek Harcama', value: summary.realExpense, description: 'Market, fatura, ulaşım ve benzeri günlük harcamalar' },
        { key: 'debtPayment', label: 'Kredi ve Kart Ödemeleri', value: summary.debtPayment, description: 'Kart borcu, kredi taksiti ve nakit avans geri ödemeleri' },
        { key: 'investment', label: 'Yatırım', value: summary.investment, description: 'Yatırım hesapları ve varlık alımları' },
        { key: 'transfer', label: 'Diğer Transferler', value: summary.transfer, description: 'Maaş dışı hesaplar arası aktarımlar' },
        { key: 'remaining', label: 'Kalan', value: Math.max(0, periodNet), description: periodNet < 0 ? 'Negatif kalan dönem başı bakiyeden kullanıldı' : 'Dönem içinde kalan tutar' },
    ];

    const expenseByCategory = Object.values(summary.movements
        .filter((movement) => movement.counted !== false && movement.bucket === 'realExpense')
        .reduce((acc, movement) => {
            const category = movement.transaction.kategori || 'İncelenmemiş';
            if (!acc[category]) acc[category] = { name: category, value: 0 };
            acc[category].value += parseAmount(movement.transaction.tutar);
            return acc;
        }, {}))
        .sort((a, b) => b.value - a.value);

    const investmentByTarget = Object.values(summary.movements
        .filter((movement) => movement.counted !== false && movement.bucket === 'investment')
        .reduce((acc, movement) => {
            const transaction = movement.transaction;
            const target = hesaplar.find((account) => account.id === transaction.hedefId);
            const targetName = target?.hesapTipi === 'yatirim'
                ? target.hesapAdi
                : transaction.yatirimTuru || transaction.varlikTuru || transaction.kategori || 'Diğer yatırım';
            if (!acc[targetName]) acc[targetName] = { name: targetName, value: 0 };
            acc[targetName].value += parseAmount(transaction.tutar);
            return acc;
        }, {}))
        .sort((a, b) => b.value - a.value);

    const periodLength = Math.max(1, dailyRemaining.length);
    const first3Outflow = dailyRemaining.slice(0, 3).reduce((sum, item) => sum + item.outflow, 0);
    const first7Outflow = dailyRemaining.slice(0, 7).reduce((sum, item) => sum + item.outflow, 0);
    const halfRemaining = dailyRemaining[Math.floor(periodLength / 2)]?.remaining ?? balances.startBalance;
    const avgDailyExpense = summary.realExpense / periodLength;
    const findThresholdDay = (ratio) => {
        const usable = Math.max(0, balances.startBalance + periodIncome);
        if (!usable) return 'Aşılmadı';
        const target = usable * (1 - ratio);
        const found = dailyRemaining.find((day) => day.remaining <= target);
        return found ? found.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : 'Aşılmadı';
    };

    const last6Periods = Array.from({ length: 6 }, (_, index) => addMonths(analysisPeriod, index - 5)).map((periodItem) => {
        const salaryPeriod = selectedAccount ? getSalaryPeriod(selectedAccount, periodItem) : null;
        const data = selectedAccount && salaryPeriod
            ? buildPeriodMovements({ transactions: tumIslemler, account: selectedAccount, accounts: hesaplar, period: salaryPeriod }).summary
            : null;
        return {
            name: `${MONTH_NAMES[periodItem.month - 1].slice(0, 3)} Maaş`,
            gelir: data ? data.income + data.refund : 0,
            harcama: data ? data.realExpense : 0,
            borc: data ? data.debtPayment : 0,
            yatirim: data ? data.investment : 0,
            kalan: data ? data.remaining : 0,
        };
    });

    const classMap = {
        'Gelir': 'income',
        'Gerçek Harcama': 'realExpense',
        'Borç Ödemesi': 'debtPayment',
        'Yatırım': 'investment',
        'Transfer': 'transfer',
        'İade': 'refund',
        'İncelenmemiş': 'neutral',
    };
    const categories = Array.from(new Set(periodTransactions.map((transaction) => transaction.kategori).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr-TR'));
    const filteredTransactions = periodTransactions
        .map((transaction) => {
            const movement = summary.movements.find((item) => item.transaction === transaction);
            return { transaction, bucket: movement?.bucket || 'neutral' };
        })
        .filter(({ transaction, bucket }) => {
            const classMatch = classFilter === 'Tümü' || bucket === classMap[classFilter];
            const categoryMatch = categoryFilter === 'Tümü' || transaction.kategori === categoryFilter;
            const haystack = `${transaction.aciklama || ''} ${transaction.kategori || ''} ${transaction.tutar || ''}`.toLocaleLowerCase('tr-TR');
            return classMatch && categoryMatch && (!searchText || haystack.includes(searchText.toLocaleLowerCase('tr-TR')));
        })
        .sort((a, b) => (toDateSafe(b.transaction.tarih)?.getTime() || 0) - (toDateSafe(a.transaction.tarih)?.getTime() || 0));
    const filteredTransactionsNet = filteredTransactions.reduce((sum, { transaction }) => (
        sum + getAccountMovementAmount(transaction, selectedAccount?.id)
    ), 0);
    const getSalaryRelationMeta = (transaction) => {
        if (transaction.islemTipi !== 'gelir') return '';
        const linkedSalaryId = getLinkedSalaryId(transaction);
        const periodKey = getTransactionSalaryPeriod(transaction);
        if (!linkedSalaryId || !periodKey) return '';
        const salary = maaslar.find((item) => String(item.id) === linkedSalaryId);
        const [year, month] = periodKey.split('-').map(Number);
        const periodLabel = Number.isFinite(year) && Number.isFinite(month)
            ? `${MONTH_NAMES[month - 1]} ${year}`
            : periodKey;
        return `${getTransactionIncomeType(transaction) || 'Gelir'} · ${salary?.ad || 'Bağlı maaş'} · ${periodLabel}`;
    };

    const largestExpenses = summary.movements.filter((item) => item.counted !== false && item.bucket === 'realExpense').sort((a, b) => parseAmount(b.transaction.tutar) - parseAmount(a.transaction.tutar)).slice(0, 5);
    const largestInvestments = summary.movements.filter((item) => item.counted !== false && item.bucket === 'investment').sort((a, b) => parseAmount(b.transaction.tutar) - parseAmount(a.transaction.tutar)).slice(0, 3);
    const largestDebt = summary.movements.filter((item) => item.counted !== false && item.bucket === 'debtPayment').sort((a, b) => parseAmount(b.transaction.tutar) - parseAmount(a.transaction.tutar)).slice(0, 3);
    const largestDebtPayment = largestDebt[0];
    const debtRatio = periodIncome > 0 ? Math.round((summary.debtPayment / periodIncome) * 100) : 0;
    const investmentRatio = periodIncome > 0 ? Math.round((summary.investment / periodIncome) * 100) : 0;
    const expenseTotal = expenseByCategory.reduce((sum, item) => sum + item.value, 0);
    if (salaryAccounts.length === 0) {
        return (
            <div className="salary-analysis-page">
                <PremiumCard className="salary-empty-card">
                    <EmptyState title="Henüz maaş hesabı tanımlanmamış" description="Maaş analizi için önce bir vadesiz hesabı maaş hesabı olarak işaretleyin." icon={Banknote} />
                    <button type="button" className="qw-submit-button" onClick={() => modalAc?.('hesap_ekle')}>Maaş hesabı tanımla</button>
                </PremiumCard>
            </div>
        );
    }

    const periodTitle = period?.label || 'Maaş Dönemi';
    const periodRange = period ? formatSalaryPeriodRange(period) : 'Maaş günü tanımlı değil';

    return (
        <div className="salary-analysis-page">
            <PremiumCard className="salary-control-bar" hover={false}>
                <div className="salary-control-left">
                    <select value={selectedAccount?.id || ''} onChange={(event) => setSelectedAccountId(event.target.value)}>
                        {salaryAccounts.map((account) => <option key={account.id} value={account.id}>{account.hesapAdi}</option>)}
                    </select>
                    <div>
                        <StatusBadge tone="purple">{periodTitle}</StatusBadge>
                        <span>{periodRange}</span>
                    </div>
                </div>
                <div className="salary-page-controls">
                    <select value={analysisPeriod.month} onChange={(event) => setAnalysisPeriod((prev) => ({ ...prev, month: Number(event.target.value) }))}>
                        {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                    </select>
                    <select value={analysisPeriod.year} onChange={(event) => setAnalysisPeriod((prev) => ({ ...prev, year: Number(event.target.value) }))}>
                        {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 3 + index).map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                    <button type="button" onClick={() => setAnalysisPeriod(addMonths(analysisPeriod, -1))}><ArrowLeft size={16} /> Önceki</button>
                    <button type="button" onClick={() => setAnalysisPeriod(addMonths(analysisPeriod, 1))}>Sonraki <ArrowRight size={16} /></button>
                    <button type="button" onClick={() => setAnalysisPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })}>Bugün</button>
                </div>
            </PremiumCard>

            <div className="salary-summary-grid">
                <StatCard title="Dönem Geliri" value={formatPara(periodIncome)} description={`${incomeRows.length} gelir kaydı`} icon={ArrowDownRight} tone="success" />
                <StatCard title="Gerçek Harcama" value={formatPara(summary.realExpense)} description={`${periodIncome > 0 ? Math.round((summary.realExpense / periodIncome) * 100) : 0}% maaşa oran`} icon={TrendingDown} tone="danger" />
                <StatCard title="Kredi ve Kart Ödemeleri" value={formatPara(summary.debtPayment)} description={`${debtRatio}% maaşa oran`} icon={CreditCard} tone="warning" />
                <StatCard title="Yatırıma Aktarılan" value={formatPara(summary.investment)} description={`${investmentRatio}% maaşa oran`} icon={PiggyBank} tone="info" />
                <StatCard title="Diğer Transferler" value={formatPara(summary.transfer)} description="Nihai kullanım amacı belirlenmemiş veya başka hesapta kalan tutar" icon={Landmark} tone="purple" />
                <StatCard title="Dönem Sonu Kalan" value={formatPara(periodNet)} description="Dönem içi net kalan" icon={Wallet} tone={moneyTone(periodNet)} />
            </div>

            <div className="salary-main-grid salary-main-grid--analysis">
                <PremiumCard className="salary-card salary-card--compact">
                    <SectionHeader title="Bu maaş nereye gitti?" description="Yüzdeler toplam dönem gelirine göre hesaplanır; toplam çıkış gelirden fazlaysa dönem başı bakiye kullanılmış olabilir." />
                    <div className="salary-distribution">
                        {distributionRows.map((row) => {
                            const percent = periodIncome > 0 ? Math.round((row.value / periodIncome) * 100) : 0;
                            const meta = bucketMeta[row.key] || bucketMeta.neutral;
                            return (
                                <div key={row.key} className="salary-distribution-row">
                                    <span style={{ background: meta.color }} />
                                    <div>
                                        <strong>{row.label}</strong>
                                        <small>{row.description}</small>
                                        <div className="salary-progress"><i style={{ width: `${Math.min(percent, 100)}%`, background: meta.color }} /></div>
                                    </div>
                                    <b>%{percent}</b>
                                    <em>{formatPara(row.value)}</em>
                                </div>
                            );
                        })}
                    </div>
                </PremiumCard>

                <PremiumCard className="salary-card salary-card--chart">
                    <SectionHeader title="Gün Sonu Bakiye" description="Maaş hesabının her gün sonundaki hesaplanan gerçek bakiyesini gösterir." />
                    <div className="salary-chart-legend">
                        <span><i className="is-success" />Pozitif kalan</span>
                        <span><i className="is-danger" />Negatif alan</span>
                        <span><i />Sıfır çizgisi</span>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={dailyRemaining} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id="salaryRemainingFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={periodNet < 0 ? '#ef4444' : '#6d5dfc'} stopOpacity={0.22} />
                                    <stop offset="100%" stopColor={periodNet < 0 ? '#ef4444' : '#6d5dfc'} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.18)" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis tickFormatter={(value) => `${Math.round(value / 1000)} B`} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                            <Tooltip content={<SalaryTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="remaining" name="Gün sonu kalan" stroke={periodNet < 0 ? '#ef4444' : '#6d5dfc'} fill="url(#salaryRemainingFill)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </PremiumCard>
            </div>

            <PremiumCard className="salary-income-card">
                <SectionHeader
                    title="Maaşlar & Gelirler"
                    description="Tanımlı düzenli gelirler ve bu dönemdeki gerçekleşme durumları."
                    action={<button type="button" className="qw-inline-action" onClick={() => modalAc?.('maas_ekle')}><Plus size={17} /> Gelir Ekle</button>}
                />
                <div className="salary-income-summary">
                    <SummaryTile label="Toplam düzenli gelir" value={formatPara(expectedIncomeTotal)} tone="success" />
                    <SummaryTile label="Bu dönem beklenen" value={formatPara(expectedIncomeTotal)} />
                    <SummaryTile label="Bu dönem gelen" value={formatPara(receivedIncomeTotal)} tone="success" />
                    <SummaryTile label="Sonraki gelir" value={nextIncome?.date ? formatDayMonth(nextIncome.date) : 'Yok'} />
                </div>
                <div className="salary-income-list">
                    {definedIncomeRows.map((row) => (
                        <div className="salary-income-row" key={row.id}>
                            <span className="salary-income-icon"><ArrowDownRight size={20} strokeWidth={2.25} /></span>
                            <div>
                                <strong>{row.name}</strong>
                                <span>{row.type}</span>
                            </div>
                            <div>
                                <small>Beklenen</small>
                                <b>{row.expectedDate ? formatDayMonth(row.expectedDate) : '-'}</b>
                                <em>{row.expectedAmount ? formatPara(row.expectedAmount) : '-'}</em>
                            </div>
                            <div>
                                <small>Gerçekleşen</small>
                                <b>{row.actualDate ? tarihFormatla(row.actualDate) : '-'}</b>
                                <em>{row.actualAmount ? formatPara(row.actualAmount) : '-'}</em>
                            </div>
                            <div>
                                <small>Fark</small>
                                <b className={moneyTone(row.difference) === 'danger' ? 'is-danger' : moneyTone(row.difference) === 'success' ? 'is-success' : ''}>
                                    {row.transaction ? `${row.difference > 0 ? '+' : row.difference < 0 ? '-' : ''}${formatPara(Math.abs(row.difference))}` : '-'}
                                </b>
                            </div>
                            <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>
                            <div className="qw-row-actions">
                                {row.salary && (
                                    <>
                                        <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={() => modalAc?.('duzenle_maas', row.salary)}><Edit3 size={14} /></button>
                                        {normalSil && <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={() => normalSil('maaslar', row.salary.id)}><Trash2 size={14} /></button>}
                                    </>
                                )}
                                {!row.salary && row.transaction && (
                                    <button type="button" className="qw-mini-icon-button" aria-label="İşlem detayı" onClick={() => modalAc?.('duzenle_islem', row.transaction)}><Edit3 size={14} /></button>
                                )}
                            </div>
                            {(row.parts?.length > 1 || row.partTotals?.advance || row.partTotals?.difference || row.partTotals?.extra || row.remainingAmount > 0) && (
                                <div className="salary-income-breakdown">
                                    {['advance', 'salary', 'difference', 'extra'].map((partKey) => (
                                        row.partTotals?.[partKey] ? (
                                            <span key={partKey}>
                                                <small>{salaryPartLabels[partKey]}</small>
                                                <b>{formatPara(row.partTotals[partKey])}</b>
                                            </span>
                                        ) : null
                                    ))}
                                    <span>
                                        <small>Toplam Gerçekleşen</small>
                                        <b>{formatPara(row.actualAmount)}</b>
                                    </span>
                                    <span>
                                        <small>Kalan</small>
                                        <b className={row.remainingAmount > 0 ? 'is-danger' : 'is-success'}>{formatPara(row.remainingAmount)}</b>
                                    </span>
                                    {row.parts?.length > 1 && (
                                        <div className="salary-payment-parts">
                                            {row.parts.map((part) => (
                                                <em key={part.transaction.id}>
                                                    {part.date ? formatDayMonth(part.date) : 'Tarih yok'} · {salaryPartLabels[part.type] || 'Gelir'} · {formatPara(part.amount)}
                                                </em>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {definedIncomeRows.length === 0 && <EmptyState title="Tanımlı gelir yok" description="Gelir tanımı ekleyerek maaş dönemini takip edebilirsiniz." icon={Banknote} />}
                </div>
            </PremiumCard>

            <PremiumCard className="salary-income-card salary-realized-income-card">
                <SectionHeader title="Gerçekleşen Gelir Geçmişi" description="Tanıma bağlı olmayan tek seferlik gelirler, iadeler ve cashback hareketleri." />
                <div className="salary-income-list">
                    {otherIncomeRows.map((row) => (
                        <div className="salary-income-row" key={row.id}>
                            <span className="salary-income-icon"><ArrowDownRight size={20} strokeWidth={2.25} /></span>
                            <div>
                                <strong>{row.name}</strong>
                                <span>{row.type}</span>
                            </div>
                            <div>
                                <small>Beklenen</small>
                                <b>-</b>
                                <em>-</em>
                            </div>
                            <div>
                                <small>Gerçekleşen</small>
                                <b>{row.actualDate ? tarihFormatla(row.actualDate) : '-'}</b>
                                <em>{row.actualAmount ? formatPara(row.actualAmount) : '-'}</em>
                            </div>
                            <div>
                                <small>Fark</small>
                                <b className="is-success">+{formatPara(row.actualAmount)}</b>
                            </div>
                            <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>
                            <div className="qw-row-actions">
                                {row.transaction && (
                                    <button type="button" className="qw-mini-icon-button" aria-label="İşlem detayı" onClick={() => modalAc?.('duzenle_islem', row.transaction)}><Edit3 size={14} /></button>
                                )}
                            </div>
                        </div>
                    ))}
                    {otherIncomeRows.length === 0 && <EmptyState title="Plansız gelir yok" description="Bu dönemde tanıma bağlı olmayan gelir hareketi bulunmadı." icon={ArrowDownRight} />}
                </div>
            </PremiumCard>

            <div className="salary-three-grid">
                <PremiumCard className="salary-card">
                    <SectionHeader title="Gerçek Harcamaların Dağılımı" description="Yalnız gerçek harcama sınıfındaki işlemler." />
                    <div className="salary-donut-layout">
                        <div className="salary-donut-wrap">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={4}>
                                        {expenseByCategory.map((_, index) => <Cell key={index} fill={['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#14b8a6'][index % 7]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatPara(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div><span>Toplam</span><strong>{formatPara(expenseTotal)}</strong></div>
                        </div>
                        <div className="salary-category-list">
                            {expenseByCategory.map((item, index) => (
                                <span key={item.name}>
                                    <i style={{ background: ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#14b8a6'][index % 7] }} />
                                    <b>{item.name}</b>
                                    <small>%{expenseTotal > 0 ? Math.round((item.value / expenseTotal) * 100) : 0}</small>
                                    <em>{formatPara(item.value)}</em>
                                </span>
                            ))}
                            {expenseByCategory.length === 0 && <EmptyState title="Gerçek harcama yok" description="Bu dönemde harcama sınıfında hareket bulunamadı." icon={ReceiptText} />}
                        </div>
                    </div>
                </PremiumCard>

                <PremiumCard className="salary-card">
                    <SectionHeader title="Kredi ve Kart Yükü" description={`Bu maaşın %${debtRatio}'i borç ödemelerine gitti.`} />
                    <div className="salary-metric-list">
                        <SummaryTile label="Kredi kartı / kredi / taksit" value={formatPara(summary.debtPayment)} tone="warning" />
                        <SummaryTile label="Dönem gelirine oran" value={`%${debtRatio}`} />
                        <SummaryTile label="En büyük borç ödemesi" value={largestDebtPayment ? formatPara(largestDebtPayment.transaction.tutar) : '-'} />
                    </div>
                    <div className="salary-wide-progress"><span style={{ width: `${Math.min(debtRatio, 100)}%` }} /></div>
                </PremiumCard>

                <PremiumCard className="salary-card">
                    <SectionHeader title="Yatırıma Ayrılan" description={previousSummary ? `Önceki döneme göre ${formatPara(summary.investment - previousSummary.investment)}` : 'Önceki dönem verisi yok.'} />
                    <div className="salary-metric-list">
                        <SummaryTile label="Toplam yatırım" value={formatPara(summary.investment)} tone="info" />
                        <SummaryTile label="Maaşa oranı" value={`%${investmentRatio}`} />
                    </div>
                    <div className="salary-mini-list">
                        {investmentByTarget.map((row) => <span key={row.name}><b>{row.name}</b><em>{formatPara(row.value)}</em></span>)}
                        {investmentByTarget.length === 0 && <EmptyState title="Yatırım hareketi yok" description="Kaynak vadesiz hesap yatırım hedefi olarak sayılmaz." icon={PiggyBank} />}
                    </div>
                </PremiumCard>
            </div>

            <div className="salary-main-grid salary-speed-comparison-grid">
                <PremiumCard className="salary-card salary-card--compact">
                    <SectionHeader title="Maaş Tükenme Hızı" description="İlk değerler toplam nakit çıkışına, günlük ortalama yalnız gerçek harcamaya göre hesaplanır." />
                    <div className="salary-speed-grid">
                        <SummaryTile label="İlk 3 gün çıkış" value={formatPara(first3Outflow)} />
                        <SummaryTile label="İlk 7 gün çıkış" value={formatPara(first7Outflow)} />
                        <SummaryTile label="Günlük ort. gerçek harcama" value={formatPara(avgDailyExpense)} />
                        <SummaryTile label="Dönemin yarısında kalan" value={formatPara(halfRemaining)} tone={moneyTone(halfRemaining)} />
                        <SummaryTile label="%50 tükenme" value={findThresholdDay(0.5)} />
                        <SummaryTile label="%80 tükenme" value={findThresholdDay(0.8)} />
                    </div>
                </PremiumCard>

                <PremiumCard className="salary-card salary-card--compact">
                    <SectionHeader title="Bu dönem vs önceki maaş dönemi" description={previousTransactions.length ? `${MONTH_NAMES[previousPeriod.month - 1]} dönemiyle karşılaştırma` : 'Önceki dönem verisi yok.'} />
                    <div className="salary-comparison-list">
                        <ComparisonRow label="Gelir" current={periodIncome} previous={(previousSummary?.income || 0) + (previousSummary?.refund || 0)} positiveHigher />
                        <ComparisonRow label="Gerçek Harcama" current={summary.realExpense} previous={previousSummary?.realExpense || 0} positiveLower />
                        <ComparisonRow label="Borç" current={summary.debtPayment} previous={previousSummary?.debtPayment || 0} positiveLower />
                        <ComparisonRow label="Yatırım" current={summary.investment} previous={previousSummary?.investment || 0} positiveHigher />
                        <ComparisonRow label="Kalan" current={summary.remaining} previous={previousSummary?.remaining || 0} positiveHigher />
                    </div>
                </PremiumCard>
            </div>

            <PremiumCard className="salary-card salary-card--compact salary-periods-card">
                <SectionHeader title="Son 6 Maaş Dönemi" description="Gelir, gerçek harcama, borç, yatırım ve kalan trendi." />
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={last6Periods} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.18)" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis tickFormatter={(value) => `${Math.round(value / 1000)} B`} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <Tooltip formatter={(value) => formatPara(value)} cursor={{ fill: 'rgba(109, 93, 252, 0.06)' }} />
                        <Legend verticalAlign="top" height={34} />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                        <Bar name="Gelir" dataKey="gelir" fill="#10b981" radius={[8, 8, 0, 0]} />
                        <Bar name="Gerçek Harcama" dataKey="harcama" fill="#ef4444" radius={[8, 8, 0, 0]} />
                        <Bar name="Borç" dataKey="borc" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                        <Bar name="Yatırım" dataKey="yatirim" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                        <Bar name="Kalan" dataKey="kalan" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </PremiumCard>

            <PremiumCard className="salary-card salary-card--compact salary-largest-card">
                <SectionHeader title="En Büyük Hareketler" description="Satırlara tıklayarak işlem detayını açabilirsiniz." />
                <div className="salary-largest-grid">
                    <MovementGroup title="En büyük harcamalar" items={largestExpenses} modalAc={modalAc} />
                    <MovementGroup title="En büyük yatırımlar" items={largestInvestments} modalAc={modalAc} />
                    <MovementGroup title="En büyük borç ödemesi" items={largestDebt} modalAc={modalAc} />
                </div>
            </PremiumCard>

            <PremiumCard className="salary-card salary-card--compact salary-transactions-card">
                <SectionHeader title="Dönem İşlemleri" description={`${filteredTransactions.length} hareket`} />
                <div className="salary-transaction-toolbar">
                    <label className="qw-search-field">
                        <Search size={17} strokeWidth={2.3} />
                        <input type="text" placeholder="İşlem, kategori veya tutar ara" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
                    </label>
                    <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                        {['Tümü', 'Gelir', 'Gerçek Harcama', 'Borç Ödemesi', 'Yatırım', 'Transfer', 'İade', 'İncelenmemiş'].map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                        <option value="Tümü">Tüm kategoriler</option>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                </div>
                <div className="qw-transaction-list qw-transaction-list--scroll salary-transactions">
                    {filteredTransactions.map(({ transaction, bucket }) => {
                        const amount = getAccountMovementAmount(transaction, selectedAccount.id);
                        const meta = bucketMeta[bucket] || bucketMeta.neutral;
                        return (
                            <TransactionRow
                                key={transaction.id}
                                icon={meta.icon}
                                tone={meta.tone}
                                title={transaction.aciklama || transaction.kategori || 'İşlem'}
                                meta={`${getSalaryRelationMeta(transaction) || `${meta.label} · ${transaction.kategori || 'Kategori yok'}`} · ${tarihFormatla(transaction.tarih)}`}
                                amount={`${amount > 0 ? '+' : amount < 0 ? '-' : ''}${formatPara(Math.abs(amount))}`}
                                amountTone={moneyTone(amount)}
                                onClick={() => modalAc?.('duzenle_islem', transaction)}
                                actions={islemSil ? (
                                    <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={(event) => { event.stopPropagation(); islemSil(transaction.id); }}>
                                        <Trash2 size={15} />
                                    </button>
                                ) : null}
                            />
                        );
                    })}
                    {filteredTransactions.length === 0 && <EmptyState title="Bu dönemde hareket yok" description="Filtreleri değiştirin veya farklı bir maaş dönemi seçin." icon={Search} />}
                </div>
                <div className="qw-card-sticky-footer">
                    <span>Filtrelenen işlemler neti</span>
                    <strong className={`is-${moneyTone(filteredTransactionsNet)}`}>{formatPara(filteredTransactionsNet)}</strong>
                </div>
            </PremiumCard>
        </div>
    );
};

const SummaryTile = ({ label, value, tone }) => (
    <div className="salary-summary-tile">
        <span>{label}</span>
        <strong className={tone ? `is-${tone}` : ''}>{value}</strong>
    </div>
);

const ComparisonRow = ({ label, current, previous, positiveHigher, positiveLower }) => {
    const diff = parseAmount(current) - parseAmount(previous);
    const good = positiveHigher ? diff >= 0 : positiveLower ? diff <= 0 : diff >= 0;
    const direction = diff > 0 ? 'arttı' : diff < 0 ? 'azaldı' : 'değişmedi';
    const diffText = diff === 0 ? 'Değişmedi' : `${formatPara(Math.abs(diff))} ${direction}`;
    return (
        <div className="salary-comparison-row">
            <strong>{label}</strong>
            <span><em>Bu dönem</em><b>{formatPara(current)}</b></span>
            <span><em>Önceki dönem</em><b>{formatPara(previous)}</b></span>
            <span><em>Değişim</em><b className={diff === 0 ? '' : good ? 'is-success' : 'is-danger'}>{diffText}</b></span>
        </div>
    );
};

const MovementGroup = ({ title, items, modalAc }) => (
    <div className="salary-movement-group">
        <h3>{title}</h3>
        {items.map(({ transaction, bucket }) => {
            const meta = bucketMeta[bucket] || bucketMeta.neutral;
            return (
                <button key={transaction.id} type="button" onClick={() => modalAc?.('duzenle_islem', transaction)}>
                    <IconTile icon={meta.icon} tone={meta.tone} />
                    <span>
                        <b>{transaction.aciklama || transaction.kategori || 'İşlem'}</b>
                        <small>{meta.label} · {tarihFormatla(transaction.tarih)}</small>
                    </span>
                    <em>{formatPara(transaction.tutar)}</em>
                </button>
            );
        })}
        {items.length === 0 && <EmptyState title="Hareket yok" description="Bu sınıfta hareket bulunamadı." icon={ReceiptText} />}
    </div>
);

export default SalaryAnalysisDashboard;
