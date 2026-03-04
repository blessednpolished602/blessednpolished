import { Helmet } from "react-helmet-async";
import Hero from "../components/Hero";
import HomeServices from "../components/HomeServices";
import HomeTechnicians from "../components/HomeTechnicians"
import HomeGallery from "../components/HomeGallery";

export default function Home() {
    return (
        <>
            <Helmet>
                <title>Blessed N Polished — Nail Art & Nail Care | Buckeye, AZ</title>
                <meta name="description" content="Premium nail art in Buckeye, AZ. Hand-crafted sets including Swarovski crystals, XXL nail art, and custom designs. Book your appointment today." />
            </Helmet>
            <Hero />
            <HomeServices />
            <HomeTechnicians />
            <HomeGallery />
        </>
    );
}
