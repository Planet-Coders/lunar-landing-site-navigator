"use client";

import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, Color, Group, SphereGeometry, SRGBColorSpace, Vector3 } from "three";
import { LANDING_SITES } from "@/lib/sites";
import {
  POLAR_CAP_DEG,
  latLonToVector,
  paintMoonSurface,
  paintSouthPolarCap,
  polarCapUV,
} from "@/lib/moon-surface";
import type { LandingSite } from "@/lib/types";

const R = 1;
/** Lift pins slightly off the surface so they never z-fight with it. */
const PIN_LIFT = 1.004;
const SITE_A_COLOR = "#7ee8ff";
const SITE_B_COLOR = "#ffc14d";
const OTHER_COLOR = "#e8edf7";

export type SiteSlot = "A" | "B";

interface LunarGlobeProps {
  siteAId: string;
  siteBId: string;
  /** Called when a pin is clicked; the parent decides which slot it fills. */
  onSelectSite?: (siteId: string) => void;
  className?: string;
}

function MoonSurface() {
  const textures = useMemo(() => {
    const { color, height } = paintMoonSurface();
    const map = new CanvasTexture(color);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
    const bump = new CanvasTexture(height);
    return { map, bump };
  }, []);

  useEffect(
    () => () => {
      textures.map.dispose();
      textures.bump.dispose();
    },
    [textures],
  );

  return (
    <mesh>
      <sphereGeometry args={[R, 256, 192]} />
      <meshStandardMaterial
        map={textures.map}
        bumpMap={textures.bump}
        bumpScale={4}
        roughness={0.97}
        metalness={0}
      />
    </mesh>
  );
}

/**
 * High-resolution overlay for the south polar cap. An equirectangular texture
 * pinches into streaks at the pole, which is exactly where this map looks, so
 * the cap gets its own azimuthal texture and UVs.
 */
function SouthPolarCap() {
  const { geometry, map, bump } = useMemo(() => {
    const cap = (POLAR_CAP_DEG * Math.PI) / 180;
    const geo = new SphereGeometry(R * 1.0006, 256, 64, 0, Math.PI * 2, Math.PI - cap, cap);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const v = new Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).normalize();
      const [u, w] = polarCapUV(v.x, v.y, v.z);
      uv.setXY(i, u, w);
    }
    uv.needsUpdate = true;
    const canvases = paintSouthPolarCap();
    const colorTex = new CanvasTexture(canvases.color);
    colorTex.colorSpace = SRGBColorSpace;
    colorTex.anisotropy = 8;
    return { geometry: geo, map: colorTex, bump: new CanvasTexture(canvases.height) };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      map.dispose();
      bump.dispose();
    },
    [geometry, map, bump],
  );

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        map={map}
        bumpMap={bump}
        bumpScale={4}
        roughness={0.97}
        metalness={0}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function latitudeRing(latitude: number) {
  const pts: [number, number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 2) pts.push(latLonToVector(latitude, lon, R * 1.0015));
  return pts;
}

function meridian(longitude: number, fromLat: number) {
  const pts: [number, number, number][] = [];
  for (let lat = fromLat; lat >= -90; lat -= 0.5) pts.push(latLonToVector(lat, longitude, R * 1.0015));
  return pts;
}

/** Polar graticule: latitude rings toward the pole and meridians every 30°. */
function Graticule() {
  const rings = useMemo(() => [-60, -70, -80, -85, -88].map((lat) => ({ lat, pts: latitudeRing(lat) })), []);
  const meridians = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ lon: i * 30, pts: meridian(i * 30, -55) })),
    [],
  );
  const lonLabels: { text: string; lon: number }[] = [
    { text: "0°", lon: 0 },
    { text: "90°E", lon: 90 },
    { text: "180°", lon: 180 },
    { text: "90°W", lon: -90 },
  ];
  return (
    <group>
      {rings.map(({ lat, pts }) => (
        <Line key={lat} points={pts} color="#7ee8ff" lineWidth={lat === -80 ? 1 : 0.6} transparent opacity={lat === -80 ? 0.32 : 0.18} />
      ))}
      {meridians.map(({ lon, pts }) => (
        <Line key={lon} points={pts} color="#7ee8ff" lineWidth={0.6} transparent opacity={0.16} />
      ))}
      {lonLabels.map(({ text, lon }) => (
        <Html key={text} position={latLonToVector(-79, lon, R * 1.01)} center zIndexRange={[5, 0]}>
          <span className="pointer-events-none select-none whitespace-nowrap text-[10px] tracking-[0.18em] text-cyan-200/60">
            {text}
          </span>
        </Html>
      ))}
    </group>
  );
}

