// src/components/SocialLinks.jsx
import React from "react";
import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaEnvelope } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";

/**
 * If you pass `socials={{ instagram, tiktok, facebook, website, email }}`,
 * it will render those. Otherwise it falls back to your default site links.
 */
export default function SocialLinks({
    className = "",
    size = 20,
    gap = "gap-4",
    brand = false,
    links,      // optional advanced override (array)
    socials,    // <-- use this for technician cards
}) {
    const defaultLinks = [
        { label: "Instagram", type: "external", Icon: FaInstagram, href: "https://www.instagram.com/reinakatrina84/", color: "#E1306C" },
        { label: "Facebook", type: "external", Icon: FaFacebookF, href: "https://www.facebook.com/katrina.garcia.777158", color: "#1877F2" },
        { label: "TikTok", type: "external", Icon: SiTiktok, href: "https://www.tiktok.com/@reinakatg?lang=en", color: "#000000" },
        { label: "Contact", type: "internal", Icon: FaEnvelope, to: "/contact", color: "#6B7280" },
    ];

    // Map simple socials object -> link array
    const mappedFromSocials = socials
        ? [
            socials.instagram && { label: "Instagram", type: "external", Icon: FaInstagram, href: socials.instagram, color: "#E1306C" },
            socials.facebook && { label: "Facebook", type: "external", Icon: FaFacebookF, href: socials.facebook, color: "#1877F2" },
            socials.tiktok && { label: "TikTok", type: "external", Icon: SiTiktok, href: socials.tiktok, color: "#000000" },
            socials.website && { label: "Website", type: "external", Icon: FaEnvelope, href: socials.website, color: "#6B7280" },
            socials.email && { label: "Email", type: "external", Icon: FaEnvelope, href: `mailto:${socials.email}`, color: "#6B7280" },
        ].filter(Boolean)
        : null;

    // Only use a prop if it has items; otherwise fall back
    const hasCustom = Array.isArray(links) && links.length > 0;
    const hasMapped = Array.isArray(mappedFromSocials) && mappedFromSocials.length > 0;
    const finalLinks = hasCustom ? links : (hasMapped ? mappedFromSocials : defaultLinks);

    const itemCls =
        "inline-flex items-center justify-center rounded-full w-10 h-10 " +
        "ring-1 ring-black/10 hover:ring-black/20 transition-transform duration-150 " +
        "hover:-translate-y-0.5 focus:outline-none focus-visible:ring focus-visible:ring-black/10";

    return (
        <nav
            aria-label="Social media"
            className={`flex items-center justify-center w-full ${gap} ${className}`}
        >
            {finalLinks.map(({ label, type, Icon, href, to, color }) =>
                type === "external" ? (
                    <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        title={label}
                        className={itemCls}
                        style={{ color: brand ? color : undefined }}
                    >
                        <Icon size={size} />
                    </a>
                ) : (
                    <Link
                        key={label}
                        to={to}
                        aria-label={label}
                        title={label}
                        className={itemCls}
                        style={{ color: brand ? color : undefined }}
                    >
                        <Icon size={size} />
                    </Link>
                )
            )}
        </nav>
    );
}
