export const normalizeTagName = (value = '') => (
    String(value).trim().replace(/\s+/g, ' ')
);

export const normalizeTagKey = (value = '') => (
    normalizeTagName(value).toLocaleLowerCase('tr-TR')
);

export const buildTransactionTagId = (transactionId, tagId) => `${transactionId}_${tagId}`;

export const getTransactionTagIds = (transaction = {}) => {
    if (Array.isArray(transaction.tagIds)) return transaction.tagIds.filter(Boolean);
    if (Array.isArray(transaction.tags)) return transaction.tags.map((tag) => tag?.id).filter(Boolean);
    return [];
};

export const getTransactionTags = (transaction = {}) => (
    Array.isArray(transaction.tags) ? transaction.tags.filter(Boolean) : []
);

export const uniqueTagIds = (tagIds = []) => Array.from(new Set((tagIds || []).filter(Boolean)));
