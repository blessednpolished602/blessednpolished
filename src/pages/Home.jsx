import Hero from "../components/Hero";
import HomeServices from "../components/HomeServices";
import HomeTechnicians from "../components/HomeTechnicians"
import HomeGallery from "../components/HomeGallery";

export default function Home() {
    return (
        <>
            <Hero />
            <HomeServices />
            <HomeTechnicians />
            <HomeGallery />
        </>
    );
}
