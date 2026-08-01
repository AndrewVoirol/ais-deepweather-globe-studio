import { GoogleGenAI } from "@google/genai";
import { WeatherConfig } from '../types';

// Initialize GenAI with the environment API key directly.
// We create a fresh client instance when needed or use a helper to get one.
const getAiClient = () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

/**
 * Simulates "WeatherGen2" by asking Gemini 2.5 Flash to generate plausible weather parameters
 * based on a city name or description, grounded in real-world Google Maps data.
 */
export const generateWeatherParameters = async (locationPrompt: string): Promise<WeatherConfig> => {
  const ai = getAiClient();
  
  // We use Google Maps grounding, so we cannot use responseSchema/MimeType 'application/json'.
  // We must prompt for JSON output in the text and parse it.
  const systemPrompt = `
  You are Google Deepmind's WeatherNext 2, a next-generation weather forecasting and environmental simulation engine.
  
  Task:
  1. Use Google Maps to search for the REAL-TIME weather, time of day, and geographical/visual features of: "${locationPrompt}".
  2. Analyze the location's architectural style, terrain, and atmosphere details.
  3. Based on the real location data, generate a configuration object.
  4. Output strictly valid JSON. No markdown code blocks.
  
  JSON Structure required:
  {
    "city": "City Name",
    "temperature": 20, // Number (Celsius)
    "condition": "sunny", // One of: sunny, rainy, snowy, cloudy, stormy
    "cloudCover": 0.5, // 0.0 to 1.0
    "precipitationIntensity": 0.0, // 0.0 to 1.0
    "windSpeed": 0.2, // 0.0 to 1.0
    "dayTime": true, // boolean based on local time
    "description": "A short, evocative description of the current atmosphere",
    "themeColor": "#FF5500", // Hex color matching the vibe
    "visualTraits": {
      "terrain": "island", // One of: island, coastal, inland, mountain
      "buildingStyle": "modern", // One of: modern, historic
      "waterColor": "#44aaff",
      "groundColor": "#3a4d31"
    }
  }

  If the location is fictional, invent plausible details.
  `;

  // Switch to gemini-2.5-flash as it supports Google Maps tools
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: systemPrompt,
    config: {
      tools: [{ googleMaps: {} }],
      // responseMimeType and responseSchema are PROHIBITED when using tools like googleMaps
    }
  });

  let text = response.text || "";
  // Clean up markdown if present
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();

  let weatherData: WeatherConfig;
  try {
    weatherData = JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse weather JSON", text);
    // Fallback if JSON parsing fails
    throw new Error("Failed to generate weather configuration");
  }

  // Extract Grounding Metadata for attribution
  const groundingLinks: { title: string; uri: string }[] = [];
  
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    for (const chunk of chunks) {
      if (chunk.maps) {
        groundingLinks.push({
          title: chunk.maps.title || "Google Maps Result",
          uri: chunk.maps.uri || "#"
        });
      } else if (chunk.web) {
        groundingLinks.push({
          title: chunk.web.title || "Source",
          uri: chunk.web.uri || "#"
        });
      }
    }
  }

  return { ...weatherData, groundingLinks };
};

/**
 * Generates a video using Veo.
 * Requires the user to have selected an API key via window.aistudio.
 */
export const generateVideo = async (prompt: string, imageBase64?: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<string> => {
  // Always grab the latest key from env when generating video, as the user might have just selected it
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  let operation;

  if (imageBase64) {
    const parts = imageBase64.split(',');
    const rawBase64 = parts.length > 1 ? parts[1] : parts[0];
    
    // Extract mime type if available from the data URL prefix
    let mimeType = 'image/png';
    if (parts.length > 1) {
        // e.g., data:image/jpeg;base64,...
        const matches = parts[0].match(/:(.*?);/);
        if (matches && matches.length > 1) {
            mimeType = matches[1];
        }
    }
    
    operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt || "Animate this scene cinematically",
      image: {
        imageBytes: rawBase64,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });
  } else {
    operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });
  }

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed or returned no URI");

  // Robustly append API Key
  const separator = videoUri.includes('?') ? '&' : '?';
  const videoRes = await fetch(`${videoUri}${separator}key=${apiKey}`);
  const videoBlob = await videoRes.blob();
  return URL.createObjectURL(videoBlob);
};

export const checkApiKey = async (): Promise<boolean> => {
  return !!import.meta.env.VITE_GEMINI_API_KEY;
};