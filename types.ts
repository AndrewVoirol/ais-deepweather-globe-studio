export enum AppView {
  GLOBE = 'GLOBE',
  VEO = 'VEO'
}

export interface WeatherConfig {
  city: string;
  temperature: number;
  condition: 'sunny' | 'rainy' | 'snowy' | 'cloudy' | 'stormy';
  cloudCover: number; // 0-1
  precipitationIntensity: number; // 0-1
  windSpeed: number; // 0-1
  dayTime: boolean;
  description: string;
  themeColor: string;
  visualTraits: {
    terrain: 'island' | 'coastal' | 'inland' | 'mountain';
    buildingStyle: 'modern' | 'historic';
    waterColor: string;
    groundColor: string;
  };
  groundingLinks?: { title: string; uri: string }[];
}



export interface GeneratedVideo {
  url: string;
  prompt: string;
}
