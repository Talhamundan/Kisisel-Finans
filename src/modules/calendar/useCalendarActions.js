import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { COLLECTION_NAME } from './constants';
import { buildCalendarEventPayload, todayKey } from './calendarUtils';

const EMPTY_FORM = () => ({
    title: '',
    description: '',
    amount: '',
    currency: 'TRY',
    date: todayKey(),
    type: 'reminder',
    status: 'upcoming',
    isRecurring: false,
    recurrenceType: 'once',
    source: 'manual',
});

export const useCalendarActions = (user, alanKodu) => {
    const [form, setForm] = useState(EMPTY_FORM());
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);

    const resetForm = (dateOverride) => {
        setForm({ ...EMPTY_FORM(), date: dateOverride || todayKey() });
        setEditingId(null);
    };

    const fillForm = (event) => {
        setEditingId(event.id);
        setForm({
            title: event.title || '',
            description: event.description || '',
            amount: event.amount != null ? String(event.amount) : '',
            currency: event.currency || 'TRY',
            date: event.date || todayKey(),
            type: event.type || 'reminder',
            status: event.status || 'upcoming',
            isRecurring: Boolean(event.isRecurring),
            recurrenceType: event.recurrenceType || 'once',
            source: event.source || 'manual',
        });
    };

    const updateField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    /**
     * Public API for other modules (V2) — creates a system-sourced event.
     * @param {Partial<import('./types').FinancialCalendarEvent>} data
     */
    const createEventFromSource = async (data) => {
        if (!user || !alanKodu) return null;
        try {
            const payload = {
                ...buildCalendarEventPayload(data),
                uid: user.uid,
                alanKodu,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            const ref = await addDoc(collection(db, COLLECTION_NAME), payload);
            return ref.id;
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    const saveEvent = async (e) => {
        if (e) e.preventDefault();
        if (!form.title?.trim()) {
            toast.warning('Lütfen bir başlık girin.');
            return false;
        }
        if (!form.date) {
            toast.warning('Lütfen bir tarih seçin.');
            return false;
        }

        setSaving(true);
        try {
            const payload = {
                ...buildCalendarEventPayload(form),
                uid: user.uid,
                alanKodu,
                updatedAt: serverTimestamp(),
            };

            if (editingId) {
                await updateDoc(doc(db, COLLECTION_NAME, editingId), payload);
                toast.success('Olay güncellendi.');
            } else {
                await addDoc(collection(db, COLLECTION_NAME), {
                    ...payload,
                    createdAt: serverTimestamp(),
                });
                toast.success('Olay eklendi.');
            }

            resetForm(form.date);
            return true;
        } catch (err) {
            console.error(err);
            toast.error('Kayıt sırasında hata oluştu.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteEvent = async (eventId) => {
        const result = await Swal.fire({
            title: 'Olayı sil?',
            text: 'Bu finansal olay takvimden kaldırılacak.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sil',
            cancelButtonText: 'Vazgeç',
            confirmButtonColor: '#ef4444',
        });

        if (!result.isConfirmed) return false;

        try {
            await deleteDoc(doc(db, COLLECTION_NAME, eventId));
            toast.success('Olay silindi.');
            if (editingId === eventId) resetForm();
            return true;
        } catch (err) {
            console.error(err);
            toast.error('Silme sırasında hata oluştu.');
            return false;
        }
    };

    return {
        form,
        editingId,
        saving,
        resetForm,
        fillForm,
        updateField,
        saveEvent,
        deleteEvent,
        createEventFromSource,
    };
};
