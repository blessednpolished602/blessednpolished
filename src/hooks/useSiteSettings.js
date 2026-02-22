import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function useSiteSettings() {
    const [data, setData] = useState(null);
    useEffect(() => {
        let cancelled = false;
        getDoc(doc(db, "site", "settings")).then((snap) => {
            if (cancelled) return;
            setData(snap.exists() ? snap.data() : null);
        });
        return () => { cancelled = true; };
    }, []);
    return data;
}
