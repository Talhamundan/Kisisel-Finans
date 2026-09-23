export const CREDIT_CARD_PAYMENT_STRATEGIES = {
    FULL: 'full',
    MINIMUM: 'minimum',
    FIXED: 'fixed',
    MANUAL: 'manual',
};

export const CREDIT_CARD_PAYMENT_TYPES = {
    INTERIM: 'interim',
    STATEMENT: 'statement',
};

export const CREDIT_CARD_PAYMENT_STRATEGY_LABELS = {
    [CREDIT_CARD_PAYMENT_STRATEGIES.FULL]: 'Ekstrenin tamamı',
    [CREDIT_CARD_PAYMENT_STRATEGIES.MINIMUM]: 'Asgari ödeme',
    [CREDIT_CARD_PAYMENT_STRATEGIES.FIXED]: 'Sabit tutar',
    [CREDIT_CARD_PAYMENT_STRATEGIES.MANUAL]: 'Manuel',
};

const parseAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
};

export const toMoneyCents = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 100);
};

export const fromMoneyCents = (value) => Math.round(Number(value) || 0) / 100;

export const isCreditCardPaymentTransaction = (transaction, accountId) => (
    transaction?.islemTipi === 'transfer' &&
    transaction?.hedefId === accountId &&
    (transaction?.kategori === 'Kredi Kartı Ödemesi' || transaction?.isCreditCardPayment || transaction?.krediKartiOdeme)
);

export const isCreditCardStatementPaymentTransaction = (transaction, accountId) => (
    isCreditCardPaymentTransaction(transaction, accountId) &&
    transaction?.creditCardPaymentType !== CREDIT_CARD_PAYMENT_TYPES.INTERIM &&
    transaction?.kkOdemeTipi !== CREDIT_CARD_PAYMENT_TYPES.INTERIM &&
    transaction?.araOdeme !== true
);

