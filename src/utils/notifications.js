export const buildDueNotificationMessage = ({ name, daysLeft, overdueText }) => {
    if (daysLeft < 0) {
        const statusText = overdueText || 'GECİKTİ';
        const delayedBy = Math.abs(daysLeft);
        const alreadySaysDelayed = statusText.toLocaleLowerCase('tr-TR').includes('gecikti');
        const delayText = alreadySaysDelayed
            ? `${delayedBy} gün`
            : `${delayedBy} gün gecikti`;
        return `🔥 ${name} ${statusText}! (${delayText})`;
    }
    if (daysLeft === 0) return `⚠️ ${name} için bugün son gün!`;
    return `⚠️ ${name} için son ${daysLeft} gün!`;
};

export const maskMoneyInNotificationMessage = (message, hidden = false) => {
    if (!hidden) return message;
    return String(message || '').replace(/(?:₺\s*)\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s*₺/g, '**** ₺');
};
