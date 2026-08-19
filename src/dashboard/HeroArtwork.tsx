import heroArtwork from "../assets/dashboard-hero-reference.jpg";
import "./HeroArtwork.css";

export function AudioHeroArtwork() {
  return (
    <div className="dashboard-v21-hero-art" aria-hidden="true">
      <img src={heroArtwork} alt="" draggable={false} />
    </div>
  );
}
