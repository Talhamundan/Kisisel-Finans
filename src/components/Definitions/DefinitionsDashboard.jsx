import React, { useMemo, useState } from 'react';
import { arrayUnion, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, CalendarClock, Ellipsis, Link2, ReceiptText, Repeat2, Trash2, WalletCards } from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { db } from '../../firebase';
import PremiumDonutChart from '../Shared/PremiumDonutChart';
import { EmptyState, PremiumCard, SectionHeader, StatusBadge } from '../Shared/PremiumUI';
import {
    DEFINITION_STATUS,
    formatDefinitionDate,
    formatDefinitionMoney,
    getAllInstallmentStatuses,
    getBillDefinitionStatus,
    getInstallmentStatus,
    getSubscriptionHistoryRows,
    statusLabels,
    statusTones,
    sumMatchedPayments,
    summarizeDefinitionsOverview,
} from '../../utils/definitions';

const tabs = [
    { id: 'overview', label: 'Varlıklar' },
    { id: 'subscriptions', label: 'Sabit Giderler' },
    { id: 'bills', label: 'Faturalar' },
    { id: 'installments', label: 'Taksitler' },
];

const getAccountName = (accounts, id) => (
    (accounts || []).find((account) => account.id === id)?.hesapAdi || 'Hesap yok'
);

