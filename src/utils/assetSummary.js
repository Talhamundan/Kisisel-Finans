import { normalizeAssetType } from './helpers.js';
import { getFinancingMetrics } from './financing.js';

const parseAmount = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const hasAmount = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(parseFloat(value));

const normalizeAccountType = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[\s_-]+/g, '')
    .toLocaleLowerCase('tr-TR');

const accountTypeLabel = (account) => {
    if (isInvestmentAccount(account)) return 'Yatırım Hesabı';
    if (isCreditCardAccount(account)) return 'Kredi Kartı';
    if (normalizeAccountType(account?.hesapTipi || account?.accountType || account?.type) === 'nakit') return 'Nakit';
    return 'Vadesiz Hesap';
};

const isInvestmentAccount = (account) => [
    'yatirim',
    'yatirimhesabi',
    'investment',
    'investmentaccount',
].includes(normalizeAccountType(account?.hesapTipi || account?.accountType || account?.type));

const isCreditCardAccount = (account) => [
    'kredikarti',
    'creditcard',
].includes(normalizeAccountType(account?.hesapTipi || account?.accountType || account?.type));

const getPortfolioValue = (item) => (
    parseAmount(item?.guncelFiyat ?? item?.alisFiyati) * parseAmount(item?.adet ?? item?.miktar ?? 1)
);

const isBesPortfolioItem = (item) => normalizeAssetType(item?.varlikTuru) === 'bes';

const isGoldOrSilver = (item) => {
    const type = normalizeAssetType(item?.varlikTuru);
    const symbol = String(item?.sembol || '').toLocaleUpperCase('tr-TR');
    return type === 'altin' || type === 'gumus' || type === 'gümüş' ||
        symbol === 'GAUTRY' || symbol === 'GMSTR' || symbol === 'GOLD' ||
        symbol === 'ALTIN' || symbol === 'GUMUS' || symbol.includes('GLD');
};

const getBesValue = (besData, besPortfolioItems = []) => {
    const legacyPortfolioValue = besPortfolioItems.reduce((sum, item) => sum + getPortfolioValue(item), 0);
    const hasCanonical = hasAmount(besData?.guncelTutar);
    const fallbackValue = hasAmount(besData?.guncelDeger)
        ? parseAmount(besData.guncelDeger)
        : hasAmount(besData?.toplamBirikim)
            ? parseAmount(besData.toplamBirikim)
            : hasAmount(besData?.birikim)
                ? parseAmount(besData.birikim)
                : null;
    const hasFallback = fallbackValue !== null;

    if (hasCanonical) {
        return {
            value: parseAmount(besData.guncelTutar),
            source: 'bes_data.guncelTutar',
            legacyPortfolioValue,
            ignoredPortfolioItems: legacyPortfolioValue > 0 ? besPortfolioItems : [],
        };
    }

    if (hasFallback) {
        return {
            value: fallbackValue,
            source: 'bes_data.legacy',
            legacyPortfolioValue,
            ignoredPortfolioItems: legacyPortfolioValue > 0 ? besPortfolioItems : [],
        };
    }

    return {
        value: legacyPortfolioValue,
        source: legacyPortfolioValue > 0 ? 'portfolio.legacyBes' : 'none',
        legacyPortfolioValue,
        ignoredPortfolioItems: [],
    };
};

const getDebtType = (debt) => debt?.type === 'ALACAK' ? 'ALACAK' : 'VERECEK';

const isDebtCompleted = (debt) => (
    debt?.durum === 'completed' ||
    debt?.status === 'completed' ||
    parseAmount(debt?.kalanTutar ?? debt?.tutar ?? debt?.toplamTutar) <= 0
);

const getInstallmentStatus = (installment, transactions = []) => {
    const count = parseInt(installment?.taksitSayisi) || 0;
    const total = parseAmount(installment?.toplamTutar);
    const monthly = parseAmount(installment?.aylikTutar || (count > 0 ? total / count : 0));
    const directPaid = Math.max(
        parseInt(installment?.odenmisTaksit) || 0,
        parseInt(installment?.completedInstallments) || 0,
        parseInt(installment?.paidInstallmentCount) || 0,
    );
    const linkedPaid = new Set((transactions || [])
        .filter((transaction) => transaction?.islemTipi === 'gider')
        .filter((transaction) => (
            transaction.taksitId === installment?.id ||
            transaction.installmentId === installment?.id ||
            transaction.planId === installment?.id ||
            transaction.sourceId === installment?.id ||
            transaction.generatedFrom === installment?.id
        ))
        .map((transaction) => transaction.installmentNumber || transaction.taksitNo || transaction.taksitSirasi || transaction.id)
        .filter(Boolean)).size;
    const status = String(installment?.status || '').toLowerCase();
    const isCompleted = installment?.paid === true ||
        installment?.isPaid === true ||
        Boolean(installment?.paidAt) ||
        ['paid', 'completed', 'complete', 'odendi', 'tamamlandi'].includes(status);
    const paidCount = isCompleted && count > 0 ? count : Math.max(directPaid, linkedPaid);

    if (count > 0 && monthly > 0) return Math.max(0, monthly * Math.max(0, count - Math.min(count, paidCount)));
    return Math.max(0, total - (monthly * paidCount));
};

