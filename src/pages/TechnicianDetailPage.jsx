// src/pages/TechnicianDetailPage.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import SocialLinks from "../components/SocialLinks";

export default function TechnicianDetailPage() {
    const { techId } = useParams();
    const [tech, setTech] = useState(null);

    useEffect(() => {
        if (!techId) return;
        return onSnapshot(doc(db, "technicians", techId), (d) => {
            setTech(d.exists() ? { id: d.id, ...d.data() } : null);
        });
    }, [techId]);

    if (tech === null) {
        return <main className="p-10">Not found. <Link to="/technicians" className="underline">Back</Link></main>;
    }
    if (!tech) return null;

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
                            <SocialLinks socials={tech.socials} fallback="none" />
                        </div>
                    </div>
                </div>

                {Array.isArray(tech.gallery) && tech.gallery.length > 0 && (
                    <>
                        <h2 className="text-xl font-semibold mt-10">Portfolio</h2>
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {tech.gallery.map((src, i) => (
                                <img key={i} src={src} alt={`${tech.name} ${i + 1}`} className="aspect-square w-full object-cover rounded-xl" loading="lazy" />
                            ))}
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}
