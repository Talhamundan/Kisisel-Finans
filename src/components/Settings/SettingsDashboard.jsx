import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowRight,
    CheckSquare,
    CircleDollarSign,
    Ellipsis,
    FolderKanban,
    KeyRound,
    LockKeyhole,
    Plus,
    Search,
    ShieldCheck,
    Tag,
    WalletCards,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { formatCurrencyPlain, inputStyle, sortTurkishText, tarihSadeceGunAyYil } from '../../utils/helpers';
import { normalizeAreaCode, validateAreaPassword } from '../../utils/areaSecurity';

const normalizeText = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr-TR');

const cleanName = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

const sections = [
    { id: 'budget', label: 'Bütçe', icon: CircleDollarSign },
    { id: 'security', label: 'Güvenlik', icon: ShieldCheck },
    { id: 'categories', label: 'Kategoriler', icon: FolderKanban },
    { id: 'bulk-move', label: 'Toplu Taşıma', icon: CheckSquare },
    { id: 'tags', label: 'Etiketler', icon: Tag },
    { id: 'investment-types', label: 'Yatırım Türleri', icon: WalletCards },
];

const sectionMeta = {
    budget: ['Bütçe', 'Aylık harcama hedefini ve bütçe davranışını yönet.'],
    security: ['Güvenlik', 'Alan kodunu ve alan şifresini yönet.'],
    categories: ['Kategoriler', 'Harcamalarını gruplamak için kullandığın kategorileri yönet.'],
    'bulk-move': ['Toplu Taşıma', 'Geçmiş işlemleri filtreleyip seçerek farklı bir kategoriye taşı.'],
    tags: ['Etiketler', 'İşlemleri kategori dışında esnek biçimde gruplamak için kullandığın etiketleri yönet.'],
    'investment-types': ['Yatırım Türleri', 'Portföyünde kullandığın yatırım türlerini yönet.'],
};

const Dialog = ({ title, children, onClose }) => (
    <div className="settings-dialog-layer" role="presentation">
        <button type="button" className="settings-dialog-backdrop" aria-label="Kapat" onClick={onClose} />
        <div className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title">
            <h3 id="settings-dialog-title">{title}</h3>
            {children}
        </div>
    </div>
);

