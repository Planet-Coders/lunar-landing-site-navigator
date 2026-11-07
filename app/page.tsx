import NavigatorView from "@/components/NavigatorView";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-6 md:px-8">
      <header className="mb-4 flex flex-col gap-1 border-b border-cyan-300/15 pb-4 md:flex-row md:items-end md:justify-between">
        <h1
          className="text-2xl font-semibold tracking-wide text-white md:text-4xl"
          style={{ fontFamily: "var(--font-display), Orbitron, sans-serif" }}
        >
          Lunar Landing Site Navigator
        </h1>
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
          LuminaLuna · NASA JPL Horizons ephemerides
        </p>
      </header>
      <NavigatorView />
      <footer className="mt-6 border-t border-cyan-300/15 pt-4 text-center text-xs text-cyan-100/75">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-hud-amber">
          Geometric Visibility Only
        </p>
        <p className="mx-auto mt-1 max-w-3xl">
          Visibility is judged from Sun and Earth elevation above the local horizontal (JPL
          Horizons, airless) and the horizon mask you set. Terrain shadowing and the size of the
          solar and Earth discs are not modelled.
        </p>
      </footer>
    </main>
  );
}
