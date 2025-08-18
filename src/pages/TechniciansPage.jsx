// src/pages/TechniciansPage.jsx
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Link } from "react-router-dom";
import SocialLinks from "../components/SocialLinks";

export default function TechniciansPage() {
    const [techs, setTechs] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "technicians"), orderBy("name", "asc"));
        return onSnapshot(q, (snap) => {
            setTechs(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.enabled !== false));
        });
    }, []);

    return (
        <main className="min-h-screen mx-auto max-w-6xl px-4 py-12">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-8">Technicians</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(techs ?? []).map(t => (
                    <div key={t.id} className="rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 shadow-soft">
                        {t.avatarUrl && <img src={t.avatarUrl} alt={t.name} className="w-full aspect-square object-cover" />}
                        <div className="p-5">
                            <h3 className="font-semibold">{t.name}</h3>
                            <p className="text-sm text-neutral-600">{t.role}</p>
                            <p className="mt-2 text-neutral-700">{t.bio}</p>
                            <SocialLinks className="mt-3" size={18} gap="gap-2" fallback="none" socials={t.socials} />
                            <div className="mt-4">
                                <Link to={`/technicians/${t.id}`} className="underline text-sm">View profile</Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
