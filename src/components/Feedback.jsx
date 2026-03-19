import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';

const Feedback = ({ userEmail }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;

        setLoading(true);
        try {
            await addDoc(collection(db, 'feedbacks'), {
                text: text,
                sender: userEmail || 'Anonymous',
                createdAt: serverTimestamp(),
            });

            toast.success('Mesajınız iletildi, teşekkürler! 🚀');
            setText('');
            setIsOpen(false);
        } catch (error) {
            console.error("Error sending feedback: ", error);
            toast.error('Bir hata oluştu, tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="feedback-fab"
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: '#2d3748',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    cursor: 'pointer',
                    zIndex: 9999,
                    transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                💬
            </button>

            {/* Modal */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '15px',
                        width: '90%',
                        maxWidth: '400px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                        position: 'relative',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '15px',
                                background: 'none',
                                border: 'none',
                                fontSize: '24px',
                                cursor: 'pointer',
                                color: '#718096'
                            }}
                        >
                            &times;
                        </button>

                        <h2 style={{
                            margin: '0 0 10px 0',
                            color: '#2d3748',
                            fontSize: '22px',
                            textAlign: 'center'
                        }}>
                            📣 Öneri & Şikayet Kutusu
                        </h2>

                        <p style={{
                            textAlign: 'center',
                            color: '#718096',
                            marginBottom: '20px',
                            fontSize: '14px',
                            lineHeight: '1.5'
                        }}>
                            Fikirlerinizi ve karşılaştığınız hataları bizimle paylaşın.
                        </p>

                        <form onSubmit={handleSend}>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Mesajınız..."
                                style={{
                                    width: '100%',
                                    height: '120px',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    marginBottom: '20px',
                                    fontSize: '16px',
                                    fontFamily: 'inherit',
                                    resize: 'none',
                                    boxSizing: 'border-box'
                                }}
                                required
                            />

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    backgroundColor: '#2d3748',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    cursor: loading ? 'wait' : 'pointer',
                                    opacity: loading ? 0.7 : 1,
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                {loading ? 'GÖNDERİLİYOR...' : 'GÖNDER'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
};

export default Feedback;
