import { useState } from "react";

export default function BookingPage() {
    const [loaded, setLoaded] = useState(false);

    // Hosted booking page (service → calendar flow)
    const BOOKING_LINK = "https://app.squareup.com/appointments/book/hiowoby9ly2y2x/LX68WJMN6NYDA/start";

    return (
        <main className="min-h-screen bg-white text-gray-900">
            <section className="mx-auto max-w-5xl px-4 py-10">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Book an Appointment</h1>
                <p className="mt-2 text-sm text-gray-600">
                    Pick a service, then choose your date &amp; time. You’ll <span className="font-medium">pay in person</span> at your visit.
                </p>

                {/* Policies */}
                <div className="mt-6 rounded-2xl border border-gray-200 p-4">
                    <h2 className="text-base font-semibold">Booking Policies</h2>
                    <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
                        <li>Please arrive 5–10 minutes early.</li>
                        <li>24‑hour reschedule window. No‑shows may require a deposit next time.</li>
                        <li>If you’re sick, message us to reschedule — no fee.</li>
                    </ul>
                </div>

                {/* Booking Flow (iframe) */}
                <div className="mt-8">
                    {!loaded && (
                        <div className="mb-3 rounded-xl border border-gray-200 p-4 text-sm">
                            Loading the booking calendar…
                        </div>
                    )}
                    <div className="relative w-full" style={{ minHeight: "90vh" }}>
                        <iframe
                            title="Blessed N Polished — Booking"
                            src={BOOKING_LINK}
                            className="absolute inset-0 h-full w-full rounded-2xl border-0"
                            onLoad={() => setLoaded(true)}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>

                    {/* Fallback open-in-new-tab */}
                    <div className="mt-4 flex items-center gap-3">
                        <a
                            href={BOOKING_LINK}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-white bg-black hover:opacity-90 transition"
                        >
                            Open Full Booking Page
                        </a>
                        <span className="text-xs text-gray-500">Use this if the embed doesn’t load.</span>
                    </div>
                </div>
            </section>
        </main>
    );
}
