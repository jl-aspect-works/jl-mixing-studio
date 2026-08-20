import React from "react";
import ReactDOM from "react-dom/client";
import { AudioHeroArtwork } from "./HeroArtwork";

function HeroArtworkPreview() {
  return (
    <main className="hero-artwork-preview-page">
      <header>
        <h1>Dashboard Hero Artwork Preview</h1>
        <p>Isolated from the Studio UI so the artwork can be refined independently.</p>
      </header>
      <div className="hero-artwork-preview-grid">
        <section>
          <p>Desktop · 176px</p>
          <div className="hero-artwork-preview-frame desktop"><AudioHeroArtwork /></div>
        </section>
        <section>
          <p>Compact · 158px</p>
          <div className="hero-artwork-preview-frame compact"><AudioHeroArtwork /></div>
        </section>
        <section>
          <p>Mobile · 138px</p>
          <div className="hero-artwork-preview-frame mobile"><AudioHeroArtwork /></div>
        </section>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <HeroArtworkPreview />
  </React.StrictMode>,
);
