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
                            {s?.heroSub || "May your nails always get compliments"}
                        </p>

                        <div className="mt-6 flex flex-wrap gap-3">
                            {onBook ? (
                                <button className="btn btn-primary" onClick={onBook}>Book Now</button>
                            ) : (
                                <Link to="/book" className="btn btn-primary">Book Now</Link>
                            )}
                            <Link to="/services" className="btn btn-ghost">Our Services</Link>
                        </div>
                    </div>

                    {/* Image */}
                    <div className="order-1 md:order-2">
                        <div
                            className="
      relative mx-auto
      w-full max-w-[clamp(260px,80vw,420px)]  /* cap size on phones */
      md:max-w-none                           /* free to expand on desktop */
      rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5
      aspect-[4/5] sm:aspect-[3/4] md:aspect-[4/3]
    "
                        >
                            {s?.heroImage ? (
                                <img
                                    src={s.heroImage}
                                    alt=""
                                    className="absolute inset-0 h-full w-full object-cover object-center"
                                    width={1200}
                                    height={1600}
                                    loading="eager"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-neutral-200" />
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
