const LAST_EXPENSE_ACCOUNT_KEY = 'tm_finance_last_quick_expense_account_id';
const LAST_TRANSFER_SOURCE_KEY = 'tm_finance_last_quick_transfer_source_id';
const LAST_TRANSFER_TARGET_KEY = 'tm_finance_last_quick_transfer_target_id';

const getTransactionSeconds = (transaction) => {
    if (typeof transaction?.tarih?.seconds === 'number') return transaction.tarih.seconds;
    if (!transaction?.tarih) return 0;
    const time = new Date(transaction.tarih).getTime();
    return Number.isFinite(time) ? time / 1000 : 0;
};

export const rememberLastQuickExpenseAccount = (accountId) => {
    if (!accountId || typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(LAST_EXPENSE_ACCOUNT_KEY, accountId);
    } catch {
        // Hızlı işlem yine çalışsın; tarayıcı saklama kapalıysa sessiz geç.
    }
};

export const rememberLastQuickTransferAccounts = ({ sourceId, targetId } = {}) => {
    if (typeof window === 'undefined') return;
    try {
        if (sourceId) window.localStorage.setItem(LAST_TRANSFER_SOURCE_KEY, sourceId);
        if (targetId) window.localStorage.setItem(LAST_TRANSFER_TARGET_KEY, targetId);
    } catch {
        // Hızlı işlem yine çalışsın; tarayıcı saklama kapalıysa sessiz geç.
    }
};

export const readLastQuickExpenseAccount = () => {
    if (typeof window === 'undefined') return '';
    try {
        return window.localStorage.getItem(LAST_EXPENSE_ACCOUNT_KEY) || '';
    } catch {
        return '';
    }
};

export const readLastQuickTransferAccounts = () => {
    if (typeof window === 'undefined') return { sourceId: '', targetId: '' };
    try {
        return {
            sourceId: window.localStorage.getItem(LAST_TRANSFER_SOURCE_KEY) || '',
            targetId: window.localStorage.getItem(LAST_TRANSFER_TARGET_KEY) || '',
        };
    } catch {
        return { sourceId: '', targetId: '' };
    }
};

export const getLatestExpenseAccountId = (transactions = [], validAccountIds = new Set()) => (
    [...(transactions || [])]
        .filter((transaction) => (
            transaction?.islemTipi === 'gider'
            && transaction?.hesapId
            && validAccountIds.has(transaction.hesapId)
        ))
        .sort((a, b) => getTransactionSeconds(b) - getTransactionSeconds(a))[0]?.hesapId || ''
);

export const getLatestTransferAccountIds = (transactions = [], validAccountIds = new Set()) => {
    const latestTransfer = [...(transactions || [])]
        .filter((transaction) => (
            transaction?.islemTipi === 'transfer'
            && transaction?.kaynakId
            && transaction?.hedefId
            && validAccountIds.has(transaction.kaynakId)
            && validAccountIds.has(transaction.hedefId)
        ))
        .sort((a, b) => getTransactionSeconds(b) - getTransactionSeconds(a))[0];

    return {
        sourceId: latestTransfer?.kaynakId || '',
        targetId: latestTransfer?.hedefId || '',
    };
};

export const getQuickExpenseDefaultAccountId = ({
    accounts = [],
    transactions = [],
    defaultPaymentAccountId = '',
} = {}) => {
    const validAccountIds = new Set((accounts || []).map((account) => account?.id).filter(Boolean));
    const rememberedAccountId = readLastQuickExpenseAccount();

    if (rememberedAccountId && validAccountIds.has(rememberedAccountId)) return rememberedAccountId;

    const latestExpenseAccountId = getLatestExpenseAccountId(transactions, validAccountIds);
    if (latestExpenseAccountId) return latestExpenseAccountId;

    return validAccountIds.has(defaultPaymentAccountId) ? defaultPaymentAccountId : '';
};

export const getQuickTransferDefaultAccountIds = ({
    accounts = [],
    transactions = [],
    defaultPaymentAccountId = '',
} = {}) => {
    const validAccountIds = new Set((accounts || []).map((account) => account?.id).filter(Boolean));
    const remembered = readLastQuickTransferAccounts();
    const latest = getLatestTransferAccountIds(transactions, validAccountIds);

    const sourceId = validAccountIds.has(remembered.sourceId)
        ? remembered.sourceId
        : (latest.sourceId || (validAccountIds.has(defaultPaymentAccountId) ? defaultPaymentAccountId : ''));

    const targetId = validAccountIds.has(remembered.targetId) && remembered.targetId !== sourceId
        ? remembered.targetId
        : (latest.targetId && latest.targetId !== sourceId ? latest.targetId : '');

    return { sourceId, targetId };
};
