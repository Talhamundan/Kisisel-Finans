import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import BESCard from './BESCard';
import { inputStyle, formatCurrencyPlain, tarihFormatla, COLORS_GENEL, COLORS_PORTFOLIO } from '../../utils/helpers';

const InvestmentDashboard = ({
    gizliMod,
    genelToplamYatirimGucu,
    toplamKarZarar,
    // New Props for Bottom Bar
    kartYatirimToplami,
    toplamDovizVarligi,
    toplamBesVarligi,
    kartNakitToplami,

    genelVarlikVerisi,
    portfoyVerisi,
    portfoy,
    modalAc,
    piyasalariGuncelle,
    guncelleniyor,
    yatirimAl,
    sembol, setSembol,
    adet, setAdet,
    alisFiyati, setAlisFiyati,
    varlikTuru, setVarlikTuru,
    yatirimHesapId, setYatirimHesapId,
    yatirimTurleri,
    hesaplar,
    yatirimIslemleri,
    yatirimArama, setYatirimArama,
    aktifYatirimAy, setAktifYatirimAy,
    mevcutAylar,
    // Actions
    islemSil, fiyatGuncelle,
    // BES
    besVerisi,
    toplamBesYatirimi,
    besGuncelle,
    islemEkle,
    besOdemeYap,
    besOdemeIsle,
    portfoyGuncelDegeri,
    tumIslemler, // NEW PROP
    pozisyonSil // NEW PROP
}) => {
    const [isMobile, setIsMobile] = React.useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= 767;
    });

    React.useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 767);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const cardStyle = {
        background: 'white',
        borderRadius: '20px',
        padding: '25px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
        border: '1px solid rgba(255,255,255,0.8)'
    };
    const formatPara = (tutar) => gizliMod ? "**** ₺" : formatCurrencyPlain(tutar);

    const COLORS_MAP = {
        'Hisse': '#3182ce',
        'Döviz': '#38a169',
        'BES': '#805ad5',
        'Nakit': '#dd6b20'
    };

    const aggregatedPortfoy = React.useMemo(() => {
        const groups = {};
        (portfoy || []).forEach(item => {
            const key = (item.sembol || "").trim().toUpperCase();
            if (!groups[key]) {
                groups[key] = {
                    ...item,
                    ids: [item.id],
                    toplamMaliyet: item.adet * item.alisFiyati,
                    guncelFiyat: item.guncelFiyat || item.alisFiyati
                };
            } else {
                groups[key].adet += parseFloat(item.adet);
                groups[key].toplamMaliyet += (parseFloat(item.adet) * parseFloat(item.alisFiyati));
                groups[key].ids.push(item.id);
                if (!groups[key].guncelFiyat && item.guncelFiyat) {
                    groups[key].guncelFiyat = item.guncelFiyat;
                }
            }
        });

        return Object.values(groups).map(g => ({
            ...g,
            alisFiyati: g.toplamMaliyet / g.adet,
            id: g.ids[0] // Use first ID as key
        }));
    }, [portfoy]);

    return (
        <div>
            {/* 1. SATIR: ÖZET + GENEL DAĞILIM */}
            <div className="responsive-grid-2 investment-grid-top" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', marginBottom: '30px' }}>
                {/* SOL KART: TOPLAM ÖZET */}
                <div className="responsive-card investment-card" style={{ ...cardStyle, padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="card-title-sm">TOPLAM YATIRIM VARLIĞI</div>
                    <div className="text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>
                        Portföy + yatırım hesap bakiyesi
                    </div>

                    <div className="kpi-amount" style={{ fontSize: '32px', marginTop: '18px' }}>
                        {formatPara(genelToplamYatirimGucu)}
                    </div>

                    <div className="investment-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '25px', fontSize: '14px', color: '#4a5568', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #edf2f7' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3182ce' }}></div>
                            <span>Hisse: <b>{formatPara(kartYatirimToplami)}</b></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#38a169' }}></div>
                            <span>Döviz: <b>{formatPara(toplamDovizVarligi)}</b></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#805ad5' }}></div>
                            <span>BES: <b>{formatPara(toplamBesVarligi)}</b></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#dd6b20' }}></div>
                            <span>Nakit: <b>{formatPara(kartNakitToplami)}</b></span>
                        </div>
                    </div>
                </div>

                {/* SAĞ KART: GENEL DAĞILIM PASTA GRAFİĞİ */}
                <div className="responsive-card investment-card" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '280px' }}>
                    {genelToplamYatirimGucu > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={genelVarlikVerisi || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={isMobile ? false : ({ name }) => name}
                                >
                                    {(genelVarlikVerisi || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS_MAP[entry.name] || COLORS_GENEL[index % COLORS_GENEL.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => gizliMod ? "****" : formatPara(value)}
                                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ color: '#cbd5e0', fontSize: '13px' }}>Veri Yok</div>
                    )}
                </div>
            </div>

            {/* 2. SATIR: PORTFÖY TABLOSU VE VARLIK DAĞILIMI */}
            <div className="responsive-grid-2 investment-grid-middle" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', marginBottom: '30px' }}>

                {/* SOL: PORTFÖY TABLOSU */}
                <div className="responsive-card investment-card" style={cardStyle}>
                    <div className="investment-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="card-title">Portföy Detayları</div>
                            <span style={{ fontSize: '11px', color: toplamKarZarar >= 0 ? 'green' : 'red', fontWeight: 'bold', background: toplamKarZarar >= 0 ? '#f0fff4' : '#fff5f5', padding: '2px 8px', borderRadius: '999px' }}>
                                K/Z: {toplamKarZarar > 0 ? '+' : ''}{formatPara(toplamKarZarar)}
                            </span>
                        </div>
                        <button onClick={piyasalariGuncelle} disabled={guncelleniyor} className="btn-ui btn-ui-primary">
                            {guncelleniyor ? 'Güncelleniyor...' : 'Fiyatları Güncelle'}
                        </button>
                    </div>
                    <div className="investment-table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="investment-portfolio-table" style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', color: '#333', minWidth: '500px' }}>
                            <thead><tr style={{ textAlign: 'left', color: '#aaa', borderBottom: '1px solid #eee' }}><th style={{ padding: '10px' }}>Varlık</th><th style={{ padding: '10px' }}>Adet</th><th style={{ padding: '10px' }}>Maliyet (Ort.)</th><th style={{ padding: '10px' }}>Güncel F.</th><th style={{ padding: '10px' }}>Değer</th><th style={{ padding: '10px' }}>K/Z</th><th></th><th></th></tr></thead>
                            <tbody>{aggregatedPortfoy.map(p => {
                                const guncel = p.adet * (p.guncelFiyat || p.alisFiyati);
                                const kar = guncel - (p.adet * p.alisFiyati);
                                return (<tr key={p.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                    <td style={{ padding: '12px 0' }}><b>{p.sembol}</b></td>
                                    <td>{gizliMod ? '****' : p.adet}</td>
                                    <td>{formatPara(p.alisFiyati)}</td>
                                    <td style={{ padding: '5px' }}><input key={p.guncelFiyat} type="number" defaultValue={p.guncelFiyat} onBlur={(e) => p.ids.forEach(id => fiyatGuncelle(id, e.target.value))} style={{ ...inputStyle, width: '80px', padding: '5px', background: '#f7fafc' }} disabled={gizliMod} /></td>
                                    <td style={{ fontWeight: 'bold' }}>{formatPara(guncel)}</td>
                                    <td style={{ color: kar >= 0 ? 'green' : 'red' }}>{gizliMod ? '***' : <>{formatPara(kar)}</>}</td>
                                    <td>
                                        <button onClick={() => modalAc('satis', p)} style={{ background: '#edf2f7', color: '#333', border: 'none', borderRadius: '5px', fontSize: '12px', padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold' }}>Sat</button>
                                        <span onClick={() => modalAc('duzenle_portfoy', p)} style={{ cursor: 'pointer', marginLeft: '5px' }}>✏️</span>
                                        <span onClick={() => modalAc('pozisyon_sil_onay', { row: p })} style={{ cursor: 'pointer', fontSize: '14px', marginLeft: '5px' }}>🗑️</span>
                                    </td>
                                    <td></td> {/* Removed extra column/button to cleanup */}
                                </tr>)
                            })}</tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: '10px', fontSize: '11px', color: '#a0aec0', textAlign: 'right', fontStyle: 'italic' }}>
                        ⚠️ BIST verileri Yahoo Finance kaynaklı olup 15 dk gecikmeli olabilir.
                    </div>
                </div>

                {/* SAĞ: VARLIK DAĞILIMI */}
                <div className="responsive-card investment-card" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {(portfoy || []).length > 0 ? (
                        <>
                            <div className="card-title-sm" style={{ marginBottom: 8 }}>Portföy Dağılımı</div>
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie
                                        data={portfoyVerisi || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={68}
                                        outerRadius={100}
                                        startAngle={90}
                                        endAngle={-270}
                                        paddingAngle={3}
                                        cornerRadius={8}
                                        dataKey="value"
                                    >
                                        {(portfoyVerisi || []).map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COLORS_PORTFOLIO[index % COLORS_PORTFOLIO.length]}
                                                stroke="#f9fafb"
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value, name) => [
                                            gizliMod ? '****' : formatPara(value),
                                            name
                                        ]}
                                        contentStyle={{
                                            borderRadius: 12,
                                            border: 'none',
                                            boxShadow: '0 10px 25px rgba(15,23,42,0.15)',
                                            fontSize: 12
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ marginTop: 4, fontSize: 18, fontWeight: 'bold', color: '#2d3748' }}>
                                {formatPara(portfoyGuncelDegeri)}
                            </div>
                        </>
                    ) : (
                        <p style={{ fontSize: '12px', color: '#aaa' }}>Henüz varlık yok.</p>
                    )}
                </div>
            </div>

            {/* BES MODÜLÜ */}
            <BESCard
                besVerisi={besVerisi}
                toplamBesYatirimi={toplamBesYatirimi}
                besGuncelle={besGuncelle}
                islemEkle={islemEkle}
                hesaplar={hesaplar}
                besOdemeYap={besOdemeYap}
                besOdemeIsle={besOdemeIsle}
                modalAc={modalAc}
                aktifYatirimAy={aktifYatirimAy}
                yatirimIslemleri={yatirimIslemleri}
                gizliMod={gizliMod}
            />

            {/* 3. SATIR: YENİ İŞLEM VE GEÇMİŞ TABLOSU */}
            <div className="responsive-grid-2 investment-grid-main" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px', marginBottom: '30px', alignItems: 'start' }}>
                {/* SOL: YENİ YATIRIM EKLEME FORM */}
                <div className="responsive-card investment-card investment-fixed-height" style={{ ...cardStyle, height: '500px', display: 'flex', flexDirection: 'column', background: '#f0fff4', border: '1px solid #9ae6b4' }}>
                    <div className="card-title" style={{ marginBottom: '16px', color: '#2f855a' }}>Yeni Yatırım Varlığı Al</div>
                    <form onSubmit={yatirimAl} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input placeholder="Sembol (THYAO, GRAM...)" value={sembol} onChange={e => setSembol(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }} />
                        <div className="investment-form-row" style={{ display: 'flex', gap: '10px' }}>
                            <input type="number" placeholder="Adet" value={adet} onChange={e => setAdet(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }} />
                            <input type="number" placeholder="Alış Fiyatı" value={alisFiyati} onChange={e => setAlisFiyati(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }} />
                        </div>
                        <select value={varlikTuru} onChange={e => setVarlikTuru(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }}>
                            {(yatirimTurleri || []).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={yatirimHesapId} onChange={e => setYatirimHesapId(e.target.value)} style={{ ...inputStyle, border: '1px solid #9ae6b4' }} required>
                            <option value="">Ödeme Yapılacak Hesap Seç</option>
                            {(hesaplar || []).map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatPara(h.guncelBakiye)})</option>)}
                        </select>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'green' }}>Toplam: {adet && alisFiyati ? formatPara(adet * alisFiyati) : formatPara(0)}</div>
                        <button type="submit" disabled={guncelleniyor} className="btn-ui btn-ui-success">
                            {guncelleniyor ? 'İşleniyor...' : 'Varlık Ekle'}
                        </button>
                    </form>
                </div>

                {/* SAĞ: YATIRIM İŞLEM GEÇMİŞİ */}
                <div className="responsive-card investment-card investment-fixed-height" style={{ ...cardStyle, maxWidth: '100%', overflow: 'hidden', height: '500px', display: 'flex', flexDirection: 'column' }}>
                    {/* ÜST BÖLÜM: AYLAR */}
                    <div className="investment-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                        <div className="card-title">Yatırım İşlem Geçmişi</div>
                        <div className="no-scrollbar" style={{ display: 'flex', gap: '5px', alignItems: 'center', overflowX: 'auto', paddingBottom: '5px', maxWidth: '100%', whiteSpace: 'nowrap' }}>
                            {(mevcutAylar || []).map(ay => (
                                <button key={ay} onClick={() => setAktifYatirimAy(ay)} style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '15px', border: 'none', cursor: 'pointer', background: aktifYatirimAy === ay ? '#2c3e50' : '#edf2f7', color: aktifYatirimAy === ay ? 'white' : '#4a5568', fontWeight: 'bold', flexShrink: 0 }}>{ay}</button>
                            ))}
                        </div>
                    </div>

                    {/* GELİŞMİŞ FİLTRELEME ALANI */}
                    <div style={{ background: '#f7fafc', padding: '15px', borderRadius: '10px', marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid #edf2f7' }}>
                        <div style={{ flex: 1, minWidth: '150px', display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 10px' }}>
                            <span style={{ fontSize: '14px', marginRight: '5px' }}>🔍</span>
                            <input
                                type="text"
                                placeholder="Yatırım işlem ara..."
                                value={yatirimArama}
                                onChange={(e) => setYatirimArama(e.target.value)}
                                style={{ border: 'none', outline: 'none', padding: '10px', width: '100%', fontSize: '13px', background: 'transparent', color: '#333' }}
                            />
                            {yatirimArama && <span onClick={() => setYatirimArama("")} style={{ cursor: 'pointer', color: '#aaa', fontWeight: 'bold' }}>X</span>}
                        </div>
                    </div>

                    {/* LİSTE */}
                    <div className="custom-scrollbar investment-history-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                        {(yatirimIslemleri || []).length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#a0aec0', marginTop: '50px', fontStyle: 'italic' }}>Bu ay için işlem bulunamadı.</div>
                        ) : (
                            <table className="investment-history-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '640px' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                    <tr style={{ color: '#718096', textAlign: 'left', fontSize: '12px' }}>
                                        <th style={{ padding: '10px' }}>Tarih</th>
                                        <th style={{ padding: '10px' }}>Hesap</th>
                                        <th style={{ padding: '10px' }}>Tür</th>
                                        <th style={{ padding: '10px' }}>Adet</th>
                                        <th style={{ padding: '10px' }}>B.Fiyat</th>
                                        <th style={{ padding: '10px' }}>Açıklama</th>
                                        <th style={{ padding: '10px' }}>Tutar</th>
                                        <th style={{ padding: '10px' }}></th>
                                        <th style={{ padding: '10px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(yatirimIslemleri || []).map(i => {
                                        const hesap = (hesaplar || []).find(h => h.id === i.hesapId);
                                        const hesapAdi = hesap ? hesap.hesapAdi : 'Silinmiş Hesap';
                                        return (
                                            <tr key={i.id} style={{ borderBottom: '1px solid #f7fafc' }}>
                                                <td style={{ padding: '10px', color: '#718096' }}>{tarihFormatla(i.tarih)}</td>
                                                <td style={{ padding: '10px' }}>{hesapAdi}</td>
                                                <td style={{ padding: '10px' }}>{i.yatirimTuru || i.kategori || "Diğer"}</td>
                                                <td style={{ padding: '10px' }}>{i.adet ? i.adet : '-'}</td>
                                                <td style={{ padding: '10px' }}>{i.birimFiyat ? formatPara(i.birimFiyat) : '-'}</td>
                                                <td style={{ padding: '10px' }}>{i.aciklama}</td>
                                                <td style={{ padding: '10px', fontWeight: 'bold', color: i.islemTipi === 'yatirim_alis' ? 'red' : 'green' }}>{formatPara(i.tutar)}</td>
                                                <td><span onClick={() => modalAc('duzenle_islem', i)} style={{ cursor: 'pointer' }}>✏️</span></td>
                                                <td><span onClick={() => islemSil(i.id)} style={{ cursor: 'pointer' }}>🗑️</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                    {/* ÖZET: YATIRIM NAKİT AKIŞI */}
                    <div className="investment-flow-summary" style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: '#718096', fontSize: '14px', fontWeight: 'bold' }}>
                            Aylık Yatırım Nakit Akışı ({aktifYatirimAy})
                        </div>
                        {(() => {
                            // STRICT CALCULATION RULE:
                            // BUY (Alış) -> Positive (+) [Capital Injection]
                            // SELL (Satış) -> Negative (-) [Capital Withdrawal]
                            // Net Flow = Sum(Buy) - Sum(Sell)

                            const totalBuy = (yatirimIslemleri || [])
                                .filter(i => i.islemTipi === 'yatirim_alis')
                                .reduce((acc, curr) => acc + parseFloat(curr.tutar || 0), 0);

                            const totalSell = (yatirimIslemleri || [])
                                .filter(i => i.islemTipi === 'yatirim_satis')
                                .reduce((acc, curr) => acc + parseFloat(curr.tutar || 0), 0);

                            const netFlow = totalBuy - totalSell;
                            const isPositive = netFlow > 0;
                            const isZero = Math.abs(netFlow) < 0.01;

                            return (
                                <div style={{
                                    fontSize: '18px', // text-lg equivalent
                                    fontWeight: 'bold',
                                    color: isZero ? '#718096' : (isPositive ? '#38a169' : '#e53e3e')
                                }}>
                                    {isZero ? (
                                        <span>{formatPara(0)}</span>
                                    ) : (
                                        <span>
                                            {isPositive ? '+' : '-'}{formatPara(Math.abs(netFlow))}
                                        </span>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>

            </div>

            {/* PORTFOLIO ANALYSIS TABLE (ALL TIME) */}
            <PortfolioAnalysisTable tumIslemler={tumIslemler} formatPara={formatPara} modalAc={modalAc} pozisyonSil={pozisyonSil} portfoy={portfoy} islemSil={islemSil} />


            <footer style={{ textAlign: 'center', marginTop: '30px', padding: '10px', color: '#a0aec0', fontSize: '12px' }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>MUNDAN BİLİŞİM</p>
            </footer>
        </div >
    );
}

// Safe rendering helper
const safeVal = (val, suffix = "") => val ? val + suffix : "";

const PortfolioAnalysisTable = ({ tumIslemler, formatPara, modalAc, portfoy }) => {
    const [hoverIndex, setHoverIndex] = React.useState(-1); // For hover effect

    // Create Price Map for Real-time valuations
    const priceMap = React.useMemo(() => {
        const map = {};
        (portfoy || []).forEach(p => {
            if (p.sembol && p.guncelFiyat) {
                map[p.sembol.toUpperCase()] = p.guncelFiyat;
            }
        });
        return map;
    }, [portfoy]);

    const analysisData = React.useMemo(() => {
        if (!tumIslemler) return { rows: [], totalRealizedProfit: 0 };

        // 1. Filter and Sort Chronologically (Oldest First) for FIFO
        const allTransactions = (tumIslemler || []).filter(i =>
            !i.analizdenGizle && ( // Filter out items hidden from analysis
                i.kategori === 'Yatırım' ||
                i.islemTipi === 'yatirim_alis' ||
                i.islemTipi === 'yatirim_satis'
            )
        ).map(i => ({
            ...i,
            // USE ANALYSIS OVERRIDES IF PRESENT
            adet: i.analiz_adet !== undefined ? i.analiz_adet : i.adet,
            birimFiyat: i.analiz_birimFiyat !== undefined ? i.analiz_birimFiyat : i.birimFiyat,
            tutar: i.analiz_tutar !== undefined ? i.analiz_tutar : i.tutar,
            // Date override if needed? Usually date is less critical to override but let's allow it
            tarih: i.analiz_tarih ? i.analiz_tarih : i.tarih
        }))
            .sort((a, b) => {
                const dA = a.tarih?.seconds || 0;
                const dB = b.tarih?.seconds || 0;
                return dA - dB; // ASCENDING for FIFO processing
            });

        // 2. Group by Symbol
        const transactionsBySymbol = {};
        allTransactions.forEach(t => {
            const rawSembol = (t.aciklama || "").replace(" Alış", "").replace(" Satış", "").trim().toUpperCase();
            // Fallback to 'sembol' field if exists, or parse from description
            const sembol = t.sembol || rawSembol;
            if (!transactionsBySymbol[sembol]) transactionsBySymbol[sembol] = [];
            transactionsBySymbol[sembol].push(t);
        });

        let totalRealizedProfit = 0;
        const displayRows = [];

        // 3. Process FIFO per Symbol
        Object.keys(transactionsBySymbol).forEach(sembol => {
            const transactions = transactionsBySymbol[sembol];
            const buyQueue = []; // Holds open buy lots

            transactions.forEach(t => {
                const isSell = t.islemTipi === 'yatirim_satis';
                const isBuy = t.islemTipi === 'yatirim_alis';
                const qty = parseFloat(t.adet) || 0;
                const price = parseFloat(t.birimFiyat) || 0;

                if (isBuy) {
                    buyQueue.push({
                        id: t.id,
                        sembol,
                        tarihObj: t.tarih?.seconds,
                        tarihStr: t.tarih?.seconds ? new Date(t.tarih.seconds * 1000).toLocaleDateString('tr-TR') : '-',
                        alisFiyati: price,
                        originalQty: qty,
                        remainingQty: qty,
                        originalTx: t
                    });
                } else if (isSell) {
                    let qtyToSell = qty;
                    while (qtyToSell > 0 && buyQueue.length > 0) {
                        const currentLot = buyQueue[0];
                        if (currentLot.remainingQty > qtyToSell) {
                            const soldQty = qtyToSell;
                            const closedChunk = {
                                id: t.id + '_closed_' + currentLot.id,
                                sembol,
                                historyDateStr: t.tarih?.seconds ? new Date(t.tarih.seconds * 1000).toLocaleDateString('tr-TR') : '-', // Use SELL date in history? Or keep buy date?
                                // Actually user might want to see when it was sold or bought. 
                                // Standard is usually open date. 
                                tarihStr: currentLot.tarihStr, // Keep open date
                                type: 'Satış',
                                adet: soldQty,
                                alisFiyati: currentLot.alisFiyati,
                                satisFiyati: price,
                                kar: (price - currentLot.alisFiyati) * soldQty,
                                margin: ((price / currentLot.alisFiyati) - 1) * 100,
                                isClosed: true,
                                buyContext: currentLot.originalTx,
                                sellContext: t
                            };
                            totalRealizedProfit += closedChunk.kar;
                            displayRows.push(closedChunk);
                            currentLot.remainingQty -= soldQty;
                            qtyToSell = 0;
                        } else {
                            const soldQty = currentLot.remainingQty;
                            const closedChunk = {
                                id: t.id + '_closed_' + currentLot.id,
                                sembol,
                                tarihStr: currentLot.tarihStr,
                                type: 'Satış',
                                adet: soldQty,
                                alisFiyati: currentLot.alisFiyati,
                                satisFiyati: price,
                                kar: (price - currentLot.alisFiyati) * soldQty,
                                margin: ((price / currentLot.alisFiyati) - 1) * 100,
                                isClosed: true,
                                buyContext: currentLot.originalTx,
                                sellContext: t
                            };
                            totalRealizedProfit += closedChunk.kar;
                            displayRows.push(closedChunk);
                            qtyToSell -= soldQty;
                            currentLot.remainingQty = 0;
                            buyQueue.shift();
                        }
                    }
                }
            });

            buyQueue.forEach(lot => {
                if (lot.remainingQty > 0.0001) {
                    // REAL-TIME P/L CALCULATION FOR OPEN POSITIONS
                    const currentPrice = priceMap[sembol.toUpperCase()] || 0;
                    const kar = currentPrice > 0 ? (currentPrice - lot.alisFiyati) * lot.remainingQty : 0;
                    const margin = currentPrice > 0 ? ((currentPrice / lot.alisFiyati) - 1) * 100 : 0;

                    displayRows.push({
                        id: lot.id + '_open',
                        sembol,
                        tarihStr: lot.tarihStr,
                        type: 'Alış',
                        adet: lot.remainingQty,
                        alisFiyati: lot.alisFiyati,
                        satisFiyati: currentPrice, // SHOW CURRENT PRICE IF OPEN
                        kar: kar, // POTENTIAL PROFIT
                        margin: margin,
                        isClosed: false,
                        buyContext: lot.originalTx
                    });
                }
            });
        });

        return { rows: displayRows.reverse(), totalRealizedProfit };

    }, [tumIslemler, priceMap]);

    return (
        <div className="responsive-card investment-card investment-analysis-card" style={{ background: 'white', borderRadius: '20px', padding: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', border: '1px solid rgba(255,255,255,0.8)', marginTop: '30px' }}>
            <div className="investment-analysis-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#2d3748' }}>📊 Portföy İşlem Analiz (Pozisyon Bazlı)</h3>
                <div className="investment-analysis-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={() => modalAc('gecmis_islem_ekle')}
                        style={{
                            background: '#718096',
                            color: 'white',
                            border: 'none',
                            padding: '10px 15px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <span style={{ fontSize: '16px', lineHeight: '1' }}>+</span> Geçmiş İşlem Ekle
                    </button>
                    <div style={{ background: analysisData.totalRealizedProfit >= 0 ? '#f0fff4' : '#fff5f5', padding: '10px 20px', borderRadius: '10px', border: `1px solid ${analysisData.totalRealizedProfit >= 0 ? '#c6f6d5' : '#fed7d7'}` }}>
                        <div style={{ fontSize: '12px', color: '#718096', fontWeight: 'bold' }}>TOPLAM REALİZE KAR</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: analysisData.totalRealizedProfit >= 0 ? 'green' : '#e53e3e' }}>
                            {analysisData.totalRealizedProfit > 0 ? '+' : ''}{formatPara(analysisData.totalRealizedProfit)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="investment-table-wrap" style={{ overflowX: 'auto' }}>
                <table className="investment-analysis-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#333' }}>
                    <thead>
                        <tr style={{ background: '#f7fafc', color: '#4a5568', textAlign: 'left' }}>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Hisse</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Alış Tarihi</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Adet</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Alış Fiyatı</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Satış Fiyatı</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Kar (₺)</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Marj (%)</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}></th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}></th> {/* Delete Col */}
                        </tr>
                    </thead>
                    <tbody>
                        {analysisData.rows.length === 0 ? (
                            <tr><td colSpan="9" style={{ padding: '20px', textAlign: 'center', color: '#a0aec0' }}>Henüz açılmış bir pozisyon bulunmuyor.</td></tr>
                        ) : (
                            analysisData.rows.map((row, index) => {
                                let rowBg = 'transparent';
                                if (row.isClosed) {
                                    rowBg = row.kar >= 0 ? '#f0fff4' : '#fff5f5';
                                }

                                const isHovered = hoverIndex === index;

                                return (
                                    <tr key={row.id + index} style={{ borderBottom: '1px solid #edf2f7', background: rowBg }}>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{safeVal(row.sembol)}</td>
                                        <td style={{ padding: '12px', color: '#718096' }}>{safeVal(row.tarihStr)}</td>
                                        <td style={{ padding: '12px' }}>{Math.round(parseFloat(row.adet || 0))}</td>
                                        <td style={{ padding: '12px' }}>{formatPara(row.alisFiyati)}</td>
                                        <td style={{ padding: '12px' }}>{row.isClosed ? formatPara(row.satisFiyati) : '-'}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: row.isClosed ? (row.kar >= 0 ? 'green' : 'red') : '#a0aec0' }}>
                                            {row.isClosed ? formatPara(row.kar) : '-'}
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: row.isClosed ? (row.margin >= 0 ? 'green' : 'red') : '#a0aec0' }}>
                                            {row.isClosed ? `%${(row.margin || 0).toFixed(2)}` : '-'}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span
                                                onClick={() => modalAc('duzenle_pozisyon', {
                                                    sembol: row.sembol,
                                                    isClosed: row.isClosed,
                                                    buy: { ...row.buyContext, alisFiyati: row.alisFiyati, tarihStr: row.tarihStr, adet: row.adet },
                                                    sell: row.isClosed ? { ...row.sellContext, satisFiyati: row.satisFiyati } : null,
                                                    guncelFiyat: !row.isClosed ? row.satisFiyati : null // Pass current price for open pos
                                                })}
                                                onMouseEnter={() => setHoverIndex(index)}
                                                onMouseLeave={() => setHoverIndex(-1)}
                                                style={{
                                                    cursor: 'pointer',
                                                    fontSize: '16px',
                                                    display: 'inline-block',
                                                    transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                                                    transition: 'transform 0.2s',
                                                    filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none'
                                                }}
                                                title="Pozisyonu Düzenle"
                                            >
                                                ✏️
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <span
                                                onClick={() => {
                                                    // Determine the underlying transaction ID to delete from nakit_islemleri
                                                    const txIdToDelete = row.isClosed ? row.sellContext?.id : row.buyContext?.id;
                                                    if (txIdToDelete) {
                                                        // Fallback to normal delete modal
                                                        modalAc('islem_sil_onay', { id: txIdToDelete, type: 'islem' });
                                                    } else {
                                                        alert("Silinecek işlem ID'si bulunamadı.");
                                                    }
                                                }}
                                                onMouseEnter={() => setHoverIndex(index + 1000)} // Different index for hover
                                                onMouseLeave={() => setHoverIndex(-1)}
                                                style={{
                                                    cursor: 'pointer',
                                                    fontSize: '16px',
                                                    display: 'inline-block',
                                                    transform: hoverIndex === (index + 1000) ? 'scale(1.2)' : 'scale(1)',
                                                    transition: 'transform 0.2s',
                                                    filter: hoverIndex === (index + 1000) ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none'
                                                }}
                                                title="İşlemi Sil"
                                            >
                                                🗑️
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InvestmentDashboard;
