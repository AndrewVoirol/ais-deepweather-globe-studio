import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WeatherConfig } from '../../types';

interface WeatherSystemProps {
  weather: WeatherConfig;
}

// --- Shaders ---

const SnowShader = {
  vertexShader: `
    uniform float uTime;
    uniform float uRadius;
    attribute vec3 aRandom; // x=speed_mod, y=offset_y, z=sway_phase
    varying float vAlpha;

    void main() {
      vec3 pos = position;
      
      // 1. Animate Fall
      float speed = 0.3 * (1.0 + aRandom.x);
      float fallOffset = uTime * speed;
      
      // 2. Apply Base Position & Loop
      pos.y = position.y - fallOffset;
      
      float h = 4.0;
      pos.y = mod(pos.y + 100.0, h) - 2.0;

      // 3. Turbulence / Sway
      pos.x += sin(uTime * 1.5 + aRandom.z) * 0.15;
      pos.z += cos(uTime * 1.2 + aRandom.z) * 0.15;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // 4. Size Attenuation
      gl_PointSize = (6.0 + aRandom.x * 4.0) * (20.0 / -mvPosition.z);

      // 5. Containment & Fading
      float dist = length(pos);
      float sphereFade = 1.0 - smoothstep(uRadius - 0.3, uRadius, dist);
      float floorFade = smoothstep(-1.5, -1.0, pos.y);
      
      vAlpha = sphereFade * floorFade;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying float vAlpha;

    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float r = length(coord);
      if (r > 0.5) discard;

      float glow = 1.0 - (r * 2.0);
      glow = pow(glow, 1.5);

      gl_FragColor = vec4(uColor, vAlpha * glow * 0.8);
    }
  `
};

const RainShader = {
  vertexShader: `
    uniform float uTime;
    uniform float uRadius;
    attribute vec3 aInstancePos; // Center of the raindrop instance
    attribute float aSpeed;
    attribute float aPhase;
    
    varying float vAlpha;

    void main() {
      vec3 pos = position; 
      
      float fallSpeed = 3.0 * (1.0 + aSpeed);
      float yFall = uTime * fallSpeed;
      
      float currentY = aInstancePos.y - yFall;
      float h = 4.0;
      currentY = mod(currentY + 100.0, h) - 2.0;
      
      vec3 instanceCenter = vec3(aInstancePos.x, currentY, aInstancePos.z);
      
      pos.x += pos.y * 0.1; // Slant
      
      vec3 worldPos = instanceCenter + pos;
      
      vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      float dist = length(instanceCenter);
      float sphereFade = 1.0 - smoothstep(uRadius - 0.2, uRadius, dist);
      float floorFade = smoothstep(-1.5, -1.2, currentY);
      
      vAlpha = sphereFade * floorFade * 0.6; 
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying float vAlpha;

    void main() {
      gl_FragColor = vec4(uColor, vAlpha);
    }
  `
};

const CloudShader = {
  vertexShader: `
    uniform float uTime;
    attribute vec3 aRandom; // x=scale, y=speed, z=height_offset
    
    varying vec2 vUv;
    varying float vAlpha;
    varying float vScale;

    void main() {
      vUv = uv;
      
      // Get initial position from instance matrix
      vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      
      // Convert to polar
      float radius = length(iPos.xz);
      float angle = atan(iPos.z, iPos.x);
      
      // Animate angle (rotate around center)
      float speed = 0.05 * aRandom.y;
      float currentAngle = angle + uTime * speed;
      
      // Recompute position
      vec3 newPos = vec3(
        cos(currentAngle) * radius,
        iPos.y + sin(uTime * 0.5 + aRandom.z) * 0.1, // Bobbing
        sin(currentAngle) * radius
      );

      // Billboard View-Aligned Quad
      vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
      
      // Scale puff
      float scale = aRandom.x * (1.0 + sin(uTime + aRandom.z) * 0.05);
      vScale = scale;
      
      mvPosition.xy += position.xy * scale;
      
      gl_Position = projectionMatrix * mvPosition;
      
      // Fade near boundaries
      float dist = length(newPos);
      // Fade out if it somehow exits the globe radius ~1.9
      vAlpha = 1.0 - smoothstep(1.6, 1.9, dist);
    }
  `,
  fragmentShader: `
    uniform vec3 uBaseColor;
    uniform float uTime;
    varying vec2 vUv;
    varying float vAlpha;
    varying float vScale;

    // Noise functions (Value Noise 2D)
    float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
    float noise(vec2 x) {
        vec2 i = floor(x);
        vec2 f = fract(x);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 x) {
        float v = 0.0;
        float a = 0.5;
        vec2 shift = vec2(100);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
        for (int i = 0; i < 4; ++i) {
            v += a * noise(x);
            x = rot * x * 2.0 + shift;
            a *= 0.5;
        }
        return v;
    }

    void main() {
      vec2 coord = vUv * 2.0 - 1.0;
      float dist = length(coord);
      
      // Base cloud shape (soft circle)
      float baseAlpha = smoothstep(1.0, 0.2, dist);
      
      // Carve with FBM noise
      // Animate noise slowly
      float n = fbm(vUv * 3.0 + uTime * 0.1);
      
      // Combine
      float finalAlpha = baseAlpha * (0.4 + 0.6 * n);
      
      // Lighting/Volume approximation
      // Lighter at top-left
      float light = 0.5 + 0.5 * fbm(vUv * 4.0 - vec2(1.0, 1.0));
      
      if (finalAlpha < 0.05) discard;
      
      vec3 col = uBaseColor * (0.7 + 0.5 * light);
      
      gl_FragColor = vec4(col, finalAlpha * vAlpha * 0.7);
    }
  `
};

