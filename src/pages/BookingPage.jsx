import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, doc, getDocs, getDoc, orderBy, query } from "firebase/firestore";

// Base Square booking URL — everything after this is the staff selector or /start
const SQUARE_BASE = "https://app.squareup.com/appointments/book/hiowoby9ly2y2x/LX68WJMN6NYDA";

const POLICIES = [
    "Please arrive 5–10 minutes early.",
    "24‑hour reschedule window. No‑shows may require a deposit next time.",
    "If you're sick, message us to reschedule — no fee.",
];

export default function BookingPage() {
    const { techId } = useParams();
    const [iframeLoaded, setIframeLoaded] = useState(false);

    // ── Tech-specific mode (/book/:techId) ─────────────────────────
    const [tech, setTech] = useState(undefined); // undefined = loading

    useEffect(() => {
        if (!techId) return;
        setIframeLoaded(false);
        setTech(undefined);
        let cancelled = false;
        getDoc(doc(db, "technicians", techId)).then((d) => {
            if (cancelled) return;
            setTech(d.exists() ? { id: d.id, ...d.data() } : null);
        });
        return () => { cancelled = true; };
    }, [techId]);

    // ── Generic picker mode (/book) ─────────────────────────────────
    const [techs, setTechs] = useState(null); // null = loading
    const [showGeneric, setShowGeneric] = useState(false);

    useEffect(() => {
        if (techId) return;
        let cancelled = false;
        getDocs(query(collection(db, "technicians"), orderBy("name", "asc")))
            .then((snap) => {
                if (cancelled) return;
                setTechs(
                    snap.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((t) => t.enabled !== false)
                );
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Failed to load technicians:", err);
                setTechs([]); // unblock UI on error
            });
        return () => { cancelled = true; };
    }, [techId]);

    // ── Booking URL ─────────────────────────────────────────────────
    const bookingUrl =
        techId && tech?.squareStaffId
            ? `${SQUARE_BASE}/staff/${tech.squareStaffId}`
            : `${SQUARE_BASE}/start`;

    // Show iframe when: on generic page and user clicked "no preference",
    // or on tech page and tech is resolved.
    const showIframe =
        (!techId && showGeneric) ||
        (!!techId && tech !== undefined && tech !== null);

    return (
        <main className="min-h-screen text-gray-900">
            <section className="mx-auto max-w-5xl px-4 py-10">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {techId && tech
                        ? `Book with ${tech.name.split(" ")[0]}`
                        : "Book an Appointment"}
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                    Pick a service, then choose your date &amp; time. You'll{" "}
                    <span className="font-medium">pay in person</span> at your visit.
                </p>

                {/* Back link when on a tech-specific page */}
                {techId && (
                    <Link to="/book" className="inline-block mt-3 text-sm underline">
                        ← Choose a different technician
                    </Link>
                )}

                {/* Policies */}
                <div className="mt-6 rounded-2xl border border-gray-200 p-4">
                    <h2 className="text-base font-semibold">Booking Policies</h2>
                    <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
                        {POLICIES.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                </div>

                {/* ── Technician picker (generic /book with no selection yet) ── */}
                {!techId && !showGeneric && (
                    <div className="mt-8">
                        <h2 className="text-lg font-semibold mb-4">Choose your technician</h2>

                        {techs === null ? (
                            <p className="text-sm text-neutral-500">Loading technicians…</p>
                        ) : techs.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {techs.map((t) => {
                                    const avatar =
                                        t.coverUrl ||
                                        t.heroUrl ||
                                        (Array.isArray(t.gallery) && t.gallery[0]) ||
                                        t.avatarUrl;
                                    return (
                                        <Link
                                            key={t.id}
                                            to={`/book/${t.id}`}
                                            className="group rounded-2xl overflow-hidden ring-1 ring-black/5 shadow-soft hover:-translate-y-0.5 hover:shadow-xl transition"
                                            style={{ background: "linear-gradient(to bottom, #f9d6d1 0%, #ffffff 100%)" }}
                                        >
                                            {avatar && (
                                                <div className="aspect-[4/3] bg-transparent">
                                                    <img
                                                        src={avatar}
                                                        alt={t.name}
                                                        loading="lazy"
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                            )}
                                            <div className="p-3">
                                                <p className="font-semibold text-sm">{t.name}</p>
                                                <p className="text-xs text-neutral-500 mt-0.5">
                                                    {t.role || "Nail Artist"}
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-neutral-500">No technicians available for booking right now.</p>
                        )}

                        <p className="mt-5 text-sm text-neutral-500">
                            No preference?{" "}
                            <button
                                onClick={() => setShowGeneric(true)}
                                className="underline"
                            >
                                Book any available technician
                            </button>
                        </p>
                    </div>
                )}

                {/* ── Booking iframe ── */}
                {showIframe && (
                    <div className="mt-8">
                        {/* Always-visible fallback — shown before iframe loads */}
                        <div className="mb-4 flex items-center gap-3">
                            <a
                                href={bookingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm text-white bg-black hover:opacity-90 transition"
                            >
                                Open booking in new tab
                            </a>
                            <span className="text-xs text-gray-500">Use this if the embed doesn't load.</span>
                        </div>

                        {/* Spinner overlaid on the iframe container until onLoad fires */}
                        <div className="relative w-full rounded-2xl overflow-hidden" style={{ minHeight: "90vh" }}>
                            {!iframeLoaded && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-50 z-10">
                                    <div className="h-8 w-8 rounded-full border-2 border-neutral-200 border-t-neutral-600 animate-spin" />
                                    <p className="text-sm text-neutral-400">Loading booking calendar…</p>
                                </div>
                            )}
                            <iframe
                                key={bookingUrl}
                                title="Blessed N Polished — Booking"
                                src={bookingUrl}
                                className="absolute inset-0 h-full w-full border-0"
                                onLoad={() => setIframeLoaded(true)}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    </div>
                )}

                {/* Tech not found */}
                {techId && tech === null && (
                    <p className="mt-8 text-sm text-neutral-600">
                        Technician not found.{" "}
                        <Link to="/book" className="underline">View all technicians</Link>
                    </p>
                )}
            </section>
        </main>
    );
}
