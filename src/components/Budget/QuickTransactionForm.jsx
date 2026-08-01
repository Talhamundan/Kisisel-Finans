import React, { useEffect, useMemo, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { inputStyle, formatCurrencyPlain, sortTurkishText } from '../../utils/helpers';
import { MONTH_NAMES } from '../../utils/period';
import { getCreditCardPaymentAmountOptions, isCreditCardPaymentSourceAccount } from '../../utils/creditCardPayments';
import DescriptionInput from '../Shared/DescriptionInput';
import { EmptyState, StatusBadge } from '../Shared/PremiumUI';

const salaryPaymentTypes = ["Maaş Ödemesi", "Maaş Avansı", "Maaş Farkı", "Ek Maaş"];
const incomeTypes = [...salaryPaymentTypes, "Prim / İkramiye", "Masraf İadesi", "Diğer Gelir"];

const toLocalDateTimeValue = (date = new Date()) => {
    const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 16);
};

const toLocalDateValue = (date = new Date()) => {
    const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 10);
};

const getSalaryPeriodOptions = (dateValue = new Date()) => {
    const date = dateValue ? new Date(dateValue) : new Date();
    const base = Number.isNaN(date.getTime()) ? new Date() : date;
    return [-1, 0, 1, 2].map((offset) => {
        const optionDate = new Date(base.getFullYear(), base.getMonth() + offset, 1);
        const value = `${optionDate.getFullYear()}-${String(optionDate.getMonth() + 1).padStart(2, '0')}`;
        return { value, label: `${MONTH_NAMES[optionDate.getMonth()]} ${optionDate.getFullYear()} Maaş Dönemi` };
    });
};

const FieldError = ({ children }) => children ? <span className="qw-field-error">{children}</span> : null;