function SitePin({
  site,
  slot,
  onSelect,
}: {
  site: LandingSite;
  slot: SiteSlot | null;
  onSelect?: (siteId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<Group>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const { camera } = useThree();
  const position = useMemo(
    () => new Vector3(...latLonToVector(site.latitude, site.longitude, R * PIN_LIFT)),
    [site.latitude, site.longitude],
  );
  const scratch = useMemo(() => ({ world: new Vector3(), normal: new Vector3(), toCam: new Vector3() }), []);

  // Hide labels for pins on the far side of the globe.
  useFrame(() => {
    if (!groupRef.current || !labelRef.current) return;
    groupRef.current.getWorldPosition(scratch.world);
    scratch.normal.copy(scratch.world).normalize();
    scratch.toCam.copy(camera.position).sub(scratch.world).normalize();
    const facing = scratch.normal.dot(scratch.toCam) > 0.05;
    labelRef.current.style.opacity = facing ? "1" : "0";
    labelRef.current.style.pointerEvents = facing ? "auto" : "none";
  });

  const color = slot === "A" ? SITE_A_COLOR : slot === "B" ? SITE_B_COLOR : OTHER_COLOR;
  const showName = slot !== null || hovered;

  return (
    <group ref={groupRef} position={position}>
      <Html center zIndexRange={slot ? [30, 20] : [15, 10]}>
        <div ref={labelRef} className="transition-opacity duration-200">
          <div className="relative -translate-y-1/2">
            {showName && (
              <span
                className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${slot === "B" ? "top-full mt-1" : "bottom-full mb-1"} whitespace-nowrap rounded border bg-black/75 px-1.5 py-0.5 text-[10px] font-medium tracking-wide`}
                style={{ borderColor: `${color}99`, color }}
              >
                {slot ? `${slot} · ` : ""}
                {site.name}
              </span>
            )}
            <button
              type="button"
              title={`${site.name} · ${site.latitude.toFixed(2)}°, ${site.longitude.toFixed(1)}°E`}
              aria-label={site.name}
              onClick={() => onSelect?.(site.id)}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="block"
            >
              <svg width={slot ? 18 : 13} height={slot ? 24 : 17} viewBox="0 0 18 24" aria-hidden className="block">
                <path
                  d="M9 23C9 23 2 14.5 2 9a7 7 0 1 1 14 0c0 5.5-7 14-7 14Z"
                  fill={slot ? color : "rgba(10,16,28,0.85)"}
                  stroke={color}
                  strokeWidth={1.6}
                />
                <circle cx="9" cy="9" r="2.6" fill={slot ? "#020205" : color} />
              </svg>
            </button>
          </div>
        </div>
      </Html>
    </group>
  );
}

/**
 * Orient the globe so the south pole faces the camera and the near side
 * (0° longitude) points up, the usual layout for south-polar maps.
 */
const SOUTH_POLE_UP: [number, number, number] = [-Math.PI / 2, 0, 0];

function Scene({ siteAId, siteBId, onSelectSite }: LunarGlobeProps) {
  return (
    <>
      <ambientLight intensity={0.35} />
      {/* Low, grazing sun like the real polar lighting, so crater relief reads. */}
      <directionalLight position={[-3, 2.2, 1.2]} intensity={2.4} color="#fff6e5" />
      <directionalLight position={[2, -1, 3]} intensity={0.35} color="#9cc7ff" />
      <Stars radius={60} depth={30} count={3000} factor={2.5} saturation={0} fade speed={0.3} />
      <group rotation={SOUTH_POLE_UP}>
        <MoonSurface />
        <SouthPolarCap />
        <Graticule />
        {LANDING_SITES.map((site) => (
          <SitePin
            key={site.id}
            site={site}
            slot={site.id === siteAId ? "A" : site.id === siteBId ? "B" : null}
            onSelect={onSelectSite}
          />
        ))}
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={1.12}
        maxDistance={6}
        rotateSpeed={0.5}
        zoomSpeed={0.7}
        enableDamping
      />
    </>
  );
}

export default function LunarGlobe({ siteAId, siteBId, onSelectSite, className }: LunarGlobeProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-cyan-300/20 bg-[#020205] ${className ?? ""}`}>
      <Canvas
        camera={{ position: [0, 0, 1.55], fov: 40, near: 0.01, far: 200 }}
        gl={{ antialias: true }}
        onCreated={({ scene }) => {
          scene.background = new Color(0x020205);
        }}
      >
        <Scene siteAId={siteAId} siteBId={siteBId} onSelectSite={onSelectSite} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.2em] text-cyan-200/50">
        Drag to rotate · scroll to zoom · click a pin to select
      </div>
    </div>
  );
}
