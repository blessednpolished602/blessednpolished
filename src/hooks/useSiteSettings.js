import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function useSiteSettings() {
    const [data, setData] = useState(null);
    useEffect(() => {
        const unsub = onSnapshot(doc(db, "site", "settings"), (snap) => {
            setData(snap.exists() ? snap.data() : null);
        });
        return unsub;
    }, []);
    return data;
}
