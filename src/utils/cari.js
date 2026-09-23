import { toDateSafe } from './helpers.js';

export const normalizeCariName = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

export const getCariNameKey = (value) => normalizeCariName(value).toLocaleLowerCase('tr-TR');

export const getDebtType = (debt) => debt?.type === 'ALACAK' ? 'ALACAK' : 'VERECEK';

export const getDebtAmount = (debt) => parseFloat(debt?.kalanTutar ?? debt?.tutar ?? debt?.toplamTutar) || 0;

export const isDebtCompleted = (debt) => (
    debt?.durum === 'completed' ||
    debt?.status === 'completed' ||
    getDebtAmount(debt) <= 0
);

export const getDebtCariName = (debt, cariler = []) => {
    const linked = debt?.cariId ? cariler.find((cari) => cari.id === debt.cariId) : null;
    return normalizeCariName(linked?.ad || linked?.name || debt?.cariAd || debt?.cari || debt?.kisi || debt?.kurum || debt?.ad || debt?.baslik || 'İsimsiz cari');
};

export const getDebtDescription = (debt) => (
    normalizeCariName(debt?.aciklama || debt?.description || debt?.not || debt?.islemAciklama || debt?.baslik) ||
    normalizeCariName(debt?.ad) ||
    'Açıklama yok'
);

export const getDebtDueDate = (debt) => toDateSafe(debt?.sonOdemeTarihi || debt?.vadeTarihi || debt?.tarih);

export const buildCariSummaries = (debts = [], cariler = []) => {
    const map = new Map();

    const ensureSummary = ({ id, name, nameKey }) => {
        const key = id || nameKey || getCariNameKey(name);
        if (!key) return null;
        if (!map.has(key)) {
            map.set(key, {
                id,
                key,
                name: normalizeCariName(name) || 'İsimsiz cari',
                nameKey: nameKey || getCariNameKey(name),
                activeReceivable: 0,
                activePayable: 0,
                completedReceivable: 0,
                completedPayable: 0,
                activeItems: [],
                completedItems: [],
                allItems: [],
            });
        }
        return map.get(key);
    };

    (cariler || []).forEach((cari) => {
        ensureSummary({
            id: cari.id,
            name: cari.ad || cari.name,
            nameKey: cari.nameKey || getCariNameKey(cari.ad || cari.name),
        });
    });

    (debts || []).forEach((debt) => {
        const cariName = getDebtCariName(debt, cariler);
        const linked = debt?.cariId ? (cariler || []).find((cari) => cari.id === debt.cariId) : null;
        const summary = ensureSummary({
            id: debt?.cariId || linked?.id,
            name: linked?.ad || linked?.name || cariName,
            nameKey: linked?.nameKey || getCariNameKey(cariName),
        });
        if (!summary) return;

        const amount = getDebtAmount(debt);
        const type = getDebtType(debt);
        const completed = isDebtCompleted(debt);
        const enriched = {
            ...debt,
            cariAd: cariName,
            displayDescription: getDebtDescription(debt),
            displayAmount: amount,
            displayType: type,
            displayDueDate: getDebtDueDate(debt),
        };

        summary.allItems.push(enriched);
        if (completed) {
            summary.completedItems.push(enriched);
            if (type === 'ALACAK') summary.completedReceivable += amount;
            else summary.completedPayable += amount;
            return;
        }

        summary.activeItems.push(enriched);
        if (type === 'ALACAK') summary.activeReceivable += amount;
        else summary.activePayable += amount;
    });

    return Array.from(map.values())
        .map((summary) => ({
            ...summary,
            netBalance: summary.activeReceivable - summary.activePayable,
            activeCount: summary.activeItems.length,
            completedCount: summary.completedItems.length,
        }))
        .filter((summary) => summary.allItems.length > 0 || summary.id)
        .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance) || a.name.localeCompare(b.name, 'tr-TR'));
};
