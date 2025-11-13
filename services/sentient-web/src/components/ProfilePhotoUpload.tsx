/**
 * Profile Photo Upload Component
 * Handles user profile photo upload with preview
 */

import { useState, useRef } from 'react';
import { Upload, X, User } from 'lucide-react';
import { users } from '../lib/api';

interface ProfilePhotoUploadProps {
  userId: string;
  currentPhotoUrl?: string;
  onPhotoUpdated?: (photoUrl: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function ProfilePhotoUpload({
  userId,
  currentPhotoUrl,
  onPhotoUpdated,
  size = 'md'
}: ProfilePhotoUploadProps) {
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl || '');
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
      const response = await users.uploadPhoto(userId, file);
      // Use relative URL since nginx serves both API and uploads from same domain
      const photoUrl = response.photoUrl;
      setPhotoUrl(photoUrl);
      setPreviewUrl('');

      if (onPhotoUpdated) {
        onPhotoUpdated(photoUrl);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload photo');
      setPreviewUrl('');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!confirm('Are you sure you want to delete your profile photo?')) return;

    setUploading(true);
    setError('');

    try {
      await users.deletePhoto(userId);
      setPhotoUrl('');
      setPreviewUrl('');

      if (onPhotoUpdated) {
        onPhotoUpdated('');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.response?.data?.message || 'Failed to delete photo');
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const displayUrl = previewUrl || photoUrl;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Photo Display */}
        <div
          className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gray-800 border-2 border-cyan-500/30 flex items-center justify-center cursor-pointer group hover:border-cyan-500 transition-colors`}
          onClick={handleClick}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className={`${iconSizeClasses[size]} text-gray-600`} />
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
        {photoUrl && !uploading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePhoto();
            }}
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
            title="Delete photo"
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
        {uploading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Upload Photo'}
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
