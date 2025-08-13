import Services from "../components/Services";

export default function ServicesPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#f9d6d1] to-white">
            <main className="mx-auto max-w-6xl px-4 py-14">
                <h1 className="text-3xl font-bold mb-6">Services & Pricing</h1>
                <Services />
            </main>
        </div>
    );
}