const QuickTransactionForm = ({
    formTab,
    setFormTab,
    hesaplar = [],
    kategoriListesi = [],
    defaultPaymentAccountId = '',
    maaslar = [],
    tanimliFaturalar = [],
    tumIslemler = [],
    islemEkle,
    transferYap,
    taksitEkle,
    faturaGir,
    secilenHesapId,
    setSecilenHesapId,
    islemTipi,
    setIslemTipi,
    islemGelirTuru,
    setIslemGelirTuru,
    islemBagliMaasId,
    setIslemBagliMaasId,
    islemMaasDonemi,
    setIslemMaasDonemi,
    kategori,
    setKategori,
    islemAciklama,
    setIslemAciklama,
    islemTutar,
    setIslemTutar,
    islemTarihi,
    setIslemTarihi,
    transferKaynakId,
    setTransferKaynakId,
    transferHedefId,
    setTransferHedefId,
    transferTutar,
    setTransferTutar,
    transferUcreti,
    setTransferUcreti,
    transferAciklama,
    setTransferAciklama,
    transferTarihi,
    setTransferTarihi,
    taksitBaslik,
    setTaksitBaslik,
    taksitHesapId,
    setTaksitHesapId,
    taksitToplamTutar,
    setTaksitToplamTutar,
    taksitSayisi,
    setTaksitSayisi,
    taksitKategori,
    setTaksitKategori,
    taksitAlisTarihi,
    setTaksitAlisTarihi,
    secilenTanimId,
    setSecilenTanimId,
    faturaGirisTutar,
    setFaturaGirisTutar,
    faturaGirisTarih,
    setFaturaGirisTarih,
    faturaGirisAciklama,
    setFaturaGirisAciklama,
    onSuccess,
}) => {
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [showMore, setShowMore] = useState(false);
    const [useFullTransferBalance, setUseFullTransferBalance] = useState(false);
    const activeTab = formTab || 'islem';
    const siraliKategoriListesi = useMemo(() => sortTurkishText(kategoriListesi || []), [kategoriListesi]);
    const siraliHesaplar = useMemo(() => [...(hesaplar || [])].sort((a, b) =>
        String(a?.hesapAdi || '').localeCompare(String(b?.hesapAdi || ''), 'tr-TR', { sensitivity: 'base' })
    ), [hesaplar]);
    const accountIds = useMemo(() => new Set((hesaplar || []).map((account) => account.id)), [hesaplar]);
    const selectedTransferSource = useMemo(
        () => (hesaplar || []).find((account) => account.id === transferKaynakId),
        [hesaplar, transferKaynakId],
    );
    const selectedTransferTarget = useMemo(
        () => (hesaplar || []).find((account) => account.id === transferHedefId),
        [hesaplar, transferHedefId],
    );
    const transferTargets = siraliHesaplar;
    const isTransferToCreditCard = selectedTransferTarget?.hesapTipi === 'krediKarti';
    const transferSources = isTransferToCreditCard
        ? siraliHesaplar.filter(isCreditCardPaymentSourceAccount)
        : siraliHesaplar;
    const creditCardTransferAmounts = isTransferToCreditCard
        ? getCreditCardPaymentAmountOptions(selectedTransferTarget)
        : null;
    const fullTransferBalance = Math.max(0, parseFloat(selectedTransferSource?.guncelBakiye) || 0);
    const transferFeeAmount = Math.max(0, parseFloat(transferUcreti) || 0);
    const fullTransferAmount = Math.max(0, fullTransferBalance - transferFeeAmount);
    const quickSalaryPeriodOptions = getSalaryPeriodOptions(islemTarihi || new Date());
    const quickNeedsSalaryLink = islemTipi === 'gelir' && salaryPaymentTypes.includes(islemGelirTuru);

    useEffect(() => {
        if (!formTab) setFormTab?.('islem');
        if (!islemTipi) setIslemTipi?.('gider');
        if (!islemTarihi) setIslemTarihi?.(toLocalDateTimeValue());
        if (!transferTarihi) setTransferTarihi?.(toLocalDateTimeValue());
        if (!taksitAlisTarihi) setTaksitAlisTarihi?.(toLocalDateValue());
        if (!faturaGirisTarih) setFaturaGirisTarih?.(toLocalDateValue());
    }, [
        formTab,
        faturaGirisTarih,
        islemTarihi,
        islemTipi,
        setFaturaGirisTarih,
        setFormTab,
        setIslemTarihi,
        setIslemTipi,
        setTaksitAlisTarihi,
        setTransferTarihi,
        taksitAlisTarihi,
        transferTarihi,
    ]);

    useEffect(() => {
        if (secilenHesapId && !accountIds.has(secilenHesapId)) setSecilenHesapId?.('');
        if (taksitHesapId && !accountIds.has(taksitHesapId)) setTaksitHesapId?.('');
        if (transferKaynakId && !accountIds.has(transferKaynakId)) setTransferKaynakId?.('');
    }, [accountIds, secilenHesapId, setSecilenHesapId, setTaksitHesapId, setTransferKaynakId, taksitHesapId, transferKaynakId]);

    useEffect(() => {
        if (!isTransferToCreditCard || !transferKaynakId) return;
        if (!isCreditCardPaymentSourceAccount(selectedTransferSource)) setTransferKaynakId?.('');
    }, [isTransferToCreditCard, selectedTransferSource, setTransferKaynakId, transferKaynakId]);

    useEffect(() => {
        if (!defaultPaymentAccountId || !accountIds.has(defaultPaymentAccountId)) return;
        if (!secilenHesapId) setSecilenHesapId?.(defaultPaymentAccountId);
        if (!taksitHesapId) setTaksitHesapId?.(defaultPaymentAccountId);
        if (!transferKaynakId) setTransferKaynakId?.(defaultPaymentAccountId);
    }, [
        accountIds,
        defaultPaymentAccountId,
        secilenHesapId,
        setSecilenHesapId,
        setTaksitHesapId,
        setTransferKaynakId,
        taksitHesapId,
        transferKaynakId,
    ]);

    useEffect(() => {
        if (!useFullTransferBalance) return;
        setTransferTutar?.(fullTransferAmount ? String(Math.round(fullTransferAmount * 100) / 100) : '');
    }, [fullTransferAmount, setTransferTutar, useFullTransferBalance]);

    const ensureQuickSalaryPeriod = (dateValue = islemTarihi || new Date()) => {
        if (!islemMaasDonemi) {
            const options = getSalaryPeriodOptions(dateValue);
            setIslemMaasDonemi(options[1]?.value || options[0]?.value || "");
        }
    };

    const runSubmit = async (event, handler, validation = {}) => {
        event.preventDefault();
        if (submitting) return;
        setErrors(validation);
        if (Object.keys(validation).length > 0) return;
        setSubmitting(true);
        try {
            const result = await handler(event);
            if (result) onSuccess?.();
        } finally {
            setSubmitting(false);
        }
    };

    const submitLabel = submitting ? 'Kaydediliyor...' : 'Kaydet';

    return (
        <div className="qw-quick-entry-form">
            <div className="qw-form-tabs">
                {[
                    ['islem', 'İşlem'],
                    ['transfer', 'Transfer'],
                    ['taksit', 'Taksit'],
                    ['fatura', 'Fatura'],
                ].map(([id, label]) => (
                    <button key={id} type="button" className={activeTab === id ? 'is-active' : ''} onClick={() => { setFormTab?.(id); setErrors({}); }}>
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === 'islem' && (
                <form
                    onSubmit={(event) => runSubmit(event, islemEkle, {
                        ...(!secilenHesapId ? { secilenHesapId: 'Hesap seçin.' } : {}),
                        ...(!islemTutar ? { islemTutar: 'Tutar girin.' } : {}),
                        ...(quickNeedsSalaryLink && !islemBagliMaasId ? { islemBagliMaasId: 'Bağlı maaş seçin.' } : {}),
                    })}
                    className="qw-quick-form"
                >
                    <div className="qw-form-row">
                        <div>
                            <select value={secilenHesapId} onChange={e => setSecilenHesapId(e.target.value)} style={inputStyle}>
                                <option value="">Hangi hesaptan?</option>
                                {siraliHesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatCurrencyPlain(parseFloat(h.guncelBakiye) || 0)})</option>)}
                            </select>
                            <FieldError>{errors.secilenHesapId}</FieldError>
                        </div>
                        <select value={islemTipi} onChange={e => setIslemTipi(e.target.value)} style={inputStyle}>
                            <option value="gider">Gider</option>
                            <option value="gelir">Gelir</option>
                        </select>
                    </div>
                    <select value={kategori || (siraliKategoriListesi && siraliKategoriListesi[0])} onChange={e => setKategori(e.target.value)} style={inputStyle}>
                        {siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <div className="qw-form-row">
                        <DescriptionInput
                            value={islemAciklama}
                            onChange={e => setIslemAciklama(e.target.value)}
                            historyItems={tumIslemler}
                            inputStyle={inputStyle}
                            wrapperStyle={{ flex: 1 }}
                        />
                        <div>
                            <input type="number" placeholder="Tutar" value={islemTutar} onChange={e => setIslemTutar(e.target.value)} style={inputStyle} />
                            <FieldError>{errors.islemTutar}</FieldError>
                        </div>
                    </div>
                    <input
                        type="datetime-local"
                        value={islemTarihi}
                        onChange={e => {
                            setIslemTarihi(e.target.value);
                            if (quickNeedsSalaryLink && !islemMaasDonemi) ensureQuickSalaryPeriod(e.target.value);
                        }}
                        style={inputStyle}
                    />
                    {islemTipi === 'gelir' && (
                        <button type="button" className="qw-more-toggle" onClick={() => setShowMore((current) => !current)}>
                            Daha fazla seçenek
                        </button>
                    )}
                    {islemTipi === 'gelir' && showMore && (
                        <div className="qw-more-panel">
                            <select
                                value={islemGelirTuru}
                                onChange={e => {
                                    setIslemGelirTuru(e.target.value);
                                    if (salaryPaymentTypes.includes(e.target.value)) ensureQuickSalaryPeriod();
                                }}
                                style={inputStyle}
                            >
                                {incomeTypes.map(tur => <option key={tur} value={tur}>{tur}</option>)}
                            </select>
                            {quickNeedsSalaryLink && (
                                <div className="qw-form-row">
                                    <div>
                                        <select value={islemBagliMaasId} onChange={e => setIslemBagliMaasId(e.target.value)} style={inputStyle} required>
                                            <option value="">Bağlı maaş</option>
                                            {(maaslar || []).map(maas => <option key={maas.id} value={maas.id}>{maas.ad}</option>)}
                                        </select>
                                        <FieldError>{errors.islemBagliMaasId}</FieldError>
                                    </div>
                                    <select value={islemMaasDonemi || quickSalaryPeriodOptions[1]?.value || ''} onChange={e => setIslemMaasDonemi(e.target.value)} style={inputStyle} required>
                                        {quickSalaryPeriodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                    <button type="submit" className="qw-submit-button" disabled={submitting}>{submitLabel}</button>
                </form>
            )}

            {activeTab === 'transfer' && (
                <form
                    onSubmit={(event) => runSubmit(event, transferYap, {
                        ...(!transferKaynakId ? { transferKaynakId: 'Kaynak hesap seçin.' } : {}),
                        ...(!transferHedefId ? { transferHedefId: 'Hedef hesap seçin.' } : {}),
                        ...(!transferTutar ? { transferTutar: 'Tutar girin.' } : {}),
                    })}
                    className="qw-quick-form"
                >
                    <div className="qw-form-row">
                        <div>
                            <select value={transferKaynakId} onChange={e => setTransferKaynakId(e.target.value)} style={inputStyle}>
                                <option value="">Nereden?</option>
                                {transferSources.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatCurrencyPlain(parseFloat(h.guncelBakiye) || 0)})</option>)}
                            </select>
                            <FieldError>{errors.transferKaynakId}</FieldError>
                        </div>
                        <div>
                            <select value={transferHedefId} onChange={e => setTransferHedefId(e.target.value)} style={inputStyle}>
                                <option value="">Nereye?</option>
                                {transferTargets.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatCurrencyPlain(parseFloat(h.guncelBakiye) || 0)})</option>)}
                            </select>
                            <FieldError>{errors.transferHedefId}</FieldError>
                        </div>
                    </div>
                    {isTransferToCreditCard && creditCardTransferAmounts && (
                        <div className="qw-quick-cc-panel">
                            <div className="qw-cc-payment-grid">
                                <div>
                                    <span>Seçilen hesap bakiyesi</span>
                                    <strong>{selectedTransferSource ? formatCurrencyPlain(selectedTransferSource.guncelBakiye) : '-'}</strong>
                                </div>
                                <div>
                                    <span>Güncel borç</span>
                                    <strong className="is-danger">{formatCurrencyPlain(creditCardTransferAmounts.currentDebt)}</strong>
                                </div>
                                <div>
                                    <span>Ekstre borcu</span>
                                    <strong>{creditCardTransferAmounts.statementDebt > 0 ? formatCurrencyPlain(creditCardTransferAmounts.statementDebt) : '-'}</strong>
                                </div>
                                <div>
                                    <span>Asgari tutar</span>
                                    <strong>{creditCardTransferAmounts.minimumPayment > 0 ? formatCurrencyPlain(creditCardTransferAmounts.minimumPayment) : '-'}</strong>
                                </div>
                            </div>
                            <div className="qw-cc-quick-options">
                                {creditCardTransferAmounts.options.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        disabled={!option.enabled}
                                        onClick={() => setTransferTutar?.(option.amount === null ? '' : String(Math.round(option.amount * 100) / 100))}
                                    >
                                        <span>{option.label}</span>
                                        {option.amount !== null && <b>{formatCurrencyPlain(option.amount)}</b>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <input
                            type="number"
                            placeholder="İşlem tutarı"
                            value={transferTutar}
                            onChange={e => {
                                setUseFullTransferBalance(false);
                                setTransferTutar(e.target.value);
                            }}
                            style={inputStyle}
                        />
                        <label className="qw-inline-checkbox">
                            <input
                                type="checkbox"
                                checked={useFullTransferBalance}
                                onChange={e => {
                                    const checked = e.target.checked;
                                    setUseFullTransferBalance(checked);
                                    if (checked) setTransferTutar?.(fullTransferAmount ? String(Math.round(fullTransferAmount * 100) / 100) : '');
                                }}
                                disabled={!transferKaynakId || fullTransferBalance <= 0 || isTransferToCreditCard}
                            />
                            <span>Tüm bakiye</span>
                            {transferKaynakId && <em>{formatCurrencyPlain(fullTransferBalance)}</em>}
                        </label>
                        <FieldError>{errors.transferTutar}</FieldError>
                    </div>
                    <div className="qw-form-row">
                        <input placeholder="Açıklama" value={transferAciklama || ''} onChange={e => setTransferAciklama?.(e.target.value)} style={inputStyle} />
                        {!isTransferToCreditCard && <input type="number" placeholder="Ücret" value={transferUcreti} onChange={e => setTransferUcreti(e.target.value)} style={inputStyle} />}
                    </div>
                    <input type="datetime-local" value={transferTarihi} onChange={e => setTransferTarihi(e.target.value)} style={inputStyle} />
                    <button type="submit" className="qw-submit-button" disabled={submitting}>{submitting ? 'Aktarılıyor...' : 'Transfer yap'}</button>
                </form>
            )}

            {activeTab === 'taksit' && (
                <form onSubmit={(event) => runSubmit(event, taksitEkle)} className="qw-quick-form">
                    <div className="qw-form-row">
                        <select value={taksitHesapId} onChange={e => setTaksitHesapId(e.target.value)} style={inputStyle} required>
                            <option value="">Hangi karttan?</option>
                            {siraliHesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}
                        </select>
                        <input placeholder="Ne aldın?" value={taksitBaslik} onChange={e => setTaksitBaslik(e.target.value)} style={inputStyle} required />
                    </div>
                    <div className="qw-form-row">
                        <input type="number" placeholder="Toplam borç" value={taksitToplamTutar} onChange={e => setTaksitToplamTutar(e.target.value)} style={inputStyle} required />
                        <input type="number" placeholder="Kaç taksit?" value={taksitSayisi} onChange={e => setTaksitSayisi(e.target.value)} style={inputStyle} required />
                    </div>
                    <div className="qw-form-row">
                        <select value={taksitKategori || (siraliKategoriListesi && siraliKategoriListesi[0])} onChange={e => setTaksitKategori(e.target.value)} style={inputStyle}>
                            {siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <input type="date" value={taksitAlisTarihi} onChange={e => setTaksitAlisTarihi(e.target.value)} style={inputStyle} />
                    </div>
                    <StatusBadge tone="purple">Aylık {taksitToplamTutar && taksitSayisi ? formatCurrencyPlain((parseFloat(taksitToplamTutar) || 0) / (parseFloat(taksitSayisi) || 1)) : formatCurrencyPlain(0)}</StatusBadge>
                    <button type="submit" className="qw-submit-button" disabled={submitting}>{submitLabel}</button>
                </form>
            )}

            {activeTab === 'fatura' && (
                <form onSubmit={(event) => runSubmit(event, faturaGir)} className="qw-quick-form">
                    {(tanimliFaturalar || []).length === 0 ? (
                        <EmptyState title="Fatura tanımı yok" description="Önce bir fatura tanımı ekleyin." icon={ReceiptText} />
                    ) : (
                        <>
                            <select value={secilenTanimId} onChange={e => setSecilenTanimId(e.target.value)} style={inputStyle} required>
                                <option value="">Hangi fatura?</option>
                                {(tanimliFaturalar || []).map(t => <option key={t.id} value={t.id}>{t.baslik} ({t.kurum})</option>)}
                            </select>
                            <div className="qw-form-row">
                                <input type="number" placeholder="Tutar" value={faturaGirisTutar} onChange={e => setFaturaGirisTutar(e.target.value)} style={inputStyle} required />
                                <input type="date" value={faturaGirisTarih} onChange={e => setFaturaGirisTarih(e.target.value)} style={inputStyle} required />
                            </div>
                            <input placeholder="Açıklama" value={faturaGirisAciklama} onChange={e => setFaturaGirisAciklama(e.target.value)} style={inputStyle} />
                            <button type="submit" className="qw-submit-button" disabled={submitting}>{submitLabel}</button>
                        </>
                    )}
                </form>
            )}
        </div>
    );
};

export default QuickTransactionForm;
