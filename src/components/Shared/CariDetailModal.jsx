import { ArrowDownRight, ArrowUpRight, CalendarClock, Edit3 } from 'lucide-react';
import HighQualityModal from './HighQualityModal';
import { IconTile, StatusBadge } from './PremiumUI';
import { formatCurrencyPlain, toDateSafe } from '../../utils/helpers';

const formatDate = (value) => {
    const date = toDateSafe(value);
    if (!date) return 'Tarih yok';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
};

const formatMoney = (value, hidden = false) => hidden ? '**** ₺' : formatCurrencyPlain(value);

const ItemRow = ({ item, gizliMod, modalAc }) => {
    const isReceivable = item.displayType === 'ALACAK';
    return (
        <div className="cari-detail-row">
            <IconTile icon={isReceivable ? ArrowDownRight : ArrowUpRight} tone={isReceivable ? 'success' : 'warning'} />
            <div className="cari-detail-row__main">
                <strong>{item.displayDescription || item.aciklama || item.ad || 'İşlem'}</strong>
                <span><CalendarClock size={13} /> {formatDate(item.displayDueDate || item.sonOdemeTarihi)}</span>
            </div>
            <div className="cari-detail-row__side">
                <b className={isReceivable ? 'is-success' : 'is-danger'}>{formatMoney(item.displayAmount, gizliMod)}</b>
                <button type="button" onClick={() => modalAc?.('borc_ode', item)}>
                    {isReceivable ? 'Tahsil Et' : 'Ödeme Yap'}
                </button>
                <button type="button" className="is-ghost" aria-label="Düzenle" onClick={() => modalAc?.('duzenle_borc', item)}>
                    <Edit3 size={14} />
                </button>
            </div>
        </div>
    );
};

const CompletedRow = ({ item, gizliMod }) => (
    <div className="cari-detail-row is-muted">
        <IconTile icon={item.displayType === 'ALACAK' ? ArrowDownRight : ArrowUpRight} tone="neutral" />
        <div className="cari-detail-row__main">
            <strong>{item.displayDescription || item.aciklama || item.ad || 'İşlem'}</strong>
            <span>{item.displayType === 'ALACAK' ? 'Tahsil edildi' : 'Ödendi'} · {formatDate(item.tamamlanmaTarihi || item.completedAt || item.sonIslemTarihi)}</span>
        </div>
        <div className="cari-detail-row__side">
            <b>{formatMoney(item.toplamTutar ?? item.tutar, gizliMod)}</b>
        </div>
    </div>
);

const CariDetailModal = ({ summary, isOpen, onClose, gizliMod = false, modalAc }) => {
    if (!summary) return null;
    const netTone = summary.netBalance >= 0 ? 'success' : 'danger';
    const netLabel = summary.netBalance >= 0 ? 'Alacak' : 'Verecek';

    return (
        <HighQualityModal
            isOpen={isOpen}
            onClose={onClose}
            title={summary.name}
            icon="👤"
            width="min(760px, calc(100vw - 32px))"
        >
            <div className="cari-detail">
                <div className="cari-detail-metrics">
                    <div>
                        <span>Açık Alacak</span>
                        <strong className="is-success">{formatMoney(summary.activeReceivable, gizliMod)}</strong>
                    </div>
                    <div>
                        <span>Açık Verecek</span>
                        <strong className="is-danger">{formatMoney(summary.activePayable, gizliMod)}</strong>
                    </div>
                    <div>
                        <span>Net Cari Bakiye</span>
                        <strong className={`is-${netTone}`}>{formatMoney(Math.abs(summary.netBalance), gizliMod)}</strong>
                        <StatusBadge tone={netTone}>{netLabel}</StatusBadge>
                    </div>
                </div>

                <div className="cari-detail-section">
                    <h4>Aktif İşlemler</h4>
                    <div className="cari-detail-list">
                        {summary.activeItems.map((item) => <ItemRow key={item.id} item={item} gizliMod={gizliMod} modalAc={modalAc} />)}
                        {summary.activeItems.length === 0 && <p className="cari-detail-empty">Aktif işlem yok.</p>}
                    </div>
                </div>

                <div className="cari-detail-section">
                    <h4>Tamamlanan İşlemler</h4>
                    <div className="cari-detail-list">
                        {summary.completedItems.map((item) => <CompletedRow key={item.id} item={item} gizliMod={gizliMod} />)}
                        {summary.completedItems.length === 0 && <p className="cari-detail-empty">Tamamlanan işlem yok.</p>}
                    </div>
                </div>
            </div>
        </HighQualityModal>
    );
};

export default CariDetailModal;
