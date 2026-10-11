import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { apiUploadMedia, formatMediaUrl } from "../api.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function PhotoUpload({ value, onChange, label = "Photo Evidence", hint = "Upload or take a photo of the waste issue" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(value ? formatMediaUrl(value) : null);
  const fileInputRef = useRef(null);
  const localUrlRef = useRef(null);

  useEffect(() => {
    setPreview(value ? formatMediaUrl(value) : null);
  }, [value]);

  useEffect(() => {
    return () => {
      if (localUrlRef.current && localUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(localUrlRef.current);
      }
    };
  }, []);

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  async function processFile(file) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError("Please select a valid image file (JPEG, PNG, or WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      return;
    }

    setError("");
    setUploading(true);

    if (localUrlRef.current && localUrlRef.current.startsWith("blob:")) {
      URL.revokeObjectURL(localUrlRef.current);
    }
    const localUrl = URL.createObjectURL(file);
    localUrlRef.current = localUrl;
    setPreview(localUrl);

    try {
      const asset = await apiUploadMedia(file);
      onChange(asset.url);
      setPreview(formatMediaUrl(asset.url));
    } catch (err) {
      setError(err.message || "Failed to upload image.");
      setPreview(null);
      onChange("");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleRemove(e) {
    e.stopPropagation();
    if (localUrlRef.current && localUrlRef.current.startsWith("blob:")) {
      URL.revokeObjectURL(localUrlRef.current);
      localUrlRef.current = null;
    }
    setPreview(null);
    setError("");
    onChange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="photo-upload-container">
      <div className="photo-upload-header">
        <label className="photo-label">
          <Camera size={16} />
          <span>{label}</span>
        </label>
        {hint && <span className="photo-hint">{hint}</span>}
      </div>

      {preview ? (
        <div className="photo-preview-card">
          <img src={preview} alt="Evidence preview" className="photo-preview-img" />
          <div className="photo-preview-overlay">
            <div className="photo-status">
              {uploading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Uploading to server...</span>
                </>
              ) : (
                <>
                  <Check size={16} className="text-emerald" />
                  <span>Photo Uploaded</span>
                </>
              )}
            </div>
            <button
              type="button"
              className="photo-remove-btn"
              onClick={handleRemove}
              title="Remove photo"
            >
              <Trash2 size={16} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="photo-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
          />
          <div className="dropzone-content">
            <div className="dropzone-icon">
              <UploadCloud size={28} />
            </div>
            <strong>Click to upload or drag photo here</strong>
            <span>JPEG, PNG, or WebP up to 5MB</span>
          </div>
        </div>
      )}

      {error && <div className="photo-error">{error}</div>}
    </div>
  );
}
