// src/pages/TechnicianDetailPage.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import SocialLinks from "../components/SocialLinks";
import Lightbox from "../components/Lightbox";


export default function TechnicianDetailPage() {
    const { techId } = useParams();
    const [tech, setTech] = useState(undefined); // undefined = loading, null = not found
    const [activeIndex, setActiveIndex] = useState(null);

    useEffect(() => {
        if (!techId) return;
        let cancelled = false;
        setTech(undefined);
        getDoc(doc(db, "technicians", techId)).then((d) => {
            if (cancelled) return;
            setTech(d.exists() ? { id: d.id, ...d.data() } : null);
        });
        return () => { cancelled = true; };
    }, [techId]);

    if (tech === undefined) return <main className="p-10 text-neutral-500">Loading…</main>;
    if (tech === null) {
        return <main className="p-10">Not found. <Link to="/technicians" className="underline">Back</Link></main>;
    }

    return (
        <main className="min-h-screen">
            <section className="mx-auto max-w-6xl px-4 py-10">
                <div className="flex flex-col md:flex-row items-start gap-6">
                    {tech.avatarUrl && <img src={tech.avatarUrl} alt={tech.name} className="h-28 w-28 rounded-full object-cover ring-1 ring-black/10" />}
                    <div>
                        <h1 className="text-3xl font-extrabold">{tech.name}</h1>
                        <p className="text-neutral-700">{tech.role}</p>
                        <p className="mt-4 max-w-2xl text-neutral-700">{tech.bio}</p>
                        <div className="mt-4 flex items-center gap-4">
                            {tech.squareStaffId && <Link to={`/book/${tech.id}`} className="underline text-sm">Book with {tech.name.split(" ")[0]}</Link>}
                            <SocialLinks
                                className="mt-3"
                                size={18}
                                gap="gap-2"
                                socials={tech.socials}
                                emailAsContact={true}
                                contactQuery={{ tech: tech.name, source: "tech-card" }}
                            />
                        </div>
                    </div>
                </div>

                {Array.isArray(tech.gallery) && tech.gallery.length > 0 && (
                    <>
                        <h2 className="text-xl font-semibold mt-10">Portfolio</h2>

                        {/* THUMB GRID (same look as Gallery page) */}
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {tech.gallery.map((src, i) => (
                                <button
                                    key={src}
                                    onClick={() => setActiveIndex(i)}
                                    className="group block rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition overflow-hidden"
                                >
                                    <div className="aspect-[4/3] bg-transparent">
                                        <img
                                            src={src}
                                            alt={`${tech.name} ${i + 1}`}
                                            loading="lazy"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* LIGHTBOX */}
                        {activeIndex != null && (
                            <Lightbox
                                images={tech.gallery}             // array of strings is OK
                                index={activeIndex}
                                onClose={() => setActiveIndex(null)}
                            />
                        )}
                    </>
                )}

            </section>
        </main>
    );
}
