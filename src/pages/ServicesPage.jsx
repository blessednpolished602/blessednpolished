// src/pages/ServicesPage.jsx
import { Link } from "react-router-dom";
import HomeServices from "../components/HomeServices";

// ── Editable pricing list ──────────────────────────────────────────────────
// Update these values as needed. "From $X" = starting rate before add-ons.
const PRICING = [
    { service: "Classic Manicure",              price: "From $35" },
    { service: "Gel Manicure",                  price: "From $50" },
    { service: "Full Set (Acrylic / Hard Gel)", price: "From $65" },
    { service: "Nail Fills",                    price: "From $45" },
    { service: "Nail Art (per nail)",           price: "From $5"  },
    { service: "Swarovski / Diamond Set",       price: "From $100" },
    { service: "XXL Nail Art Set",              price: "From $120" },
    { service: "XXXL Extreme Length",           price: "From $150" },
];
// ──────────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
    return (
        <main className="mx-auto max-w-6xl px-4 py-14">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-2">Services & Pricing</h1>
            <p className="text-sm text-neutral-500 mb-8">
                Starting rates — final price depends on length, design complexity, and add-ons.{" "}
                <Link to="/contact" className="underline">Contact us</Link> for a custom quote.
            </p>

            <section className="mb-14">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {PRICING.map(({ service, price }) => (
                        <div
                            key={service}
                            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-soft"
                        >
                            <span className="text-sm font-medium">{service}</span>
                            <span className="text-sm text-neutral-500 ml-3 shrink-0">{price}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Signature Looks (admin-managed cards) */}
            <HomeServices showViewAll={false} />
        </main>
    );
}
