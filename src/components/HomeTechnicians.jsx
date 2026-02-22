// src/components/HomeTechnicians.jsx
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import SocialLinks from "./SocialLinks";
import Skeleton from "./Skeleton";

function TechSkeleton() {
    return (
        <div
            className="rounded-2xl overflow-hidden ring-1 ring-black/5 shadow-soft"
            style={{ background: "linear-gradient(to bottom, #f9d6d1 0%, #ffffff 100%)" }}
        >
            <Skeleton className="aspect-[16/9] sm:aspect-[4/3]" />
            <div className="p-4 sm:p-5 space-y-2">
                <Skeleton className="h-4 w-2/3 rounded-full" />
                <Skeleton className="h-3 w-1/3 rounded-full" />
                <Skeleton className="mt-3 h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-4/5 rounded-full" />
            </div>
        </div>
    );
}

export default function HomeTechnicians({ showViewAll }) {
    const { pathname } = useLocation();
    const showLink = showViewAll ?? pathname !== "/technicians";
    const [items, setItems] = useState(null); // null = loading

    useEffect(() => {
        let cancelled = false;
        getDocs(query(collection(db, "technicians"), orderBy("name", "asc")))
            .then((snap) => {
                if (cancelled) return;
                setItems(
                    snap.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((x) => x.enabled !== false)
                );
            });
        return () => { cancelled = true; };
    }, []);

    return (
        <section id="technicians" className="py-12 md:py-16 scroll-mt-24 bg-transparent">
            <div className="mx-auto max-w-6xl px-4">
                <div className="flex items-end justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">Our Technicians</h2>
                    {showLink && <Link to="/technicians" className="text-sm underline">View all</Link>}
                </div>

                {items === null ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                        {Array.from({ length: 3 }).map((_, i) => <TechSkeleton key={i} />)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                        {items.map((t) => {
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
                                            <div className="aspect-[16/9] sm:aspect-[4/3] bg-transparent">
                                                <img
                                                    src={cover}
                                                    alt={t.name}
                                                    loading="lazy"
                                                    className="w-full h-full object-contain"
                                                />
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
                )}
            </div>
        </section>
    );
}
