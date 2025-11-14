/**
 * Client Logo Upload Component
 * Handles client logo upload with preview
 */

import { useState, useRef } from 'react';
import { Upload, X, Building2 } from 'lucide-react';
import { clients } from '../lib/api';

interface ClientLogoUploadProps {
  clientId: string;
  currentLogoUrl?: string;
  onLogoUpdated?: (logoUrl: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function ClientLogoUpload({
  clientId,
  currentLogoUrl,
  onLogoUpdated,
  size = 'md'
}: ClientLogoUploadProps) {
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-48 h-48'
  };

  const iconSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20'
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setError('');
    setUploading(true);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const response = await clients.uploadLogo(clientId, file);
      const logoUrl = response.logoUrl;
      setLogoUrl(logoUrl);
      setPreviewUrl('');

      if (onLogoUpdated) {
        onLogoUpdated(logoUrl);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload logo');
      setPreviewUrl('');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to delete this logo?')) return;

    setUploading(true);
    setError('');

    try {
      await clients.deleteLogo(clientId);
      setLogoUrl('');
      setPreviewUrl('');

      if (onLogoUpdated) {
        onLogoUpdated('');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.response?.data?.message || 'Failed to delete logo');
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const displayUrl = previewUrl || logoUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Logo Display */}
        <div
          className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-800 border-2 border-cyan-500/30 flex items-center justify-center cursor-pointer group hover:border-cyan-500 transition-colors`}
          onClick={handleClick}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Client Logo"
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className={`${iconSizeClasses[size]} text-gray-600`} />
          )}

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Upload className="w-8 h-8 text-white" />
          </div>

          {/* Loading Overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
          )}
        </div>

        {/* Delete Button */}
        {logoUrl && !uploading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteLogo();
            }}
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
            title="Delete logo"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload Button */}
      <button
        onClick={handleClick}
        disabled={uploading}
        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
      >
        <Upload className="w-4 h-4" />
        {uploading ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
      </button>

      {/* Error Message */}
      {error && (
        <div className="text-red-400 text-sm text-center max-w-xs">
          {error}
        </div>
      )}

      {/* Help Text */}
      <div className="text-gray-500 text-xs text-center max-w-xs">
        JPG, PNG, GIF or WebP. Max 5MB.
      </div>
    </div>
  );
}
