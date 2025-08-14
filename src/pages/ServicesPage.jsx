// src/pages/ServicesPage.jsx
import { Link } from "react-router-dom";
import Services from "../components/Services";
import HomeServices from "../components/HomeServices";

// Toggle this to true when you’re ready to show the detailed pricing list
const SHOW_PRICING = false;

export default function ServicesPage() {
    return (
        <main className="mx-auto max-w-6xl px-4 py-14">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-8">
                Services{SHOW_PRICING ? " & Pricing" : ""}
            </h1>

            {SHOW_PRICING ? (
                <section className="mb-14">
                    <Services />
                </section>
            ) : (
                <p className="text-neutral-600 mb-10">
                    Full pricing menu coming soon. For quotes or availability,{" "}
                    <Link to="/book" className="underline">book an appointment</Link> or{" "}
                    <Link to="/contact" className="underline">contact us</Link>.
                </p>
            )}

            {/* Signature Looks (admin-managed cards); hide the "View all" link on this page */}
            <section>
                <HomeServices showViewAll={false} />
            </section>
        </main>
    );
}
