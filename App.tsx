import React, { useState } from 'react';
import ThreeScene from './components/SnowGlobe/ThreeScene';
import WeatherPanel from './components/WeatherPanel';
import VeoStudio from './components/VeoStudio';
import { AppView, WeatherConfig } from './types';
import { Globe, Video } from 'lucide-react';

// Initial default weather
const DEFAULT_WEATHER: WeatherConfig = {
  city: 'DeepMind City',
  temperature: 22,
  condition: 'sunny',
  cloudCover: 0.1,
  precipitationIntensity: 0,
  windSpeed: 0.1,
  dayTime: true,
  description: "A clear digital morning",
  themeColor: "#FFD700",
  visualTraits: {
    terrain: 'island',
    buildingStyle: 'modern',
    waterColor: '#44aaff',
    groundColor: '#3a4d31'
  }
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.GLOBE);
  const [weather, setWeather] = useState<WeatherConfig>(DEFAULT_WEATHER);

  return (
    <div className="relative w-full h-screen bg-deep-900 overflow-hidden text-white font-sans">
      
      {/* Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 h-16 bg-black/40 backdrop-blur-md border-b border-white/10 z-50 flex items-center justify-between px-6">
        <div className="flex items-center space-x-2">
          <Globe className="w-6 h-6 text-blue-400" />
          <span className="font-mono font-bold text-lg tracking-tight">DEEPWEATHER<span className="text-blue-400">.NEXT</span></span>
        </div>

        <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setView(AppView.GLOBE)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === AppView.GLOBE ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Globe className="w-4 h-4 inline-block mr-2" />
            Globe
          </button>
          <button
            onClick={() => setView(AppView.VEO)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === AppView.VEO ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Video className="w-4 h-4 inline-block mr-2" />
            Veo
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="w-full h-full pt-16 relative">
        {view === AppView.GLOBE && (
          <>
            <ThreeScene weather={weather} />
            <WeatherPanel weather={weather} setWeather={setWeather} />
            <div className="absolute bottom-6 right-6 max-w-sm text-right pointer-events-none z-40">
               <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">System Status</p>
               <p className="text-xs text-blue-400/80 font-mono mt-1">
                 Model: Gemini 2.0 Flash (Grounding)
                 <br/>
                 Engine: WeatherNext 2.0
               </p>
            </div>
          </>
        )}
        
        {view === AppView.VEO && (
          <div className="w-full h-full overflow-y-auto bg-gradient-to-br from-deep-900 via-deep-800 to-black">
            <VeoStudio />
          </div>
        )}


      </main>
    </div>
  );
};

export default App;