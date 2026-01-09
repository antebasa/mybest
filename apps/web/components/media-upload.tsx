"use client";

import { useState, useRef } from "react";
import { Button, Card, CardBody, Spinner } from "@heroui/react";

interface MediaUploadProps {
  onUpload: (file: File, type: "video" | "image") => Promise<void>;
  prompt?: string;
  disabled?: boolean;
  maxSizeMB?: number;
}

/**
 * Media Upload Component (Phase 2)
 * 
 * Handles image/video uploads for goal chat and training sessions.
 * Supports camera capture on mobile and file selection on desktop.
 */
export function MediaUpload({ 
  onUpload, 
  prompt = "Upload a photo or video",
  disabled = false,
  maxSizeMB = 10,
}: MediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"video" | "image" | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    // Determine media type
    const type: "video" | "image" = file.type.startsWith("video/") ? "video" : "image";
    setMediaType(type);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setIsUploading(true);
    try {
      await onUpload(file, type);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setMediaType(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  return (
    <Card className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 border-dashed">
      <CardBody className="py-6">
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {/* Preview */}
        {preview ? (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden bg-black/10">
              {mediaType === "video" ? (
                <video
                  src={preview}
                  controls
                  className="w-full max-h-48 object-contain"
                />
              ) : (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full max-h-48 object-contain"
                />
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Spinner color="white" size="lg" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="flat"
                onPress={handleClear}
                disabled={isUploading}
              >
                Clear
              </Button>
              {!isUploading && (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  ✓ Uploaded
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            {/* Prompt */}
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {prompt}
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                size="sm"
                variant="flat"
                onPress={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="flex items-center gap-1"
              >
                📷 Photo
              </Button>
              <Button
                size="sm"
                variant="flat"
                onPress={() => videoInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="flex items-center gap-1"
              >
                🎥 Video
              </Button>
            </div>

            <p className="text-xs text-zinc-400">
              Max size: {maxSizeMB}MB
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-500 mt-2 text-center">
            {error}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Inline media request card for chat
 */
export function MediaRequestCard({ 
  prompt, 
  onUpload,
  disabled,
}: { 
  prompt: string; 
  onUpload: (file: File, type: "video" | "image") => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <div className="my-3">
      <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 mb-2">
        <p className="text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
          📹 <span>{prompt}</span>
        </p>
      </div>
      <MediaUpload 
        onUpload={onUpload}
        prompt={prompt}
        disabled={disabled}
        maxSizeMB={50}
      />
    </div>
  );
}
