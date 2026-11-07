'use client';

// Oficina in 3D (isometric, low poly). Everything is built from simple shapes here: no model files to download.
// The team sits at the desks, the AI robots work by the windows and customers waiting for a person sit in the lounge.
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export interface ScenePerson {
  key: string;
  name: string;
  online: boolean;
  typing: boolean;
  onChat: string | null;
  assigned: number;
  available: boolean;
  color: string;
}
export interface SceneRobot {
  key: string;
  label: string; // customer it's answering
}
export interface SceneCustomer {
  key: string;
  name: string;
  wait: string; // "12 min"
  isNew: boolean; // just handed over: walks from the AI zone to the lounge
}

const C = {
  floorA: '#9a6741',
  floorB: '#8b5a37',
  wall: '#f6e8d2',
  wallTop: '#ffffff',
  orange: '#f07a2b',
  deskTop: '#efe2c8',
  white: '#f8fafc',
  dark: '#1f2937',
  screenOn: '#7dd3fc',
  screenOff: '#334155',
  glass: '#9fd3e6',
  frame: '#1e2a4a',
  green: '#7ac74f',
  skin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'],
  hair: ['#2d1b0e', '#4a2c17', '#111827', '#7c4a1e', '#b45309'],
};

const first = (name: string) => {
  const w = name.trim().split(/\s+/)[0] || name;
  return w.length > 12 ? `${w.slice(0, 11)}…` : w;
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

// ---------- basic pieces ----------

function Box({ p, s, c, r, cast = true, receive = false, emissive }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: [number, number, number]; cast?: boolean; receive?: boolean; emissive?: string }) {
  return (
    <mesh position={p} rotation={r} castShadow={cast} receiveShadow={receive}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={emissive || '#000000'} emissiveIntensity={emissive ? 0.6 : 0} roughness={0.85} />
    </mesh>
  );
}

function Label({ y, children, tone = 'light', onClick }: { y: number; children: React.ReactNode; tone?: 'light' | 'amber' | 'violet' | 'gray'; onClick?: () => void }) {
  const cls = {
    light: 'bg-white/95 text-slate-800 border-slate-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-300',
    violet: 'bg-violet-50 text-violet-900 border-violet-200',
    gray: 'bg-slate-100/90 text-slate-500 border-slate-200',
  }[tone];
  return (
    <Html position={[0, y, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: onClick ? 'auto' : 'none' }}>
      <div onClick={onClick} className={`whitespace-nowrap rounded-full border px-1.5 py-[1px] text-[10px] leading-4 font-semibold shadow-sm select-none ${cls} ${onClick ? 'cursor-pointer hover:scale-105 transition' : ''}`}>{children}</div>
    </Html>
  );
}

// ---------- room ----------

