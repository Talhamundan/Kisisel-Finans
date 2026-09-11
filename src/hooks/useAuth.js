import { useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { toast } from 'react-toastify';
import { auth, provider } from '../firebase';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const girisYap = async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (e) {
            console.error(e);
            toast.error("Giriş başarısız!");
        }
    };

    const cikisYap = async () => {
        await signOut(auth);
    };

    return { user, loading, girisYap, cikisYap };
};
