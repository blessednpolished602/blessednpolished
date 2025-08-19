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
                    {(items ?? []).map((t) => {
                        // same cover-picking logic as the page
                        const cover =
                            t.coverUrl ||
                            t.heroUrl ||
                            (Array.isArray(t.gallery) && t.gallery[0]) ||
                            t.avatarUrl;

                        return (
                            <article
                                key={t.id}
                                className="group rounded-2xl overflow-hidden ring-1 ring-black/5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-xl"
                                style={{ background: "linear-gradient(to bottom, #f9d6d1 0%, #ffffff 100%)" }}
                            >
                                {cover && (
                                    <Link to={`/technicians/${t.id}`} className="block">
                                        <div className="relative aspect-[16/9] sm:aspect-[4/3]">
                                            <img
                                                src={cover}
                                                alt={t.name}
                                                loading="lazy"
                                                className="absolute inset-0 w-full h-full object-contain"
                                            />
                                            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
                                        </div>
                                    </Link>
                                )}

                                <div className="p-4 sm:p-5">
                                    <h3 className="font-semibold text-base sm:text-lg">
                                        <Link to={`/technicians/${t.id}`} className="hover:underline">
                                            {t.name}
                                        </Link>
                                    </h3>
                                    <p className="text-neutral-600 mt-1.5 text-sm sm:text-[15px]">
                                        {t.role || "Nail Artist"}
                                    </p>

                                    {t.bio && (
                                        <p className="text-neutral-700 mt-2 text-sm sm:text-[15px]">{t.bio}</p>
                                    )}

                                    {/* Social links are anchors; now they’re NOT nested in a Link */}
                                    <div className="mt-3">
                                        <SocialLinks className="mt-3" size={18} gap="gap-2" fallback="none" socials={t.socials} emailAsContact={true} contactQuery={{ tech: t.name, source: "tech-card" }} />
                                    </div>

                                    <div className="mt-4 flex gap-3">
                                        <Link to={`/technicians/${t.id}`} className="underline text-sm">
                                            View profile
                                        </Link>
                                        {t.squareStaffId && (
                                            <Link to={`/book/${t.id}`} className="underline text-sm">
                                                Book {t.name.split(" ")[0]}
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
