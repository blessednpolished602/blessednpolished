// src/components/HomeTechnicians.jsx
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import SocialLinks from "./SocialLinks";

export default function HomeTechnicians({ showViewAll }) {
    const { pathname } = useLocation();
    const showLink = showViewAll ?? pathname !== "/technicians";
    const [items, setItems] = useState(null);

    useEffect(() => {
        const col = collection(db, "technicians");
        const q = query(col, orderBy("name", "asc"));
        return onSnapshot(q, (snap) => {
            const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
                .filter((x) => x.enabled !== false);
            setItems(docs);
        });
    }, []);

    return (
        <section id="technicians" className="py-12 md:py-16 scroll-mt-24 bg-transparent">
            <div className="mx-auto max-w-6xl px-4">
                <div className="flex items-end justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">Our Technicians</h2>
                    {showLink && <Link to="/technicians" className="text-sm underline">View all</Link>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    {(items ?? []).map((t) => (
                        <div
                            key={t.id}
                            className="group w-full max-w-[420px] sm:max-w-none mx-auto rounded-2xl overflow-hidden bg-white ring-1 ring-black/5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-xl"
                        >
                            {t.avatarUrl && (
                                <div className="relative aspect-square">
                                    <img src={t.avatarUrl} alt={t.name} loading="lazy"
                                        className="absolute inset-0 h-full w-full object-cover" />
                                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
                                </div>
                            )}
                            <div className="p-5">
                                <h3 className="font-semibold">{t.name}</h3>
                                <p className="text-neutral-600 mt-1 text-sm">{t.role}</p>
                                <p className="text-neutral-700 mt-2">{t.bio}</p>

                                <SocialLinks
                                    className="mt-3"
                                    size={18}
                                    gap="gap-2"
                                    fallback="none"            // <- DO NOT fall back to site defaults here
                                    socials={t.socials}         // <- comes straight from Firestore
                                />

                                <div className="mt-4 flex gap-3">
                                    <Link to={`/technicians/${t.id}`} className="underline text-sm">View profile</Link>
                                    {t.squareStaffId && (
                                        <Link to={`/book/${t.id}`} className="underline text-sm">
                                            Book {t.name.split(" ")[0]}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