function Room() {
  const planks = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);
  return (
    <group>
      {/* wooden floor */}
      {planks.map((i) => (
        <Box key={i} p={[-9 + 0.5 + i, -0.05, 0]} s={[1, 0.1, 13]} c={i % 2 ? C.floorA : C.floorB} cast={false} receive />
      ))}
      <Box p={[0, -0.25, 0]} s={[18.4, 0.3, 13.4]} c="#f3e3c8" cast={false} />
      {/* walls: back and left */}
      <Box p={[0, 2, -6.65]} s={[18.3, 4, 0.3]} c={C.wall} receive />
      <Box p={[-9.15, 2, 0]} s={[0.3, 4, 13.6]} c={C.wall} receive />
      <Box p={[0, 4.03, -6.65]} s={[18.3, 0.06, 0.3]} c={C.wallTop} cast={false} />
      <Box p={[-9.15, 4.03, 0]} s={[0.3, 0.06, 13.6]} c={C.wallTop} cast={false} />
      {/* windows over the AI zone */}
      {[2.4, 6.4].map((x) => (
        <group key={x} position={[x, 2.2, -6.48]}>
          <Box p={[0, 0, 0]} s={[2.4, 2.2, 0.06]} c={C.frame} cast={false} />
          <Box p={[-0.58, 0, 0.03]} s={[1.05, 2.0, 0.04]} c={C.glass} cast={false} />
          <Box p={[0.58, 0, 0.03]} s={[1.05, 2.0, 0.04]} c={C.glass} cast={false} />
        </group>
      ))}
      {/* door on the left wall */}
      <group position={[-8.98, 1.15, -3.6]}>
        <Box p={[0, 0, 0]} s={[0.06, 2.3, 1.2]} c={C.orange} cast={false} />
        <Box p={[0.05, 0.3, 0]} s={[0.04, 0.8, 0.9]} c="#f59e5b" cast={false} />
        <Box p={[0.08, 0, 0.42]} s={[0.06, 0.06, 0.12]} c={C.dark} cast={false} />
      </group>
      {/* whiteboard with a chart, clock, AC units */}
      <group position={[-8.98, 2.2, 0.6]}>
        <Box p={[0, 0, 0]} s={[0.05, 1.3, 2.6]} c={C.white} cast={false} />
        <Box p={[0.03, -0.3, -0.7]} s={[0.02, 0.4, 0.2]} c="#22c55e" cast={false} />
        <Box p={[0.03, -0.2, -0.3]} s={[0.02, 0.6, 0.2]} c={C.orange} cast={false} />
        <Box p={[0.03, -0.05, 0.1]} s={[0.02, 0.9, 0.2]} c="#3b82f6" cast={false} />
      </group>
      <mesh position={[-2.2, 3.1, -6.48]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.06, 8]} />
        <meshStandardMaterial color={C.orange} />
      </mesh>
      <Box p={[-2.2, 3.1, -6.44]} s={[0.04, 0.22, 0.02]} c={C.white} cast={false} />
      <Box p={[-5.5, 3.5, -6.4]} s={[1.6, 0.4, 0.3]} c={C.white} cast={false} />
      <Box p={[-8.85, 3.5, 4.2]} s={[0.3, 0.4, 1.6]} c={C.white} cast={false} />
      {/* bookshelves and plants */}
      <Shelf p={[-7.2, 0, -6.1]} />
      <Shelf p={[-5.6, 0, -6.1]} />
      <Plant p={[-8.4, 0, -5.9]} />
      <Plant p={[-0.6, 0, -5.9]} />
      <Plant p={[8.4, 0, 5.8]} />
      <WaterCooler p={[-1.6, 0, -6.1]} />
    </group>
  );
}

function Shelf({ p }: { p: [number, number, number] }) {
  const books = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6'];
  return (
    <group position={p}>
      <Box p={[0, 0.9, -0.12]} s={[1.4, 1.8, 0.22]} c={C.white} />
      <Box p={[-0.68, 0.9, 0.05]} s={[0.05, 1.8, 0.45]} c={C.white} />
      <Box p={[0.68, 0.9, 0.05]} s={[0.05, 1.8, 0.45]} c={C.white} />
      <Box p={[0, 1.78, 0.05]} s={[1.4, 0.05, 0.45]} c={C.white} />
      {[0.35, 0.95, 1.5].map((y, row) => (
        <group key={y}>
          <Box p={[0, y - 0.18, 0.05]} s={[1.3, 0.04, 0.42]} c="#e2e8f0" cast={false} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Box key={i} p={[-0.48 + i * 0.22, y + 0.02, 0.1]} s={[0.14, 0.36, 0.3]} c={books[(i + row * 2) % books.length]} cast={false} />
          ))}
        </group>
      ))}
    </group>
  );
}

function Plant({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.22, 0.6, 6]} />
        <meshStandardMaterial color={C.orange} flatShading />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={C.green} flatShading />
      </mesh>
    </group>
  );
}

function WaterCooler({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.5, 0]} s={[0.45, 1, 0.45]} c={C.white} />
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.5, 8]} />
        <meshStandardMaterial color="#60a5fa" transparent opacity={0.85} flatShading />
      </mesh>
    </group>
  );
}

// ---------- furniture ----------

function Chair({ p, rot }: { p: [number, number, number]; rot: number }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.45, 0]} s={[0.5, 0.08, 0.5]} c={C.orange} />
      <Box p={[0, 0.8, -0.24]} s={[0.5, 0.6, 0.08]} c={C.orange} />
      <Box p={[0, 0.22, 0]} s={[0.06, 0.44, 0.06]} c={C.dark} />
      <Box p={[0, 0.03, 0]} s={[0.5, 0.04, 0.08]} c={C.dark} cast={false} />
      <Box p={[0, 0.03, 0]} s={[0.08, 0.04, 0.5]} c={C.dark} cast={false} />
    </group>
  );
}

