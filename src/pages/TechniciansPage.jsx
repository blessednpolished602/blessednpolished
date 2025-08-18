import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { Link } from "react-router-dom";
import SocialLinks from "../components/SocialLinks";

export default function TechniciansPage() {
    const [techs, setTechs] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "technicians"), orderBy("name", "asc"));
        return onSnapshot(q, (snap) => {
            setTechs(
                snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((t) => t.enabled !== false)
            );
        });
    }, []);

    return (
        <main className="min-h-screen mx-auto max-w-6xl px-4 py-12">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-8">Technicians</h1>

            {/* 1-col on xs, 2-col on sm, 3-col on lg; tighter gap on phones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {techs.map((t) => {
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
                                            decoding="async"
                                            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                                            className="absolute inset-0 w-full h-full object-contain"
                                        />
                                        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
                                    </div>
                                </Link>
                            )}

                            <div className="p-4 sm:p-5">
                                <h3 className="font-semibold text-base sm:text-lg">
                                    <Link
                                        to={`/technicians/${t.id}`}
                                        className="hover:underline focus:outline-none focus:ring-2 focus:ring-black/20 rounded"
                                    >
                                        {t.name}
                                    </Link>
                                </h3>
                                <p className="text-neutral-600 mt-1.5 text-sm sm:text-[15px]">
                                    {t.role || "Nail Artist"}
                                </p>

                                {t.bio && (
                                    <p className="mt-2 text-neutral-700 text-sm sm:text-[15px]">
                                        {t.bio}
                                    </p>
                                )}

                                {/* SocialLinks stays as real <a> tags — no nesting now */}
                                <div className="mt-3">
                                    <SocialLinks className="mt-3" size={18} gap="gap-2" fallback="none" socials={t.socials} />
                                </div>

                                <div className="mt-4">
                                    <Link to={`/technicians/${t.id}`} className="underline text-sm">
                                        View profile
                                    </Link>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </main>
    );
}
