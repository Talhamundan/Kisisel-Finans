import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    ChevronDown,
    CheckCircle2,
    Clock3,
    CopyCheck,
    FileJson,
    ReceiptText,
    Save,
    ShieldAlert,
    Trash2,
    XCircle,
} from 'lucide-react';
import { formatCurrencyPlain, tarihFormatla, toDateSafe, sortTurkishText } from '../../utils/helpers';
import { RECEIPT_STATUSES, buildReceiptImportId, validateReceiptPayload } from '../../utils/receipts';
import { EmptyState, IconTile, PremiumCard, SectionHeader, StatCard, StatusBadge } from '../Shared/PremiumUI';

const statusTabs = [
    { id: RECEIPT_STATUSES.PENDING, label: 'Onay Bekleyen', icon: Clock3 },
    { id: RECEIPT_STATUSES.APPROVED, label: 'Onaylanan', icon: CheckCircle2 },
    { id: RECEIPT_STATUSES.REJECTED, label: 'Reddedilen', icon: XCircle },
];

const formatMoney = (value) => formatCurrencyPlain(parseFloat(value) || 0);
const dateInputValue = (value) => {
    const date = toDateSafe(value);
    return date ? date.toISOString().slice(0, 10) : '';
};

const hasReceiptWarning = (receipt) => (
    (receipt?.validation?.warnings || []).length > 0
    || (receipt?.validation?.errors || []).length > 0
    || (receipt?.validation?.duplicateCandidateIds || []).length > 0
);

const getStatusTone = (status) => {
    if (status === RECEIPT_STATUSES.APPROVED) return 'success';
    if (status === RECEIPT_STATUSES.REJECTED) return 'danger';
    return 'warning';
};

const receiptStatusLabel = (status) => {
    if (status === RECEIPT_STATUSES.APPROVED) return 'Onaylandı';
    if (status === RECEIPT_STATUSES.REJECTED) return 'Reddedildi';
    return 'Bekliyor';
};

const ReceiptDetail = ({
    receipt,
    accounts,
    categories,
    transaction,
    onSave,
    onApprove,
    onReject,
}) => {
    const [form, setForm] = useState({
        merchant: '',
        date: '',
        total: '',
        category: '',
        selectedAccountId: '',
    });

    useEffect(() => {
        setForm({
            merchant: receipt?.merchant || '',
            date: dateInputValue(receipt?.date),
            total: receipt?.total !== undefined ? String(receipt.total) : '',
            category: receipt?.category || 'Diğer',
            selectedAccountId: receipt?.selectedAccountId || '',
        });
    }, [receipt]);

    if (!receipt) {
        return (
            <PremiumCard className="receipts-detail-card" hover={false}>
                <EmptyState title="Fiş seçilmedi" description="Detayları görmek için listeden bir fiş seçin." icon={ReceiptText} />
            </PremiumCard>
        );
    }

    const warnings = [
        ...(receipt.validation?.warnings || []),
        ...(receipt.validation?.errors || []),
        ...((receipt.validation?.duplicateCandidateIds || []).length > 0 ? ['Benzer mağaza, tarih, tutar ve para birimine sahip fiş olabilir.'] : []),
    ];
    const itemTotal = receipt.validation?.itemTotal ?? (receipt.items || []).reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    const canEdit = receipt.status === RECEIPT_STATUSES.PENDING;
    const submitValues = {
        ...form,
        total: parseFloat(form.total),
        currency: receipt.currency || 'TRY',
        items: receipt.items || [],
        validation: receipt.validation || {},
    };

    return (
        <PremiumCard className="receipts-detail-card" hover={false}>
            <div className="receipts-detail-header">
                <div>
                    <span className="qw-eyebrow">Fiş Detayı</span>
                    <h2>{receipt.merchant || 'Mağaza yok'}</h2>
                </div>
                <StatusBadge tone={getStatusTone(receipt.status)}>{receiptStatusLabel(receipt.status)}</StatusBadge>
            </div>

            {warnings.length > 0 && (
                <div className="receipts-warning-box">
                    <ShieldAlert size={18} />
                    <span>
                        {warnings.map((warning) => <small key={warning}>{warning}</small>)}
                    </span>
                </div>
            )}

            <div className="receipts-form-grid">
                <label>
                    <span>Mağaza</span>
                    <input disabled={!canEdit} value={form.merchant} onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))} />
                </label>
                <label>
                    <span>Tarih</span>
                    <input disabled={!canEdit} type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
                </label>
                <label>
                    <span>Toplam</span>
                    <input disabled={!canEdit} type="number" step="0.01" value={form.total} onChange={(event) => setForm((current) => ({ ...current, total: event.target.value }))} />
                </label>
                <label>
                    <span>Kategori</span>
                    <select disabled={!canEdit} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                </label>
                <label className="receipts-form-grid__wide">
                    <span>Hesap veya kredi kartı</span>
                    <select disabled={!canEdit} value={form.selectedAccountId} onChange={(event) => setForm((current) => ({ ...current, selectedAccountId: event.target.value }))}>
                        <option value="">Seçim yap</option>
                        {accounts.map((account) => <option key={account.id} value={account.id}>{account.hesapAdi || 'İsimsiz hesap'}</option>)}
                    </select>
                </label>
            </div>

            <div className="receipts-kv">
                <span>Para Birimi <b>{receipt.currency || 'TRY'}</b></span>
                <span>Ürün Toplamı <b>{formatMoney(itemTotal)}</b></span>
                <span>Import ID <b>{receipt.importId || '-'}</b></span>
                {transaction && <span>Harcama Kaydı <b>{transaction.aciklama || transaction.id}</b></span>}
            </div>

            <div className="receipts-items">
                <strong>Ürünler</strong>
                {(receipt.items || []).length === 0 && <small>Ürün detayı yok.</small>}
                {(receipt.items || []).map((item, index) => (
                    <div key={`${item.name}-${index}`}>
                        <span>{item.name || `Ürün ${index + 1}`} <small>x{item.quantity || 1}</small></span>
                        <b>{formatMoney(item.total)}</b>
                    </div>
                ))}
            </div>

            {canEdit && (
                <div className="receipts-detail-actions">
                    <button type="button" onClick={() => onSave(receipt.id, submitValues)}><Save size={16} /> Kaydet</button>
                    <button type="button" className="is-primary" onClick={() => onApprove(receipt.id, submitValues)}><CopyCheck size={16} /> Harcamaya Dönüştür</button>
                    <button type="button" className="is-danger" onClick={() => onReject(receipt.id)}><Trash2 size={16} /> Reddet</button>
                </div>
            )}
        </PremiumCard>
    );
};