function Monitor({ p, rot, on, busy }: { p: [number, number, number]; rot: number; on: boolean; busy: boolean }) {
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!screen.current) return;
    screen.current.emissiveIntensity = on ? (busy ? 0.55 + Math.sin(clock.elapsedTime * 6) * 0.15 : 0.45) : 0;
  });
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.3, 0]} s={[0.62, 0.42, 0.05]} c={C.dark} />
      <mesh position={[0, 0.3, 0.03]}>
        <boxGeometry args={[0.56, 0.36, 0.01]} />
        <meshStandardMaterial ref={screen} color={on ? C.screenOn : C.screenOff} emissive={C.screenOn} emissiveIntensity={0} />
      </mesh>
      <Box p={[0, 0.06, 0]} s={[0.06, 0.12, 0.05]} c={C.dark} />
      <Box p={[0, 0.01, 0.05]} s={[0.25, 0.02, 0.15]} c={C.dark} cast={false} />
      <Box p={[0, 0.01, 0.3]} s={[0.42, 0.02, 0.14]} c="#cbd5e1" cast={false} />
    </group>
  );
}

// A pod: a shared desk with two seats on each side.
function Pod({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box p={[0, 0.78, 0]} s={[2.6, 0.06, 1.5]} c={C.deskTop} receive />
      <Box p={[0, 1.0, 0]} s={[2.5, 0.4, 0.04]} c={C.white} cast={false} />
      {[-1.22, 1.22].map((x) =>
        [-0.68, 0.68].map((z) => <Box key={`${x}${z}`} p={[x, 0.38, z]} s={[0.06, 0.76, 0.06]} c={C.orange} />),
      )}
      <mesh position={[1.45, 0.18, 0.9]} castShadow>
        <cylinderGeometry args={[0.13, 0.1, 0.36, 6]} />
        <meshStandardMaterial color="#94a3b8" flatShading />
      </mesh>
    </group>
  );
}

function Sofa({ p, rot, seats }: { p: [number, number, number]; rot: number; seats: number }) {
  const w = seats * 0.9 + 0.3;
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box p={[0, 0.25, 0]} s={[w, 0.5, 0.9]} c={C.orange} />
      <Box p={[0, 0.7, -0.35]} s={[w, 0.6, 0.2]} c="#e86f22" />
      <Box p={[-w / 2 + 0.1, 0.55, 0]} s={[0.2, 0.3, 0.9]} c="#e86f22" />
      <Box p={[w / 2 - 0.1, 0.55, 0]} s={[0.2, 0.3, 0.9]} c="#e86f22" />
    </group>
  );
}

// ---------- characters ----------