// --- Components ---

const SnowParticles = ({ count, color }: { count: number, color: string }) => {
  const points = useRef<THREE.Points>(null);
  
  const { positions, randoms } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const r = Math.random() * 1.8;
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = r * Math.cos(theta);
      positions[i * 3 + 1] = (Math.random() * 4.0) - 2.0;
      positions[i * 3 + 2] = r * Math.sin(theta);
      randoms[i * 3] = Math.random();
      randoms[i * 3 + 1] = Math.random();
      randoms[i * 3 + 2] = Math.random() * Math.PI;
    }
    return { positions, randoms };
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uRadius: { value: 1.9 },
    uColor: { value: new THREE.Color(color) }
  }), [color]);

  useFrame((state) => {
    if (points.current && points.current.material instanceof THREE.ShaderMaterial) {
      points.current.material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aRandom" count={count} array={randoms} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={SnowShader.vertexShader}
        fragmentShader={SnowShader.fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

const RainParticles = ({ count, color }: { count: number, color: string }) => {
  const mesh = useRef<THREE.InstancedMesh>(null);

  const { instancePos, speeds, phases } = useMemo(() => {
    const instancePos = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      const r = Math.random() * 1.8;
      const theta = Math.random() * Math.PI * 2;
      instancePos[i * 3] = r * Math.cos(theta);
      instancePos[i * 3 + 1] = (Math.random() * 4.0) - 2.0;
      instancePos[i * 3 + 2] = r * Math.sin(theta);
      speeds[i] = Math.random();
      phases[i] = Math.random();
    }
    return { instancePos, speeds, phases };
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uRadius: { value: 1.9 },
    uColor: { value: new THREE.Color(color) }
  }), [color]);

  useFrame((state) => {
    if (mesh.current && mesh.current.material instanceof THREE.ShaderMaterial) {
      mesh.current.material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.01, 0.4, 0.01]}>
         <instancedBufferAttribute attach="attributes-aInstancePos" args={[instancePos, 3]} />
         <instancedBufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
         <instancedBufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </boxGeometry>
      <shaderMaterial
        vertexShader={RainShader.vertexShader}
        fragmentShader={RainShader.fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
};

const VolumetricClouds = ({ weather }: { weather: WeatherConfig }) => {
  const mesh = useRef<THREE.InstancedMesh>(null);
  
  // Density multiplier
  const particleCount = Math.floor(weather.cloudCover * 80) + 20;
  
  const { transforms, randoms } = useMemo(() => {
    const t = new Float32Array(particleCount * 16);
    const r = new Float32Array(particleCount * 3);
    const tempObj = new THREE.Object3D();
    
    for(let i=0; i<particleCount; i++) {
      // Spread clouds in upper hemisphere
      const radius = Math.random() * 1.6;
      const angle = Math.random() * Math.PI * 2;
      const y = 0.5 + Math.random() * 1.0; // Height between 0.5 and 1.5
      
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      tempObj.position.set(x, y, z);
      tempObj.updateMatrix();
      t.set(tempObj.matrix.elements, i * 16);
      
      r[i*3 + 0] = 0.5 + Math.random() * 1.2; // Scale
      r[i*3 + 1] = 0.8 + Math.random() * 0.4; // Speed mod
      r[i*3 + 2] = Math.random() * Math.PI;   // Offset
    }
    return { transforms: t, randoms: r };
  }, [particleCount]);
  
  // Update matrices on count change (remount effect)
  useEffect(() => {
    if (mesh.current) {
      for (let i = 0; i < particleCount; i++) {
         const mat = new THREE.Matrix4();
         mat.fromArray(transforms, i * 16);
         mesh.current.setMatrixAt(i, mat);
      }
      mesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [transforms, particleCount]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(weather.condition === 'stormy' ? '#4a5568' : '#ffffff') }
  }), [weather.condition]);

  useFrame((state) => {
    if (mesh.current && mesh.current.material instanceof THREE.ShaderMaterial) {
      mesh.current.material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, particleCount]} key={particleCount}>
      <planeGeometry args={[1, 1]}>
         <instancedBufferAttribute attach="attributes-aRandom" args={[randoms, 3]} />
      </planeGeometry>
      <shaderMaterial
        vertexShader={CloudShader.vertexShader}
        fragmentShader={CloudShader.fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        // Normal blending creates softer, denser looking clouds than Additive
        blending={THREE.NormalBlending} 
      />
    </instancedMesh>
  );
}

// --- Main Weather Component ---

const WeatherSystem: React.FC<WeatherSystemProps> = ({ weather }) => {
  const config = useMemo(() => {
    if (weather.condition === 'snowy') {
      return { 
        type: 'snow', 
        count: Math.floor(1500 * weather.precipitationIntensity), 
        color: '#ffffff' 
      };
    } else if (weather.condition === 'rainy' || weather.condition === 'stormy') {
      return { 
        type: 'rain', 
        count: Math.floor(2000 * weather.precipitationIntensity), 
        color: '#aaddff' 
      };
    }
    return { type: 'none', count: 0, color: '#fff' };
  }, [weather]);

  return (
    <group>
      {/* Volumetric Cloud System */}
      {weather.cloudCover > 0.1 && (
        <VolumetricClouds weather={weather} />
      )}

      {/* Precipitation Particles */}
      {config.type === 'snow' && config.count > 0 && (
        <SnowParticles count={config.count} color={config.color} />
      )}

      {config.type === 'rain' && config.count > 0 && (
        <RainParticles count={config.count} color={config.color} />
      )}
    </group>
  );
};

export default WeatherSystem;