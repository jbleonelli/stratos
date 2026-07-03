import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Device } from '../api/types';

const deviceColor = (status: Device['status']) =>
  status === 'online' ? '#ff00b2' : status === 'maintenance' ? '#f59e0b' : '#64748b';

function DeviceMarker({ device, elevation }: { device: Device; elevation: number }) {
  const x = (device.positionX ?? 0.5) * 10 - 5;
  const z = (device.positionY ?? 0.5) * 10 - 5;
  return (
    <mesh position={[x, elevation + 0.35, z]}>
      <boxGeometry args={[0.5, 0.7, 0.5]} />
      <meshStandardMaterial color={deviceColor(device.status)} />
    </mesh>
  );
}

function FloorScene({ devices, elevation }: { devices: Device[]; elevation: number }) {
  const placed = devices.filter((d) => d.positionX != null && d.positionY != null);
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 4]} intensity={0.85} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, elevation, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <gridHelper args={[12, 12, '#334155', '#1e293b']} position={[0, elevation + 0.01, 0]} />
      {placed.map((d) => (
        <DeviceMarker key={d.id} device={d} elevation={elevation} />
      ))}
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={18} />
    </>
  );
}

export function HypervisorFloor3D({ devices, elevation }: { devices: Device[]; elevation: number }) {
  return (
    <div style={{ height: 420, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', background: '#0f172a' }}>
      <Canvas camera={{ position: [8, 7, 8], fov: 45 }}>
        <FloorScene devices={devices} elevation={elevation} />
      </Canvas>
    </div>
  );
}
