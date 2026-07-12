export const CREDIT_CARD_PAYMENT_STRATEGIES = {
    FULL: 'full',
    MINIMUM: 'minimum',
    FIXED: 'fixed',
    MANUAL: 'manual',
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
