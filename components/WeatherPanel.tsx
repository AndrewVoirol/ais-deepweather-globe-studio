import React, { useState } from 'react';
import { WeatherConfig } from '../types';
import { Search, CloudRain, Wind, Thermometer, Loader2, MapPin, Cpu } from 'lucide-react';
import { generateWeatherParameters } from '../services/geminiService';

interface WeatherPanelProps {
  weather: WeatherConfig;
  setWeather: (w: WeatherConfig) => void;
}

const WeatherPanel: React.FC<WeatherPanelProps> = ({ weather, setWeather }) => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const newWeather = await generateWeatherParameters(search);
      setWeather(newWeather);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch weather data. Check your API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-24 left-6 z-10 w-80 flex flex-col gap-4">
      {/* Search Box */}
      <form onSubmit={handleSearch} className="relative group">
        <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-lg group-hover:bg-blue-500/30 transition-all duration-500"></div>
        <input
          id="location-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Enter location portal..."
          className="relative w-full bg-black/80 backdrop-blur-xl border border-white/20 text-white pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 outline-none shadow-2xl transition-all placeholder-gray-500"
        />
        <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
        {loading && (
          <div className="absolute right-3 top-3.5">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          </div>
        )}
      </form>

      {/* Error Feedback */}
      {error && (
        <div className="bg-red-900/30 backdrop-blur-xl border border-red-700/50 rounded-xl px-4 py-3 text-sm text-red-300 animate-in fade-in slide-in-from-top-2 duration-300">
          {error}
        </div>
      )}

      {/* Stats Card */}
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white shadow-2xl animate-in fade-in slide-in-from-left-4 duration-700">
        <div className="flex justify-between items-start mb-2">
            <div>
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    {weather.city}
                </h2>
                <p className="text-xs text-blue-300 flex items-center mt-1">
                    <Cpu className="w-3 h-3 mr-1" />
                    WeatherNext 2 Simulation
                </p>
            </div>
            <div className="w-10 h-10 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] border border-white/20" style={{ backgroundColor: weather.themeColor }}></div>
        </div>
        
        <p className="text-sm text-gray-300 italic mb-6 leading-relaxed border-l-2 border-white/10 pl-3">
            "{weather.description}"
        </p>
        
        <div className="flex items-end space-x-4 mb-6">
          <span className="text-6xl font-thin tracking-tighter">{Math.round(weather.temperature)}°</span>
          <span className="text-sm text-gray-400 pb-2 uppercase tracking-widest font-mono">{weather.condition}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
           <div className="bg-white/5 hover:bg-white/10 transition-colors rounded-lg p-3 flex flex-col items-center justify-center border border-white/5">
              <CloudRain className="w-5 h-5 text-blue-400 mb-1" />
              <span className="text-[10px] uppercase text-gray-500 font-bold">Precipitation</span>
              <span className="font-mono">{Math.round(weather.precipitationIntensity * 100)}%</span>
           </div>
           <div className="bg-white/5 hover:bg-white/10 transition-colors rounded-lg p-3 flex flex-col items-center justify-center border border-white/5">
              <Wind className="w-5 h-5 text-gray-400 mb-1" />
              <span className="text-[10px] uppercase text-gray-500 font-bold">Wind Spd</span>
              <span className="font-mono">{Math.round(weather.windSpeed * 100)} <span className="text-[10px]">km/h</span></span>
           </div>
        </div>
        
        {/* Grounding / Source Links */}
        {weather.groundingLinks && weather.groundingLinks.length > 0 && (
            <div className="border-t border-white/10 pt-3 mt-2">
                <p className="text-[10px] text-gray-500 mb-2 flex items-center uppercase tracking-wider">
                    <MapPin className="w-3 h-3 mr-1" />
                    Verified Sources
                </p>
                <div className="flex flex-wrap gap-2">
                    {weather.groundingLinks.slice(0, 3).map((link, i) => (
                        <a 
                            key={i} 
                            href={link.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2 py-1 rounded text-blue-200 truncate max-w-full transition-colors"
                        >
                            {link.title}
                        </a>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default WeatherPanel;