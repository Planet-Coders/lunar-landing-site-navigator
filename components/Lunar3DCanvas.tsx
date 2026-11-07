"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import {
  Color,
  Vector3,
} from "three";
import { azElToCartesian } from "@/lib/ephemeris";
import type { EphemerisSample } from "@/lib/types";

const SKY_RADIUS = 36;
function celestialPosition(body: EphemerisSample["sun"]): Vector3 {
  return new Vector3(...azElToCartesian(body.azimuth!, body.elevation!, SKY_RADIUS));
}

/** A reference horizontal plane, not a reconstruction of site terrain. */
function Terrain() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
      <planeGeometry args={[220, 220]} />
      <meshStandardMaterial color="#b7aea3" roughness={0.92} metalness={0.02} />
    </mesh>
  );
}

function HorizonRing() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[48, 48.35, 128]} />
        <meshBasicMaterial color="#7ee8ff" transparent opacity={0.35} />
      </mesh>
      {[
        { label: "N", pos: [0, 0.2, -9] as [number, number, number] },
        { label: "E", pos: [9, 0.2, 0] as [number, number, number] },
        { label: "S", pos: [0, 0.2, 9] as [number, number, number] },
        { label: "W", pos: [-9, 0.2, 0] as [number, number, number] },
      ].map((mark) => (
        <mesh key={mark.label} position={mark.pos}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshBasicMaterial color="#7ee8ff" />
        </mesh>
      ))}
    </group>
  );
}

function Lander() {
  return (
    <group position={[0, 0.55, 0]} castShadow>
      <mesh castShadow>
        <cylinderGeometry args={[0.35, 0.55, 0.7, 8]} />
        <meshStandardMaterial color="#c9d4e8" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#7ee8ff" emissive="#123040" />
      </mesh>
    </group>
  );
}

function CelestialBodies({ sample }: { sample: EphemerisSample }) {
  const sun = useMemo(() => celestialPosition(sample.sun), [sample]);
  const earth = useMemo(() => celestialPosition(sample.earth), [sample]);
  // Actual full-disk angular diameters (arcsec), no visual enlargement.
  const radius = (diameter: number) => SKY_RADIUS * Math.tan(diameter / 3600 * Math.PI / 360);
  return (
    <group>
      <mesh position={sun}>
        <sphereGeometry args={[radius(sample.sun.angularDiameterArcsec), 24, 24]} />
        <meshBasicMaterial color="#fff4c2" />
      </mesh>
      <directionalLight position={sun} color="#fff4d2" intensity={sample.sun.elevation! > 0 ? 2.6 : 0} castShadow />
      <mesh position={earth}>
        <sphereGeometry args={[radius(sample.earth.angularDiameterArcsec), 32, 32]} />
        <meshStandardMaterial color="#6aa2ff" emissive={new Color("#0a1224")} roughness={0.4} />
      </mesh>
    </group>
  );
}

export default function Lunar3DCanvas({ sample }: { sample: EphemerisSample | null }) {
  return (
    <div className="relative h-[320px] overflow-hidden rounded-xl border border-cyan-300/20 bg-[#020205] scanlines md:h-[380px]">
      <Canvas
        shadows
        camera={{ position: [-12, 4.6, 2.5], fov: 55, near: 0.1, far: 400 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ scene }) => {
          scene.background = new Color(0x020205);
          scene.fog = null;
        }}
      >
        <ambientLight intensity={0.28} />
        <hemisphereLight args={["#8ea7d8", "#2c241c", 0.55]} />
        <Terrain />
        <HorizonRing />
        <Lander />
        {sample && <CelestialBodies sample={sample} />}
        <gridHelper args={[80, 20, "#1b3b55", "#101824"]} position={[0, 0.02, 0]} />
        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={28}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 0.6, 0]}
        />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 text-[10px] uppercase tracking-[0.24em] text-cyan-200/70">
        Reference plane · airless Az/El
      </div>
    </div>
  );
}
