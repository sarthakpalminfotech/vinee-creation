// Cloudinary unsigned upload. Falls back to a compressed data URL when not configured (prototype mode).
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
export const cloudinaryEnabled = Boolean(CLOUD && PRESET)

export async function uploadImage(file) {
  if (cloudinaryEnabled) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', PRESET)
    fd.append('folder', 'vinee-creation')
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Image upload failed')
    return (await res.json()).secure_url
  }
  return compressToDataUrl(file)
}

function compressToDataUrl(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = img.width * scale
      c.height = img.height * scale
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Unsigned upload of any file (audio voice notes use resource_type "auto"). Returns the https URL.
 * Throws when Cloudinary is not configured or the upload fails — the caller decides on a fallback
 * (voice notes then stay on this device only, see src/lib/voiceStore.js).
 */
export async function uploadMedia(file) {
  if (!cloudinaryEnabled) throw new Error('Cloudinary is not configured')
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', PRESET)
  fd.append('folder', 'vinee-creation')
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('Upload failed')
  return (await res.json()).secure_url
}