const toDateSafe = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate();
    if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const monthKeyFromDate = (value) => {
    const date = toDateSafe(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const clampPayment = (amount, debt) => {
    if (debt <= 0) return 0;
    return Math.max(0, Math.min(parseAmount(amount), debt));
};

export const getCreditCardStatementDebt = (account) => Math.abs(parseAmount(account?.guncelBakiye));

export const getCreditCardMinimumPayment = (account) => {
    const debt = getCreditCardStatementDebt(account);
    const definedMinimum = parseAmount(account?.asgariOdemeTutari ?? account?.asgariOdeme);
    return clampPayment(definedMinimum > 0 ? definedMinimum : debt * 0.2, debt);
};

const getPeriodOverride = (account, periodKey) => {
    if (!account || !periodKey) return null;
    const override = account.planlananOdemeler?.[periodKey]
        || account.ekstreOdemePlanlari?.[periodKey]
        || account.statementPaymentPlans?.[periodKey];
    if (!override) return null;
    if (typeof override === 'number' || typeof override === 'string') return { plannedPayment: override };
    return override;
};

export const getCreditCardPaymentPlan = (account, periodKey = '') => {
    const statementDebt = getCreditCardStatementDebt(account);
    const minimumPayment = getCreditCardMinimumPayment(account);
    const periodOverride = getPeriodOverride(account, periodKey);
    const strategy = periodOverride?.strategy || periodOverride?.odemeStratejisi || account?.odemeStratejisi || CREDIT_CARD_PAYMENT_STRATEGIES.FULL;
    const fixedAmount = parseAmount(account?.varsayilanOdemeTutari);
    const manualAmount = parseAmount(
        periodOverride?.plannedPayment
        ?? periodOverride?.planlananOdemeTutari
        ?? periodOverride?.tutar
        ?? account?.planlananOdemeTutari
        ?? account?.manuelOdemeTutari
    );

    let plannedPayment = statementDebt;
    if (strategy === CREDIT_CARD_PAYMENT_STRATEGIES.MINIMUM) plannedPayment = minimumPayment;
    if (strategy === CREDIT_CARD_PAYMENT_STRATEGIES.FIXED) plannedPayment = fixedAmount;
    if (strategy === CREDIT_CARD_PAYMENT_STRATEGIES.MANUAL) plannedPayment = manualAmount;

    plannedPayment = clampPayment(plannedPayment, statementDebt);

    return {
        strategy,
        statementDebt,
        minimumPayment,
        plannedPayment,
        carryoverDebt: Math.max(0, statementDebt - plannedPayment),
    };
};

export const getCreditCardStatementPaymentSummary = (account, transactions = [], periodKey = '') => {
    const paymentPlan = getCreditCardPaymentPlan(account, periodKey);
    const statementPayments = (transactions || []).filter((transaction) => (
        isCreditCardStatementPaymentTransaction(transaction, account?.id) &&
        (!periodKey || monthKeyFromDate(transaction.tarih) === periodKey)
    ));
    const paidAmount = statementPayments.reduce((sum, transaction) => (
        sum + parseAmount(transaction.appliedToStatement ?? transaction.tutar)
    ), 0);
    const statementDebt = Math.max(
        paymentPlan.statementDebt,
        ...statementPayments.map((transaction) => parseAmount(transaction.statementDebtBeforePayment)),
        paymentPlan.statementDebt + paidAmount
    );
    const minimumPayment = Math.min(
        statementDebt,
        Math.max(
            paymentPlan.minimumPayment,
            ...statementPayments.map((transaction) => parseAmount(transaction.minimumPayment))
        )
    );
    const remainingMinimumPayment = Math.max(0, minimumPayment - paidAmount);
    const remainingStatementDebt = Math.max(0, statementDebt - paidAmount);
    const status = paidAmount <= 0
        ? 'unpaid'
        : remainingStatementDebt <= 0
            ? 'statement_paid'
            : remainingMinimumPayment <= 0
                ? 'minimum_paid'
                : 'minimum_partial';

    return {
        ...paymentPlan,
        statementDebt,
        minimumPayment,
        paidAmount,
        remainingMinimumPayment,
        remainingStatementDebt,
        status,
        minimumPaid: remainingMinimumPayment <= 0,
        statementPaid: remainingStatementDebt <= 0 && statementDebt > 0,
    };
};

export const getCreditCardPaymentAmountOptions = (account) => {
    const paymentPlan = getCreditCardPaymentPlan(account);
    const currentDebtCents = Math.max(0, -toMoneyCents(account?.guncelBakiye));
    const statementDebtCents = Math.min(currentDebtCents, toMoneyCents(paymentPlan.statementDebt));
    const minimumCents = Math.min(statementDebtCents, toMoneyCents(paymentPlan.minimumPayment));

    return {
        currentDebt: fromMoneyCents(currentDebtCents),
        statementDebt: fromMoneyCents(statementDebtCents),
        minimumPayment: fromMoneyCents(minimumCents),
        options: [
            { id: 'minimum', label: 'Asgari tutar', amount: fromMoneyCents(minimumCents), enabled: minimumCents > 0 },
            { id: 'statement', label: 'Ekstre borcu', amount: fromMoneyCents(statementDebtCents), enabled: statementDebtCents > 0 },
            { id: 'current', label: 'Güncel borç', amount: fromMoneyCents(currentDebtCents), enabled: currentDebtCents > 0 },
            { id: 'custom', label: 'Diğer tutar', amount: null, enabled: currentDebtCents > 0 },
        ],
    };
};

export const isCreditCardPaymentSourceAccount = (account) => {
    const type = account?.hesapTipi || 'nakit';
    return Boolean(account?.id) && type !== 'krediKarti' && type !== 'yatirim';
};

export const validateCreditCardPayment = ({
    sourceAccount,
    cardAccount,
    amount,
    allowPositiveCardBalance = false,
}) => {
    const amountCents = toMoneyCents(amount);
    const sourceBalanceCents = toMoneyCents(sourceAccount?.guncelBakiye);
    const currentDebtCents = Math.max(0, -toMoneyCents(cardAccount?.guncelBakiye));
    const sourceCurrency = sourceAccount?.paraBirimi || sourceAccount?.currency || 'TRY';
    const cardCurrency = cardAccount?.paraBirimi || cardAccount?.currency || 'TRY';

    if (!cardAccount) return { valid: false, message: 'Ödenecek kredi kartı bulunamadı.' };
    if (!sourceAccount) return { valid: false, message: 'Ödeme yapılacak vadesiz hesap seçin.' };
    if (cardAccount.hesapTipi !== 'krediKarti') return { valid: false, message: 'Hedef hesap kredi kartı olmalı.' };
    if (!isCreditCardPaymentSourceAccount(sourceAccount)) return { valid: false, message: 'Kaynak hesap kredi kartı veya yatırım hesabı olamaz.' };
    if (sourceAccount.id === cardAccount.id) return { valid: false, message: 'Kaynak hesap ve kredi kartı aynı olamaz.' };
    if (sourceCurrency !== cardCurrency) return { valid: false, message: 'Farklı para birimleri için döviz dönüşümü desteklenmiyor.' };
    if (amountCents <= 0) return { valid: false, message: 'Tutar sıfırdan büyük olmalı.' };
    if (sourceBalanceCents < amountCents) return { valid: false, message: 'Yetersiz bakiye.' };
    if (!allowPositiveCardBalance && amountCents > currentDebtCents) return { valid: false, message: 'Ödenecek tutar güncel kart borcundan fazla olamaz.' };

    return {
        valid: true,
        amount: fromMoneyCents(amountCents),
        amountCents,
        sourceBalance: fromMoneyCents(sourceBalanceCents),
        currentDebt: fromMoneyCents(currentDebtCents),
    };
};

export const buildCreditCardPaymentMetadata = ({ cardAccount, amount, paymentType = CREDIT_CARD_PAYMENT_TYPES.STATEMENT }) => {
    const amountCents = toMoneyCents(amount);
    const currentDebtCents = Math.max(0, -toMoneyCents(cardAccount?.guncelBakiye));
    const paymentPlan = getCreditCardPaymentPlan(cardAccount);
    const statementDebtCents = Math.min(currentDebtCents, toMoneyCents(paymentPlan.statementDebt));
    const isStatementPayment = paymentType === CREDIT_CARD_PAYMENT_TYPES.STATEMENT;
    const appliedToStatementCents = isStatementPayment ? Math.min(amountCents, statementDebtCents) : 0;
    const appliedToCurrentDebtCents = isStatementPayment ? Math.max(0, amountCents - appliedToStatementCents) : amountCents;
    const statementRemainingCents = Math.max(0, statementDebtCents - appliedToStatementCents);
    const minimumPaymentCents = Math.min(statementDebtCents, toMoneyCents(paymentPlan.minimumPayment));
    const minimumRemainingCents = Math.max(0, minimumPaymentCents - appliedToStatementCents);
    const statementPaid = statementDebtCents > 0 && statementRemainingCents === 0;
    const minimumPaid = minimumPaymentCents > 0 && minimumRemainingCents === 0;

    return {
        creditCardPaymentType: paymentType,
        araOdeme: paymentType === CREDIT_CARD_PAYMENT_TYPES.INTERIM,
        statementDebtBeforePayment: fromMoneyCents(statementDebtCents),
        currentDebtBeforePayment: fromMoneyCents(currentDebtCents),
        minimumPayment: fromMoneyCents(minimumPaymentCents),
        appliedToStatement: fromMoneyCents(appliedToStatementCents),
        appliedToCurrentDebt: fromMoneyCents(appliedToCurrentDebtCents),
        statementRemainingAfterPayment: fromMoneyCents(statementRemainingCents),
        minimumRemainingAfterPayment: fromMoneyCents(minimumRemainingCents),
        minimumPaid,
        statementPaid,
        statementPaymentStatus: statementPaid ? 'statement_paid' : minimumPaid ? 'minimum_paid' : appliedToStatementCents > 0 ? 'minimum_partial' : 'unpaid',
    };
};

export const applyCreditCardPaymentToBalances = ({
    sourceAccount,
    cardAccount,
    amount,
    paymentId,
    paymentType = CREDIT_CARD_PAYMENT_TYPES.STATEMENT,
    processedPaymentIds = [],
}) => {
    if (paymentId && processedPaymentIds.includes(paymentId)) {
        return {
            duplicate: true,
            sourceBalance: parseAmount(sourceAccount?.guncelBakiye),
            cardBalance: parseAmount(cardAccount?.guncelBakiye),
            metadata: null,
        };
    }

    const validation = validateCreditCardPayment({ sourceAccount, cardAccount, amount });
    if (!validation.valid) return { valid: false, message: validation.message };

    const metadata = buildCreditCardPaymentMetadata({ cardAccount, amount: validation.amount, paymentType });
    const sourceBalance = fromMoneyCents(toMoneyCents(sourceAccount.guncelBakiye) - validation.amountCents);
    const cardBalance = fromMoneyCents(toMoneyCents(cardAccount.guncelBakiye) + validation.amountCents);

    return {
        valid: true,
        duplicate: false,
        amount: validation.amount,
        sourceBalance,
        cardBalance,
        metadata,
    };
};
