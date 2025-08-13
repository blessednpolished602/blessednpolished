// src/components/Hero.jsx
import useSiteSettings from "../hooks/useSiteSettings";
import { Link } from "react-router-dom";

export default function Hero({ onBook }) {
    const s = useSiteSettings();

    return (
        <section id="hero" className="bg-transparent">
            <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
                    {/* Text */}
                    <div className="order-2 md:order-1">
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
                            {s?.heroHeadline || "Blessed N Polished"}
                        </h1>
                        <p className="mt-4 text-lg text-neutral-700">
                            {s?.heroSub || "How we do"}
                        </p>

                        <div className="mt-6 flex flex-wrap gap-3">
                            {onBook
                                ? <button className="btn btn-primary" onClick={onBook}>Book Now</button>
                                : <Link to="/book" className="btn btn-primary">Book Now</Link>}
                            <Link to="/services" className="btn btn-ghost">Our Services</Link>
                        </div>
                    </div>

                    {/* Image */}
                    <div className="order-1 md:order-2">
                        <div className="rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5">
                            {s?.heroImage ? (
                                <img
                                    src={s.heroImage}
                                    alt=""
                                    className="w-full h-[380px] md:h-[460px] object-cover"
                                />
                            ) : (
                                <div className="w-full h-[380px] md:h-[460px] bg-neutral-200" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
