import SpaceCanvas from "@/components/scene/SpaceCanvas";
import Hud from "@/components/ui/Hud";
import IntroOverlay from "@/components/ui/IntroOverlay";
import WarpOverlay from "@/components/ui/WarpOverlay";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background font-sans">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(12,20,28,0.32),_transparent_55%),radial-gradient(circle_at_80%_70%,_rgba(6,10,16,0.45),_transparent_60%)]" />
      <SpaceCanvas />
      <Hud />
      <IntroOverlay />
      <WarpOverlay />
    </main>
  );
}
