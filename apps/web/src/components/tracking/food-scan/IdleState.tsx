'use client';

import { Camera } from 'lucide-react';

interface IdleStateProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function IdleState({ fileInputRef, onFileSelect }: IdleStateProps) {
  return (
    <div className="mb-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileSelect}
        className="hidden"
        aria-label="Select a food photo to analyze"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        aria-label="Take or upload a food photo for nutritional analysis"
        className="w-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/95 hover:to-primary/75 text-white rounded-2xl p-6 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex flex-col items-center gap-3"
      >
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <Camera className="w-8 h-8" aria-hidden="true" />
        </div>
        <span className="text-lg font-heading uppercase tracking-wider">Snap Your Meal</span>
        <span className="text-sm text-white/80">AI-powered instant calorie estimation</span>
      </button>

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground transition-colors">
          Tips for best results
        </summary>
        <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
          <li>Use good lighting (natural light works best)</li>
          <li>Capture the entire meal in frame</li>
          <li>Include a reference object (fork, plate) for portion size</li>
          <li>Avoid blurry or dark photos</li>
        </ul>
      </details>
    </div>
  );
}