function Person({ shirt, seed, typing, sitting = true, walking = false }: { shirt: string; seed: number; typing?: boolean; sitting?: boolean; walking?: boolean }) {
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const skin = C.skin[seed % C.skin.length];
  const hair = C.hair[(seed >> 3) % C.hair.length];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + (seed % 100);
    if (armL.current && armR.current) {
      if (typing) {
        armL.current.rotation.x = -1.25 + Math.sin(t * 18) * 0.12;
        armR.current.rotation.x = -1.25 + Math.sin(t * 18 + Math.PI) * 0.12;
      } else if (walking) {
        armL.current.rotation.x = Math.sin(t * 8) * 0.5;
        armR.current.rotation.x = -Math.sin(t * 8) * 0.5;
      } else {
        armL.current.rotation.x = sitting ? -1.1 : 0;
        armR.current.rotation.x = sitting ? -1.1 : 0;
      }
    }
    if (walking && legL.current && legR.current) {
      legL.current.rotation.x = Math.sin(t * 8) * 0.55;
      legR.current.rotation.x = -Math.sin(t * 8) * 0.55;
    }
    if (body.current) body.current.position.y = walking ? Math.abs(Math.sin(t * 8)) * 0.05 : Math.sin(t * 1.5) * 0.01;
  });
  const hip = sitting ? 0.52 : 0.82;
  return (
    <group ref={body}>
      {/* legs */}
      {sitting ? (
        <>
          {[-0.1, 0.1].map((x) => (
            <group key={x}>
              <Box p={[x, hip, 0.2]} s={[0.15, 0.14, 0.42]} c="#1e3a5f" />
              <Box p={[x, 0.25, 0.4]} s={[0.14, 0.5, 0.14]} c="#1e3a5f" />
            </group>
          ))}
        </>
      ) : (
        [-0.1, 0.1].map((x, i) => (
          <group key={x} ref={i ? legR : legL} position={[x, hip, 0]}>
            <Box p={[0, -0.41, 0]} s={[0.15, 0.82, 0.15]} c="#1e3a5f" />
          </group>
        ))
      )}
      {/* torso, head, hair */}
      <mesh position={[0, hip + 0.33, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.24, 0.62, 6]} />
        <meshStandardMaterial color={shirt} flatShading />
      </mesh>
      <mesh position={[0, hip + 0.86, 0]} castShadow>
        <icosahedronGeometry args={[0.21, 0]} />
        <meshStandardMaterial color={skin} flatShading />
      </mesh>
      <mesh position={[0, hip + 0.96, -0.03]} castShadow>
        <icosahedronGeometry args={[0.19, 0]} />
        <meshStandardMaterial color={hair} flatShading />
      </mesh>
      {/* arms (pivot at the shoulder) */}
      {[-0.27, 0.27].map((x, i) => (
        <group key={x} ref={i ? armR : armL} position={[x, hip + 0.58, 0]}>
          <Box p={[0, -0.24, 0]} s={[0.1, 0.48, 0.1]} c={shirt} />
          <Box p={[0, -0.5, 0]} s={[0.09, 0.08, 0.09]} c={skin} cast={false} />
        </group>
      ))}
    </group>
  );
}

function Robot({ busy, seed }: { busy: boolean; seed: number }) {
  const head = useRef<THREE.Group>(null);
  const antenna = useRef<THREE.MeshStandardMaterial>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (head.current) head.current.rotation.y = busy ? Math.sin(t * 1.3) * 0.15 : Math.sin(t * 0.6) * 0.35;
    if (antenna.current) antenna.current.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 4)) * 1.2;
    if (armL.current && armR.current) {
      armL.current.rotation.x = busy ? -1.3 + Math.sin(t * 20) * 0.12 : -1.0;
      armR.current.rotation.x = busy ? -1.3 + Math.sin(t * 20 + Math.PI) * 0.12 : -1.0;
    }
  });
  return (
    <group>
      <Box p={[0, 0.25, 0.1]} s={[0.3, 0.5, 0.3]} c="#94a3b8" />
      <Box p={[0, 0.82, 0]} s={[0.48, 0.55, 0.36]} c="#e2e8f0" />
      <Box p={[0, 0.85, 0.19]} s={[0.24, 0.18, 0.02]} c="#6366f1" emissive="#6366f1" cast={false} />
      <group ref={head} position={[0, 1.28, 0]}>
        <Box p={[0, 0, 0]} s={[0.42, 0.32, 0.36]} c={C.white} />
        <Box p={[-0.09, 0.02, 0.185]} s={[0.08, 0.06, 0.02]} c="#22d3ee" emissive="#22d3ee" cast={false} />
        <Box p={[0.09, 0.02, 0.185]} s={[0.08, 0.06, 0.02]} c="#22d3ee" emissive="#22d3ee" cast={false} />
        <Box p={[0, 0.24, 0]} s={[0.03, 0.16, 0.03]} c="#94a3b8" cast={false} />
        <mesh position={[0, 0.34, 0]}>
          <icosahedronGeometry args={[0.05, 0]} />
          <meshStandardMaterial ref={antenna} color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.6} />
        </mesh>
      </group>
      {[-0.31, 0.31].map((x, i) => (
        <group key={x} ref={i ? armR : armL} position={[x, 1.0, 0]}>
          <Box p={[0, -0.22, 0]} s={[0.1, 0.44, 0.1]} c="#cbd5e1" />
        </group>
      ))}
    </group>
  );
}

// ---------- layout ----------

