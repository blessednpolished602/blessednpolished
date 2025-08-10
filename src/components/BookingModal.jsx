export default function BookingModal({ open, onClose }) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold">Booking Coming Soon</h3>
                <p className="mt-2 text-sm text-neutral-700">We’ll add calendar integration next.</p>
                <div className="mt-4 flex justify-end">
                    <button className="btn btn-primary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
}
