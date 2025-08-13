export default function BookingPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-blush-100 to-white">
            <main className="mx-auto max-w-6xl px-4 py-14 space-y-6">
                <h1 className="text-3xl font-bold">Book an Appointment</h1>
                <p className="text-neutral-700">
                    We’ll embed your booking tool here (Calendly/GlossGenius/Peek, etc.). For now, this is a placeholder.
                </p>
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-soft">
                    {/* Replace this IFRAME with your provider's embed when ready */}
                    <div className="text-neutral-600">Booking widget coming soon.</div>
                </div>
            </main>
        </div>
    );
}
