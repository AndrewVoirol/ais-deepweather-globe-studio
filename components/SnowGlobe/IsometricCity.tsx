import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WeatherConfig } from '../../types';

interface IsometricCityProps {
  themeColor: string;
  density: number;
  weather: WeatherConfig;
}

// --- Procedural Noise Helper (Simple smooth noise) ---
function fract(x: number) { return x - Math.floor(x); }
function hash(n: number) { return fract(Math.sin(n) * 43758.5453123); }
function noise(x: number, z: number) {
    const p = new THREE.Vector2(Math.floor(x), Math.floor(z));
    const f = new THREE.Vector2(fract(x), fract(z));
    const f2 = new THREE.Vector2(f.x * f.x * (3.0 - 2.0 * f.x), f.y * f.y * (3.0 - 2.0 * f.y));
    const n = p.x + p.y * 57.0;
    return THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(hash(n + 0.0), hash(n + 1.0), f2.x),
        THREE.MathUtils.lerp(hash(n + 57.0), hash(n + 58.0), f2.x),
        f2.y
    );
}
function fbm(x: number, z: number, octaves: number) {
    let v = 0.0;
    let a = 0.5;
    for (let i = 0; i < octaves; i++) {
        v += a * noise(x, z);
        x *= 2.0; z *= 2.0;
        a *= 0.5;
    }
    return v;
}

