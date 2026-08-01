import React, { useState, useEffect, useCallback } from 'react';
import { checkApiKey, generateVideo } from '../services/geminiService';
import { Video, Upload, Loader2, AlertCircle } from 'lucide-react';

const VeoStudio: React.FC = () => {
  const [hasKey, setHasKey] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyKey = useCallback(async () => {
    try {
      const valid = await checkApiKey();
      setHasKey(valid);
    } catch (e) {
      console.error("Key check failed", e);
    }
  }, []);

  useEffect(() => {
    verifyKey();
  }, [verifyKey]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!hasKey) return;

    setLoading(true);
    setError(null);
    setVideoUrl(null);

    try {
      const url = await generateVideo(prompt, selectedImage || undefined, '16:9');
      setVideoUrl(url);
    } catch (err: any) {
      setError(err.message || "Failed to generate video. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full h-full">
      <div className="w-full bg-deep-800/50 backdrop-blur-md border border-deep-700 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6">
          <Video className="w-8 h-8 text-purple-400" />
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
            Veo Motion Studio
          </h2>
        </div>

        {!hasKey && (
          <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <p className="font-semibold mb-1">API Key Required</p>
              <p>Veo generation requires a Gemini API key. Set <code className="bg-black/30 px-1 rounded">VITE_GEMINI_API_KEY</code> in <code className="bg-black/30 px-1 rounded">.env.local</code> and restart the dev server.</p>
              <p className="mt-2 text-xs opacity-70">
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                  View Billing Documentation
                </a>
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Image Input */}
          <div className="group relative border-2 border-dashed border-deep-700 rounded-xl p-6 hover:border-purple-500/50 transition-colors">
             <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
             />
             <div className="flex flex-col items-center justify-center text-center space-y-2">
                {selectedImage ? (
                  <div className="relative w-full h-48 overflow-hidden rounded-lg">
                    <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <span className="text-white font-medium">Click to change</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-500 group-hover:text-purple-400 transition-colors" />
                    <span className="text-gray-400 text-sm">Drop an image here or click to upload (Optional)</span>
                  </>
                )}
             </div>
          </div>

          {/* Text Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the motion, camera movement, or scene details..."
              className="w-full bg-deep-900/80 border border-deep-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none h-32 transition-all"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || (!prompt && !selectedImage)}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 transition-all ${
              loading || (!prompt && !selectedImage)
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg hover:shadow-purple-500/25'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Video (this may take a minute)...</span>
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                <span>Generate Video</span>
              </>
            )}
          </button>
          
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {/* Video Output */}
          {videoUrl && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h3 className="text-lg font-semibold text-white mb-3">Generated Result</h3>
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full rounded-xl shadow-2xl border border-deep-700"
              />
              <a 
                href={videoUrl} 
                download={`veo-${Date.now()}.mp4`}
                className="block text-center mt-2 text-sm text-purple-400 hover:text-purple-300"
              >
                Download Video
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VeoStudio;