import React, { useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
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
    resolveTransactionFlow,
    summarizeDebtPayments,
    summarizeSalaryPeriod,
} from '../../utils/salaryPeriod';
import {
    EmptyState,
    IconTile,
    PremiumCard,
    SectionHeader,
    StatCard,
    StatusBadge,
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

const getSalaryExpectedAccountId = (salary) => String(salary?.beklenenHesapId || salary?.hesapId || '').trim();

const getSalaryRealizedAccountId = (salary, transactions = []) => String(
    transactions.find((transaction) => transaction?.hesapId)?.hesapId ||
    (transactions.length ? salary?.gerceklesenHesapId : '') ||
    ''
).trim();

const getAccountName = (accounts, accountId) => accounts.find((account) => account.id === accountId)?.hesapAdi || '-';

const isCashAccount = (account) => {
    const name = normalizeText(account?.hesapAdi);
    return name.includes('nakit cüzdan') ||
        name.includes('nakit cuzdan') ||
        name.includes('elden') ||
        name.includes('kasa');
};

const transferLinksAccounts = (transaction, sourceAccount, targetAccount) => {
    if (!transaction || !sourceAccount || !targetAccount) return false;
    if (transaction.kaynakId === sourceAccount.id && transaction.hedefId === targetAccount.id) return true;

    const description = normalizeText(transaction.aciklama);
    const sourceName = normalizeText(sourceAccount.hesapAdi);
    const targetName = normalizeText(targetAccount.hesapAdi);
    if (!description || !sourceName || !targetName) return false;

    return description.includes(sourceName) &&
        description.includes(targetName) &&
        description.indexOf(sourceName) < description.indexOf(targetName);
};

const findExpectedAccountTransfer = ({ transactions, realizedAccountId, expectedAccountId, actualDate, amount }) => {
    if (!realizedAccountId || !expectedAccountId || realizedAccountId === expectedAccountId || !actualDate) return null;
    const transfers = (transactions || [])
        .filter((transaction) => {
            if (transaction.islemTipi !== 'transfer') return false;
            if (transaction.kaynakId !== realizedAccountId || transaction.hedefId !== expectedAccountId) return false;
            const transferDate = toDateSafe(transaction.tarih);
            if (!transferDate || transferDate < actualDate) return false;
            return true;
        })
        .sort((a, b) => (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0));

    if (transfers.length === 0) return null;
    const targetAmount = parseAmount(amount);
    const tolerance = Math.max(1, targetAmount * 0.01);
    let transferredAmount = 0;
    const matchedTransfers = [];

    for (const transfer of transfers) {
        if (targetAmount > 0 && transferredAmount >= targetAmount - tolerance) break;
        transferredAmount += parseAmount(transfer.tutar);
        matchedTransfers.push(transfer);
    }

    return {
        transaction: matchedTransfers[0],
        transactions: matchedTransfers,
        amount: Math.min(transferredAmount, targetAmount || transferredAmount),
        fullyTransferred: targetAmount > 0 ? transferredAmount >= targetAmount - tolerance : transferredAmount > 0,
    };
};

const buildPeriodMovements = ({ transactions, account, accounts, period, installmentPlans = [] }) => {
    const periodKey = getPeriodKey(period);
    const primaryRows = (transactions || [])
        .filter((transaction) => {
            const linked = transaction.hesapId === account.id || transaction.kaynakId === account.id || transaction.hedefId === account.id;
            const linkedToSalaryPeriod = getTransactionSalaryPeriod(transaction) === periodKey;
            return linked && (isDateInSalaryPeriod(transaction.tarih, period) || linkedToSalaryPeriod);
        })
        .sort((a, b) => (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0));
    const downstreamRows = primaryRows
        .map((transaction) => resolveTransactionFlow({ transfer: transaction, transactions, accounts, sourceAccountId: account.id, installmentPlans })?.finalPaymentTransaction)
        .filter(Boolean);
    const rows = Array.from(new Map([...primaryRows, ...downstreamRows].map((transaction) => [transaction.id, transaction])).values())
        .sort((a, b) => (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0));
    return { rows, summary: summarizeSalaryPeriod({ transactions: rows, account, accounts, installmentPlans }) };
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
        text.includes('fark') ||
        text.includes('masraf') ||
        text.includes('iade') ||
        text.includes('prim') ||
        text.includes('ikramiye');
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

const getIncomeStatus = ({ salary, transactions, expectedDate, accounts = [], transferToExpected = null }) => {
    const rawStatus = normalizeText(salary?.status || salary?.durum);
    if (salary?.atlandi || salary?.skipped || rawStatus.includes('atland')) return { label: 'Atlandı', tone: 'neutral' };
    const actualAmount = (transactions || []).reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0);
    if (actualAmount > 0) {
        const expectedAccountId = getSalaryExpectedAccountId(salary);
        const realizedAccountId = getSalaryRealizedAccountId(salary, transactions);
        const expectedAmount = parseAmount(salary?.tutar);
        const diff = actualAmount - expectedAmount;
        const tolerance = Math.max(1, expectedAmount * 0.005);
        const today = new Date();
        const hasOnlyAdvance = (transactions || []).length > 0 && (transactions || []).every((transaction) => getSalaryPartType(transaction) === 'advance');
        if (hasOnlyAdvance && expectedDate && today < expectedDate) return { label: 'Avans Ödendi', tone: 'info' };
        if (expectedAccountId && realizedAccountId && expectedAccountId !== realizedAccountId) {
            const realizedAccount = accounts.find((account) => account.id === realizedAccountId);
            if (transferToExpected?.fullyTransferred) return { label: 'Beklenen hesaba aktarıldı', tone: 'success' };
            if (transferToExpected?.amount > 0) return { label: 'Kısmi aktarıldı', tone: 'warning' };
            if (isCashAccount(realizedAccount)) return { label: 'Nakit olarak alındı', tone: 'warning' };
            return { label: 'Farklı hesaba geldi', tone: 'warning' };
        }
        if (expectedAmount > 0 && diff < -tolerance) return { label: 'Kısmi Ödendi', tone: 'warning' };
        if (expectedAmount > 0 && diff > tolerance) return { label: 'Fazla Ödendi', tone: 'success' };
        return { label: 'Tam Ödendi', tone: 'success' };
    }
    if (!expectedDate) return { label: 'Bekleniyor', tone: 'warning' };
    const today = new Date();
    if (today > expectedDate) return { label: 'Gecikti', tone: 'danger' };
    return { label: 'Bekleniyor', tone: 'warning' };
};

const buildIncomeRows = ({ salaries, incomeTransactions, period, accounts = [], allTransactions = [] }) => {
    const usedTransactions = new Set();
    const salaryRows = (salaries || [])
        .map((salary) => {
            const transactions = findSalaryTransactions({ salary, incomeTransactions, period });
            transactions.forEach((transaction) => {
                if (transaction?.id) usedTransactions.add(transaction.id);
            });
            const expectedDate = getExpectedDate(salary, period);
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
            const actualDate = firstTransaction ? toDateSafe(firstTransaction.tarih) : null;
            const expectedAccountId = getSalaryExpectedAccountId(salary);
            const realizedAccountId = getSalaryRealizedAccountId(salary, transactions);
            const transferToExpected = findExpectedAccountTransfer({
                transactions: allTransactions,
                realizedAccountId,
                expectedAccountId,
                actualDate,
                amount: actualAmount || salary.tutar,
            });
            const transferredAmount = parseAmount(transferToExpected?.amount);
            const realizedAccountIsCash = isCashAccount(accounts.find((account) => account.id === realizedAccountId));
            const cashWaitingAmount = realizedAccountIsCash
                ? Math.max(0, actualAmount - transferredAmount)
                : 0;
            const status = getIncomeStatus({ salary, transactions, expectedDate, accounts, transferToExpected });
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
                actualDate,
                actualAmount,
                expectedAccountId,
                expectedAccountName: getAccountName(accounts, expectedAccountId),
                realizedAccountId,
                realizedAccountName: getAccountName(accounts, realizedAccountId),
                realizedAccountIsCash,
                transferredToExpected: Boolean(transferToExpected?.fullyTransferred),
                transferredAmount,
                cashWaitingAmount,
                transferToExpected,
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
            expectedAccountId: '',
            expectedAccountName: '-',
            realizedAccountId: transaction.hesapId || '',
            realizedAccountName: getAccountName(accounts, transaction.hesapId),
            realizedAccountIsCash: isCashAccount(accounts.find((account) => account.id === transaction.hesapId)),
            transferredToExpected: false,
            transferredAmount: 0,
            cashWaitingAmount: isCashAccount(accounts.find((account) => account.id === transaction.hesapId))
                ? parseAmount(transaction.tutar)
                : 0,
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

const SalaryTooltip = ({ active, payload, hasInvestmentAccount = true }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
        <div className="salary-chart-tooltip">
            <strong>{item.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            <span><em>Gün başı bakiye</em><b>{formatPara(item.start)}</b></span>
            <span><em>Gelir</em><b className="is-success">{formatPara(item.income)}</b></span>
            <span><em>Harcama</em><b className="is-danger">{formatPara(item.realExpense)}</b></span>
            <span><em>Borç</em><b className="is-warning">{formatPara(item.debtPayment)}</b></span>
            {hasInvestmentAccount && (
                <span><em>Yatırım</em><b className="is-info">{formatPara(item.investment)}</b></span>
            )}
            <span><em>Transfer girişi</em><b className="is-success">{formatPara(item.transferIn)}</b></span>
            <span><em>Transfer</em><b className="is-purple">{formatPara(item.transfer)}</b></span>
            <span><em>Gün sonu kalan</em><b className={moneyTone(item.remaining) === 'danger' ? 'is-danger' : 'is-success'}>{formatPara(item.remaining)}</b></span>
        </div>
    );
};

const SalaryAnalysisDashboard = ({
    hesaplar = [],
    maaslar = [],
    taksitler = [],
    tumIslemler = [],
    selectedPeriod,
    modalAc,
    islemSil,
    normalSil,
    hasInvestmentAccount = true,
}) => {
    const salaryAccounts = useMemo(() => (hesaplar || []).filter(isSalaryAccount), [hesaplar]);
    const defaultAccount = salaryAccounts.find((account) => account.anaMaasHesabi) || salaryAccounts[0] || null;
    const [selectedAccountId, setSelectedAccountId] = useState(defaultAccount?.id || '');
    const [analysisPeriod, setAnalysisPeriod] = useState({
        year: selectedPeriod?.year || new Date().getFullYear(),
        month: selectedPeriod?.month === 'all' ? new Date().getMonth() + 1 : selectedPeriod?.month || new Date().getMonth() + 1,
    });
    const [expandedAllocation, setExpandedAllocation] = useState('');

    const selectedAccount = salaryAccounts.find((account) => account.id === selectedAccountId) || defaultAccount;
    const period = selectedAccount ? getSalaryPeriod(selectedAccount, analysisPeriod) : null;
    const previousPeriod = addMonths(analysisPeriod, -1);
    const previousSalaryPeriod = selectedAccount ? getSalaryPeriod(selectedAccount, previousPeriod) : null;

    const { rows: periodTransactions, summary } = selectedAccount && period
        ? buildPeriodMovements({ transactions: tumIslemler, account: selectedAccount, accounts: hesaplar, period, installmentPlans: taksitler })
        : { rows: [], summary: summarizeSalaryPeriod({ transactions: [], account: selectedAccount, accounts: hesaplar, installmentPlans: taksitler }) };
    const { rows: previousTransactions, summary: previousSummary } = selectedAccount && previousSalaryPeriod
        ? buildPeriodMovements({ transactions: tumIslemler, account: selectedAccount, accounts: hesaplar, period: previousSalaryPeriod, installmentPlans: taksitler })
        : { rows: [], summary: null };

    const periodIncome = summary.income + summary.refund;
    const periodNet = periodIncome - summary.totalOutflow;
    const periodAccountNet = periodTransactions.reduce((sum, transaction) => (
        sum + getAccountMovementAmount(transaction, selectedAccount?.id)
    ), 0);
    const incomeTransactions = (tumIslemler || [])
        .filter((transaction) => {
            if (!['gelir', 'cari_iade'].includes(transaction.islemTipi)) return false;
            const linkedToCurrentSalaryPeriod = period && getTransactionSalaryPeriod(transaction) === getPeriodKey(period);
            return linkedToCurrentSalaryPeriod || (period && isDateInSalaryPeriod(transaction.tarih, period));
        });
    const incomeRows = selectedAccount && period
        ? buildIncomeRows({ salaries: maaslar, incomeTransactions, period, accounts: hesaplar, allTransactions: tumIslemler })
        : [];
    const expectedIncomeTotal = incomeRows.reduce((sum, row) => sum + row.expectedAmount, 0);
    const receivedIncomeTotal = incomeRows.reduce((sum, row) => sum + row.actualAmount, 0);
    const cashIncomeTotal = incomeRows.reduce((sum, row) => {
        if (!row.actualAmount) return sum;
        return row.realizedAccountIsCash ? sum + row.actualAmount : sum;
    }, 0);
    const nonCashIncomeTotal = incomeRows.reduce((sum, row) => {
        if (!row.actualAmount) return sum;
        return !row.realizedAccountIsCash ? sum + row.actualAmount : sum;
    }, 0);
    const cashTransferToSelectedTotal = (tumIslemler || []).reduce((sum, transaction) => {
        if (!period || transaction?.islemTipi !== 'transfer') return sum;
        const sourceAccount = (hesaplar || []).find((account) => account.id === transaction.kaynakId);
        const inferredSourceAccount = sourceAccount || (hesaplar || []).find((account) => (
            isCashAccount(account) && transferLinksAccounts(transaction, account, selectedAccount)
        ));
        if (!isCashAccount(inferredSourceAccount)) return sum;
        if (!transferLinksAccounts(transaction, inferredSourceAccount, selectedAccount)) return sum;
        if (!isDateInSalaryPeriod(transaction.tarih, period)) return sum;
        return sum + parseAmount(transaction.tutar);
    }, 0);
    const cashTransferredToBankTotal = Math.min(cashIncomeTotal, cashTransferToSelectedTotal);
    const bankIncomeTotal = nonCashIncomeTotal + cashTransferredToBankTotal;
    const cashWaitingTotal = Math.max(0, cashIncomeTotal - cashTransferredToBankTotal);
    const definedIncomeRows = incomeRows.filter((row) => row.salary);

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
    const debtSummary = summarizeDebtPayments(summary);
    const debtDetailGroups = [
        { title: 'Kredi Kartı Ödemeleri', subtype: 'creditCard', tone: 'warning', icon: CreditCard, empty: 'Kredi kartı ödemesi yok' },
        { title: 'Kredi Taksitleri', subtype: 'loan', tone: 'warning', icon: Landmark, empty: 'Kredi taksiti yok' },
        { title: 'Taksitli Alışverişler', subtype: 'installmentPurchase', tone: 'purple', icon: ReceiptText, empty: 'Taksitli alışveriş yok' },
    ].map((group) => ({
        ...group,
        items: debtSummary.items.filter((item) => item.subtype === group.subtype),
    }));

    const distributionRows = [
        { key: 'realExpense', label: 'Gerçek Harcama', value: summary.realExpense, description: 'Market, fatura, ulaşım ve benzeri günlük harcamalar' },
        { key: 'debtPayment', label: 'Kredi ve Kart Ödemeleri', value: debtSummary.total, description: 'Kart borcu, kredi taksiti ve taksitli alışveriş ödemeleri' },
        { key: 'investment', label: 'Yatırım', value: summary.investment, description: 'Yatırım hesapları ve varlık alımları' },
        { key: 'transfer', label: 'Diğer Transferler', value: summary.transfer, description: 'Maaş dışı hesaplar arası aktarımlar' },
        { key: 'remaining', label: 'Kalan', value: Math.max(0, periodNet), description: periodNet < 0 ? 'Negatif kalan dönem başı bakiyeden kullanıldı' : 'Dönem içinde kalan tutar' },
    ].filter((row) => row.key !== 'investment' || hasInvestmentAccount);

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
            ? buildPeriodMovements({ transactions: tumIslemler, account: selectedAccount, accounts: hesaplar, period: salaryPeriod, installmentPlans: taksitler }).summary
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

    const importantMovements = summary.movements
        .filter((item) => {
            if (item.bucket === 'investment' && !hasInvestmentAccount) return false;
            return item.counted !== false && item.transaction && ['realExpense', 'debtPayment', 'investment', 'transfer'].includes(item.bucket);
        })
        .sort((a, b) => parseAmount(b.transaction.tutar) - parseAmount(a.transaction.tutar))
        .slice(0, 5);
    const debtRatio = periodIncome > 0 ? Math.round((summary.debtPayment / periodIncome) * 100) : 0;
    const investmentRatio = periodIncome > 0 ? Math.round((summary.investment / periodIncome) * 100) : 0;
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
                <StatCard title="Beklenen Gelir" value={formatPara(expectedIncomeTotal)} description={`${definedIncomeRows.length} düzenli gelir tanımı`} icon={ReceiptText} tone="info" />
                <StatCard title="Gerçekleşen Gelir" value={formatPara(receivedIncomeTotal)} description={`${incomeRows.filter((row) => row.actualAmount > 0).length} gelir hareketi`} icon={ArrowDownRight} tone="success" />
                <StatCard title="Gerçek Harcama" value={formatPara(summary.realExpense)} description={`${periodIncome > 0 ? Math.round((summary.realExpense / periodIncome) * 100) : 0}% maaşa oran`} icon={TrendingDown} tone="danger" />
                <StatCard title="Kredi ve Kart Ödemeleri" value={formatPara(summary.debtPayment)} description={`${debtRatio}% maaşa oran`} icon={CreditCard} tone="warning" />
                {hasInvestmentAccount && (
                    <StatCard title="Yatırıma Aktarılan" value={formatPara(summary.investment)} description={`${investmentRatio}% maaşa oran`} icon={PiggyBank} tone="info" />
                )}
                <StatCard title="Dönem Sonu Kalan" value={formatPara(periodNet)} description="Dönem içi net kalan" icon={Wallet} tone={moneyTone(periodNet)} />
            </div>

            <PremiumCard className="salary-income-card salary-income-card--merged">
                <SectionHeader
                    title="Gelirler"
                    description={`${incomeRows.length} gelir kalemi`}
                    action={<button type="button" className="qw-inline-action" onClick={() => modalAc?.('maas_ekle')}><Plus size={17} /> Gelir Ekle</button>}
                />
                <div className="salary-income-summary salary-income-summary--compact">
                    <SummaryTile label="Beklenen" value={formatPara(expectedIncomeTotal)} />
                    <SummaryTile label="Gerçekleşen" value={formatPara(receivedIncomeTotal)} tone="success" />
                    <SummaryTile label="Kalan" value={formatPara(Math.max(0, expectedIncomeTotal - receivedIncomeTotal))} tone={expectedIncomeTotal - receivedIncomeTotal > 0 ? 'warning' : 'success'} />
                    <SummaryTile label="Bankaya Geçen" value={formatPara(bankIncomeTotal)} tone="purple" />
                    <SummaryTile label="Nakit Bekleyen" value={formatPara(cashWaitingTotal)} tone={cashWaitingTotal > 0 ? 'warning' : 'neutral'} />
                </div>
                <div className="salary-income-list">
                    {incomeRows.map((row) => (
                        <div className="salary-income-row salary-income-row--compact" key={row.id}>
                            <span className="salary-income-icon"><Banknote size={21} strokeWidth={2.25} /></span>
                            <div>
                                <strong>{row.name}</strong>
                                <span>{[row.type, row.expectedAccountName && row.salary ? row.expectedAccountName : row.realizedAccountName].filter(Boolean).join(' · ')}</span>
                                <small>
                                    {row.actualDate
                                        ? `${row.expectedDate ? formatDayMonth(row.expectedDate) : '-'} -> ${formatDayMonth(row.actualDate)}`
                                        : `Beklenen: ${row.expectedDate ? formatDayMonth(row.expectedDate) : '-'}`}
                                </small>
                            </div>
                            <div>
                                <small>Beklenen</small>
                                <b>{row.expectedAmount ? formatPara(row.expectedAmount) : row.salary ? 'Değişken tutar' : '-'}</b>
                            </div>
                            <div>
                                <small>Gerçekleşen</small>
                                <b>{row.actualAmount ? formatPara(row.actualAmount) : '-'}</b>
                                {row.actualAmount > 0 && row.expectedAccountId && row.realizedAccountId && row.expectedAccountId !== row.realizedAccountId && (
                                    <em>
                                        {row.transferredToExpected
                                            ? 'Beklenen hesaba aktarıldı'
                                            : row.transferredAmount > 0
                                                ? `${formatPara(row.transferredAmount)} aktarıldı`
                                                : 'Beklenen hesaba aktarılmadı'}
                                    </em>
                                )}
                            </div>
                            <div className="salary-income-status">
                                <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>
                            </div>
                            <div className="qw-row-actions">
                                {row.salary && (
                                    <>
                                        <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={() => modalAc?.('duzenle_maas', row.salary)}><Edit3 size={14} /></button>
                                        {normalSil && <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={() => normalSil('maaslar', row.salary.id)}><Trash2 size={14} /></button>}
                                    </>
                                )}
                                {!row.salary && row.transaction && (
                                    <>
                                        <button type="button" className="qw-mini-icon-button" aria-label="Düzenle" onClick={() => modalAc?.('duzenle_islem', row.transaction)}><Edit3 size={14} /></button>
                                        {islemSil && <button type="button" className="qw-mini-icon-button is-danger" aria-label="Sil" onClick={() => islemSil(row.transaction.id)}><Trash2 size={14} /></button>}
                                    </>
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
                                        <small>Kalan</small>
                                        <b className={row.remainingAmount > 0 ? 'is-danger' : 'is-success'}>{formatPara(row.remainingAmount)}</b>
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                    {incomeRows.length === 0 && <div className="salary-compact-empty">Bu dönemde gelir kalemi bulunmuyor.</div>}
                </div>
            </PremiumCard>

            <div className="salary-main-grid salary-main-grid--analysis">
                <PremiumCard className="salary-card salary-card--compact">
                    <SectionHeader title="Bu maaş nereye gitti?" description="Yüzdeler toplam dönem gelirine göre hesaplanır; toplam çıkış gelirden fazlaysa dönem başı bakiye kullanılmış olabilir." />
                    <div className="salary-distribution">
                        {distributionRows.map((row) => {
                            const percent = periodIncome > 0 ? Math.round((row.value / periodIncome) * 100) : 0;
                            const meta = bucketMeta[row.key] || bucketMeta.neutral;
                            const isExpanded = expandedAllocation === row.key;
                            return (
                                <div key={row.key} className={`salary-distribution-item ${isExpanded ? 'is-expanded' : ''}`}>
                                    <button type="button" className="salary-distribution-row" onClick={() => setExpandedAllocation(isExpanded ? '' : row.key)}>
                                        <span style={{ background: meta.color }} />
                                        <div>
                                            <strong>{row.label}</strong>
                                            <small>{row.description}</small>
                                            <div className="salary-progress"><i style={{ width: `${Math.min(percent, 100)}%`, background: meta.color }} /></div>
                                        </div>
                                        <b>%{percent}</b>
                                        <em>{formatPara(row.value)}</em>
                                    </button>
                                    {isExpanded && (
                                        <AllocationDetails
                                            type={row.key}
                                            expenseByCategory={expenseByCategory}
                                            debtDetailGroups={debtDetailGroups}
                                            investmentByTarget={investmentByTarget}
                                            summary={summary}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </PremiumCard>

                <PremiumCard className="salary-card salary-card--chart">
                    <SectionHeader title="Gün Sonu Bakiye" />
                    <div className="salary-chart-legend">
                        <span><i className="is-success" />Pozitif kalan</span>
                        <span><i className="is-danger" />Negatif alan</span>
                        <span><i />Sıfır çizgisi</span>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
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
                            <Tooltip content={<SalaryTooltip hasInvestmentAccount={hasInvestmentAccount} />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="remaining" name="Gün sonu kalan" stroke={periodNet < 0 ? '#ef4444' : '#6d5dfc'} fill="url(#salaryRemainingFill)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                        </AreaChart>
                    </ResponsiveContainer>
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
                        {hasInvestmentAccount && (
                            <ComparisonRow label="Yatırım" current={summary.investment} previous={previousSummary?.investment || 0} positiveHigher />
                        )}
                        <ComparisonRow label="Kalan" current={summary.remaining} previous={previousSummary?.remaining || 0} positiveHigher />
                    </div>
                </PremiumCard>
            </div>

            <PremiumCard className="salary-card salary-card--compact salary-periods-card">
                <SectionHeader title="Son 6 Maaş Dönemi" description={hasInvestmentAccount ? 'Gelir, gerçek harcama, borç, yatırım ve kalan trendi.' : 'Gelir, gerçek harcama, borç ve kalan trendi.'} />
                <ResponsiveContainer width="100%" height={280}>
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
                        {hasInvestmentAccount && (
                            <Bar name="Yatırım" dataKey="yatirim" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                        )}
                        <Bar name="Kalan" dataKey="kalan" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </PremiumCard>

            {importantMovements.length > 0 && (
                <PremiumCard className="salary-card salary-card--compact salary-important-card">
                    <SectionHeader
                        title="Dönemin Önemli Hareketleri"
                        description={`${importantMovements.length} hareket`}
                    />
                    <div className="salary-important-list">
                        {importantMovements.map(({ transaction, bucket }) => {
                            const meta = bucketMeta[bucket] || bucketMeta.neutral;
                            const amount = getAccountMovementAmount(transaction, selectedAccount.id);
                            return (
                                <div key={transaction.id} className="salary-important-row">
                                    <IconTile icon={meta.icon} tone={meta.tone} />
                                    <span>
                                        <b>{transaction.aciklama || transaction.kategori || 'İşlem'}</b>
                                        <small>{meta.label} · {tarihFormatla(transaction.tarih)}</small>
                                    </span>
                                    <em className={`is-${moneyTone(amount)}`}>{amount > 0 ? '+' : amount < 0 ? '-' : ''}{formatPara(Math.abs(amount))}</em>
                                </div>
                            );
                        })}
                    </div>
                </PremiumCard>
            )}
        </div>
    );
};

const SummaryTile = ({ label, value, tone }) => (
    <div className="salary-summary-tile">
        <span>{label}</span>
        <strong className={tone ? `is-${tone}` : ''}>{value}</strong>
    </div>
);

const AllocationDetails = ({ type, expenseByCategory, debtDetailGroups, investmentByTarget, summary }) => {
    let rows = [];
    if (type === 'realExpense') {
        rows = expenseByCategory.slice(0, 5).map((item) => ({ label: item.name, value: item.value }));
    } else if (type === 'debtPayment') {
        rows = debtDetailGroups.map((group) => ({
            label: group.title,
            value: group.items.reduce((sum, item) => sum + parseAmount(item.amount), 0),
        }));
    } else if (type === 'investment') {
        rows = investmentByTarget.slice(0, 5).map((item) => ({ label: item.name, value: item.value }));
    } else if (type === 'transfer') {
        rows = [{ label: 'Diğer transferler', value: summary.transfer }];
    } else if (type === 'remaining') {
        rows = [{ label: 'Dönem sonu kalan', value: Math.max(0, summary.remaining) }];
    }

    const visibleRows = rows.filter((row) => parseAmount(row.value) > 0);
    return (
        <div className="salary-allocation-detail">
            {visibleRows.map((row) => (
                <span key={row.label}>
                    <small>{row.label}</small>
                    <b>{formatPara(row.value)}</b>
                </span>
            ))}
            {visibleRows.length === 0 && <em>Bu başlıkta detay yok.</em>}
        </div>
    );
};

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

export default SalaryAnalysisDashboard;
