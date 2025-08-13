import { useState, useRef } from "react";
import { db } from "../lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import useSiteSettings from "../hooks/useSiteSettings";
import emailjs from "@emailjs/browser";

export default function ContactPage() {
    const s = useSiteSettings();

    const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [err, setErr] = useState("");
    const trap = useRef(null); // honeypot

    // ---- Public contact info (safe defaults) ----
    const phone = s?.phone || ""; // leave blank to hide phone
    const email = s?.email || "blessednpolished@gmail.com";
    const instagram = s?.instagram || "reinakatrina84";
    const serviceArea = s?.serviceArea || s?.city || "Buckeye, AZ • Sundance";
    const byApptOnly = s?.byApptOnly ?? true;

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");

        // simple validation
        if (!form.name.trim()) return setErr("Please enter your name.");
        if (!form.email.trim() && !form.phone.trim()) return setErr("Add an email or phone.");
        if (form.email && !/.+@.+\..+/.test(form.email)) return setErr("That email looks off.");
        if (form.message.trim().length < 5) return setErr("Add a short message.");

        // honeypot (bots)
        if (trap.current?.value) return;

        setBusy(true);
        try {
            // 1) Save to Firestore
            await addDoc(collection(db, "contactMessages"), {
                ...form,
                createdAt: serverTimestamp(),
                source: "website",
            });

            // 2) Email via EmailJS
            const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
            const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
            const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

            await emailjs.send(
                SERVICE_ID,
                TEMPLATE_ID,
                {
                    title: "Website Contact",
                    name: form.name,
                    email: form.email || "no-email@site",
                    phone: form.phone || "n/a",
                    message: form.message,
                    time: new Date().toLocaleString(),
                },
                PUBLIC_KEY
            );

            setSent(true);
            setForm({ name: "", email: "", phone: "", message: "" });
        } catch (e) {
            console.error(e);
            setErr("Couldn’t send right now. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="mx-auto max-w-6xl px-4 py-10 md:py-16">
            <h1 className="text-3xl md:text-4xl font-bold mb-8">Contact</h1>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Left: Contact info (privacy-safe) */}
                <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-soft p-6 space-y-5">
                    {byApptOnly && (
                        <div className="inline-flex items-center gap-2 rounded-full bg-black text-white text-xs px-3 py-1">
                            By appointment only
                        </div>
                    )}

                    {serviceArea && (
                        <div>
                            <div className="text-sm text-neutral-600">Location</div>
                            <div className="text-lg font-medium">
                                {serviceArea} <span className="text-neutral-500">• address shared after booking</span>
                            </div>
                        </div>
                    )}

                    {phone && (
                        <div>
                            <div className="text-sm text-neutral-600">Phone</div>
                            <a className="text-lg font-medium hover:underline" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                                {phone}
                            </a>
                            <div className="mt-2 flex gap-2">
                                <a className="btn btn-ghost btn-sm" href={`sms:${phone.replace(/[^\d+]/g, "")}`}>Text</a>
                                <a className="btn btn-ghost btn-sm" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>Call</a>
                            </div>
                        </div>
                    )}

                    {email && (
                        <div>
                            <div className="text-sm text-neutral-600">Email</div>
                            <a className="text-lg font-medium hover:underline" href={`mailto:${email}`}>{email}</a>
                        </div>
                    )}

                    {instagram && (
                        <div>
                            <div className="text-sm text-neutral-600">Instagram</div>
                            <a
                                className="text-lg font-medium hover:underline"
                                target="_blank" rel="noreferrer"
                                href={`https://instagram.com/${instagram.replace(/^@/, "")}`}
                            >
                                @{instagram.replace(/^@/, "")}
                            </a>
                        </div>
                    )}
                </div>

                {/* Right: Form */}
                <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-soft p-6">
                    {sent ? (
                        <div className="text-center py-10">
                            <div className="text-2xl mb-2">🎉 Thanks!</div>
                            <p className="text-neutral-700">We got your message and will get back to you soon.</p>
                            <button className="btn btn-primary mt-6" onClick={() => setSent(false)}>Send another</button>
                        </div>
                    ) : (
                        <form className="space-y-4" onSubmit={onSubmit}>
                            {/* honeypot */}
                            <input ref={trap} className="hidden" tabIndex={-1} autoComplete="off" placeholder="Company" />

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1">Name</label>
                                    <input
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={form.name}
                                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                        autoComplete="name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1">Phone</label>
                                    <input
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={form.phone}
                                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                        autoComplete="tel"
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Email</label>
                                <input
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={form.email}
                                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                    type="email"
                                    autoComplete="email"
                                    placeholder="name@email.com"
                                />
                                <p className="text-xs text-neutral-500 mt-1">Add email or phone (either one works).</p>
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Message</label>
                                <textarea
                                    className="w-full border rounded-lg px-3 py-2 min-h-[120px]"
                                    value={form.message}
                                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                                    required
                                />
                            </div>

                            {err && <p className="text-sm text-red-600">{err}</p>}

                            <button className="btn btn-primary" disabled={busy}>
                                {busy ? "Sending…" : "Send Message"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
