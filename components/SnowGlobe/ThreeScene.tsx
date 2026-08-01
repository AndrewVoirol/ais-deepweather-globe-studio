import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, ContactShadows, Stars, MeshTransmissionMaterial, Sparkles } from '@react-three/drei';
import IsometricCity from './IsometricCity';
import WeatherSystem from './WeatherSystem';
import { WeatherConfig } from '../../types';

interface ThreeSceneProps {
  weather: WeatherConfig;
}

const GlobeGlass = () => (
  <mesh>
    <sphereGeometry args={[2, 64, 64]} />
    <MeshTransmissionMaterial 
      backside={false}
      samples={4}
      thickness={0.1} // Thinner for more clarity
      chromaticAberration={0.03}
      anisotropy={0.1}
      distortion={0.1}
      distortionScale={0.1}
      temporalDistortion={0.0}
      roughness={0.05} // Polished glass
      clearcoat={1}
      attenuationDistance={0.5}
      attenuationColor="#ffffff"
      color="#eef2ff"
      transmission={0.99}
      ior={1.5}
    />
  </mesh>
);

const Base = () => (
  <group position={[0, -2.2, 0]}>
    {/* Main Pedestal */}
    <mesh position={[0, 0.1, 0]}>
      <cylinderGeometry args={[1.8, 2.0, 0.2, 64]} />
      <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
    </mesh>
    {/* Accent Ring */}
    <mesh position={[0, 0.21, 0]}>
       <torusGeometry args={[1.8, 0.02, 16, 100]} />
       <meshStandardMaterial color="#444" emissive="#222" />
    </mesh>
  </group>
)

const ThreeScene: React.FC<ThreeSceneProps> = ({ weather }) => {
  const isNight = !weather.dayTime;

  return (
    <div className="w-full h-full bg-gradient-to-b from-deep-900 to-black relative">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 2, 7]} fov={35} />
        <OrbitControls 
          enablePan={false} 
          minDistance={5} 
          maxDistance={14} 
          maxPolarAngle={Math.PI / 1.8} 
          autoRotate={true}
          autoRotateSpeed={0.5}
        />
        
        {/* Dynamic Lighting */}
        <ambientLight intensity={isNight ? 0.2 : 0.7} />
        
        {/* Sun / Moon Light */}
        <spotLight 
          position={[10, 12, 5]} 
          angle={0.4} 
          penumbra={1} 
          intensity={isNight ? 2 : 1.5} 
          castShadow 
          shadow-bias={-0.0001}
          color={isNight ? "#aaccff" : "#fff9e6"}
        />
        
        {/* Rim Light for Glass */}
        <pointLight position={[-10, 0, -5]} intensity={1} color="#4444ff" />

        {/* Blurred Environment for Realistic Reflections */}
        <Environment 
          preset={isNight ? "night" : "city"} 
          background={false} 
          blur={0.6} // Key for realism: blurs the HDRI so it looks like generic surroundings
        />
        
        {isNight && <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />}

        {/* The Globe */}
        <group position={[0, 0, 0]}>
            <GlobeGlass />
            
            {/* Interior World */}
            <group position={[0, -0.5, 0]}>
              <IsometricCity themeColor={weather.themeColor} density={weather.dayTime ? 0.8 : 1.0} weather={weather} />
              <WeatherSystem weather={weather} />
            </group>

            {/* Internal Atmosphere Glow */}
            {weather.condition === 'stormy' && (
               <pointLight position={[0, 0, 0]} intensity={0.5} color="#ffaa00" distance={3} decay={2} />
            )}
        </group>

        <Base />
        
        {/* Soft Ground Shadow */}
        <ContactShadows position={[0, -2.2, 0]} opacity={0.6} scale={12} blur={2.5} far={4} color="#000" />

        {/* External Fog */}
        <fog attach="fog" args={['#0B1120', 8, 30]} />
      </Canvas>
    </div>
  );
};

export default ThreeScene;