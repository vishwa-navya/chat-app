import { createClient } from '@supabase/supabase-js'
import {
  compressImageLightweight,
  detectDeviceCapabilities,
  validateImage,
  revokePreviewUrl,
} from './imageCompression'

/* ===================================================
   SUPABASE CLIENT
=================================================== */

const supabaseUrl = 'https://mfbnotbpmmvisvicclji.supabase.co'
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mYm5vdGJwbW12aXN2aWNjbGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MTcwNDEsImV4cCI6MjA2Nzk5MzA0MX0.JSJs-U570W56r0qfuwXY6kfhgXMwJrbb7FwbmXF_QJA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/* ===================================================
   MEMORY-SAFE IMAGE UPLOAD
=================================================== */

export async function uploadImageToSupabase(
  file: File,
  fileName: string
): Promise<string> {
  try {
    console.log('🔄 Starting image upload:', fileName)
    
    const capabilities = detectDeviceCapabilities()
    
    // Validate
    const validation = validateImage(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
    
    // 🔥 Memory-safe compression (uses createImageBitmap with resize)
    const compressedFile = await compressImageLightweight(file, 100)
    
    const { error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, compressedFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: compressedFile.type || 'image/webp'
      })

    if (error) {
      throw new Error(error.message)
    }

    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName)

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL')
    }

    console.log('✅ Image uploaded:', urlData.publicUrl)
    return urlData.publicUrl
  } catch (error) {
    console.error('❌ Image upload failed:', error)
    throw error
  }
}

/* ===================================================
   VIDEO UPLOAD
=================================================== */

export async function uploadVideoToSupabase(
  file: File,
  fileName: string
): Promise<string> {
  try {
    console.log('🎥 Starting video upload:', fileName)
    
    const capabilities = detectDeviceCapabilities()
    const maxSize = capabilities.isLowMemory ? 50 * 1024 * 1024 : 100 * 1024 * 1024
    
    if (file.size > maxSize) {
      const maxMB = Math.floor(maxSize / (1024 * 1024))
      throw new Error(`Video must be less than ${maxMB}MB on this device`)
    }

    const { error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      })

    if (error) {
      throw new Error(error.message)
    }

    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName)

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL')
    }

    console.log('✅ Video uploaded:', urlData.publicUrl)
    return urlData.publicUrl
  } catch (error) {
    console.error('❌ Video upload failed:', error)
    throw error
  }
}

/* ===================================================
   FILE UPLOAD
=================================================== */

export async function uploadFileToSupabase(
  file: File,
  fileName: string
): Promise<string> {
  try {
    console.log('📄 Starting file upload:', fileName)
    
    const capabilities = detectDeviceCapabilities()
    const maxSize = capabilities.isLowMemory ? 30 * 1024 * 1024 : 50 * 1024 * 1024
    
    if (file.size > maxSize) {
      const maxMB = Math.floor(maxSize / (1024 * 1024))
      throw new Error(`File must be less than ${maxMB}MB on this device`)
    }

    const { error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      })

    if (error) {
      throw new Error(error.message)
    }

    const { data: urlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName)

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL')
    }

    console.log('✅ File uploaded:', urlData.publicUrl)
    return urlData.publicUrl
  } catch (error) {
    console.error('❌ File upload failed:', error)
    throw error
  }
}

/* ===================================================
   DOWNLOAD HELPERS
=================================================== */

async function downloadBlob(url: string, fileName: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Download failed')

  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.URL.revokeObjectURL(downloadUrl)
  console.log('📥 Download completed:', fileName)
}

export async function downloadImage(url: string, fileName: string) {
  return downloadBlob(url, fileName)
}

export async function downloadVideo(url: string, fileName: string) {
  return downloadBlob(url, fileName)
}

export async function downloadFile(url: string, fileName: string) {
  return downloadBlob(url, fileName)
}

/* ===================================================
   EXPORTS
=================================================== */

export { revokePreviewUrl, detectDeviceCapabilities }
