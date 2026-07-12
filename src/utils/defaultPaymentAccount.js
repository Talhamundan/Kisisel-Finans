import { useMemo } from 'react';

const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value.seconds) return value.seconds * 1000;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const canBeDefaultPaymentAccount = (account) => (
    account &&
    account.hesapTipi !== 'yatirim' &&
    !account.deletedAt &&
    !account.silindi
);

export const getDefaultPaymentAccount = (accounts = []) => {
    const candidates = (accounts || [])
        .filter((account) => canBeDefaultPaymentAccount(account) && account.varsayilanOdemeAraci === true)
        .sort((a, b) => (
            toMillis(b.guncellemeTarihi || b.updatedAt || b.olusturmaTarihi || b.createdAt) -
            toMillis(a.guncellemeTarihi || a.updatedAt || a.olusturmaTarihi || a.createdAt)
        ));

    return candidates[0] || null;
};

export const useDefaultPaymentAccount = (accounts = []) => (
    useMemo(() => getDefaultPaymentAccount(accounts), [accounts])
);