const ReceiptsDashboard = ({
    receipts = [],
    accounts = [],
    categories = [],
    transactions = [],
    actions,
    importPayload,
    importError,
    onImportHandled,
    activeAreaCode = '',
}) => {
    const [activeStatus, setActiveStatus] = useState(RECEIPT_STATUSES.PENDING);
    const [selectedId, setSelectedId] = useState('');
    const [manualJson, setManualJson] = useState('');
    const [importMessage, setImportMessage] = useState('');
    const [manualOpen, setManualOpen] = useState(false);
    const [failedImport, setFailedImport] = useState(null);
    const [optimisticReceipts, setOptimisticReceipts] = useState([]);
    const onImportHandledRef = useRef(onImportHandled);
    const actionsRef = useRef(actions);
    const processedImportKeysRef = useRef(new Set());

    const sortedCategories = useMemo(() => {
        const list = sortTurkishText(categories || []);
        return list.length ? list : ['Diğer'];
    }, [categories]);

    useEffect(() => {
        onImportHandledRef.current = onImportHandled;
    }, [onImportHandled]);

    useEffect(() => {
        actionsRef.current = actions;
    }, [actions]);

    useEffect(() => {
        if (optimisticReceipts.length === 0) return;
        const remoteIds = new Set((receipts || []).map((receipt) => receipt.id));
        setOptimisticReceipts((current) => current.filter((receipt) => !remoteIds.has(receipt.id)));
    }, [optimisticReceipts.length, receipts]);

    const displayedReceipts = useMemo(() => {
        const byId = new Map((receipts || []).map((receipt) => [receipt.id, receipt]));
        optimisticReceipts.forEach((receipt) => {
            if (!byId.has(receipt.id)) byId.set(receipt.id, receipt);
        });
        return Array.from(byId.values());
    }, [optimisticReceipts, receipts]);

    useEffect(() => {
        if (!importPayload) return;
        if (!activeAreaCode) {
            setImportMessage('Fiş aktarımı hazır. Kaydetmek için önce veri alanı seçilmeli.');
            return;
        }
        const validation = validateReceiptPayload(importPayload);
        if (!validation.valid) {
            setImportMessage(validation.errors.join(' '));
            setFailedImport({
                message: validation.errors.join(' '),
                decodedText: JSON.stringify(importPayload, null, 2),
                rawData: '',
            });
            return;
        }
        const importKey = `${activeAreaCode}|${buildReceiptImportId(importPayload)}`;
        if (processedImportKeysRef.current.has(importKey)) return;
        processedImportKeysRef.current.add(importKey);

        let cancelled = false;
        setFailedImport(null);
        setImportMessage('Fiş aktarılıyor...');

        actionsRef.current.importReceipt(importPayload)
            .then((result) => {
                if (cancelled) return;
                setActiveStatus(result.receipt?.status || RECEIPT_STATUSES.PENDING);
                setSelectedId(result.id);
                setOptimisticReceipts((current) => {
                    const next = current.filter((receipt) => receipt.id !== result.id);
                    return [{ ...result.receipt, id: result.id }, ...next];
                });
                setImportMessage(result.existing ? 'Bu fiş daha önce aktarılmış; mevcut kayıt açıldı.' : 'Fiş Onay Bekleyen listesine aktarıldı.');
                onImportHandledRef.current?.();
            })
            .catch((error) => {
                if (cancelled) return;
                processedImportKeysRef.current.delete(importKey);
                setFailedImport({
                    message: error?.message || 'Fiş aktarılamadı.',
                    decodedText: JSON.stringify(importPayload, null, 2),
                    rawData: '',
                });
                setManualJson(JSON.stringify(importPayload, null, 2));
                setManualOpen(true);
                setImportMessage(error?.message || 'Fiş aktarılamadı.');
            });

        return () => {
            cancelled = true;
        };
    }, [activeAreaCode, importPayload]);

    useEffect(() => {
        if (!importError) return;
        const decodedText = importError.__receiptImportDecodedText || '';
        setFailedImport({
            message: importError.__receiptImportError,
            cause: importError.__receiptImportCause,
            rawData: importError.__receiptImportRawData || '',
            decodedText,
        });
        setManualJson(decodedText);
        setImportMessage(importError.__receiptImportError);
    }, [importError]);

    useEffect(() => {
        if (selectedId && displayedReceipts.some((receipt) => receipt.id === selectedId)) return;
        const first = displayedReceipts.find((receipt) => receipt.status === activeStatus);
        setSelectedId(first?.id || '');
    }, [activeStatus, displayedReceipts, selectedId]);

    const byStatus = displayedReceipts.filter((receipt) => receipt.status === activeStatus);
    const selectedReceipt = displayedReceipts.find((receipt) => receipt.id === selectedId) || null;
    const approvedThisMonth = displayedReceipts.filter((receipt) => {
        if (receipt.status !== RECEIPT_STATUSES.APPROVED) return false;
        const date = toDateSafe(receipt.approvedAt || receipt.date);
        const now = new Date();
        return date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    const pending = displayedReceipts.filter((receipt) => receipt.status === RECEIPT_STATUSES.PENDING);
    const warningCount = displayedReceipts.filter(hasReceiptWarning).length;
    const transactionById = new Map((transactions || []).map((transaction) => [transaction.id, transaction]));
    const selectedTransaction = selectedReceipt?.approvedTransactionId
        ? transactionById.get(selectedReceipt.approvedTransactionId)
        : null;

    const handleManualImport = async (event) => {
        event.preventDefault();
        let payload;
        try {
            payload = JSON.parse(manualJson);
        } catch (error) {
            setFailedImport({
                message: 'JSON okunamadı. Metin eksik, kesilmiş veya geçersiz olabilir.',
                cause: error?.message || '',
                decodedText: manualJson,
                rawData: failedImport?.rawData || '',
            });
            setImportMessage('JSON okunamadı. Metin eksik, kesilmiş veya geçersiz olabilir.');
            return;
        }

        const validation = validateReceiptPayload(payload);
        if (!validation.valid) {
            setImportMessage(validation.errors.join(' '));
            setFailedImport({
                message: validation.errors.join(' '),
                decodedText: manualJson,
                rawData: failedImport?.rawData || '',
            });
            return;
        }
        setFailedImport(null);
        if (!activeAreaCode) {
            setImportMessage('Manuel fişi aktarmadan önce veri alanı seçmelisin.');
            return;
        }
        try {
            const result = await actions.importReceipt({ ...payload, source: payload.source || 'manual_paste' });
            setManualJson('');
            setActiveStatus(result.receipt?.status || RECEIPT_STATUSES.PENDING);
            setSelectedId(result.id);
            setOptimisticReceipts((current) => {
                const next = current.filter((receipt) => receipt.id !== result.id);
                return [{ ...result.receipt, id: result.id }, ...next];
            });
            setImportMessage(result.existing ? 'Bu fiş daha önce aktarılmış; mevcut kayıt açıldı.' : 'Fiş Onay Bekleyen listesine aktarıldı.');
        } catch (error) {
            setFailedImport({
                message: error?.message || 'Fiş aktarılamadı.',
                decodedText: manualJson,
                rawData: failedImport?.rawData || '',
            });
            setImportMessage(error?.message || 'Fiş aktarılamadı.');
        }
    };

    const cancelPendingImport = () => {
        setFailedImport(null);
        setManualJson('');
        setImportMessage('Fiş aktarımı iptal edildi.');
        onImportHandledRef.current?.();
    };

    return (
        <div className="receipts-page">
            <div className="receipts-stats">
                <StatCard title="Bekleyen Fişler" value={formatMoney(pending.reduce((sum, receipt) => sum + (parseFloat(receipt.total) || 0), 0))} description={`${pending.length} fiş`} icon={ReceiptText} tone="warning" />
                <StatCard title="Bu Ay Onaylanan" value={formatMoney(approvedThisMonth.reduce((sum, receipt) => sum + (parseFloat(receipt.total) || 0), 0))} description={`${approvedThisMonth.length} fiş`} icon={CheckCircle2} tone="success" />
                <StatCard title="Uyarılı Kayıt" value={String(warningCount)} description="Mükerrerlik veya veri uyarısı" icon={AlertTriangle} tone={warningCount > 0 ? 'danger' : 'neutral'} />
            </div>

            <PremiumCard className="receipts-import-card" hover={false}>
                <button type="button" className="receipts-manual-toggle" onClick={() => setManualOpen((open) => !open)}>
                    <FileJson size={16} /> Manuel JSON Aktar <ChevronDown size={16} className={manualOpen ? 'is-open' : ''} />
                </button>
                {manualOpen && (
                    <>
                        <SectionHeader title="Manuel JSON Aktar" description="URL çok uzunsa kestirme çıktısını buraya yapıştır." />
                        <form onSubmit={handleManualImport}>
                            <textarea value={manualJson} onChange={(event) => setManualJson(event.target.value)} placeholder='{"merchant":"Market","date":"2026-10-12","total":90.2,"currency":"TRY","category":"Market","items":[]}' />
                            <button type="submit"><FileJson size={16} /> İçe Aktar</button>
                        </form>
                    </>
                )}
                {failedImport && (
                    <div className="receipts-import-error">
                        <strong>{failedImport.message}</strong>
                        {failedImport.cause && <small>{failedImport.cause}</small>}
                        {failedImport.rawData && (
                            <details>
                                <summary>Ham aktarım verisini göster</summary>
                                <textarea readOnly value={failedImport.rawData} />
                            </details>
                        )}
                        <button type="button" onClick={cancelPendingImport}>Aktarımı Temizle</button>
                    </div>
                )}
                {importMessage && <p className="receipts-import-message">{importMessage}</p>}
            </PremiumCard>

            <div className="receipts-tabs">
                {statusTabs.map(({ id, label, icon }) => (
                    <button key={id} type="button" className={activeStatus === id ? 'is-active' : ''} onClick={() => setActiveStatus(id)}>
                        {React.createElement(icon, { size: 16 })} {label}
                    </button>
                ))}
            </div>

            <div className="receipts-workspace">
                <PremiumCard className="receipts-list-card" hover={false}>
                    {byStatus.length === 0 && <EmptyState title="Fiş bulunamadı" description="Bu durumda kayıt yok." icon={ReceiptText} />}
                    {byStatus.map((receipt) => (
                        <button
                            key={receipt.id}
                            type="button"
                            className={`receipts-row ${selectedId === receipt.id ? 'is-active' : ''}`}
                            onClick={() => setSelectedId(receipt.id)}
                        >
                            <IconTile icon={ReceiptText} tone={getStatusTone(receipt.status)} />
                            <span>
                                <strong>{receipt.merchant || 'Mağaza yok'}</strong>
                                <small>{receipt.category || 'Kategori yok'} · {tarihFormatla(receipt.date)}</small>
                            </span>
                            {hasReceiptWarning(receipt) && <AlertTriangle size={16} className="receipts-row-warning" />}
                            <b>{formatMoney(receipt.total)}</b>
                        </button>
                    ))}
                </PremiumCard>

                <ReceiptDetail
                    receipt={selectedReceipt}
                    accounts={accounts}
                    categories={sortedCategories}
                    transaction={selectedTransaction}
                    onSave={actions.updateReceipt}
                    onApprove={actions.approveReceipt}
                    onReject={actions.rejectReceipt}
                />
            </div>
        </div>
    );
};

export default ReceiptsDashboard;

