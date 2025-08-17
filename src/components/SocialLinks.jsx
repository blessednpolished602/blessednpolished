import React from "react";
import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaEnvelope } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import { Icon } from "lucide-react";

/**
 * Renders social media icons.
 * - className: extra classes for the container
 * - size: icon size in px
 * - gap: Tailwind gap utility (default gap-4)
 * - brand: true => brand colors; false => inherit text color
 */
export default function SocialLinks({
    className = "",
    size = 20,
    gap = "gap-4",
    brand = false,
}) {
    const links = [
        // TODO: swap these 3 with her real profile URLs
        { label: "Instagram", type: "external", Icon: FaInstagram, href: "https://www.instagram.com/reinakatrina84/", color: "#E1306C" },
        { label: "Facebook", type: "external", Icon: FaFacebookF, href: "https://www.facebook.com/katrina.garcia.777158", color: "#1877F2" },
        { label: "TikTok", type: "external", Icon: SiTiktok, href: "https://www.tiktok.com/@reinakatg?lang=en", color: "#000000" },

        // Envelope goes to /contact (internal)
        { label: "Contact", type: "internal", Icon: FaEnvelope, to: "/contact", color: "#6B7280" },
    ];

    const itemCls =
        "inline-flex items-center justify-center rounded-full w-10 h-10 " +
        "transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none focus-visible:ring focus-visible:ring-black/10";

    return (
        <nav aria-label="Social media" className={`flex items-center ${gap} ${className}`}>
            {links.map(({ label, type, Icon, href, to, color }) =>
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