const SectionHeader = ({ activeSection, actionLabel, onAction }) => {
    const [title, description] = sectionMeta[activeSection] || sectionMeta.budget;
    return (
        <div className="settings-content-header">
            <div>
                <h2>{title}</h2>
                <p>{description}</p>
            </div>
            {actionLabel && (
                <button type="button" className="settings-primary-action" onClick={onAction}>
                    <Plus size={16} />
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

const RowActions = ({ onRename, onDelete }) => (
    <div className="settings-row-actions">
        <button type="button" className="settings-kebab" aria-label="İşlemler">
            <Ellipsis size={17} />
        </button>
        <div className="settings-action-menu">
            {onRename && <button type="button" onClick={onRename}>Yeniden adlandır</button>}
            {onDelete && <button type="button" className="is-danger" onClick={onDelete}>Sil</button>}
        </div>
    </div>
);

const SettingsDashboard = ({
    aylikLimit,
    onLimitChange,
    kategoriListesi = [],
    tumIslemler = [],
    onKategoriUpdate,
    onKategoriRename,
    onBulkCategoryMove,
    etiketler = [],
    ensureTag,
    renameTag,
    deleteTag,
    yatirimTurleri = [],
    onYatirimTuruUpdate,
    onYatirimTuruRename,
    alanKodu,
    veriAlanKodu,
    areaRecord,
    koddanCikis,
    onCreateAreaPassword,
    onChangeAreaPassword,
    onChangeAreaCode,
    gizliMod,
}) => {
    const categories = useMemo(() => sortTurkishText(kategoriListesi || []), [kategoriListesi]);
    const investmentTypes = useMemo(() => sortTurkishText(yatirimTurleri || []), [yatirimTurleri]);
    const [activeSection, setActiveSection] = useState('budget');
    const [budgetInput, setBudgetInput] = useState(String(aylikLimit || ''));
    const [dialog, setDialog] = useState(null);
    const [dialogValue, setDialogValue] = useState('');
    const [dialogTarget, setDialogTarget] = useState(null);
    const [bulkSearch, setBulkSearch] = useState('');
    const [bulkCategoryFilter, setBulkCategoryFilter] = useState('all');
    const [bulkTypeFilter, setBulkTypeFilter] = useState('all');
    const [bulkTargetCategory, setBulkTargetCategory] = useState('');
    const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', nextPassword: '', confirmPassword: '' });
    const [codeForm, setCodeForm] = useState({ nextCode: '', confirmCode: '', currentPassword: '' });

    const transactionCountByCategory = useMemo(() => {
        const counts = new Map();
        (tumIslemler || []).forEach((transaction) => {
            const key = normalizeText(transaction.kategori);
            if (!key) return;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return counts;
    }, [tumIslemler]);

    const filteredTransactions = useMemo(() => {
        const search = normalizeText(bulkSearch);
        return (tumIslemler || [])
            .filter((transaction) => {
                if (bulkCategoryFilter !== 'all' && normalizeText(transaction.kategori) !== normalizeText(bulkCategoryFilter)) return false;
                if (bulkTypeFilter !== 'all' && transaction.islemTipi !== bulkTypeFilter) return false;
                if (!search) return true;
                return normalizeText(`${transaction.aciklama || ''} ${transaction.kategori || ''} ${transaction.tutar || ''}`).includes(search);
            })
            .slice(0, 120);
    }, [bulkCategoryFilter, bulkSearch, bulkTypeFilter, tumIslemler]);

    const selectedIdSet = useMemo(() => new Set(selectedTransactionIds), [selectedTransactionIds]);
    const visibleIds = filteredTransactions.map((transaction) => transaction.id).filter(Boolean);
    const visibleSelectedCount = visibleIds.filter((id) => selectedIdSet.has(id)).length;
    const canMoveSelected = selectedTransactionIds.length > 0 && Boolean(bulkTargetCategory) && !processing;

    useEffect(() => {
        setBudgetInput(String(aylikLimit || ''));
    }, [aylikLimit]);

    useEffect(() => {
        if (!categories.length) return;
        setBulkTargetCategory((current) => categories.includes(current) ? current : '');
        setBulkCategoryFilter((current) => current === 'all' || categories.includes(current) ? current : 'all');
    }, [categories]);

    const openDialog = (type, target = null) => {
        setDialog(type);
        setDialogTarget(target);
        setDialogValue(target?.name || '');
    };

    const closeDialog = () => {
        setDialog(null);
        setDialogTarget(null);
        setDialogValue('');
        setPasswordForm({ currentPassword: '', nextPassword: '', confirmPassword: '' });
        setCodeForm({ nextCode: '', confirmCode: '', currentPassword: '' });
    };

    const handleDialogSubmit = async (event) => {
        event.preventDefault();
        const value = cleanName(dialogValue);
        if (!value) return toast.warning("İsim boş olamaz.");

        setProcessing(true);
        try {
            if (dialog === 'new-category') {
                await onKategoriUpdate?.([...(kategoriListesi || []), value]);
                toast.success("Kategori eklendi.");
            }
            if (dialog === 'rename-category') {
                const ok = await onKategoriRename?.(dialogTarget?.name, value);
                if (!ok) return;
            }
            if (dialog === 'new-tag') {
                const tag = await ensureTag?.(value);
                if (!tag) return;
                toast.success("Etiket eklendi.");
            }
            if (dialog === 'rename-tag') {
                const ok = await renameTag?.(dialogTarget?.id, value);
                if (!ok) return;
            }
            if (dialog === 'new-investment-type') {
                await onYatirimTuruUpdate?.([...(yatirimTurleri || []), value]);
                toast.success("Tür eklendi.");
            }
            if (dialog === 'rename-investment-type') {
                const ok = await onYatirimTuruRename?.(dialogTarget?.name, value);
                if (!ok) return;
            }
            closeDialog();
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteCategory = async (category) => {
        const result = await Swal.fire({
            title: 'Kategori listeden kaldırılsın mı?',
            text: `"${category}" geçmiş kayıtlardan silinmez, sadece seçenek listesinden kalkar.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Kaldır',
            cancelButtonText: 'İptal',
        });
        if (!result.isConfirmed) return;
        await onKategoriUpdate?.((kategoriListesi || []).filter((item) => item !== category));
        toast.success("Kategori listeden kaldırıldı.");
    };

    const handleDeleteInvestmentType = async (type) => {
        const result = await Swal.fire({
            title: 'Yatırım türü kaldırılsın mı?',
            text: `"${type}" sadece seçenek listesinden kaldırılır.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Kaldır',
            cancelButtonText: 'İptal',
        });
        if (!result.isConfirmed) return;
        await onYatirimTuruUpdate?.((yatirimTurleri || []).filter((item) => item !== type));
        toast.success("Tür kaldırıldı.");
    };

    const handleToggleVisible = () => {
        if (!visibleIds.length) return;
        if (visibleSelectedCount === visibleIds.length) {
            setSelectedTransactionIds((current) => current.filter((id) => !visibleIds.includes(id)));
            return;
        }
        setSelectedTransactionIds((current) => Array.from(new Set([...current, ...visibleIds])));
    };

    const handleBulkMove = async (event) => {
        event.preventDefault();
        if (!canMoveSelected) return;
        const result = await Swal.fire({
            title: 'Seçili işlemler taşınsın mı?',
            text: `${selectedTransactionIds.length} işlem "${bulkTargetCategory}" kategorisine taşınacak.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Taşı',
            cancelButtonText: 'İptal',
        });
        if (!result.isConfirmed) return;

        setProcessing(true);
        try {
            const ok = await onBulkCategoryMove?.({ transactionIds: selectedTransactionIds, toCategory: bulkTargetCategory });
            if (ok) setSelectedTransactionIds([]);
        } finally {
            setProcessing(false);
        }
    };

    const actionForSection = {
        categories: ['Yeni Kategori', () => openDialog('new-category')],
        tags: ['Yeni Etiket', () => openDialog('new-tag')],
        'investment-types': ['Yeni Tür', () => openDialog('new-investment-type')],
    }[activeSection];

    const renderContent = () => {
        if (activeSection === 'budget') {
            return (
                <>
                    <SectionHeader activeSection={activeSection} />
                    <form className="settings-budget-row" onSubmit={(event) => {
                        event.preventDefault();
                        const nextLimit = Math.max(0, parseFloat(budgetInput) || 0);
                        onLimitChange?.(nextLimit);
                        toast.success("Bütçe limiti kaydedildi");
                    }}>
                        <label>Aylık bütçe limiti</label>
                        <div className="settings-money-input">
                            <input type="number" min="0" step="1" value={budgetInput} onChange={(event) => setBudgetInput(event.target.value)} />
                            <span>₺</span>
                        </div>
                        <button type="submit">Kaydet</button>
                    </form>
                </>
            );
        }

        if (activeSection === 'security') {
            const hasPassword = Boolean(areaRecord?.passwordConfigured);
            return (
                <>
                    <SectionHeader activeSection={activeSection} />
                    <div className="settings-access-panel">
                        <div className="settings-access-code">
                            <span>Alan Kodu</span>
                            <strong>{alanKodu}</strong>
                        </div>
                        <div className="settings-security-grid">
                            <div className="settings-security-item">
                                <span>Alan Şifresi</span>
                                <strong>{hasPassword ? '••••••••' : 'Henüz oluşturulmadı'}</strong>
                            </div>
                            <div className="settings-security-item">
                                <span>Veri Bağlantısı</span>
                                <strong>{veriAlanKodu === alanKodu ? 'Alan koduyla aynı' : 'Eski veri alanı korunuyor'}</strong>
                            </div>
                        </div>
                        <p>Alan kodu erişim adresidir; finans kayıtları ayrı veri bağlantısı altında kalır. Kod değiştirildiğinde kayıtlar taşınmaz.</p>
                        <div className="settings-security-actions">
                            <button type="button" onClick={() => openDialog('change-code')}>
                                <KeyRound size={16} />
                                Alan Kodunu Değiştir
                            </button>
                            <button type="button" onClick={() => openDialog(hasPassword ? 'change-password' : 'create-password')}>
                                <LockKeyhole size={16} />
                                {hasPassword ? 'Şifreyi Değiştir' : 'Şifre Oluştur'}
                            </button>
                            <button type="button" className="settings-secondary-button" onClick={koddanCikis}>
                                Alan Kodundan Çık
                            </button>
                        </div>
                    </div>
                </>
            );
        }

        if (activeSection === 'categories') {
            return (
                <>
                    <SectionHeader activeSection={activeSection} actionLabel={actionForSection?.[0]} onAction={actionForSection?.[1]} />
                    <div className="settings-list-grid">
                        {categories.map((category) => (
                            <div key={category} className="settings-list-item">
                                <div>
                                    <strong>{category}</strong>
                                    <span>{transactionCountByCategory.get(normalizeText(category)) || 0} işlem</span>
                                </div>
                                <RowActions
                                    onRename={() => openDialog('rename-category', { name: category })}
                                    onDelete={() => handleDeleteCategory(category)}
                                />
                            </div>
                        ))}
                    </div>
                </>
            );
        }

        if (activeSection === 'bulk-move') {
            return (
                <>
                    <SectionHeader activeSection={activeSection} />
                    <div className="settings-history-toolbar">
                        <div className="settings-search">
                            <Search size={16} />
                            <input value={bulkSearch} onChange={(event) => setBulkSearch(event.target.value)} placeholder="İşlem ara..." />
                        </div>
                        <select value={bulkCategoryFilter} onChange={(event) => setBulkCategoryFilter(event.target.value)} style={inputStyle}>
                            <option value="all">Tüm kategoriler</option>
                            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                        <select value={bulkTypeFilter} onChange={(event) => setBulkTypeFilter(event.target.value)} style={inputStyle}>
                            <option value="all">Tüm tipler</option>
                            <option value="gider">Gider</option>
                            <option value="gelir">Gelir</option>
                            <option value="transfer">Transfer</option>
                        </select>
                    </div>
                    <form className="settings-transfer-bar" onSubmit={handleBulkMove}>
                        <button type="button" className="settings-secondary-button" onClick={handleToggleVisible} disabled={visibleIds.length === 0}>
                            {visibleSelectedCount === visibleIds.length && visibleIds.length > 0 ? 'Görünenleri bırak' : 'Görünenleri seç'}
                        </button>
                        <span>{selectedTransactionIds.length} işlem seçili</span>
                        <ArrowRight size={16} />
                        <select value={bulkTargetCategory} onChange={(event) => setBulkTargetCategory(event.target.value)} style={inputStyle}>
                            <option value="">Hedef kategori</option>
                            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                        <button type="submit" disabled={!canMoveSelected}>Taşı</button>
                    </form>
                    <div className="settings-history-table">
                        {filteredTransactions.length === 0 ? (
                            <div className="settings-empty">Eşleşen işlem yok.</div>
                        ) : filteredTransactions.map((transaction) => {
                            const selected = selectedIdSet.has(transaction.id);
                            return (
                                <label key={transaction.id} className={`settings-history-row ${selected ? 'is-selected' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={(event) => {
                                            setSelectedTransactionIds((current) => (
                                                event.target.checked
                                                    ? Array.from(new Set([...current, transaction.id]))
                                                    : current.filter((id) => id !== transaction.id)
                                            ));
                                        }}
                                    />
                                    <span className="settings-history-row__main">
                                        <b>{transaction.aciklama || transaction.kategori || 'İşlem'}</b>
                                        <em>{tarihSadeceGunAyYil(transaction.tarih)} · {transaction.kategori || '-'}</em>
                                    </span>
                                    <strong>{gizliMod ? '**** ₺' : formatCurrencyPlain(parseFloat(transaction.tutar) || 0)}</strong>
                                </label>
                            );
                        })}
                    </div>
                </>
            );
        }

        if (activeSection === 'tags') {
            return (
                <>
                    <SectionHeader activeSection={activeSection} actionLabel={actionForSection?.[0]} onAction={actionForSection?.[1]} />
                    {(etiketler || []).length === 0 ? (
                        <div className="settings-empty-state">
                            <Tag size={34} />
                            <strong>Henüz etiket oluşturmadın</strong>
                            <p>Etiketler ile farklı kategorilerdeki işlemleri ortak başlık altında gruplayabilirsin.</p>
                            <button type="button" onClick={() => openDialog('new-tag')}><Plus size={16} /> Etiket Oluştur</button>
                        </div>
                    ) : (
                        <div className="settings-list-grid">
                            {etiketler.map((tag) => (
                                <div key={tag.id} className="settings-list-item">
                                    <div>
                                        <strong>#{tag.name}</strong>
                                    </div>
                                    <RowActions
                                        onRename={() => openDialog('rename-tag', { id: tag.id, name: tag.name })}
                                        onDelete={() => deleteTag?.(tag)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </>
            );
        }

        if (activeSection === 'investment-types') {
            return (
                <>
                    <SectionHeader activeSection={activeSection} actionLabel={actionForSection?.[0]} onAction={actionForSection?.[1]} />
                    <div className="settings-list-grid settings-list-grid--compact">
                        {investmentTypes.map((type) => (
                            <div key={type} className="settings-list-item">
                                <div>
                                    <strong>{type}</strong>
                                </div>
                                <RowActions
                                    onRename={() => openDialog('rename-investment-type', { name: type })}
                                    onDelete={() => handleDeleteInvestmentType(type)}
                                />
                            </div>
                        ))}
                    </div>
                </>
            );
        }

        return null;
    };

    return (
        <main className="settings-page">
            <div className="settings-page__title">
                <div>
                    <h1>Ayarlar</h1>
                    <p>Finans alanındaki tanımları ve uygulama tercihlerini yönet.</p>
                </div>
            </div>

            <div className="settings-layout">
                <aside className="settings-subnav" aria-label="Ayar bölümleri">
                    {sections.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            className={activeSection === id ? 'is-active' : ''}
                            onClick={() => setActiveSection(id)}
                        >
                            {React.createElement(Icon, { size: 17 })}
                            <span>{label}</span>
                        </button>
                    ))}
                </aside>

                <section className="settings-content-panel">
                    {renderContent()}
                </section>
            </div>

            {dialog && (
                <Dialog title={{
                    'new-category': 'Yeni Kategori',
                    'rename-category': 'Kategori adını değiştir',
                    'new-tag': 'Yeni Etiket',
                    'rename-tag': 'Etiket adını değiştir',
                    'new-investment-type': 'Yeni Yatırım Türü',
                    'rename-investment-type': 'Yatırım türünü değiştir',
                    'create-password': 'Alan Şifresi Oluştur',
                    'change-password': 'Şifreyi Değiştir',
                    'change-code': 'Alan Kodunu Değiştir',
                }[dialog] || 'Düzenle'} onClose={closeDialog}>
                    {['create-password', 'change-password'].includes(dialog) ? (
                        <form onSubmit={async (event) => {
                            event.preventDefault();
                            if (passwordForm.nextPassword !== passwordForm.confirmPassword) return toast.warning("Yeni şifreler uyuşmuyor.");
                            const validation = validateAreaPassword(passwordForm.nextPassword);
                            if (validation) return toast.warning(validation);
                            setProcessing(true);
                            try {
                                const ok = dialog === 'create-password'
                                    ? await onCreateAreaPassword?.(passwordForm)
                                    : await onChangeAreaPassword?.(passwordForm);
                                if (ok) closeDialog();
                            } finally {
                                setProcessing(false);
                            }
                        }} className="settings-dialog-form">
                            {dialog === 'change-password' && (
                                <input
                                    autoFocus
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                                    placeholder="Mevcut şifre"
                                    style={inputStyle}
                                    autoComplete="current-password"
                                />
                            )}
                            <input
                                autoFocus={dialog === 'create-password'}
                                type="password"
                                value={passwordForm.nextPassword}
                                onChange={(event) => setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))}
                                placeholder="Yeni şifre"
                                style={inputStyle}
                                autoComplete="new-password"
                            />
                            <input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                                placeholder="Yeni şifre tekrar"
                                style={inputStyle}
                                autoComplete="new-password"
                            />
                            <small>En az 8 karakter, bir büyük harf, bir küçük harf ve bir rakam.</small>
                            <div>
                                <button type="button" onClick={closeDialog}>İptal</button>
                                <button type="submit" disabled={processing}>{processing ? 'Kaydediliyor...' : 'Kaydet'}</button>
                            </div>
                        </form>
                    ) : dialog === 'change-code' ? (
                        <form onSubmit={async (event) => {
                            event.preventDefault();
                            setProcessing(true);
                            try {
                                const ok = await onChangeAreaCode?.(codeForm);
                                if (ok) closeDialog();
                            } finally {
                                setProcessing(false);
                            }
                        }} className="settings-dialog-form">
                            <div className="settings-readonly-field">
                                <span>Mevcut Alan Kodu</span>
                                <strong>{alanKodu}</strong>
                            </div>
                            <input
                                autoFocus
                                value={codeForm.nextCode}
                                onChange={(event) => setCodeForm((current) => ({ ...current, nextCode: normalizeAreaCode(event.target.value) }))}
                                placeholder="Yeni alan kodu"
                                style={inputStyle}
                            />
                            <input
                                value={codeForm.confirmCode}
                                onChange={(event) => setCodeForm((current) => ({ ...current, confirmCode: normalizeAreaCode(event.target.value) }))}
                                placeholder="Yeni alan kodu tekrar"
                                style={inputStyle}
                            />
                            {areaRecord?.passwordConfigured && (
                                <input
                                    type="password"
                                    value={codeForm.currentPassword}
                                    onChange={(event) => setCodeForm((current) => ({ ...current, currentPassword: event.target.value }))}
                                    placeholder="Mevcut alan şifresi"
                                    style={inputStyle}
                                    autoComplete="current-password"
                                />
                            )}
                            <div>
                                <button type="button" onClick={closeDialog}>İptal</button>
                                <button type="submit" disabled={processing}>{processing ? 'Kaydediliyor...' : 'Alan Kodunu Değiştir'}</button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleDialogSubmit} className="settings-dialog-form">
                            <input
                                autoFocus
                                value={dialogValue}
                                onChange={(event) => setDialogValue(event.target.value)}
                                placeholder={dialog.includes('investment') ? 'Tür adı' : dialog.includes('tag') ? 'Etiket adı' : 'Kategori adı'}
                                style={inputStyle}
                            />
                            <div>
                                <button type="button" onClick={closeDialog}>İptal</button>
                                <button type="submit" disabled={processing}>{processing ? 'Kaydediliyor...' : dialog.startsWith('new') ? 'Ekle' : 'Kaydet'}</button>
                            </div>
                        </form>
                    )}
                </Dialog>
            )}
        </main>
    );
};

export default SettingsDashboard;
