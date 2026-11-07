"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  RepeatWrapping,
  Vector3,
} from "three";
import { azElToCartesian, raDecToCartesian } from "@/lib/ephemeris";
import type { EphemerisSample } from "@/lib/types";

const SKY_RADIUS = 36;
const MOON_ANGULAR_DIAMETER_DEG = 0.5;
const EARTH_ANGULAR_MULTIPLIER = 4;
const SUN_VISUAL_SCALE = 3.8;

function angularMeshRadius(angularDiameterDeg: number, distance: number) {
  return distance * Math.tan(((angularDiameterDeg / 2) * Math.PI) / 180);
}

function makeRegolithTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#1a1714";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i += 1) {
    const shade = 28 + Math.floor(Math.random() * 50);
    ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 8})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

function celestialPosition(body: EphemerisSample["sun"]): Vector3 {
  if (body.azimuth !== null && body.elevation !== null) {
    return new Vector3(...azElToCartesian(body.azimuth, body.elevation, SKY_RADIUS));
  }
  if (body.rightAscension !== null && body.declination !== null) {
    return new Vector3(...raDecToCartesian(body.rightAscension, body.declination, SKY_RADIUS));
  }
  return new Vector3(0, -SKY_RADIUS, 0);
}

function Terrain() {
  const texture = useMemo(() => makeRegolithTexture(), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
      <planeGeometry args={[220, 220, 96, 96]} />
      <meshStandardMaterial
        map={texture ?? undefined}
        color="#b7aea3"
        roughness={0.92}
        metalness={0.02}
        displacementMap={texture ?? undefined}
        displacementScale={0.55}
      />
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

function CelestialBodies({ sample }: { sample: EphemerisSample | null }) {
  const sunRef = useRef<Mesh>(null);
  const earthRef = useRef<Mesh>(null);
  const lightRef = useRef<DirectionalLight>(null);
  const groupRef = useRef<Group>(null);
  const sunTarget = useRef(new Vector3(20, 40, 10));
  const earthTarget = useRef(new Vector3(-20, 8, 40));

  const sunSize =
    angularMeshRadius(MOON_ANGULAR_DIAMETER_DEG, SKY_RADIUS) * SUN_VISUAL_SCALE;
  const earthSize =
    angularMeshRadius(MOON_ANGULAR_DIAMETER_DEG * EARTH_ANGULAR_MULTIPLIER, SKY_RADIUS) *
    SUN_VISUAL_SCALE;

  if (sample) {
    sunTarget.current.copy(celestialPosition(sample.sun));
    earthTarget.current.copy(celestialPosition(sample.earth));
  }

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * 4.2);
    if (sunRef.current) {
      sunRef.current.position.lerp(sunTarget.current, k);
      if (lightRef.current) {
        lightRef.current.position.copy(sunRef.current.position);
      }
    }
    if (earthRef.current) {
      earthRef.current.position.lerp(earthTarget.current, k);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={sunRef}>
        <sphereGeometry args={[Math.max(sunSize, 1.15), 24, 24]} />
        <meshBasicMaterial color="#fff4c2" />
      </mesh>
      <pointLight color="#ffe9a8" intensity={3.4} distance={120} />
      <directionalLight
        ref={lightRef}
        color="#fff4d2"
        intensity={(sample?.sun.elevation ?? -10) > 0 ? 2.6 : 0.22}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <mesh ref={earthRef}>
        <sphereGeometry args={[Math.max(earthSize, 3.4), 32, 32]} />
        <meshStandardMaterial
          color="#6aa2ff"
          emissive={new Color((sample?.earth.elevation ?? -10) > 0 ? "#1a4cad" : "#0a1224")}
          roughness={0.4}
        />
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
        <Stars radius={180} depth={40} count={4000} factor={3} saturation={0} fade speed={0.2} />
        <Terrain />
        <HorizonRing />
        <Lander />
        <CelestialBodies sample={sample} />
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
        Airless horizon · ICRF / AZ-EL
      </div>
    </div>
  );
}
