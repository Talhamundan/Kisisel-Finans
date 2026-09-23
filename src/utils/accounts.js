const normalizeAccountType = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[\s_-]+/g, '')
    .toLocaleLowerCase('tr-TR');

export const isActiveAccount = (account) => {
    if (!account) return false;
    if (account.aktif === false) return false;
    if (account.active === false) return false;
    if (account.pasif === true) return false;
    if (account.deletedAt || account.silindi === true || account.isDeleted === true) return false;
    return true;
};

export const isInvestmentAccount = (account) => {
    const type = normalizeAccountType(account?.hesapTipi || account?.accountType || account?.type);
    return [
        'yatirim',
        'yatirimhesabi',
        'investment',
        'investmentaccount',
    ].includes(type);
};

export const selectHasInvestmentAccount = (accounts = []) => (
    (accounts || []).some((account) => isActiveAccount(account) && isInvestmentAccount(account))
);