// Team seats: 4 pods of 4 (16 desks), filled in order.
const PODS: [number, number][] = [
  [0.6, 0.2],
  [4.6, 0.2],
  [0.6, 4.1],
  [4.6, 4.1],
];
const SEATS = PODS.flatMap(([px, pz]) => [
  { x: px - 0.62, z: pz - 1.15, rot: 0 },
  { x: px + 0.62, z: pz - 1.15, rot: 0 },
  { x: px - 0.62, z: pz + 1.15, rot: Math.PI },
  { x: px + 0.62, z: pz + 1.15, rot: Math.PI },
]);
export const MAX_DESKS = SEATS.length;

// Robots along the windows.
const ROBOT_X = [1.4, 2.7, 4.0, 5.3, 6.6, 7.9];
export const MAX_ROBOTS = ROBOT_X.length;

// Lounge seats (two sofas of three).
const LOUNGE = [
  { x: -8.0, z: 1.4, rot: Math.PI / 2 },
  { x: -8.0, z: 2.3, rot: Math.PI / 2 },
  { x: -8.0, z: 3.2, rot: Math.PI / 2 },
  { x: -6.3, z: 5.6, rot: Math.PI },
  { x: -5.4, z: 5.6, rot: Math.PI },
  { x: -4.5, z: 5.6, rot: Math.PI },
];
export const MAX_LOUNGE = LOUNGE.length;
const WALK_FROM = new THREE.Vector3(4.6, 0, -3.2);
const WALK_MS = 4500;

function Customer({ c, seat, lift, onOpen }: { c: SceneCustomer; seat: (typeof LOUNGE)[number]; lift: number; onOpen: () => void }) {
  const g = useRef<THREE.Group>(null);
  const start = useRef<number | null>(c.isNew ? null : -1);
  const [walking, setWalking] = React.useState(c.isNew);
  const target = useMemo(() => new THREE.Vector3(seat.x + Math.sin(seat.rot) * 0.15, 0, seat.z + Math.cos(seat.rot) * 0.15), [seat]);
  useFrame(({ clock }) => {
    if (!g.current) return;
    if (start.current === -1) {
      g.current.position.copy(target);
      g.current.rotation.y = seat.rot;
      return;
    }
    if (start.current === null) start.current = clock.elapsedTime * 1000;
    const k = Math.min(1, (clock.elapsedTime * 1000 - start.current) / WALK_MS);
    g.current.position.lerpVectors(WALK_FROM, target, k);
    g.current.rotation.y = k < 1 ? Math.atan2(target.x - WALK_FROM.x, target.z - WALK_FROM.z) : seat.rot;
    if (k >= 1) {
      start.current = -1;
      setWalking(false);
    }
  });
  const seed = hash(c.key);
  const shirts = ['#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa'];
  return (
    <group ref={g} position={c.isNew ? WALK_FROM : target} onClick={(e) => (e.stopPropagation(), onOpen())}>
      <Person shirt={shirts[seed % shirts.length]} seed={seed} sitting={!walking} walking={walking} />
      <Label y={walking ? 2.15 : 1.75 + lift} tone="amber" onClick={onOpen}>
        {first(c.name)} · {c.wait}
      </Label>
    </group>
  );
}

