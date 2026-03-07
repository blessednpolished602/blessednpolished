import { createContext, useContext, useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const CACHE_KEY = "bnp_site_settings";

function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : undefined;
    } catch {
        return undefined;
    }
}

function writeCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
        // storage full or private-browsing restriction — silently skip
    }
}

const SiteSettingsContext = createContext(undefined);

export function SiteSettingsProvider({ children }) {
    const [settings, setSettings] = useState(() => readCache() ?? undefined);

    useEffect(() => {
        let cancelled = false;
        getDoc(doc(db, "site", "settings"))
            .then((snap) => {
                if (cancelled) return;
                const data = snap.exists() ? snap.data() : null;
                writeCache(data ?? {});
                setSettings(data);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Failed to load site settings:", err);
                // Keep cached value if available; fall back to null to unblock UI
                setSettings((prev) => prev === undefined ? null : prev);
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