const confirmDefinitionDelete = async ({ collectionName, id, title }) => {
    const result = await Swal.fire({
        title: 'Tanım silinsin mi?',
        text: `${title || 'Bu tanım'} silinecek. Geçmiş finansal hareketler korunacaktır.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Sil',
        cancelButtonText: 'Vazgeç',
    });
    if (!result.isConfirmed) return false;
    await deleteDoc(doc(db, collectionName, id));
    toast.info('Tanım silindi. Geçmiş hareketler korundu.');
    return true;
};

const RowShell = ({ children, onClick }) => (
    <div className="definitions-row" onClick={onClick} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onClick?.(); }}>
        {children}
    </div>
);

const Actions = ({ onEdit, onPassive, onDelete }) => (
    <div className="definitions-actions">
        <button type="button" onClick={onEdit}>Düzenle</button>
        <button type="button" onClick={onPassive}>Pasife Al</button>
        <button type="button" className="is-danger" onClick={onDelete}><Trash2 size={14} /> Sil</button>
    </div>
);

const GroupedValueList = ({ title, items = [], emptyTitle, hidden = false }) => {
    const groups = items.reduce((map, item) => {
        if (!map.has(item.group)) map.set(item.group, []);
        map.get(item.group).push(item);
        return map;
    }, new Map());

    return (
        <div className="definitions-value-list">
            <h3>{title}</h3>
            {[...groups.entries()].map(([group, groupItems]) => (
                <div key={group} className="definitions-value-group">
                    <span>{group}</span>
                    {groupItems.map((item) => (
                        <div key={item.id} className="definitions-value-row">
                            <p><strong>{item.label}</strong><small>{item.meta}</small></p>
                            <b>{formatDefinitionMoney(item.value, hidden)}</b>
                        </div>
                    ))}
                </div>
            ))}
            {items.length === 0 && <EmptyState title={emptyTitle} />}
        </div>
    );
};

const PaymentSummaryFooter = ({ label = 'Toplam Ödenen', summary }) => (
    <div className="definitions-summary-footer">
        <span><strong>{label}</strong><small>{summary.count} ödeme</small></span>
        <b>{formatDefinitionMoney(summary.total)}</b>
    </div>
);

const InstallmentSummaryFooter = ({ status }) => (
    <div className="definitions-summary-footer definitions-summary-footer--stack">
        <span><strong>Toplam Planlanan</strong><small>{formatDefinitionMoney(status.total)}</small></span>
        <span><strong>Toplam Ödenen</strong><small>{formatDefinitionMoney(status.paidAmount)}</small></span>
        <span><strong>Kalan</strong><small>{formatDefinitionMoney(status.remainingAmount)}</small></span>
    </div>
);

const Overview = ({ data, gizliMod }) => {
    const summary = useMemo(() => summarizeDefinitionsOverview({
        accounts: data.hesaplar,
        portfolio: data.portfoy,
        debts: data.borclar,
        financings: data.finansmanlar,
        installments: data.taksitler,
        transactions: data.islemler,
        besData: data.besVerisi,
    }), [data]);

    const assetChart = [
        { name: 'Nakit / Vadesiz', value: summary.assets.cash, color: '#38bdf8' },
        { name: 'Yatırım Hesapları', value: summary.assets.investmentAccounts + summary.assets.portfolioValue, color: '#8b5cf6' },
        { name: 'Diğer Varlıklar', value: summary.assets.besValue, color: '#22c55e' },
    ];
    const debtChart = [
        { name: 'Kredi Kartları', value: summary.debts.creditCards, color: '#f97316' },
        { name: 'Finansmanlar', value: summary.debts.financings, color: '#ef4444' },
        { name: 'Diğer Borçlar', value: summary.debts.manualDebt + summary.debts.installmentDebt, color: '#64748b' },
    ];

    return (
        <div className="definitions-overview">
            <div className="definitions-metrics">
                <PremiumCard><span>Toplam Varlık</span><strong>{formatDefinitionMoney(summary.assets.total, gizliMod)}</strong></PremiumCard>
                <PremiumCard><span>Toplam Borç</span><strong className="is-danger">{formatDefinitionMoney(summary.debts.total, gizliMod)}</strong></PremiumCard>
                <PremiumCard><span>Net Varlık</span><strong className={summary.netWorth >= 0 ? 'is-success' : 'is-danger'}>{formatDefinitionMoney(summary.netWorth, gizliMod)}</strong></PremiumCard>
            </div>
            <div className="definitions-chart-grid">
                <PremiumCard hover={false}>
                    <SectionHeader title="Varlık Dağılımı" />
                    <PremiumDonutChart data={assetChart} centerValue={formatDefinitionMoney(summary.assets.total, gizliMod)} centerLabel="Varlık" height={190} innerRadius={54} outerRadius={76} />
                </PremiumCard>
                <PremiumCard hover={false}>
                    <SectionHeader title="Borç Dağılımı" />
                    <PremiumDonutChart data={debtChart} centerValue={formatDefinitionMoney(summary.debts.total, gizliMod)} centerLabel="Borç" height={190} innerRadius={54} outerRadius={76} />
                </PremiumCard>
            </div>
            <div className="definitions-ledger-grid">
                <PremiumCard hover={false}>
                    <GroupedValueList title="Hesaplar" items={summary.assets.items} emptyTitle="Varlık hesabı yok" hidden={gizliMod} />
                </PremiumCard>
                <PremiumCard hover={false}>
                    <GroupedValueList title="Borçlar" items={summary.debts.items} emptyTitle="Borç kalemi yok" hidden={gizliMod} />
                </PremiumCard>
            </div>
        </div>
    );
};

const SubscriptionList = ({ data, navigateTo, modalAc }) => (
    <PremiumCard className="definitions-panel">
        <SectionHeader title="Sabit Giderler" description={`${(data.abonelikler || []).length} tanım`} />
        <div className="definitions-list">
            {(data.abonelikler || []).map((item) => (
                <RowShell key={item.id} onClick={() => navigateTo(`/tanimlamalar/sabit-giderler/${item.id}`)}>
                    <Repeat2 size={18} />
                    <span><strong>{item.ad || 'Sabit gider'}</strong><small>{item.kategori || 'Kategori yok'} · Her ayın {item.gun || '-'} günü</small></span>
                    <b>{formatDefinitionMoney(item.tutar)}</b>
                    <StatusBadge tone={item.aktif === false ? 'neutral' : 'info'}>{item.aktif === false ? 'Pasif' : 'Aktif'}</StatusBadge>
                    <button type="button" className="definitions-row-menu" onClick={(event) => { event.stopPropagation(); modalAc('duzenle_abonelik', item); }}><Ellipsis size={16} /></button>
                </RowShell>
            ))}
            {(data.abonelikler || []).length === 0 && <EmptyState title="Sabit gider yok" icon={Repeat2} />}
        </div>
    </PremiumCard>
);

const BillList = ({ data, navigateTo }) => {
    const rows = (data.tanimliFaturalar || []).map((definition) => getBillDefinitionStatus(definition, {
        pendingBills: data.bekleyenFaturalar,
        transactions: data.islemler,
        monthCount: 6,
    }));

    return (
        <PremiumCard className="definitions-panel">
            <SectionHeader title="Faturalar" description={`${rows.length} tanım`} />
            <div className="definitions-list">
                {rows.map(({ definition, current, lastPayment }) => (
                    <RowShell key={definition.id} onClick={() => navigateTo(`/tanimlamalar/faturalar/${definition.id}`)}>
                        <ReceiptText size={18} />
                        <span><strong>{definition.baslik || definition.kurum || 'Fatura'}</strong><small>{formatDefinitionDate(current?.dueDate, { withYear: false })} · Son ödeme {lastPayment ? formatDefinitionDate(lastPayment.tarih) : 'yok'}</small></span>
                        <b>{current?.expectedAmount ? formatDefinitionMoney(current.expectedAmount) : '-'}</b>
                        <StatusBadge tone={statusTones[current?.status]}>{statusLabels[current?.status]}</StatusBadge>
                    </RowShell>
                ))}
                {rows.length === 0 && <EmptyState title="Fatura tanımı yok" icon={ReceiptText} />}
            </div>
        </PremiumCard>
    );
};

const InstallmentList = ({ data, navigateTo }) => {
    const [filter, setFilter] = useState('active');
    const rows = getAllInstallmentStatuses(data.taksitler, data.islemler);
    const filteredRows = rows.filter((row) => {
        if (filter === 'completed') return row.status === DEFINITION_STATUS.COMPLETED;
        if (filter === 'active') return row.status !== DEFINITION_STATUS.COMPLETED;
        return true;
    });

    return (
        <PremiumCard className="definitions-panel">
            <SectionHeader title="Taksitler" description={`${filteredRows.length} plan`} />
            <div className="definitions-tabs definitions-tabs--small">
                <button type="button" className={filter === 'active' ? 'is-active' : ''} onClick={() => setFilter('active')}>Aktif</button>
                <button type="button" className={filter === 'completed' ? 'is-active' : ''} onClick={() => setFilter('completed')}>Tamamlananlar</button>
                <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Tümü</button>
            </div>
            <div className="definitions-list">
                {filteredRows.map((row) => (
                    <RowShell key={row.installment.id} onClick={() => navigateTo(`/tanimlamalar/taksitler/${row.installment.id}`)}>
                        <CalendarClock size={18} />
                        <span>
                            <strong>{row.installment.baslik || 'Taksit'}</strong>
                            <small>{row.paidCount} / {row.count} ödendi · Kalan {formatDefinitionMoney(row.remainingAmount)}{row.installment.reconstructed ? ' · geçmişten' : ''}</small>
                            <i style={{ '--progress': `${row.progress}%` }} />
                        </span>
                        <b>{row.nextPayment ? formatDefinitionMoney(row.nextPayment.plannedAmount) : formatDefinitionMoney(0)}</b>
                        <StatusBadge tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusBadge>
                    </RowShell>
                ))}
                {filteredRows.length === 0 && <EmptyState title="Taksit planı yok" icon={CalendarClock} />}
            </div>
        </PremiumCard>
    );
};

const BillDetail = ({ bill, data, navigateTo, modalAc }) => {
    const status = getBillDefinitionStatus(bill, { pendingBills: data.bekleyenFaturalar, transactions: data.islemler, monthCount: 12 });
    const current = status.current;
    const paidSummary = sumMatchedPayments(status.history);
    const [linkTransactionId, setLinkTransactionId] = useState('');
    const candidateTransactions = (data.islemler || []).filter((transaction) => transaction.islemTipi === 'gider' && !transaction.billDefinitionId && !transaction.faturaTanimId).slice(0, 30);
    const linkTransaction = async () => {
        if (!linkTransactionId) return;
        const transaction = candidateTransactions.find((item) => item.id === linkTransactionId);
        await updateDoc(doc(db, 'fatura_tanimlari', bill.id), {
            billLinks: arrayUnion({ transactionId: linkTransactionId, periodKey: transaction?.tarih ? `${new Date(transaction.tarih.seconds ? transaction.tarih.seconds * 1000 : transaction.tarih).getFullYear()}-${String(new Date(transaction.tarih.seconds ? transaction.tarih.seconds * 1000 : transaction.tarih).getMonth() + 1).padStart(2, '0')}` : '', linkedAt: new Date() }),
        });
        toast.success('Geçmiş işlem faturaya bağlandı.');
        setLinkTransactionId('');
    };

    return (
        <div className="definitions-detail">
            <button type="button" className="definitions-back" onClick={() => navigateTo('/tanimlamalar/faturalar')}><ArrowLeft size={16} /> Faturalara dön</button>
            <PremiumCard className="definitions-detail-hero">
                <div>
                    <span>Fatura</span>
                    <h2>{bill.baslik || bill.kurum || 'Fatura'}</h2>
                    <p>{bill.kategori || 'Fatura'} · {getAccountName(data.hesaplar, bill.hesapId)} · Beklenen gün {bill.beklenenOdemeGunu || bill.odemeGunu || bill.gun || '-'}</p>
                </div>
                <StatusBadge tone={bill.aktif === false ? 'neutral' : 'info'}>{bill.aktif === false ? 'Pasif' : 'Aktif'}</StatusBadge>
            </PremiumCard>
            <div className="definitions-detail-grid">
                <PremiumCard hover={false}>
                    <SectionHeader title="Bu Dönem" />
                    <div className="definitions-kv">
                        <span>Beklenen ödeme <b>{formatDefinitionMoney(current?.expectedAmount || 0)}</b></span>
                        <span>Son ödeme tarihi <b>{formatDefinitionDate(current?.dueDate, { withYear: false })}</b></span>
                        <span>Durum <StatusBadge tone={statusTones[current?.status]}>{statusLabels[current?.status]}</StatusBadge></span>
                        {current?.transaction && <span>Ödenen <b>{formatDefinitionMoney(current.paidAmount)}</b></span>}
                        {current?.paidDate && <span>Ödeme tarihi <b>{formatDefinitionDate(current.paidDate)}</b></span>}
                        {current?.accountId && <span>Ödeme hesabı <b>{getAccountName(data.hesaplar, current.accountId)}</b></span>}
                    </div>
                </PremiumCard>
                <PremiumCard hover={false}>
                    <SectionHeader title="İşlemler" />
                    <Actions
                        onEdit={() => modalAc('duzenle_fatura_tanim', bill)}
                        onPassive={() => updateDoc(doc(db, 'fatura_tanimlari', bill.id), { aktif: false })}
                        onDelete={() => confirmDefinitionDelete({ collectionName: 'fatura_tanimlari', id: bill.id, title: bill.baslik })}
                    />
                </PremiumCard>
            </div>
            <PremiumCard className="definitions-panel">
                <SectionHeader title="Fatura Ödeme Geçmişi" />
                <div className="definitions-table">
                    {status.history.map((row) => (
                        <div key={row.id}>
                            <span>{row.periodLabel}</span>
                            <b>{formatDefinitionMoney(row.paidAmount || row.expectedAmount)}</b>
                            <span>{row.paidDate ? formatDefinitionDate(row.paidDate) : '-'}</span>
                            <span>{getAccountName(data.hesaplar, row.accountId)}</span>
                            <StatusBadge tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusBadge>
                        </div>
                    ))}
                </div>
                <PaymentSummaryFooter summary={paidSummary} />
            </PremiumCard>
            <PremiumCard className="definitions-panel">
                <SectionHeader title="Geçmiş İşlem Bağla" />
                <div className="definitions-linker">
                    <select value={linkTransactionId} onChange={(event) => setLinkTransactionId(event.target.value)}>
                        <option value="">Hareket seç</option>
                        {candidateTransactions.map((transaction) => (
                            <option key={transaction.id} value={transaction.id}>{formatDefinitionDate(transaction.tarih)} · {transaction.aciklama || transaction.kategori} · {formatDefinitionMoney(transaction.tutar)}</option>
                        ))}
                    </select>
                    <button type="button" onClick={linkTransaction}><Link2 size={15} /> Bağla</button>
                </div>
            </PremiumCard>
        </div>
    );
};

const InstallmentDetail = ({ installment, data, navigateTo, modalAc }) => {
    const status = getInstallmentStatus(installment, data.islemler);
    return (
        <div className="definitions-detail">
            <button type="button" className="definitions-back" onClick={() => navigateTo('/tanimlamalar/taksitler')}><ArrowLeft size={16} /> Taksitlere dön</button>
            <PremiumCard className="definitions-detail-hero">
                <div>
                    <span>Taksit</span>
                    <h2>{installment.baslik || 'Taksit'}</h2>
                    <p>{installment.kategori || 'Kategori yok'} · {getAccountName(data.hesaplar, installment.hesapId)} · Başlangıç {formatDefinitionDate(installment.alisTarihi || installment.olusturmaTarihi)}</p>
                </div>
                <StatusBadge tone={statusTones[status.status]}>{statusLabels[status.status]}</StatusBadge>
            </PremiumCard>
            <div className="definitions-metrics">
                <PremiumCard><span>{status.paidCount} / {status.count} ödendi</span><strong>{formatDefinitionMoney(status.paidAmount)}</strong></PremiumCard>
                <PremiumCard><span>Toplam</span><strong>{formatDefinitionMoney(status.total)}</strong></PremiumCard>
                <PremiumCard><span>Kalan</span><strong className="is-danger">{formatDefinitionMoney(status.remainingAmount)}</strong></PremiumCard>
                <PremiumCard><span>Sonraki</span><strong>{status.nextPayment ? formatDefinitionDate(status.nextPayment.dueDate, { withYear: false }) : '-'}</strong></PremiumCard>
            </div>
            <PremiumCard className="definitions-panel">
                <SectionHeader title="Taksit Planı" />
                <div className="definitions-table definitions-table--installments">
                    {status.rows.map((row) => (
                        <div key={row.id}>
                            <span>{row.installmentNumber}. taksit</span>
                            <span>{formatDefinitionDate(row.dueDate)}</span>
                            <b>{formatDefinitionMoney(row.plannedAmount)}</b>
                            <StatusBadge tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusBadge>
                        </div>
                    ))}
                </div>
                <InstallmentSummaryFooter status={status} />
            </PremiumCard>
            {!installment.reconstructed && (
                <PremiumCard hover={false}>
                    <SectionHeader title="İşlemler" />
                    <Actions
                        onEdit={() => modalAc('duzenle_taksit', installment)}
                        onPassive={() => updateDoc(doc(db, 'taksitler', installment.id), { aktif: false })}
                        onDelete={() => confirmDefinitionDelete({ collectionName: 'taksitler', id: installment.id, title: installment.baslik })}
                    />
                </PremiumCard>
            )}
        </div>
    );
};

const SubscriptionDetail = ({ subscription, data, navigateTo, modalAc }) => {
    const historyRows = getSubscriptionHistoryRows(subscription, { transactions: data.islemler, monthCount: 12 });
    const paidSummary = sumMatchedPayments(historyRows);
    return (
        <div className="definitions-detail">
            <button type="button" className="definitions-back" onClick={() => navigateTo('/tanimlamalar/sabit-giderler')}><ArrowLeft size={16} /> Sabit giderlere dön</button>
            <PremiumCard className="definitions-detail-hero">
                <div>
                    <span>Sabit Gider</span>
                    <h2>{subscription.ad || 'Sabit gider'}</h2>
                    <p>{subscription.kategori || 'Kategori yok'} · {getAccountName(data.hesaplar, subscription.hesapId)} · Her ayın {subscription.gun || '-'} günü</p>
                </div>
                <strong>{formatDefinitionMoney(subscription.tutar)}</strong>
            </PremiumCard>
            <PremiumCard className="definitions-panel">
                <SectionHeader title="Ödeme Geçmişi" />
                <div className="definitions-table">
                    {historyRows.map((row) => (
                        <div key={row.id}>
                            <span>{row.periodLabel}</span>
                            <b>{formatDefinitionMoney(row.paidAmount || row.expectedAmount)}</b>
                            <span>{row.paidDate ? formatDefinitionDate(row.paidDate) : formatDefinitionDate(row.dueDate)}</span>
                            <span>{getAccountName(data.hesaplar, row.accountId)}</span>
                            <StatusBadge tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusBadge>
                        </div>
                    ))}
                    {historyRows.length === 0 && <EmptyState title="Bağlı ödeme bulunamadı" icon={WalletCards} />}
                </div>
                <PaymentSummaryFooter summary={paidSummary} />
            </PremiumCard>
            <PremiumCard hover={false}>
                <SectionHeader title="İşlemler" />
                <Actions
                    onEdit={() => modalAc('duzenle_abonelik', subscription)}
                    onPassive={() => updateDoc(doc(db, 'abonelikler', subscription.id), { aktif: false })}
                    onDelete={() => confirmDefinitionDelete({ collectionName: 'abonelikler', id: subscription.id, title: subscription.ad })}
                />
            </PremiumCard>
        </div>
    );
};

const DefinitionsDashboard = ({ data, gizliMod, routePath, navigateTo, modalAc }) => {
    const billId = routePath.match(/^\/tanimlamalar\/faturalar\/([^/]+)/)?.[1];
    const installmentId = routePath.match(/^\/tanimlamalar\/taksitler\/([^/]+)/)?.[1];
    const subscriptionId = routePath.match(/^\/tanimlamalar\/sabit-giderler\/([^/]+)/)?.[1];
    const activeTab = routePath.startsWith('/tanimlamalar/faturalar') ? 'bills'
        : routePath.startsWith('/tanimlamalar/taksitler') ? 'installments'
            : routePath.startsWith('/tanimlamalar/sabit-giderler') ? 'subscriptions'
                : 'overview';
    const bill = (data.tanimliFaturalar || []).find((item) => item.id === billId);
    const installment = getAllInstallmentStatuses(data.taksitler, data.islemler).find((item) => item.installment.id === installmentId)?.installment;
    const subscription = (data.abonelikler || []).find((item) => item.id === subscriptionId);

    if (billId && bill) return <BillDetail bill={bill} data={data} navigateTo={navigateTo} modalAc={modalAc} />;
    if (installmentId && installment) return <InstallmentDetail installment={installment} data={data} navigateTo={navigateTo} modalAc={modalAc} />;
    if (subscriptionId && subscription) return <SubscriptionDetail subscription={subscription} data={data} navigateTo={navigateTo} modalAc={modalAc} />;

    return (
        <div className="definitions-page">
            <div className="definitions-tabs">
                {tabs.map((tab) => (
                    <button key={tab.id} type="button" className={activeTab === tab.id ? 'is-active' : ''} onClick={() => navigateTo(tab.id === 'overview' ? '/tanimlamalar' : `/tanimlamalar/${tab.id === 'subscriptions' ? 'sabit-giderler' : tab.id === 'bills' ? 'faturalar' : 'taksitler'}`)}>
                        {tab.label}
                    </button>
                ))}
            </div>
            {activeTab === 'overview' && <Overview data={data} gizliMod={gizliMod} />}
            {activeTab === 'subscriptions' && <SubscriptionList data={data} navigateTo={navigateTo} modalAc={modalAc} />}
            {activeTab === 'bills' && <BillList data={data} navigateTo={navigateTo} />}
            {activeTab === 'installments' && <InstallmentList data={data} navigateTo={navigateTo} />}
        </div>
    );
};

export default DefinitionsDashboard;