function CameraRig() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = Math.max(18, Math.min(size.width / 21, size.height / 14.5));
    cam.position.set(20, 18, 20);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function Scene({ people, robots, aiOn, aiTotal, customers, extraWaiting, onOpenCustomer }: OfficeSceneProps) {
  const seated = people.slice(0, MAX_DESKS);
  const robotList = aiOn ? (robots.length ? robots.slice(0, MAX_ROBOTS) : [{ key: 'idle', label: '' }]) : [];
  return (
    <>
      <CameraRig />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#fff7ed', '#c89a70', 0.6]} />
      <directionalLight position={[10, 18, 14]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-bias={-0.0005} />
      <Room />

      {/* team */}
      {PODS.map(([x, z]) => (
        <Pod key={`${x}${z}`} p={[x, 0, z]} />
      ))}
      {SEATS.map((s, i) => {
        const person = seated[i];
        const monitorZ = s.rot === 0 ? s.z + 0.62 : s.z - 0.62;
        return (
          <group key={i}>
            <Chair p={[s.x, 0, s.z - (s.rot === 0 ? 0.05 : -0.05)]} rot={s.rot} />
            <Monitor p={[s.x, 0.81, monitorZ]} rot={s.rot === 0 ? Math.PI : 0} on={Boolean(person?.online)} busy={Boolean(person?.typing)} />
            {person && (
              <group position={[s.x, 0, s.z]} rotation={[0, s.rot, 0]}>
                {person.online && <Person shirt={person.color} seed={hash(person.key)} typing={person.typing || Boolean(person.onChat)} />}
                <Label y={(person.online ? 1.85 : 1.3) + ((i + 1) % 2) * 0.42} tone={!person.online ? 'gray' : person.typing ? 'violet' : 'light'}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${!person.online ? 'bg-slate-400' : person.available ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {first(person.name)}
                  {person.online && person.typing ? ' ✍️' : person.online && person.onChat ? ' 💬' : ''}
                </Label>
              </group>
            )}
          </group>
        );
      })}

      {/* AI zone by the windows */}
      <Box p={[4.65, 0.78, -5.75]} s={[8.2, 0.06, 1.0]} c={C.deskTop} receive />
      {[0.7, 8.6].map((x) => (
        <Box key={x} p={[x, 0.38, -5.75]} s={[0.06, 0.76, 0.9]} c={C.orange} />
      ))}
      <group position={[4.65, 0, -6.3]}>
        <Label y={3.75} tone="violet">
          🤖 Zona IA · {aiOn ? `${aiTotal} ${aiTotal === 1 ? 'conversación' : 'conversaciones'}` : 'apagada'}
        </Label>
      </group>
      {ROBOT_X.map((x, i) => {
        const r = robotList[i];
        return (
          <group key={x}>
            <Chair p={[x, 0, -4.95]} rot={Math.PI} />
            <Monitor p={[x, 0.81, -5.95]} rot={0} on={Boolean(r)} busy={Boolean(r && r.key !== 'idle')} />
            {r && (
              <group position={[x, 0.05, -4.85]} rotation={[0, Math.PI, 0]}>
                <Robot busy={r.key !== 'idle'} seed={i * 1.7} />
                {r.label && (
                  <Label y={1.9} tone="violet">
                    💬 {first(r.label)}
                  </Label>
                )}
              </group>
            )}
          </group>
        );
      })}

      {/* lounge: customers waiting for a person */}
      <Sofa p={[-8.15, 0, 2.3]} rot={Math.PI / 2} seats={3} />
      <Sofa p={[-5.4, 0, 5.75]} rot={Math.PI} seats={3} />
      <Box p={[-6.4, 0.22, 3.4]} s={[1.2, 0.06, 0.8]} c={C.white} />
      <Box p={[-6.4, 0.1, 3.4]} s={[0.9, 0.2, 0.5]} c={C.orange} />
      <Box p={[-5.9, 0.01, 3.2]} s={[4.4, 0.02, 3.6]} c="#f4d4b5" cast={false} receive />
      <group position={[-8.8, 0, 3.4]}>
        <Label y={3.75} tone="amber">
          🛋️ Esperan a una persona · {customers.length + extraWaiting}
        </Label>
      </group>
      {customers.slice(0, MAX_LOUNGE).map((c, i) => (
        <Customer key={c.key} c={c} seat={LOUNGE[i]} lift={(2 - (i % 3)) * 0.42} onOpen={() => onOpenCustomer(c.key)} />
      ))}

      <OrbitControls target={[0, 0, 0]} enablePan={false} minPolarAngle={0.75} maxPolarAngle={1.05} minAzimuthAngle={0.2} maxAzimuthAngle={1.35} minZoom={14} maxZoom={120} />
    </>
  );
}

export interface OfficeSceneProps {
  people: ScenePerson[];
  robots: SceneRobot[];
  aiOn: boolean;
  aiTotal: number;
  customers: SceneCustomer[];
  extraWaiting: number;
  onOpenCustomer: (key: string) => void;
}

export default function OfficeScene(props: OfficeSceneProps) {
  // Pause drawing while the tab is hidden (saves battery).
  const [visible, setVisible] = React.useState(true);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return (
    <Canvas orthographic shadows dpr={[1, 1.75]} frameloop={visible ? 'always' : 'never'} camera={{ position: [20, 18, 20], zoom: 40, near: -100, far: 200 }} gl={{ antialias: true }}>
      <color attach="background" args={['#b2e3dd']} />
      <Scene {...props} />
    </Canvas>
  );
}
