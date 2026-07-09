import HighQualityModal from '../Shared/HighQualityModal';
import { inputStyle } from '../../utils/helpers';
import {
    EVENT_TYPE_META,
    RECURRENCE_LABELS,
    CURRENCY_OPTIONS,
} from '../../modules/calendar/constants';

const CalendarEventForm = ({
    isOpen,
    onClose,
    form,
    updateField,
    onSave,
    saving,
    editingId,
}) => {
    const typeOptions = Object.entries(EVENT_TYPE_META);

    return (
        <HighQualityModal
            isOpen={isOpen}
            onClose={onClose}
            title={editingId ? 'Olayı Düzenle' : 'Yeni Finansal Olay'}
            icon="📅"
            width="480px"
        >
            <form onSubmit={onSave} className="cal-form">
                <label className="cal-form__label">
                    Başlık *
                    <input
                        style={inputStyle}
                        value={form.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        placeholder="Örn: QNB Son Ödeme"
                        required
                    />
                </label>

                <label className="cal-form__label">
                    Tür
                    <select
                        style={inputStyle}
                        value={form.type}
                        onChange={(e) => updateField('type', e.target.value)}
                    >
                        {typeOptions.map(([key, meta]) => (
                            <option key={key} value={key}>{meta.dot} {meta.label}</option>
                        ))}
                    </select>
                </label>

                <div className="cal-form__row">
                    <label className="cal-form__label">
                        Tutar
                        <input
                            style={inputStyle}
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.amount}
                            onChange={(e) => updateField('amount', e.target.value)}
                            placeholder="0,00"
                        />
                    </label>
                    <label className="cal-form__label">
                        Para Birimi
                        <select
                            style={inputStyle}
                            value={form.currency}
                            onChange={(e) => updateField('currency', e.target.value)}
                        >
                            {CURRENCY_OPTIONS.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <label className="cal-form__label">
                    Tarih *
                    <input
                        style={inputStyle}
                        type="date"
                        value={form.date}
                        onChange={(e) => updateField('date', e.target.value)}
                        required
                    />
                </label>

                <label className="cal-form__label">
                    Açıklama
                    <textarea
                        style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
                        value={form.description}
                        onChange={(e) => updateField('description', e.target.value)}
                        placeholder="İsteğe bağlı not..."
                    />
                </label>

                <div className="cal-form__recur">
                    <label className="cal-form__checkbox">
                        <input
                            type="checkbox"
                            checked={form.isRecurring}
                            onChange={(e) => {
                                updateField('isRecurring', e.target.checked);
                                if (!e.target.checked) updateField('recurrenceType', 'once');
                                else if (form.recurrenceType === 'once') updateField('recurrenceType', 'monthly');
                            }}
                        />
                        Tekrarlayan olay
                    </label>

                    {form.isRecurring && (
                        <select
                            style={inputStyle}
                            value={form.recurrenceType}
                            onChange={(e) => updateField('recurrenceType', e.target.value)}
                        >
                            {Object.entries(RECURRENCE_LABELS)
                                .filter(([k]) => k !== 'once')
                                .map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                        </select>
                    )}
                </div>

                <button
                    type="submit"
                    className="modal-primary-btn"
                    disabled={saving}
                    style={{ marginTop: '8px' }}
                >
                    {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kaydet'}
                </button>
            </form>
        </HighQualityModal>
    );
};

export default CalendarEventForm;
