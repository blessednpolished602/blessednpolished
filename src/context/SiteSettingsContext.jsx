import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const SiteSettingsContext = createContext(undefined);

export function SiteSettingsProvider({ children }) {
    const [settings, setSettings] = useState(undefined); // undefined = loading

    useEffect(() => {
        let cancelled = false;
        getDoc(doc(db, "site", "settings"))
            .then((snap) => {
                if (cancelled) return;
                setSettings(snap.exists() ? snap.data() : null);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Failed to load site settings:", err);
                setSettings(null); // unblock loading state on error
            });
        return () => { cancelled = true; };
    }, []);

    return (
        <SiteSettingsContext.Provider value={settings}>
            {children}
        </SiteSettingsContext.Provider>
    );
}

export function useSiteSettings() {
    return useContext(SiteSettingsContext);
}