// --- Custom Building Shader Material ---
// Simulates windows that reflect sky by day and light up by night
const BuildingShaderMaterial = {
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vPosition = position;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uWindowColor;
      uniform float uNight;
      uniform float uTime;
      
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;

      // Pseudo-random function
      float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      void main() {
        // Determine if face is a wall (vertical)
        float isWall = 1.0 - abs(dot(vNormal, vec3(0.0, 1.0, 0.0)));
        
        // Grid generation based on world position to align across blocks
        // Fix: Explicitly add scalar z to both components of xy by creating a vec2
        vec2 gridUV = vPosition.xy + vec2(vPosition.z); 
        
        // Adjust scaling for window size
        vec2 cell = floor(gridUV * 8.0);
        vec2 frac = fract(gridUV * 8.0);
        
        // Window Border
        float border = step(0.15, frac.x) * step(0.15, frac.y) * step(frac.x, 0.85) * step(frac.y, 0.9);
        
        // Randomly light up windows at night
        float noiseVal = random(cell);
        float isLit = step(0.6, noiseVal) * uNight; 
        
        // Day reflection logic (simple gradient)
        float dayReflection = 0.0;
        if (uNight < 0.5) {
             dayReflection = random(cell) * 0.3; 
        }

        vec3 finalWindowColor = mix(vec3(0.1, 0.15, 0.2), vec3(1.0, 0.9, 0.6), isLit);
        if (uNight < 0.5) {
            finalWindowColor = mix(vec3(0.2, 0.25, 0.35), vec3(0.7, 0.8, 0.9), dayReflection);
        }

        // Mix base wall color with window color
        // Apply windows only to walls
        vec3 color = uBaseColor;
        if (isWall > 0.5) {
            color = mix(uBaseColor, finalWindowColor, border);
        } else {
            // Roof darkness
            color = uBaseColor * 0.8; 
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `
};

// --- Components ---

const TieredBuilding = ({ position, scale, color, isNight }: any) => {
    // Create uniform reference to update time/night status
    const uniforms = useMemo(() => ({
        uBaseColor: { value: new THREE.Color(color) },
        uWindowColor: { value: new THREE.Color('#ffffee') },
        uNight: { value: isNight ? 1.0 : 0.0 },
        uTime: { value: 0 }
    }), [color, isNight]);

    useFrame((state) => {
        uniforms.uTime.value = state.clock.elapsedTime;
        uniforms.uNight.value = THREE.MathUtils.lerp(uniforms.uNight.value, isNight ? 1.0 : 0.0, 0.05);
    });

    // Generate 1-3 tiers
    const tiers = useMemo(() => {
        const t = [];
        const height = scale[1];
        const width = scale[0];
        const depth = scale[2];
        
        // Base
        t.push({ pos: [0, height * 0.4, 0], size: [width, height * 0.8, depth] });
        
        // Mid (if tall enough)
        if (height > 0.6) {
             t.push({ pos: [0, height * 0.9, 0], size: [width * 0.7, height * 0.4, depth * 0.7] });
        }
        
        // Top (if skyscraper)
        if (height > 1.2) {
             t.push({ pos: [0, height * 1.15, 0], size: [width * 0.4, height * 0.2, depth * 0.4] });
        }
        return t;
    }, [scale]);

    return (
        <group position={position}>
            {tiers.map((tier, i) => (
                <mesh key={i} position={tier.pos as any} castShadow receiveShadow>
                    <boxGeometry args={tier.size as any} />
                    <shaderMaterial 
                        vertexShader={BuildingShaderMaterial.vertexShader}
                        fragmentShader={BuildingShaderMaterial.fragmentShader}
                        uniforms={uniforms}
                    />
                </mesh>
            ))}
        </group>
    );
};

const TerrainMesh = ({ weather }: { weather: WeatherConfig }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const { terrain, groundColor } = weather.visualTraits;

    const geometry = useMemo(() => {
        const geo = new THREE.PlaneGeometry(4, 4, 128, 128);
        const posAttr = geo.attributes.position;
        const colors = [];
        const colorObj = new THREE.Color();
        
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i); // Actually Z in plane, but we'll rotate
            
            // Noise Generation
            let n = fbm(x * 0.8, y * 0.8, 4); // Base shape
            
            // Shaping based on Terrain Trait
            let h = 0;
            const dist = Math.sqrt(x*x + y*y);
            
            if (terrain === 'island') {
                h = n * 1.5 - (dist * dist * 0.6);
            } else if (terrain === 'mountain') {
                h = n * 2.5 - (dist * 0.5);
            } else if (terrain === 'coastal') {
                h = n * 1.0 + (x * 0.5);
            } else { // Inland
                h = n * 0.5 + 0.2; 
            }
            
            // Apply Height
            posAttr.setZ(i, Math.max(-0.5, h));

            // Vertex Coloring
            if (h < 0.05) {
                // Sand/Shore
                colorObj.set('#e6c288'); 
            } else if (h > 1.2 && (terrain === 'mountain')) {
                // Snow
                colorObj.set('#ffffff');
            } else if (h > 0.8) {
                // Rock
                colorObj.set('#666666');
            } else {
                // Grass/Base
                colorObj.set(groundColor);
                // Variate grass
                colorObj.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);
            }
            colors.push(colorObj.r, colorObj.g, colorObj.b);
        }
        
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        return geo;
    }, [terrain, groundColor]);

    return (
        <mesh 
            ref={meshRef} 
            geometry={geometry} 
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[0, -1.5, 0]} 
            receiveShadow
        >
            <meshStandardMaterial 
                vertexColors 
                roughness={0.8} 
                metalness={0.1} 
                flatShading={false}
            />
        </mesh>
    );
};

const TreesInstanced = ({ terrainMesh, weather }: { terrainMesh: any, weather: WeatherConfig }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    const count = weather.visualTraits.terrain === 'inland' ? 200 : 60;

    const { transforms, colors } = useMemo(() => {
        const transforms = new Float32Array(count * 16);
        const colors = new Float32Array(count * 3);
        const tempObj = new THREE.Object3D();
        const tempColor = new THREE.Color();

        let idx = 0;
        // Simple rejection sampling to place trees on land
        for (let i = 0; i < count * 4 && idx < count; i++) {
             const x = (Math.random() - 0.5) * 3.5;
             const z = (Math.random() - 0.5) * 3.5;
             
             // Re-calculate approximate height using same logic as terrain
             // (In a real engine we'd raycast, but here we duplicate logic for speed)
             let n = fbm(x * 0.8, z * 0.8, 4);
             const dist = Math.sqrt(x*x + z*z);
             let h = 0;
             const trait = weather.visualTraits.terrain;
             
             if (trait === 'island') h = n * 1.5 - (dist * dist * 0.6);
             else if (trait === 'mountain') h = n * 2.5 - (dist * 0.5);
             else if (trait === 'coastal') h = n * 1.0 + (x * 0.5);
             else h = n * 0.5 + 0.2;

             // Only place on land, not too high (snow), not underwater
             if (h > 0.1 && h < 1.1) {
                 const s = 0.15 + Math.random() * 0.2;
                 tempObj.position.set(x, h - 1.5, z);
                 tempObj.rotation.y = Math.random() * Math.PI;
                 tempObj.scale.set(s, s, s);
                 tempObj.updateMatrix();
                 transforms.set(tempObj.matrix.elements, idx * 16);
                 
                 // Color variation
                 if (weather.condition === 'snowy') tempColor.set('#ddeeff');
                 else tempColor.set(weather.visualTraits.groundColor).offsetHSL(0, 0, Math.random() * 0.2 - 0.1);
                 
                 colors.set([tempColor.r, tempColor.g, tempColor.b], idx * 3);
                 idx++;
             }
        }
        return { transforms, colors }; // Note: only using populated indices
    }, [weather, count]);

    useEffect(() => {
        if (meshRef.current) {
            for (let i=0; i<count; i++) {
                const mat = new THREE.Matrix4();
                mat.fromArray(transforms, i*16);
                meshRef.current.setMatrixAt(i, mat);
            }
            meshRef.current.instanceMatrix.needsUpdate = true;
            if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
        }
    }, [transforms]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <coneGeometry args={[1, 2.5, 5]} />
            <meshStandardMaterial vertexColors />
            <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
        </instancedMesh>
    );
};

const IsometricCity: React.FC<IsometricCityProps> = ({ themeColor, density, weather }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Generate Buildings Placement
  const buildings = useMemo(() => {
    const b = [];
    const count = Math.floor(density * 30);
    const { terrain } = weather.visualTraits;
    
    let placed = 0;
    for(let i=0; i<count*5 && placed < count; i++) {
         const x = (Math.random() - 0.5) * 3.0;
         const z = (Math.random() - 0.5) * 3.0;
         
         // Height check
         let n = fbm(x * 0.8, z * 0.8, 4);
         const dist = Math.sqrt(x*x + z*z);
         let h = 0;
         if (terrain === 'island') h = n * 1.5 - (dist * dist * 0.6);
         else if (terrain === 'mountain') h = n * 2.5 - (dist * 0.5);
         else if (terrain === 'coastal') h = n * 1.0 + (x * 0.5);
         else h = n * 0.5 + 0.2;

         if (h > 0.1 && h < 0.8) { // Buildable land
             const isModern = weather.visualTraits.buildingStyle === 'modern';
             const height = isModern ? 0.5 + Math.random() * 1.5 : 0.3 + Math.random() * 0.5;
             const width = 0.15 + Math.random() * 0.1;
             
             b.push({
                 position: [x, h - 1.5, z], // Sit on terrain
                 scale: [width, height, width],
                 color: themeColor
             });
             placed++;
         }
    }
    // Sort back-to-front for transparency if we had it, but here just for stability
    return b;
  }, [weather, themeColor, density]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001;
    }
  });

  return (
    <group ref={groupRef}>
      <TerrainMesh weather={weather} />
      
      {/* Water Plane */}
      <mesh position={[0, -1.45, 0]} rotation={[-Math.PI/2, 0, 0]}>
         <circleGeometry args={[1.95, 64]} />
         <meshPhysicalMaterial 
            color={weather.visualTraits.waterColor} 
            transmission={0.6}
            opacity={0.8}
            roughness={0.2}
            metalness={0.1}
            ior={1.33}
            thickness={0.5}
         />
      </mesh>

      {/* Buildings */}
      {buildings.map((b, i) => (
         <TieredBuilding 
            key={i}
            position={b.position}
            scale={b.scale}
            color={b.color}
            isNight={!weather.dayTime}
         />
      ))}

      {/* Trees */}
      <TreesInstanced terrainMesh={null} weather={weather} />
    </group>
  );
};

export default IsometricCity;