import React, { useState, useEffect } from 'react';
import HighQualityModal from '../Shared/HighQualityModal';
import DescriptionInput from '../Shared/DescriptionInput';
import { formatCurrencyPlain, inputStyle, tarihSadeceGunAyYil, sortTurkishText } from '../../utils/helpers';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { MONTH_NAMES } from '../../utils/period';
import {
    CREDIT_CARD_PAYMENT_TYPES,
    CREDIT_CARD_PAYMENT_STRATEGIES,
    CREDIT_CARD_PAYMENT_STRATEGY_LABELS,
    getCreditCardPaymentAmountOptions,
    isCreditCardPaymentSourceAccount,
} from '../../utils/creditCardPayments';

const FieldLabel = ({ children }) => (
    <label style={{ display: 'block', margin: '0 0 6px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
        {children}
    </label>
);

const salaryPaymentTypes = ["Maaş Ödemesi", "Maaş Avansı", "Maaş Farkı", "Ek Maaş"];
const incomeTypes = [...salaryPaymentTypes, "Prim / İkramiye", "Masraf İadesi", "Diğer Gelir"];
const getPeriodOptions = (dateValue = new Date()) => {
    const date = dateValue ? new Date(dateValue) : new Date();
    const base = Number.isNaN(date.getTime()) ? new Date() : date;
    return [-1, 0, 1, 2].map((offset) => {
        const optionDate = new Date(base.getFullYear(), base.getMonth() + offset, 1);
        const value = `${optionDate.getFullYear()}-${String(optionDate.getMonth() + 1).padStart(2, '0')}`;
        return { value, label: `${MONTH_NAMES[optionDate.getMonth()]} ${optionDate.getFullYear()} Maaş Dönemi` };
    });
};

// Sub-component to handle Portföy Düzenleme with own state
const IslemEkleMobilModal = ({ close, islemEkle, hesaplar, kategoriListesi, inputStyle, tumIslemler, maaslar = [] }) => {
    const [hesapId, setHesapId] = useState("");
    const [islemTipi, setIslemTipi] = useState("gider");
    const [kategori, setKategori] = useState(kategoriListesi && kategoriListesi[0] ? kategoriListesi[0] : "");
    const [aciklama, setAciklama] = useState("");
    const [tutar, setTutar] = useState("");
    const [gelirTuru, setGelirTuru] = useState("Diğer Gelir");
    const [bagliMaasId, setBagliMaasId] = useState("");

    // Default to current date and time
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
    const [tarih, setTarih] = useState(localISOTime);
    const [maasDonemi, setMaasDonemi] = useState(getPeriodOptions(localISOTime)[1]?.value || getPeriodOptions(localISOTime)[0]?.value || "");

    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const needsSalaryLink = islemTipi === 'gelir' && salaryPaymentTypes.includes(gelirTuru);
        if (needsSalaryLink && (!bagliMaasId || !maasDonemi)) {
            toast.warning("Maaş ödeme türleri için bağlı maaş ve maaş dönemi seçiniz.");
            return;
        }
        setIsProcessing(true);
        const success = await islemEkle(e, {
            hesapId,
            islemTipi,
            kategori,
            aciklama,
            tutar,
            tarih,
            gelirTuru: islemTipi === 'gelir' ? gelirTuru : undefined,
            bagliMaasId: needsSalaryLink ? bagliMaasId : undefined,
            maasDonemi: needsSalaryLink ? maasDonemi : undefined,
            salaryPeriod: needsSalaryLink ? maasDonemi : undefined,
        });
        setIsProcessing(false);
        if (success !== false) close();
    }

    return (
        <HighQualityModal isOpen={true} onClose={close} title="Hızlı İşlem Ekle" icon="⚡" color="#805ad5">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <select value={hesapId} onChange={e => setHesapId(e.target.value)} style={{ flex: 1, ...inputStyle }} required>
                        <option value="">Hangi Hesap?</option>
                        {(hesaplar || []).map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatCurrencyPlain(h.guncelBakiye)})</option>)}
                    </select>
                    <select value={islemTipi} onChange={e => setIslemTipi(e.target.value)} style={{ flex: 1, ...inputStyle }}>
                        <option value="gider">🔴 Gider</option>
                        <option value="gelir">🟢 Gelir</option>
                    </select>
                </div>
                <select value={kategori} onChange={e => setKategori(e.target.value)} style={{ ...inputStyle }}>
                    {sortTurkishText(kategoriListesi || []).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                {islemTipi === 'gelir' && (
                    <>
                        <select value={gelirTuru} onChange={e => setGelirTuru(e.target.value)} style={{ ...inputStyle }}>
                            {incomeTypes.map(tur => <option key={tur} value={tur}>{tur}</option>)}
                        </select>
                        {salaryPaymentTypes.includes(gelirTuru) && (
                            <>
                                <select value={bagliMaasId} onChange={e => setBagliMaasId(e.target.value)} style={{ ...inputStyle }} required>
                                    <option value="">Bağlı Maaş</option>
                                    {(maaslar || []).map(maas => <option key={maas.id} value={maas.id}>{maas.ad}</option>)}
                                </select>
                                <select value={maasDonemi} onChange={e => setMaasDonemi(e.target.value)} style={{ ...inputStyle }} required>
                                    {getPeriodOptions(tarih).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </>
                        )}
                    </>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <DescriptionInput
                        value={aciklama}
                        onChange={e => setAciklama(e.target.value)}
                        historyItems={tumIslemler}
                        inputStyle={inputStyle}
                        wrapperStyle={{ flex: 1 }}
                    />
                    <input type="number" placeholder="Tutar (₺)" value={tutar} onChange={e => setTutar(e.target.value)} style={{ flex: 1, ...inputStyle }} required step="0.01" />
                </div>
                <input type="datetime-local" value={tarih} onChange={e => setTarih(e.target.value)} style={{ ...inputStyle }} required />

                <button type="submit" disabled={isProcessing} style={{ padding: '15px', background: '#805ad5', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', opacity: isProcessing ? 0.7 : 1 }}>
                    {isProcessing ? 'KAYDEDİLİYOR...' : 'KAYDET'}
                </button>
            </form>
        </HighQualityModal>
    );
};

const PositionEditModal = ({ seciliVeri, pozisyonGuncelle, close, inputStyle }) => {
    // Helper to safe parse date
    const safeDate = (str) => {
        if (!str) return "";
        try {
            // Handle DD.MM.YYYY format
            const parts = str.split('.');
            if (parts.length === 3) {
                const day = parts[0];
                const month = parts[1];
                let year = parts[2];
                // Remove potential time part from year
                if (year.includes(' ')) year = year.split(' ')[0];

                const d = new Date(`${year}-${month}-${day}`);
                if (!isNaN(d.getTime())) return d.toISOString().slice(0, 16);
            }
            return "";
        } catch {
            return "";
        }
    };

    // Local state for form, initialized with selected data
    const [buyPrice, setBuyPrice] = useState(seciliVeri?.buy?.alisFiyati || "");
    const [buyDate, setBuyDate] = useState(safeDate(seciliVeri?.buy?.tarihStr));
    const [buyAdet, setBuyAdet] = useState(seciliVeri?.buy?.adet || "");

    const [sellPrice, setSellPrice] = useState(seciliVeri?.sell?.satisFiyati || "");
    const [sellDate, setSellDate] = useState(safeDate(seciliVeri?.sell?.tarihStr));

    const isClosed = seciliVeri?.isClosed;

    return (
        <form onSubmit={async (e) => {
            e.preventDefault();
            const success = await pozisyonGuncelle(
                { id: seciliVeri.buy?.id, fiyat: buyPrice, adet: buyAdet, tarih: buyDate },
                isClosed ? { id: seciliVeri.sell?.id, fiyat: sellPrice, adet: seciliVeri.sell?.adet, tarih: sellDate } : null
            );
            if (success) close();
        }}>
            <div style={{ background: '#ebf8ff', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#2b6cb0', fontSize: '14px' }}>📥 Alış İşlemi ({seciliVeri?.sembol || '?'})</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}>Alış Fiyatı</label>
                        <input type="number" step="0.01" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} style={inputStyle} required />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}>Adet</label>
                        <input type="number" step="0.01" value={buyAdet} onChange={e => setBuyAdet(e.target.value)} style={inputStyle} required />
                    </div>
                </div>
                <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}>Tarih</label>
                    <input type="datetime-local" value={buyDate || ""} onChange={e => setBuyDate(e.target.value)} style={inputStyle} />
                </div>
            </div>

            {isClosed ? (
                <div style={{ background: '#fff5f5', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#c53030', fontSize: '14px' }}>📤 Satış İşlemi (Kapanış)</h4>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}>Satış Fiyatı</label>
                            <input type="number" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)} style={inputStyle} required />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}>Adet (Kilitli)</label>
                            <input value={seciliVeri.sell?.adet} disabled style={{ ...inputStyle, background: '#edf2f7', color: '#a0aec0' }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}>Tarih</label>
                        <input type="datetime-local" value={sellDate || ""} onChange={e => setSellDate(e.target.value)} style={inputStyle} />
                    </div>
                </div>
            ) : (
                <div style={{ background: '#f0fff4', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#276749', fontSize: '14px' }}>📈 Güncel Piyasa Durumu</h4>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}>Anlık Fiyat (Güncellenemez)</label>
                            <input value={formatCurrencyPlain(seciliVeri.guncelFiyat || 0)} disabled style={{ ...inputStyle, background: '#edf2f7', color: '#a0aec0', fontWeight: 'bold' }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: '12px', color: '#718096' }}>
                            * Pozisyon açıktır.
                        </div>
                    </div>
                </div>
            )}

            <button type="submit" style={{ width: '100%', background: '#3182ce', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                DEĞİŞİKLİKLERİ KAYDET
            </button>
        </form>
    );
};

const ModalManager = ({
    aktifModal, setAktifModal,
    seciliVeri,
    hesaplar,
    tumIslemler,
    hesapAdi, setHesapAdi,
    hesapTipi, setHesapTipi,
    baslangicBakiye, setBaslangicBakiye,
    hesapKesimGunu, setHesapKesimGunu,
    kartOdemeStratejisi, setKartOdemeStratejisi,
    kartVarsayilanOdemeTutari, setKartVarsayilanOdemeTutari,
    kartPlanlananOdemeTutari, setKartPlanlananOdemeTutari,
    kartAsgariOdemeTutari, setKartAsgariOdemeTutari,
    varsayilanOdemeAraci, setVarsayilanOdemeAraci,
    maasHesabi, setMaasHesabi,
    anaMaasHesabi, setAnaMaasHesabi,
    hesapMaasGunu, setHesapMaasGunu,
    bagliMaasId, setBagliMaasId,
    hesapDuzenle,
    islemAciklama, setIslemAciklama,
    islemTutar, setIslemTutar,
    islemTarihi, setIslemTarihi,
    islemAdet, setIslemAdet, // NEW
    islemBirimFiyat, setIslemBirimFiyat, // NEW
    kategori, setKategori,
    yatirimTurleri,
    kategoriListesi,
    islemDuzenle,
    aboAd, setAboAd,
    aboTutar, setAboTutar,
    aboGun, setAboGun,
    aboHesapId, setAboHesapId,
    aboKategori, setAboKategori,
    abonelikDuzenle,
    taksitBaslik, setTaksitBaslik,
    taksitToplamTutar, setTaksitToplamTutar,
    taksitSayisi, setTaksitSayisi,
    taksitHesapId, setTaksitHesapId,
    taksitKategori, setTaksitKategori,
    taksitAlisTarihi, setTaksitAlisTarihi,
    taksitDuzenle,
    maasAd, setMaasAd,
    maasTutar, setMaasTutar,
    maasGun, setMaasGun,
    maasHesapId, setMaasHesapId,
    maasTur, setMaasTur,
    maasDuzenle,
    islemGelirTuru, setIslemGelirTuru,
    islemBagliMaasId, setIslemBagliMaasId,
    islemMaasDonemi, setIslemMaasDonemi,
    maaslar = [],
    kkOdemeKartId,
    kkOdemeKaynakId, setKkOdemeKaynakId,
    kkOdemeTutar, setKkOdemeTutar,
    kkOdemeTarihi, setKkOdemeTarihi,
    kkOdemeAciklama, setKkOdemeAciklama,
    kkOdemeTipi, setKkOdemeTipi,
    krediKartiBorcOde,
    faturaOde,
    tanimliFaturalar,
    faturaGirisTutar, setFaturaGirisTutar,
    faturaGirisTarih, setFaturaGirisTarih,
    faturaGirisAciklama, setFaturaGirisAciklama,
    bekleyenFaturaDuzenle,
    tanimBaslik, setTanimBaslik,
    tanimKurum, setTanimKurum,
    tanimAboneNo, setTanimAboneNo,
    tanimHesapId, setTanimHesapId,
    faturaTanimDuzenle,
    alanKodu,
    verileriTasi,
    yeniKodInput, setYeniKodInput,
    tasimaIslemiSuruyor,
    satisYap,
    secilenHesapId, setSecilenHesapId,
    defaultPaymentAccountId,

    // NEW PROPS FOR SETTINGS
    // yeniKategoriAdi, setYeniKategoriAdi, -> MOVED TO LOCAL STATE
    // yeniYatirimTuruAdi, setYeniYatirimTuruAdi, -> MOVED TO LOCAL STATE
    onKategoriUpdate, // Replaces inline setDoc
    onYatirimTuruUpdate, // Replaces inline setDoc
    aylikLimit,
    onLimitChange,
    gizliMod,
    besKesintiEkle,
    besKesintiSil,
    // Investment Edit Props
    portfoyDuzenle, sembol, adet, setAdet, alisFiyati, setAlisFiyati, varlikTuru, setVarlikTuru,
    tahsilatTutar, setTahsilatTutar, satisTahsilatEkle,
    pozisyonGuncelle, // NEW PROP
    pozisyonSil, // NEW PROP for delete modal

    // Auth Actions
    onConfirmLogout,

    // ADDED: New props for add actions (Already passed, but ensuring they are destructured if not)
    maasEkle, hesapEkle, faturaTanimEkle, abonelikEkle, gecmisIslemEkle,
    // Fix: islemSil destructured here to fix undefined error
    islemSil,

    // Borç Props
    borcAd, setBorcAd,
    borcTutar, setBorcTutar,
    borcKalanTutar, setBorcKalanTutar,
    borcTarih, setBorcTarih,
    borcKategori, setBorcKategori,
    borcEkle, borcDuzenle, borcOde, borcSil,

}) => {


    const [yeniKategoriAdi, setYeniKategoriAdi] = useState("");
    const [yeniYatirimTuruAdi, setYeniYatirimTuruAdi] = useState("");
    const [isProcessing, setIsProcessing] = useState(false); // NEW: Global loading state for modals
    const [silinecekObje, setSilinecekObje] = useState(null); // Local state for delete confirmation
    const [borcOdemeTutarState, setBorcOdemeTutarState] = useState("");
    const [borcSecilenHesapIdState, setBorcSecilenHesapIdState] = useState("");
    const [butceLimitInput, setButceLimitInput] = useState(aylikLimit || "");

    useEffect(() => {
        setButceLimitInput(aylikLimit || "");
    }, [aylikLimit]);

    useEffect(() => {
        if (aktifModal === 'borc_ode') {
            setBorcOdemeTutarState("");
            setBorcSecilenHesapIdState(defaultPaymentAccountId || "");
        } else {
            setBorcOdemeTutarState("");
            setBorcSecilenHesapIdState("");
        }
    }, [aktifModal, defaultPaymentAccountId]);

    useEffect(() => {
        if (aktifModal !== 'duzenle_islem') return;
        const isIncomeTransaction = seciliVeri?.islemTipi === 'gelir';
        if (!isIncomeTransaction || !salaryPaymentTypes.includes(islemGelirTuru) || islemMaasDonemi) return;
        const suggestedPeriod = getPeriodOptions(islemTarihi || seciliVeri?.tarih || new Date())[1]?.value;
        if (suggestedPeriod) setIslemMaasDonemi(suggestedPeriod);
    }, [aktifModal, seciliVeri, islemGelirTuru, islemMaasDonemi, islemTarihi, setIslemMaasDonemi]);

    const formatPara = (tutar) => gizliMod ? "**** ₺" : formatCurrencyPlain(tutar);

    if (!aktifModal) return null;

    // Helper to close
    const close = () => setAktifModal(null);

    // Render content based on activeModal
    let content = null;
    let title = "Modal";
    let icon = "📝";
    let customWidth = undefined;
    let customMinHeight = undefined;
    const siraliKategoriListesi = sortTurkishText(kategoriListesi || []);
    const gelirTurleri = ["Maaş", "Maaş Avansı", "Prim / İkramiye", "Masraf İadesi", "Diğer Gelir"];
    const creditCardPaymentSettings = hesapTipi === 'krediKarti' && (
        <div style={{ marginBottom: '20px' }}>
            <FieldLabel>Ödeme stratejisi</FieldLabel>
            <select value={kartOdemeStratejisi} onChange={e => setKartOdemeStratejisi(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }}>
                {Object.entries(CREDIT_CARD_PAYMENT_STRATEGY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {kartOdemeStratejisi === CREDIT_CARD_PAYMENT_STRATEGIES.FIXED && (
                <input type="number" placeholder="Varsayılan ödeme tutarı" value={kartVarsayilanOdemeTutari} onChange={e => setKartVarsayilanOdemeTutari(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
            )}
            {kartOdemeStratejisi === CREDIT_CARD_PAYMENT_STRATEGIES.MANUAL && (
                <input type="number" placeholder="Bu ay planlanan ödeme" value={kartPlanlananOdemeTutari} onChange={e => setKartPlanlananOdemeTutari(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
            )}
            <input type="number" placeholder="Asgari ödeme tutarı (boşsa %20)" value={kartAsgariOdemeTutari} onChange={e => setKartAsgariOdemeTutari(e.target.value)} style={inputStyle} />
        </div>
    );

    // 0. YENİ EKLEME MODALLARI
    if (aktifModal === 'maas_ekle') {
        title = "Yeni Gelir Ekle";
        icon = "💰";
        content = (
            <form onSubmit={async (e) => {
                e.preventDefault(); // Fixed: Prevent default submission
                setIsProcessing(true);
                const success = await maasEkle(e);
                setIsProcessing(false);
                if (success) close();
            }}>
                <input placeholder="Gelir Adı (Maaş vb.)" value={maasAd} onChange={e => setMaasAd(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <select value={maasTur || "Maaş"} onChange={e => setMaasTur(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }}>
                    {gelirTurleri.map(tur => <option key={tur} value={tur}>{tur}</option>)}
                </select>
                <input placeholder="Tutar" type="number" value={maasTutar} onChange={e => setMaasTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <input placeholder="Gün (1-31)" type="number" value={maasGun} onChange={e => setMaasGun(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <select value={maasHesapId} onChange={e => setMaasHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}><option value="">Beklenen Hesap Seç</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select>
                <button type="submit" disabled={isProcessing} style={{ width: '100%', background: '#48bb78', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', opacity: isProcessing ? 0.7 : 1 }}>{isProcessing ? 'KAYDEDİLİYOR...' : 'KAYDET'}</button>
            </form>
        );
    }

    else if (aktifModal === 'hesap_ekle') {
        title = "Yeni Hesap Ekle";
        icon = "💳";
        content = (
            <form onSubmit={async (e) => {
                e.preventDefault(); // Fixed
                setIsProcessing(true);
                const success = await hesapEkle(e);
                setIsProcessing(false);
                if (success) close();
            }}>
                <div style={{ marginBottom: '15px' }}>
                    <FieldLabel>Hesap adı</FieldLabel>
                    <input placeholder="Hesap Adı" value={hesapAdi} onChange={e => setHesapAdi(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <FieldLabel>Hesap türü</FieldLabel>
                    <select value={hesapTipi} onChange={e => setHesapTipi(e.target.value)} style={inputStyle}>
                        <option value="nakit">Nakit</option>
                        <option value="krediKarti">Kart</option>
                        <option value="yatirim">Yatırım H.</option>
                    </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <FieldLabel>{hesapTipi === 'krediKarti' ? 'Güncel bakiye / borç' : 'Güncel bakiye'}</FieldLabel>
                    <input placeholder="0" type="number" value={baslangicBakiye} onChange={e => setBaslangicBakiye(e.target.value)} style={inputStyle} />
                </div>
                {hesapTipi === 'krediKarti' && (
                    <div style={{ marginBottom: '20px' }}>
                        <FieldLabel>Ekstre kesim günü</FieldLabel>
                        <input type="number" min="1" max="31" placeholder="1-31" value={hesapKesimGunu} onChange={e => setHesapKesimGunu(e.target.value)} style={inputStyle} />
                    </div>
                )}
                {creditCardPaymentSettings}
                {hesapTipi !== 'yatirim' && (
                    <div className="qw-default-payment-toggle">
                        <label>
                            <input type="checkbox" checked={varsayilanOdemeAraci} onChange={e => setVarsayilanOdemeAraci(e.target.checked)} />
                            <span>
                                <strong>Varsayılan ödeme aracı</strong>
                                <small>Yeni gider, fatura, abonelik ve taksit kayıtlarında bu hesap otomatik seçilir.</small>
                            </span>
                        </label>
                    </div>
                )}
                {hesapTipi !== 'krediKarti' && (
                    <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '14px', background: '#f8fafc' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#0f172a', marginBottom: maasHesabi ? '12px' : 0 }}>
                            <input type="checkbox" checked={maasHesabi} onChange={e => setMaasHesabi(e.target.checked)} />
                            Maaş hesabı
                        </label>
                        {maasHesabi && (
                            <>
                                <div style={{ marginBottom: '12px' }}>
                                    <FieldLabel>Maaş günü</FieldLabel>
                                    <input type="number" min="1" max="31" placeholder="1-31" value={hesapMaasGunu} onChange={e => setHesapMaasGunu(e.target.value)} style={inputStyle} />
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                    <FieldLabel>Bağlı düzenli gelir</FieldLabel>
                                    <select value={bagliMaasId} onChange={e => setBagliMaasId(e.target.value)} style={inputStyle}>
                                        <option value="">Bağlı gelir yok</option>
                                        {maaslar.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
                                    </select>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#475569' }}>
                                    <input type="checkbox" checked={anaMaasHesabi} onChange={e => setAnaMaasHesabi(e.target.checked)} />
                                    Ana maaş hesabı
                                </label>
                            </>
                        )}
                    </div>
                )}
                <button type="submit" disabled={isProcessing} style={{ width: '100%', background: '#3182ce', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', opacity: isProcessing ? 0.7 : 1 }}>{isProcessing ? 'KAYDEDİLİYOR...' : 'KAYDET'}</button>
            </form>
        );
    }

    else if (aktifModal === 'fatura_tanim_ekle') {
        title = "Yeni Fatura Tanımı";
        icon = "🧾";
        content = (
            <form onSubmit={async (e) => {
                e.preventDefault(); // Fixed
                setIsProcessing(true);
                const success = await faturaTanimEkle(e);
                setIsProcessing(false);
                if (success) close();
            }}>
                <input placeholder="Ad" value={tanimBaslik} onChange={e => setTanimBaslik(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <input placeholder="Kurum" value={tanimKurum} onChange={e => setTanimKurum(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <input placeholder="Abone No" value={tanimAboneNo} onChange={e => setTanimAboneNo(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <select value={tanimHesapId} onChange={e => setTanimHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}>
                    <option value="">Hangi Hesaptan?</option>
                    {hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}
                </select>
                <button type="submit" disabled={isProcessing} style={{ width: '100%', background: '#805ad5', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', opacity: isProcessing ? 0.7 : 1 }}>{isProcessing ? 'KAYDEDİLİYOR...' : 'KAYDET'}</button>
            </form>
        );
    }

    else if (aktifModal === 'fatura_ode') {
        title = "Fatura Öde";
        icon = "💸";
        const tanim = tanimliFaturalar?.find(t => t.id === seciliVeri?.tanimId);
        const baslik = tanim ? tanim.baslik : "Fatura";

        content = (
            <form onSubmit={async (e) => {
                e.preventDefault();
                if (!secilenHesapId) { alert("Lütfen hesap seçiniz."); return; }
                setIsProcessing(true);
                const success = await faturaOde(seciliVeri, secilenHesapId);
                setIsProcessing(false);
                if (success) close();
            }}>
                <div style={{ marginBottom: '20px', padding: '15px', background: '#fff5f5', borderRadius: '12px', color: '#c53030' }}>
                    <h3 style={{ margin: '0 0 5px 0' }}>{baslik}</h3>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatPara(seciliVeri?.tutar)}</div>
                    <div style={{ fontSize: '12px', marginTop: '5px' }}>Son Ödeme: {tarihSadeceGunAyYil(seciliVeri?.sonOdemeTarihi)}</div>
                </div>

                <select value={secilenHesapId} onChange={e => setSecilenHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }} required>
                    <option value="">Ödenecek Hesap Seçin</option>
                    {hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatPara(h.guncelBakiye)})</option>)}
                </select>

                <button type="submit" disabled={isProcessing} style={{ width: '100%', background: '#c53030', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', opacity: isProcessing ? 0.7 : 1 }}>
                    {isProcessing ? 'ÖDENİYOR...' : 'ÖDE'}
                </button>
            </form>
        );
    }

    else if (aktifModal === 'duzenle_fatura_tanim') {
        title = "Fatura Tanımı Düzenle";
        content = (
            <form onSubmit={(e) => faturaTanimDuzenle(e, seciliVeri.id).then(res => res && close())}>
                <input placeholder="Ad" value={tanimBaslik} onChange={e => setTanimBaslik(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <input placeholder="Kurum" value={tanimKurum} onChange={e => setTanimKurum(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <input placeholder="Abone No" value={tanimAboneNo} onChange={e => setTanimAboneNo(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <select value={tanimHesapId} onChange={e => setTanimHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}>
                    <option value="">Hangi Hesaptan?</option>
                    {hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}
                </select>
                <button type="submit" style={{ width: '100%', background: '#805ad5', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>GÜNCELLE</button>
            </form>
        );
    }

    else if (aktifModal === 'duzenle_bekleyen_fatura') {
        title = "Bekleyen Fatura Düzenle";
        content = (
            <form onSubmit={(e) => bekleyenFaturaDuzenle(e, seciliVeri.id).then(res => res && close())}>
                <input type="number" placeholder="Tutar" value={faturaGirisTutar} onChange={e => setFaturaGirisTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <input type="date" value={faturaGirisTarih} onChange={e => setFaturaGirisTarih(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <input placeholder="Açıklama (Opsiyonel)" value={faturaGirisAciklama} onChange={e => setFaturaGirisAciklama(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }} />
                <button type="submit" style={{ width: '100%', background: '#c53030', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>KAYDET</button>
            </form>
        );
    }

    else if (aktifModal === 'abonelik_ekle') {
        title = "Yeni Sabit Gider Ekle";
        icon = "🔄";
        content = (
            <form onSubmit={async (e) => {
                e.preventDefault(); // Fixed
                setIsProcessing(true);
                const success = await abonelikEkle(e);
                setIsProcessing(false);
                if (success) close();
            }}>
                <input placeholder="Ad" value={aboAd} onChange={e => setAboAd(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <input placeholder="Tutar" type="number" value={aboTutar} onChange={e => setAboTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <input placeholder="Gün (1-31)" type="number" value={aboGun} onChange={e => setAboGun(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <select value={aboKategori} onChange={e => setAboKategori(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }}>{siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}</select>
                <select value={aboHesapId} onChange={e => setAboHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}><option value="">Hangi Hesaptan?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select>
                <button type="submit" disabled={isProcessing} style={{ width: '100%', background: '#805ad5', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', opacity: isProcessing ? 0.7 : 1 }}>{isProcessing ? 'KAYDEDİLİYOR...' : 'KAYDET'}</button>
            </form>
        );
    }

    // 1. SATIŞ
    else if (aktifModal === 'satis') {
        title = "Satış Yap";
        icon = "💰";
        content = (
            <form onSubmit={async (e) => {
                e.preventDefault();
                setIsProcessing(true);
                const success = await satisYap(seciliVeri, secilenHesapId, islemTutar);
                setIsProcessing(false);
                if (success) close();
            }}>
                <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}><b>{seciliVeri.sembol}</b> - {seciliVeri.adet} Adet</div>
                <input type="number" value={islemTutar} onChange={e => setIslemTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} placeholder="Birim Satış Fiyatı" />
                <select value={secilenHesapId} onChange={e => setSecilenHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }} required><option value="">Para Hangi Hesaba Gitsin?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select>
                <div style={{ marginBottom: '20px', fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>Toplam Tutar: {islemTutar ? formatPara(parseFloat(islemTutar) * seciliVeri.adet) : formatPara(0)}</div>
                <button type="submit" disabled={isProcessing} style={{ width: '100%', background: '#10b981', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', opacity: isProcessing ? 0.7 : 1 }}>{isProcessing ? 'İŞLENİYOR...' : 'ONAYLA'}</button>
            </form>
        );
    }

    // 2. HESAP DÜZENLE
    else if (aktifModal === 'duzenle_hesap') {
        title = "Hesabı Düzenle";
        content = (
            <form onSubmit={(e) => hesapDuzenle(e, seciliVeri.id).then(res => res && close())}>
                <div style={{ marginBottom: '15px' }}>
                    <FieldLabel>Hesap adı</FieldLabel>
                    <input value={hesapAdi} onChange={e => setHesapAdi(e.target.value)} style={inputStyle} placeholder="Hesap Adı" />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <FieldLabel>Hesap türü</FieldLabel>
                    <select value={hesapTipi} onChange={e => setHesapTipi(e.target.value)} style={inputStyle}>
                        <option value="nakit">Nakit</option>
                        <option value="krediKarti">Kart</option>
                        <option value="yatirim">Yatırım H.</option>
                    </select>
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <FieldLabel>{hesapTipi === 'krediKarti' ? 'Güncel bakiye / borç' : 'Güncel bakiye'}</FieldLabel>
                    <input type="number" value={baslangicBakiye} onChange={e => setBaslangicBakiye(e.target.value)} style={inputStyle} placeholder="Bakiye" />
                </div>
                {hesapTipi === 'krediKarti' && (
                    <div style={{ marginBottom: '20px' }}>
                        <FieldLabel>Ekstre kesim günü</FieldLabel>
                        <input type="number" min="1" max="31" placeholder="1-31" value={hesapKesimGunu} onChange={e => setHesapKesimGunu(e.target.value)} style={inputStyle} />
                        <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: 1.45, color: '#94a3b8' }}>
                            Kesim gününü değiştirmek geçmiş ekstre dönemlerinin dağılımını değiştirebilir.
                        </div>
                    </div>
                )}
                {creditCardPaymentSettings}
                {hesapTipi !== 'yatirim' && (
                    <div className="qw-default-payment-toggle">
                        <label>
                            <input type="checkbox" checked={varsayilanOdemeAraci} onChange={e => setVarsayilanOdemeAraci(e.target.checked)} />
                            <span>
                                <strong>Varsayılan ödeme aracı</strong>
                                <small>Yeni gider, fatura, abonelik ve taksit kayıtlarında bu hesap otomatik seçilir.</small>
                            </span>
                        </label>
                    </div>
                )}
                {hesapTipi !== 'krediKarti' && (
                    <div style={{ marginBottom: '20px', padding: '14px', borderRadius: '14px', background: '#f8fafc' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#0f172a', marginBottom: maasHesabi ? '12px' : 0 }}>
                            <input type="checkbox" checked={maasHesabi} onChange={e => setMaasHesabi(e.target.checked)} />
                            Maaş hesabı
                        </label>
                        {maasHesabi && (
                            <>
                                <div style={{ marginBottom: '12px' }}>
                                    <FieldLabel>Maaş günü</FieldLabel>
                                    <input type="number" min="1" max="31" placeholder="1-31" value={hesapMaasGunu} onChange={e => setHesapMaasGunu(e.target.value)} style={inputStyle} />
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                    <FieldLabel>Bağlı düzenli gelir</FieldLabel>
                                    <select value={bagliMaasId} onChange={e => setBagliMaasId(e.target.value)} style={inputStyle}>
                                        <option value="">Bağlı gelir yok</option>
                                        {maaslar.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
                                    </select>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#475569' }}>
                                    <input type="checkbox" checked={anaMaasHesabi} onChange={e => setAnaMaasHesabi(e.target.checked)} />
                                    Ana maaş hesabı
                                </label>
                            </>
                        )}
                    </div>
                )}
                <button type="submit" style={{ width: '100%', background: '#6366f1', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>Kaydet</button>
            </form>
        );
    }

    // 3. İŞLEM DÜZENLE
    else if (aktifModal === 'duzenle_islem') {
        if (!seciliVeri) return null; // STRICT SAFE ACCESS
        title = "İşlemi Düzenle";
        const isInvestment = (seciliVeri.islemTipi && seciliVeri.islemTipi.includes('yatirim')) || seciliVeri.kategori === 'Yatırım';
        const isTransfer = seciliVeri.islemTipi === 'transfer' || seciliVeri.kategori === 'Transfer';
        const isIncome = seciliVeri.islemTipi === 'gelir';
        const needsSalaryLink = isIncome && salaryPaymentTypes.includes(islemGelirTuru);
        const periodOptions = getPeriodOptions(islemTarihi || seciliVeri.tarih || new Date());
        const seciliKategori = kategori || seciliVeri.kategori || "";
        const normalKategoriOpsiyonlari = (kategoriListesi || []).includes(seciliKategori)
            ? siraliKategoriListesi
            : sortTurkishText([seciliKategori, ...(kategoriListesi || []).filter(k => k !== seciliKategori)].filter(Boolean));

        // Auto-Calc Handler
        const handleCalc = (val, type) => {
            const numVal = parseFloat(val);
            const total = parseFloat(islemTutar);

            if (type === 'adet') {
                setIslemAdet(val);
                if (!isNaN(numVal) && numVal !== 0 && !isNaN(total)) {
                    setIslemBirimFiyat((total / numVal).toFixed(2));
                }
            } else if (type === 'fiyat') {
                setIslemBirimFiyat(val);
                if (!isNaN(numVal) && numVal !== 0 && !isNaN(total)) {
                    setIslemAdet((total / numVal).toFixed(2));
                }
            }
        };

        const handleAmountChange = (val) => {
            setIslemTutar(val);
            if (isInvestment) {
                const total = parseFloat(val);
                const q = parseFloat(islemAdet);
                if (!isNaN(total) && !isNaN(q) && q !== 0) {
                    setIslemBirimFiyat((total / q).toFixed(2));
                }
            }
        };

        content = (
            <form onSubmit={(e) => islemDuzenle(e, seciliVeri.id, seciliVeri).then(res => res && close())}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>İşlem Açıklaması</label>
                    <DescriptionInput
                        value={islemAciklama}
                        onChange={e => setIslemAciklama(e.target.value)}
                        historyItems={tumIslemler}
                        inputStyle={{ ...inputStyle, padding: '12px 15px', fontSize: '14px' }}
                    />
                </div>

                {/* CONDITIONAL RENDERING for Investment Fields */}
                {isInvestment && (
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>Adet</label>
                            <input
                                type="number"
                                step="0.001"
                                value={islemAdet ?? ''}
                                onChange={e => handleCalc(e.target.value, 'adet')}
                                style={{ ...inputStyle, padding: '12px 15px', fontSize: '14px' }}
                                placeholder="0"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>Birim Fiyat</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={islemBirimFiyat ?? ''}
                                    onChange={e => handleCalc(e.target.value, 'fiyat')}
                                    style={{ ...inputStyle, padding: '12px 15px', paddingRight: '30px', fontSize: '14px' }}
                                    placeholder="0.00"
                                />
                                <span style={{ position: 'absolute', right: '12px', top: '12px', color: '#718096', fontWeight: 'bold' }}>₺</span>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>Toplam Tutar</label>
                    <div style={{ position: 'relative' }}>
                        <input type="number" step="0.01" value={islemTutar} onChange={e => handleAmountChange(e.target.value)} style={{ ...inputStyle, padding: '12px 15px', paddingRight: '30px', fontSize: '18px', fontWeight: 'bold', color: '#2d3748' }} placeholder="Tutar" />
                        <span style={{ position: 'absolute', right: '12px', top: '13px', color: '#718096', fontWeight: 'bold', fontSize: '16px' }}>₺</span>
                    </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>İşlem Tarihi</label>
                    <input type="datetime-local" value={islemTarihi} onChange={e => setIslemTarihi(e.target.value)} style={{ ...inputStyle, padding: '12px 15px', fontSize: '14px' }} />
                </div>

                {!isTransfer && (
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>Ödeme Aracı</label>
                        <select value={secilenHesapId} onChange={e => setSecilenHesapId(e.target.value)} style={{ ...inputStyle, padding: '12px 15px', fontSize: '14px' }} required>
                            <option value="">Hangi Hesaptan?</option>
                            {(hesaplar || []).map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}
                        </select>
                    </div>
                )}

                {isIncome && (
                    <div style={{ display: 'grid', gridTemplateColumns: needsSalaryLink ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '15px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>Gelir Türü</label>
                            <select value={islemGelirTuru} onChange={e => setIslemGelirTuru(e.target.value)} style={{ ...inputStyle, padding: '12px 15px', fontSize: '14px' }}>
                                {incomeTypes.map(tur => <option key={tur} value={tur}>{tur}</option>)}
                            </select>
                        </div>
                        {needsSalaryLink && (
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>Bağlı Maaş</label>
                                <select value={islemBagliMaasId} onChange={e => setIslemBagliMaasId(e.target.value)} style={{ ...inputStyle, padding: '12px 15px', fontSize: '14px' }} required>
                                    <option value="">Maaş seç</option>
                                    {(maaslar || []).map(maas => <option key={maas.id} value={maas.id}>{maas.ad}</option>)}
                                </select>
                            </div>
                        )}
                        {needsSalaryLink && (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>Ait Olduğu Maaş Dönemi</label>
                                <select value={islemMaasDonemi || periodOptions[1]?.value || ''} onChange={e => setIslemMaasDonemi(e.target.value)} style={{ ...inputStyle, padding: '12px 15px', fontSize: '14px' }} required>
                                    {periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ marginBottom: '25px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4a5568', fontWeight: 'bold', marginBottom: '5px' }}>Kategori</label>
                    {seciliVeri.kategori === 'BES' ? (
                        <input value="BES" disabled style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8', padding: '12px 15px', fontSize: '14px', cursor: 'not-allowed' }} />
                    ) : (isTransfer) ? (
                        <input value={seciliVeri.kategori || "Transfer"} disabled style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8', padding: '12px 15px', fontSize: '14px', cursor: 'not-allowed' }} />
                    ) : (isInvestment) ? (
                        <select value={kategori} onChange={e => setKategori(e.target.value)} style={{ ...inputStyle, padding: '12px 15px', fontSize: '14px' }}>{yatirimTurleri.map(t => <option key={t} value={t}>{t}</option>)}</select>
                    ) : (
                        <select value={seciliKategori} onChange={e => setKategori(e.target.value)} style={{ ...inputStyle, padding: '12px 15px', fontSize: '14px' }}>
                            {normalKategoriOpsiyonlari.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    )}
                </div>

                <button type="submit" style={{ width: '100%', background: 'linear-gradient(to right, #4f46e5, #6366f1)', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                    DEĞİŞİKLİKLERİ KAYDET
                </button>
            </form>
        );
    }

    else if (aktifModal === 'duzenle_abonelik') {
        title = "Sabit Gider Düzenle";
        content = (
            <form onSubmit={(e) => abonelikDuzenle(e, seciliVeri.id).then(res => res && close())}>
                <input value={aboAd} onChange={e => setAboAd(e.target.value)} placeholder="Gider Adı" style={{ ...inputStyle, marginBottom: '15px' }} />
                <input type="number" value={aboTutar} onChange={e => setAboTutar(e.target.value)} placeholder="Tutar" style={{ ...inputStyle, marginBottom: '15px' }} />
                <input type="number" value={aboGun} onChange={e => setAboGun(e.target.value)} placeholder="Gün (1-31)" style={{ ...inputStyle, marginBottom: '15px' }} />
                <select value={aboKategori} onChange={e => setAboKategori(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }}>{siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}</select>
                <select value={aboHesapId} onChange={e => setAboHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}><option value="">Hangi Hesaptan?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select>
                <button type="submit" style={{ width: '100%', background: '#6366f1', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>Kaydet</button>
            </form>
        );
    }

    else if (aktifModal === 'duzenle_maas') {
        title = "Gelir Düzenle";
        content = (
            <form onSubmit={(e) => maasDuzenle(e, seciliVeri.id).then(res => res && close())}>
                <input value={maasAd} onChange={e => setMaasAd(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} placeholder="Gelir Adı" />
                <select value={maasTur || "Maaş"} onChange={e => setMaasTur(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }}>
                    {gelirTurleri.map(tur => <option key={tur} value={tur}>{tur}</option>)}
                </select>
                <input type="number" value={maasTutar} onChange={e => setMaasTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} placeholder="Tutar" />
                <input type="number" value={maasGun} onChange={e => setMaasGun(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} placeholder="Gün (1-31)" />
                <select value={maasHesapId} onChange={e => setMaasHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}><option value="">Beklenen Hesap Seç</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select>
                <button type="submit" style={{ width: '100%', background: '#48bb78', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>GÜNCELLE</button>
            </form>
        );
    }

    else if (aktifModal === 'borc_tanimla') {
        title = "Borç Tanımla";
        icon = "💸";
        content = (
            <form onSubmit={(e) => borcEkle(e).then(res => res && close())}>
                <input placeholder="Borç Adı (Örn: Babam, Trafik Cezası)" value={borcAd || ''} onChange={e => setBorcAd(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <input type="number" placeholder="Toplam Borç Tutarı (₺)" value={borcTutar || ''} onChange={e => setBorcTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <input type="number" placeholder="Kalan Borç (Boşsa tamamı olur)" value={borcKalanTutar || ''} onChange={e => setBorcKalanTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px' }}>Kategori Seçin</label>
                    <select value={borcKategori || ''} onChange={e => setBorcKategori(e.target.value)} style={inputStyle}>
                        {siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px' }}>Son Ödeme Tarihi (Opsiyonel)</label>
                    <input type="date" value={borcTarih || ''} onChange={e => setBorcTarih(e.target.value)} style={inputStyle} />
                </div>
                <button type="submit" style={{ width: '100%', background: '#e53e3e', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>KAYDET</button>
            </form>
        );
    }

    else if (aktifModal === 'duzenle_borc') {
        title = "Borcu Düzenle";
        icon = "✏️";
        content = (
            <form onSubmit={(e) => borcDuzenle(e, seciliVeri.id).then(res => res && close())}>
                <input placeholder="Borç Adı" value={borcAd || ''} onChange={e => setBorcAd(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <input type="number" placeholder="Toplam Borç Tutarı (₺)" value={borcTutar || ''} onChange={e => setBorcTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <input type="number" placeholder="Kalan Borç" value={borcKalanTutar || ''} onChange={e => setBorcKalanTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px' }}>Kategori Seçin</label>
                    <select value={borcKategori || ''} onChange={e => setBorcKategori(e.target.value)} style={inputStyle}>
                        {siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: '#666', marginBottom: '5px' }}>Son Ödeme Tarihi (Opsiyonel)</label>
                    <input type="date" value={borcTarih || ''} onChange={e => setBorcTarih(e.target.value)} style={inputStyle} />
                </div>
                <button type="submit" style={{ width: '100%', background: '#3182ce', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>GÜNCELLE</button>
            </form>
        );
    }

    else if (aktifModal === 'borc_ode') {
        title = "Borç Öde";
        icon = "💳";

        content = (
            <form onSubmit={async (e) => {
                e.preventDefault();
                if (!borcOdemeTutarState || !borcSecilenHesapIdState) return alert("Lütfen tutar ve hesap seçiniz.");
                const res = await borcOde(seciliVeri, borcOdemeTutarState, borcSecilenHesapIdState);
                if (!res?.success) return;

                close();

                if (res.borcKapandi) {
                    const karar = await Swal.fire({
                        title: 'Borç Kapandı! 🎉',
                        text: `${res.borcAd} borcu tamamlandı. Listeden kaldırılsın mı?`,
                        icon: 'success',
                        showCancelButton: true,
                        confirmButtonText: 'Kaldır',
                        cancelButtonText: 'Listede Tut',
                        zIndex: 200000
                    });

                    if (karar.isConfirmed) {
                        await borcSil?.(res.borcId);
                    }
                }
            }}>
                <div style={{ marginBottom: '20px', padding: '15px', background: '#fdf2f8', borderRadius: '12px', color: '#831843' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px' }}>{seciliVeri?.ad}</p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>Kalan Borç: <b>{formatPara(seciliVeri?.kalanTutar)}</b></p>
                </div>
                <input type="number" autoFocus placeholder="Kaç TL ödeyeceksin?" value={borcOdemeTutarState} onChange={e => setBorcOdemeTutarState(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />
                <select value={borcSecilenHesapIdState} onChange={e => setBorcSecilenHesapIdState(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }} required>
                    <option value="">Ödeme Aracı (Hangi Hesaptan?)</option>
                    {(hesaplar || []).map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatPara(h.guncelBakiye)})</option>)}
                </select>
                <button type="submit" style={{ width: '100%', background: '#805ad5', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>ÖDEMEYİ YAP</button>
            </form>
        );
    }

    else if (aktifModal === 'ayarlar_yonetim') {
        title = <span>Ayarlar</span>;
        icon = "⚙️";
        customWidth = "380px";
        customMinHeight = "550px";

        const tagStyle = (bg) => ({
            background: bg, color: '#000', padding: '4px 10px', borderRadius: '15px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', border: `1px solid ${bg === '#fff' ? '#e2e8f0' : 'transparent'}`,
            fontWeight: '500'
        });

        content = (
            <div style={{ position: 'relative' }}>
                {/* SİLME ONAY OVERLAY */}
                {silinecekObje && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(5px)',
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                        zIndex: 20, borderRadius: '12px'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ fontSize: '20px', marginBottom: '8px' }}>🗑️</div>
                            <b style={{ color: '#2d3748', fontSize: '13px' }}>{silinecekObje.name}</b>
                            <div style={{ color: '#718096', fontSize: '11px', marginTop: '4px' }}>
                                {silinecekObje.type === 'kategori' ? 'kategorisini' : 'türünü'} silmek istediğinize emin misiniz?
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setSilinecekObje(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e0', background: 'white', color: '#4a5568', cursor: 'pointer', fontSize: '11px' }}>İPTAL</button>
                            <button onClick={() => {
                                if (silinecekObje.type === 'kategori') onKategoriUpdate(kategoriListesi.filter(x => x !== silinecekObje.name));
                                else onYatirimTuruUpdate(yatirimTurleri.filter(x => x !== silinecekObje.name));
                                setSilinecekObje(null);
                                toast.success("Silindi.");
                            }} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#e53e3e', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>SİL</button>
                        </div>
                    </div>
                )}

                {/* 1. BÜTÇE AYARLARI */}
                <div style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>🎯 Bütçe Ayarları</h4>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const nextLimit = Math.max(0, parseFloat(butceLimitInput) || 0);
                        onLimitChange(nextLimit);
                        toast.success("Bütçe limiti kaydedildi");
                    }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={{ color: '#64748b', fontSize: '11px', fontWeight: 800 }}>
                            Aylık bütçe limiti (₺)
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={butceLimitInput}
                                onChange={e => setButceLimitInput(e.target.value)}
                                placeholder="40000"
                                style={{ ...inputStyle, background: '#ffffff', border: '1px solid #dbe3ef', fontSize: '12px', padding: '9px', flex: 1 }}
                            />
                            <button type="submit" style={{ padding: '0 16px', borderRadius: '8px', border: 'none', background: '#0f172a', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                                Kaydet
                            </button>
                        </div>
                    </form>
                </div>

                {/* 1. KATEGORİLER */}
                <h4 style={{ margin: '0 0 10px 0', color: '#4a5568', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>📂 Kategoriler</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {siraliKategoriListesi.map(k => (
                        <span key={k} style={tagStyle('#f0fff4')}>
                            {k} <span onClick={() => setSilinecekObje({ type: 'kategori', name: k })} style={{ cursor: 'pointer', color: '#e53e3e', fontWeight: 'bold', fontSize: '12px' }}>X</span>
                        </span>
                    ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (!yeniKategoriAdi) return; onKategoriUpdate([...(kategoriListesi || []), yeniKategoriAdi]); setYeniKategoriAdi(""); toast.success("Kategori eklendi"); }} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    <input value={yeniKategoriAdi} onChange={e => setYeniKategoriAdi(e.target.value)} placeholder="Yeni Kategori" style={{ ...inputStyle, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', padding: '8px' }} />
                    <button type="submit" style={{ padding: '0 16px', borderRadius: '8px', border: 'none', background: 'green', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Ekle</button>
                </form>

                {/* 2. YATIRIM TÜRLERİ */}
                <h4 style={{ margin: '0 0 10px 0', color: '#4a5568', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', opacity: 0.8 }}>💎 Yatırım Türleri</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {(yatirimTurleri || []).map(k => (
                        <span key={k} style={tagStyle('#ebf8ff')}>
                            {k} <span onClick={() => setSilinecekObje({ type: 'yatirim', name: k })} style={{ cursor: 'pointer', color: '#e53e3e', fontWeight: 'bold', fontSize: '12px' }}>X</span>
                        </span>
                    ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (!yeniYatirimTuruAdi) return; onYatirimTuruUpdate([...(yatirimTurleri || []), yeniYatirimTuruAdi]); setYeniYatirimTuruAdi(""); toast.success("Tür eklendi"); }} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    <input value={yeniYatirimTuruAdi} onChange={e => setYeniYatirimTuruAdi(e.target.value)} placeholder="Yeni Tür (Fon, Coin...)" style={{ ...inputStyle, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '12px', padding: '8px' }} />
                    <button type="submit" style={{ padding: '0 16px', borderRadius: '8px', border: 'none', background: '#3182ce', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Ekle</button>
                </form>

                {/* 3. VERİ TAŞIMA */}
                <div style={{ padding: '12px', background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: '10px' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#c05621', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>🚚 Verileri Başka Koda Taşı</h4>
                    <div style={{ fontSize: '11px', marginBottom: '8px', color: '#744210' }}>
                        Mevcut Kodunuz: <b>{alanKodu}</b>. Taşımak için yeni kodu girin.
                    </div>
                    <form onSubmit={verileriTasi} style={{ display: 'flex', gap: '8px' }}>
                        <input value={yeniKodInput} onChange={e => setYeniKodInput(e.target.value.toUpperCase())} placeholder="YENİ KOD" style={{ ...inputStyle, flex: 1, border: '1px solid #fbd38d', background: 'white', fontSize: '12px', padding: '8px' }} />
                        <button type="submit" disabled={tasimaIslemiSuruyor} style={{ background: '#c05621', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>{tasimaIslemiSuruyor ? '...' : 'TAŞI'}</button>
                    </form>
                </div>
            </div>
        );
    }

    else if (aktifModal === 'duzenle_taksit') {
        title = "Taksit Düzenle";
        content = (
            <form onSubmit={(e) => taksitDuzenle(e, seciliVeri.id).then(res => res && close())}>
                <input value={taksitBaslik} onChange={e => setTaksitBaslik(e.target.value)} placeholder="Ne aldın?" style={{ ...inputStyle, marginBottom: '15px' }} />
                <input type="number" value={taksitToplamTutar} onChange={e => setTaksitToplamTutar(e.target.value)} placeholder="Toplam Borç" style={{ ...inputStyle, marginBottom: '15px' }} />
                <input type="number" value={taksitSayisi} onChange={e => setTaksitSayisi(e.target.value)} placeholder="Taksit Sayısı" style={{ ...inputStyle, marginBottom: '15px' }} />
                <input type="date" value={taksitAlisTarihi || ""} onChange={e => setTaksitAlisTarihi(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
                <select value={taksitKategori} onChange={e => setTaksitKategori(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }}>{siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}</select>
                <select value={taksitHesapId} onChange={e => setTaksitHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }}><option value="">Hangi Karttan?</option>{hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}</select>
                <div style={{ marginBottom: '20px', fontSize: '14px', color: '#6366f1', fontWeight: 'bold' }}>Aylık: {taksitToplamTutar && taksitSayisi ? formatPara(taksitToplamTutar / taksitSayisi) : formatPara(0)}</div>
                <button type="submit" style={{ width: '100%', background: '#6366f1', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>Kaydet</button>
            </form>
        );
    }

    else if (aktifModal === 'kredi_karti_ode') {
        title = "Borç Öde";
        icon = "💳";
        customWidth = "min(520px, calc(100vw - 32px))";
        const kart = hesaplar.find(h => h.id === kkOdemeKartId);
        const kaynak = hesaplar.find(h => h.id === kkOdemeKaynakId);
        const paymentAmounts = getCreditCardPaymentAmountOptions(kart);
        const paymentAccounts = (hesaplar || []).filter(isCreditCardPaymentSourceAccount);
        const isInterimPayment = kkOdemeTipi === CREDIT_CARD_PAYMENT_TYPES.INTERIM;
        const applyQuickAmount = (option) => {
            if (!option.enabled || option.amount === null) {
                setKkOdemeTutar("");
                return;
            }
            setKkOdemeTutar(String(Math.round(option.amount * 100) / 100));
        };

        content = (
            <form className="qw-cc-payment-form" onSubmit={async (e) => {
                e.preventDefault();
                if (isProcessing) return;
                setIsProcessing(true);
                const s = await krediKartiBorcOde(e);
                setIsProcessing(false);
                if (s) close();
            }}>
                <div className="qw-cc-payment-hero">
                    <div>
                        <span>Ödenecek kredi kartı</span>
                        <strong>{kart?.hesapAdi || 'Kredi kartı'}</strong>
                    </div>
                    <b className="is-danger">{formatPara(paymentAmounts.currentDebt)}</b>
                </div>

                <div>
                    <FieldLabel>Ödeme türü</FieldLabel>
                    <div className="qw-cc-payment-type-tabs">
                        <button
                            type="button"
                            className={kkOdemeTipi === CREDIT_CARD_PAYMENT_TYPES.STATEMENT ? 'is-active' : ''}
                            onClick={() => setKkOdemeTipi(CREDIT_CARD_PAYMENT_TYPES.STATEMENT)}
                        >
                            Ekstre ödemesi
                        </button>
                        <button
                            type="button"
                            className={isInterimPayment ? 'is-active' : ''}
                            onClick={() => setKkOdemeTipi(CREDIT_CARD_PAYMENT_TYPES.INTERIM)}
                        >
                            Ara ödeme
                        </button>
                    </div>
                </div>

                <div>
                    <FieldLabel>Ödeme yapılacak vadesiz hesap</FieldLabel>
                    <select value={kkOdemeKaynakId} onChange={e => setKkOdemeKaynakId(e.target.value)} style={inputStyle} required>
                        <option value="">Hesap seç</option>
                        {paymentAccounts.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatPara(h.guncelBakiye)})</option>)}
                    </select>
                </div>

                <div className="qw-cc-payment-grid">
                    <div>
                        <span>Seçilen hesabın kullanılabilir bakiyesi</span>
                        <strong>{kaynak ? formatPara(kaynak.guncelBakiye) : '-'}</strong>
                    </div>
                    <div>
                        <span>Güncel kredi kartı borcu</span>
                        <strong className="is-danger">{formatPara(paymentAmounts.currentDebt)}</strong>
                    </div>
                    <div>
                        <span>Ekstre borcu</span>
                        <strong>{paymentAmounts.statementDebt > 0 ? formatPara(paymentAmounts.statementDebt) : '-'}</strong>
                    </div>
                    <div>
                        <span>Asgari ödeme tutarı</span>
                        <strong>{paymentAmounts.minimumPayment > 0 ? formatPara(paymentAmounts.minimumPayment) : '-'}</strong>
                    </div>
                </div>
                <div>
                    <FieldLabel>Hızlı tutar seçimi</FieldLabel>
                    <div className="qw-cc-quick-options">
                        {paymentAmounts.options.map((option) => (
                            <button key={option.id} type="button" disabled={!option.enabled} onClick={() => applyQuickAmount(option)}>
                                <span>{option.label}</span>
                                {option.amount !== null && <b>{formatPara(option.amount)}</b>}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="qw-form-row">
                    <div>
                        <FieldLabel>Ödenecek tutar</FieldLabel>
                        <input type="number" min="0.01" step="0.01" placeholder="0,00" value={kkOdemeTutar} onChange={e => setKkOdemeTutar(e.target.value)} style={inputStyle} required />
                    </div>
                    <div>
                        <FieldLabel>İşlem tarihi</FieldLabel>
                        <input type="datetime-local" value={kkOdemeTarihi || ''} onChange={e => setKkOdemeTarihi(e.target.value)} style={inputStyle} required />
                    </div>
                </div>
                <div>
                    <FieldLabel>Açıklama</FieldLabel>
                    <input
                        placeholder={`${kaynak?.hesapAdi || 'Kaynak hesap'} → ${kart?.hesapAdi || 'Kredi kartı'} ${isInterimPayment ? 'Ara Ödeme' : 'Ekstre Ödemesi'}`}
                        value={kkOdemeAciklama || ''}
                        onChange={e => setKkOdemeAciklama(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <button type="submit" disabled={isProcessing} className="qw-submit-button">{isProcessing ? 'Kaydediliyor...' : 'Ödemeyi kaydet'}</button>
            </form>
        );


    } else if (aktifModal === 'duzenle_portfoy') {
        title = "Portföy Düzenle";
        icon = "✏️";
        content = (
            <form onSubmit={async (e) => {
                e.preventDefault();
                const target = seciliVeri.ids || seciliVeri.id;
                const success = await portfoyDuzenle(target, { adet, alisFiyati, varlikTuru });
                if (success) close();
            }}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#718096' }}>Sembol</label>
                    <input value={sembol} disabled style={{ ...inputStyle, background: '#edf2f7', color: '#a0aec0' }} />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#718096' }}>Adet</label>
                    <input type="number" value={adet} onChange={e => setAdet(e.target.value)} style={inputStyle} required />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#718096' }}>Maliyet (Birim Alış)</label>
                    <input type="number" value={alisFiyati} onChange={e => setAlisFiyati(e.target.value)} style={inputStyle} required />
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#718096' }}>Varlık Türü</label>
                    <select value={varlikTuru} onChange={e => setVarlikTuru(e.target.value)} style={inputStyle}>
                        {(yatirimTurleri || ["Hisse", "Fon", "Altın", "Döviz"]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <button type="submit" style={{ width: '100%', background: '#3182ce', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>KAYDET</button>
            </form>
        );
    }

    else if (aktifModal === 'bes_kesinti_ekle') {
        title = "Yönetim Gider Kesintisi";
        icon = "⚠️";
        content = (
            <div>
                <p style={{ fontSize: '13px', color: '#718096', margin: '0 0 20px 0' }}>BES hesabınızdan kesilen tutarları buradan takip edin.</p>
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!islemTutar || !islemTarihi) return alert("Lütfen tutar ve tarih giriniz.");
                    const success = await besKesintiEkle(seciliVeri, islemTutar, islemTarihi);
                    if (success) { setIslemTutar(""); close(); }
                }}>
                    <input type="number" value={islemTutar} onChange={e => setIslemTutar(e.target.value)} placeholder="Kesinti Tutarı (₺)" style={{ ...inputStyle, marginBottom: '15px', borderColor: '#fc8181' }} required />
                    <input type="date" value={islemTarihi} onChange={e => setIslemTarihi(e.target.value)} style={{ ...inputStyle, marginBottom: '20px', borderColor: '#fc8181' }} required />
                    <button type="submit" style={{ width: '100%', background: '#c53030', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>KAYDET</button>
                </form>
                {/* LIST OF PAST DEDUCTIONS */}
                <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#2d3748' }}>Geçmiş Kesintiler</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '10px', background: '#fff' }}>
                        {(!seciliVeri?.kesintiler || seciliVeri.kesintiler.length === 0) ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#a0aec0', fontSize: '12px' }}>Henüz kesinti kaydı yok.</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <tbody>
                                    {seciliVeri.kesintiler.sort((a, b) => new Date(b.tarih) - new Date(a.tarih)).map((k) => (
                                        <tr key={k.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px', color: '#334155' }}>{tarihSadeceGunAyYil(k.tarih)}</td>
                                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#c53030' }}>-{formatPara(k.tutar)}</td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}><span onClick={async () => { const success = await besKesintiSil(seciliVeri, k.id); if (success) close(); }} style={{ cursor: 'pointer', fontSize: '14px' }}>🗑️</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    else if (aktifModal === 'tahsilat_ekle') {
        title = "Tahsilat Ekle (Ödeme Al)";
        icon = "💸";
        content = (
            <form onSubmit={async (e) => {
                e.preventDefault();
                const success = await satisTahsilatEkle(seciliVeri.id, tahsilatTutar);
                if (success) close();
            }}>
                <div style={{ marginBottom: '15px', color: '#4a5568' }}>Kalan Alacak: <b>{seciliVeri ? formatPara(seciliVeri.satisFiyati - seciliVeri.tahsilEdilen) : 0}</b></div>
                <input type="number" autoFocus value={tahsilatTutar} onChange={e => setTahsilatTutar(e.target.value)} placeholder="Tahsil Edilen Tutar" style={{ ...inputStyle, marginBottom: '20px' }} required />
                <button type="submit" style={{ width: '100%', background: '#38a169', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>EKLE</button>
            </form>
        );
    }

    else if (aktifModal === 'duzenle_pozisyon') {
        title = "Pozisyon Düzenle";
        icon = "✏️";
        content = (
            <PositionEditModal
                seciliVeri={seciliVeri}
                pozisyonGuncelle={pozisyonGuncelle}
                close={close}
                inputStyle={inputStyle}
            />
        );
    }

    else if (aktifModal === 'gecmis_islem_ekle') {
        title = "Geçmiş İşlem Ekle";
        icon = "🕰️";
        content = (
            <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());

                // Add validation
                if (!data.sembol || !data.adet || !data.alisFiyati || !data.alisTarihi) {
                    alert("Lütfen zorunlu alanları doldurun (Sembol, Adet, Alış Fiyatı, Alış Tarihi).");
                    return;
                }

                const success = await gecmisIslemEkle(data);
                if (success) close();
            }}>
                <div style={{ marginBottom: '15px', background: '#e2e8f0', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#4a5568' }}>
                    ℹ️ <b>Bilgi:</b> Bu işlem nakit bakiyenizi etkilemez. Sadece analiz tablosuna ve portföye eklenir. <br />
                    • Hem Alış hem Satış girerseniz: <b>Kapanmış Pozisyon</b> olur.<br />
                    • Sadece Alış girerseniz: <b>Açık Pozisyon</b> olur.
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}>Varlık (Hisse/Döviz)</label>
                        <input name="sembol" placeholder="Örn: THYAO, USD" style={inputStyle} required />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}>Adet</label>
                        <input name="adet" type="number" step="0.001" placeholder="0" style={inputStyle} required />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#2b6cb0' }}>Alış Fiyatı</label>
                        <input name="alisFiyati" type="number" step="0.01" placeholder="0.00" style={{ ...inputStyle, borderColor: '#63b3ed' }} required />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#2b6cb0' }}>Alış Tarihi</label>
                        <input name="alisTarihi" type="date" style={{ ...inputStyle, borderColor: '#63b3ed' }} required />
                    </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e0', margin: '20px 0' }} />

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#c53030' }}>Satış Fiyatı (Opsiyonel)</label>
                        <input name="satisFiyati" type="number" step="0.01" placeholder="0.00" style={{ ...inputStyle, borderColor: '#fc8181' }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#718096', fontStyle: 'italic' }}>
                            * Satış fiyatı girilirse pozisyon <b>Kapanmış</b> sayılır.
                        </span>
                    </div>
                </div>

                <button type="submit" style={{ width: '100%', background: '#4a5568', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                    GEÇMİŞ İŞLEMİ KAYDET
                </button>
            </form>
        );
    }

    // NEW DELETE CONFIRMATION MODAL
    else if (aktifModal === 'pozisyon_sil_onay') {
        title = "Pozisyonu Sil";
        icon = "🗑️";
        const assetName = seciliVeri?.row?.sembol || "Bu varlığı";

        content = (
            <div>
                <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                    <div style={{ fontSize: '16px', color: '#4a5568', marginBottom: '10px' }}>
                        <b>{assetName}</b> varlığını portföyden silmek istediğinize emin misiniz?
                    </div>
                    <div style={{ fontSize: '13px', color: '#718096' }}>
                        Bu işlem geri alınamaz. Eğer ilgili bir harcama kaydı bulunursa, tutar bakiyenize iade edilecektir.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <button
                        onClick={close}
                        style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#4a5568', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}
                    >
                        İPTAL
                    </button>
                    <button
                        onClick={async () => {
                            if (pozisyonSil && seciliVeri?.row) {
                                setIsProcessing(true);
                                const success = await pozisyonSil(seciliVeri.row);
                                setIsProcessing(false);
                                if (success !== false) close();
                            } else {
                                close();
                            }
                        }}
                        disabled={isProcessing}
                        style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#e53e3e', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', opacity: isProcessing ? 0.7 : 1 }}
                    >
                        {isProcessing ? 'SİLİNİYOR...' : 'SİL'}
                    </button>
                </div>
            </div>
        );
    }
    else if (aktifModal === 'islem_sil_onay') {
        title = "İşlemi Sil";
        icon = "🗑️";
        content = (
            <div>
                <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                    <div style={{ fontSize: '16px', color: '#4a5568', marginBottom: '10px', fontWeight: 'bold' }}>
                        Bu işlemi silmek istediğinize emin misiniz?
                    </div>
                    <div style={{ fontSize: '13px', color: '#718096' }}>
                        Bu işlem kalıcı olarak silinecek ve ilgili bakiye işlemleriniz buna göre güncellenecektir. Analiz tablosundan pozisyon kaldırılacaktır.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <button
                        onClick={close}
                        style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#e2e8f0', color: '#4a5568', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}
                    >
                        İPTAL
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                console.log("SILME TETIKLENDI - islemSil function:", !!islemSil, "seciliVeri:", seciliVeri);
                                // Fallback to seciliVeri if seciliVeri.id is not directly there.
                                const deleteId = seciliVeri?.id || seciliVeri?.row?.id;

                                if (!islemSil) {
                                    alert("Sistemsel Hata: Silme fonksiyonu bulunamadı (islemSil eksik).");
                                    close();
                                    return;
                                }

                                if (!deleteId) {
                                    alert("Silinecek işlem ID'si bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.");
                                    close();
                                    return;
                                }

                                setIsProcessing(true);
                                const success = await islemSil(deleteId);
                                setIsProcessing(false);
                                if (success !== false) close();
                            } catch (error) {
                                console.error("Silme sirasinda hata:", error);
                                setIsProcessing(false);
                                alert("Silme işlemi sırasında bir hata oluştu.");
                            }
                        }}
                        disabled={isProcessing}
                        style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#e53e3e', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', opacity: isProcessing ? 0.7 : 1 }}
                    >
                        {isProcessing ? 'SİLİNİYOR...' : 'SİL'}
                    </button>
                </div>
            </div>
        );
    }

    else if (aktifModal === 'cikis_onay') {
        title = "Çıkış Yap";
        icon = "🚪";
        content = (
            <div>
                <div style={{ marginBottom: '25px', padding: '15px', background: '#fee2e2', borderRadius: '12px', color: '#991b1b', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <div>
                        <strong>Emin misin?</strong>
                        <div style={{ fontSize: '13px', marginTop: '5px' }}>Bu kod (<b>{alanKodu}</b>) ile olan oturumun sonlandırılacak. Kodunu unutma!</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <button onClick={close} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#334155', fontWeight: 'bold', cursor: 'pointer' }}>İPTAL</button>
                    <button onClick={() => { onConfirmLogout && onConfirmLogout(); close(); }} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>EVET, ÇIK</button>
                </div>
            </div>
        );
    }

    // Fallback
    if (!content) return null;

    return (
        <HighQualityModal
            isOpen={!!aktifModal}
            onClose={close}
            title={title}
            icon={icon}
            width={customWidth}
            minHeight={customMinHeight}
        >
            {content}
        </HighQualityModal>
    );

};

export default ModalManager;