export const summarizeAssets = ({
    accounts = [],
    portfolio = [],
    besData = null,
    debts = [],
    financings = [],
    installments = [],
    transactions = [],
} = {}) => {
    const diagnostics = [];
    const cashAccounts = [];
    const investmentAccounts = [];
    const positiveCreditCardAccounts = [];
    const debtLikeNegativeAccounts = [];

    (accounts || []).forEach((account) => {
        const balance = parseAmount(account?.guncelBakiye);
        if (isCreditCardAccount(account)) {
            if (balance > 0) positiveCreditCardAccounts.push(account);
            return;
        }
        if (isInvestmentAccount(account)) {
            if (balance > 0) investmentAccounts.push(account);
            else if (balance < 0) debtLikeNegativeAccounts.push(account);
            return;
        }
        if (balance > 0) cashAccounts.push(account);
        else if (balance < 0) debtLikeNegativeAccounts.push(account);
    });

    const besPortfolioItems = (portfolio || []).filter(isBesPortfolioItem);
    const bes = getBesValue(besData, besPortfolioItems);
    if (bes.ignoredPortfolioItems.length > 0) {
        diagnostics.push({
            type: 'ignored_legacy_bes_portfolio',
            message: 'BES için bes_data değeri kullanıldı; portföydeki BES kayıtları çift sayımı önlemek için toplama alınmadı.',
            value: bes.legacyPortfolioValue,
            itemIds: bes.ignoredPortfolioItems.map((item) => item.id).filter(Boolean),
        });
    }

    const investablePortfolio = (portfolio || []).filter((item) => !isBesPortfolioItem(item));
    const portfolioByCategory = investablePortfolio.reduce((summary, item) => {
        const value = getPortfolioValue(item);
        if (value <= 0) return summary;
        const type = normalizeAssetType(item?.varlikTuru);
        const key = type === 'doviz'
            ? 'doviz'
            : isGoldOrSilver(item)
                ? 'emtia'
                : type === 'fon'
                    ? 'fon'
                    : type === 'coin'
                        ? 'coin'
                        : 'hisse';
        summary[key] = (summary[key] || 0) + value;
        return summary;
    }, {});

    const cash = cashAccounts.reduce((sum, account) => sum + parseAmount(account.guncelBakiye), 0);
    const investmentCash = investmentAccounts.reduce((sum, account) => sum + parseAmount(account.guncelBakiye), 0);
    const positiveCreditCardBalance = positiveCreditCardAccounts.reduce((sum, account) => sum + parseAmount(account.guncelBakiye), 0);
    const openPositionValue = investablePortfolio.reduce((sum, item) => sum + getPortfolioValue(item), 0);
    const totalAssets = cash + investmentCash + positiveCreditCardBalance + openPositionValue + bes.value;

    const creditCardDebt = (accounts || [])
        .filter(isCreditCardAccount)
        .reduce((sum, account) => sum + Math.max(0, -parseAmount(account.guncelBakiye)), 0);
    const negativeAccountDebt = debtLikeNegativeAccounts.reduce((sum, account) => sum + Math.max(0, -parseAmount(account.guncelBakiye)), 0);
    const financingContext = { transactions, installments };
    const financingDebt = (financings || []).reduce((sum, financing) => (
        sum + getFinancingMetrics(financing, financingContext).remainingPlannedPayment
    ), 0);
    const financingInstallmentIds = new Set((financings || []).map((item) => item.installmentId).filter(Boolean));
    const installmentDebt = (installments || [])
        .filter((installment) => !financingInstallmentIds.has(installment.id))
        .reduce((sum, installment) => sum + getInstallmentStatus(installment, transactions), 0);
    const activePayables = (debts || []).filter((debt) => getDebtType(debt) === 'VERECEK' && !isDebtCompleted(debt));
    const manualDebt = activePayables.reduce((sum, debt) => sum + parseAmount(debt.kalanTutar ?? debt.tutar ?? debt.toplamTutar), 0);
    const totalDebts = creditCardDebt + negativeAccountDebt + financingDebt + installmentDebt + manualDebt;

    const assetItems = [
        ...cashAccounts.map((account) => ({
            id: `account-${account.id}`,
            group: 'Hesaplar',
            label: account.hesapAdi || 'İsimsiz hesap',
            meta: accountTypeLabel(account),
            value: parseAmount(account.guncelBakiye),
        })),
        ...investmentAccounts.map((account) => ({
            id: `investment-cash-${account.id}`,
            group: 'Yatırım Hesapları',
            label: account.hesapAdi || 'Yatırım hesabı',
            meta: 'Kullanılabilir nakit',
            value: parseAmount(account.guncelBakiye),
        })),
        ...(portfolioByCategory.hisse > 0 ? [{
            id: 'portfolio-stocks',
            group: 'Yatırım Varlıkları',
            label: 'Hisse Senetleri',
            meta: 'Açık pozisyonlar',
            value: portfolioByCategory.hisse,
        }] : []),
        ...(portfolioByCategory.fon > 0 ? [{
            id: 'portfolio-funds',
            group: 'Yatırım Varlıkları',
            label: 'Fonlar',
            meta: 'Açık pozisyonlar',
            value: portfolioByCategory.fon,
        }] : []),
        ...(portfolioByCategory.doviz > 0 ? [{
            id: 'portfolio-currency',
            group: 'Yatırım Varlıkları',
            label: 'Döviz Pozisyonları',
            meta: 'Açık pozisyonlar',
            value: portfolioByCategory.doviz,
        }] : []),
        ...(portfolioByCategory.emtia > 0 ? [{
            id: 'portfolio-commodities',
            group: 'Yatırım Varlıkları',
            label: 'Altın / Emtia',
            meta: 'Açık pozisyonlar',
            value: portfolioByCategory.emtia,
        }] : []),
        ...(portfolioByCategory.coin > 0 ? [{
            id: 'portfolio-crypto',
            group: 'Yatırım Varlıkları',
            label: 'Coin',
            meta: 'Açık pozisyonlar',
            value: portfolioByCategory.coin,
        }] : []),
        ...(bes.value > 0 ? [{
            id: 'bes-value',
            group: 'Yatırım Varlıkları',
            label: 'BES Birikimi',
            meta: bes.source === 'portfolio.legacyBes' ? 'Eski portföy kaydı' : 'Emeklilik birikimi',
            value: bes.value,
        }] : []),
        ...positiveCreditCardAccounts.map((account) => ({
            id: `credit-card-positive-${account.id}`,
            group: 'Diğer Varlıklar',
            label: account.hesapAdi || 'Kredi kartı pozitif bakiye',
            meta: 'Kredi kartı alacağı',
            value: parseAmount(account.guncelBakiye),
        })),
    ];

    const debtItems = [
        ...(accounts || [])
            .filter((account) => isCreditCardAccount(account) && parseAmount(account.guncelBakiye) < 0)
            .map((account) => ({
                id: `credit-card-${account.id}`,
                group: 'Kredi Kartları',
                label: account.hesapAdi || 'Kredi kartı',
                meta: 'Kredi Kartı',
                value: Math.max(0, -parseAmount(account.guncelBakiye)),
            })),
        ...debtLikeNegativeAccounts.map((account) => ({
            id: `negative-account-${account.id}`,
            group: 'Diğer Borçlar',
            label: account.hesapAdi || 'Negatif hesap',
            meta: accountTypeLabel(account),
            value: Math.max(0, -parseAmount(account.guncelBakiye)),
        })),
        ...(financings || []).map((financing) => {
            const metrics = getFinancingMetrics(financing, financingContext);
            return {
                id: `financing-${financing.id}`,
                group: 'Finansmanlar',
                label: financing.ad || financing.bankName || 'Finansman',
                meta: financing.bankName || 'Finansman',
                value: metrics.remainingPlannedPayment,
            };
        }).filter((item) => item.value > 0),
        ...activePayables.map((debt) => ({
            id: `manual-debt-${debt.id}`,
            group: 'Manuel Borçlar',
            label: debt.baslik || debt.ad || debt.aciklama || 'Borç',
            meta: debt.kisi || debt.kurum || 'Verecek',
            value: parseAmount(debt.kalanTutar ?? debt.tutar ?? debt.toplamTutar),
        })).filter((item) => item.value > 0),
        ...(installments || [])
            .filter((installment) => !financingInstallmentIds.has(installment.id))
            .map((installment) => ({
                id: `installment-debt-${installment.id}`,
                group: 'Manuel Borçlar',
                label: installment.baslik || 'Taksitli alışveriş',
                meta: 'Taksit yükü',
                value: getInstallmentStatus(installment, transactions),
            }))
            .filter((item) => item.value > 0),
    ];

    return {
        assets: {
            cash,
            availableCash: cash,
            investmentCash,
            positiveCreditCardBalance,
            openPositionValue,
            besValue: bes.value,
            besSource: bes.source,
            total: totalAssets,
            items: assetItems,
        },
        debts: {
            creditCards: creditCardDebt,
            negativeAccounts: negativeAccountDebt,
            financings: financingDebt,
            manualDebt,
            installmentDebt,
            total: totalDebts,
            items: debtItems,
        },
        investment: {
            cash: investmentCash,
            positions: openPositionValue,
            bes: bes.value,
            power: investmentCash + openPositionValue + bes.value,
            byCategory: {
                hisse: portfolioByCategory.hisse || 0,
                fon: portfolioByCategory.fon || 0,
                doviz: portfolioByCategory.doviz || 0,
                emtia: portfolioByCategory.emtia || 0,
                coin: portfolioByCategory.coin || 0,
            },
        },
        cash: {
            available: cash,
            netPosition: cash - creditCardDebt,
        },
        netWorth: totalAssets - totalDebts,
        diagnostics,
    };
};

export const summarizeAssetOverview = summarizeAssets;
