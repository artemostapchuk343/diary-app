import { useState, useEffect, useRef } from 'react'
import { Camera, User } from 'lucide-react'
import { db } from '../db'
import { isSignedIn, uploadProfilePic } from '../googleDrive'

async function resizeToJpeg(file, maxPx = 256) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    img.src = url
  })
}

const SIZES = {
  sm: { box: 'w-9 h-9',   icon: 16, camera: 12 },
  md: { box: 'w-12 h-12', icon: 20, camera: 14 },
  lg: { box: 'w-20 h-20', icon: 30, camera: 20 },
}

export default function ProfilePic({ size = 'md', editable = false }) {
  const [pic, setPic] = useState(null)
  const fileRef = useRef()
  const { box, icon, camera } = SIZES[size] || SIZES.md

  useEffect(() => {
    db.settings.get('profile_pic').then(s => { if (s?.value) setPic(s.value) })
    const refresh = () => db.settings.get('profile_pic').then(s => { if (s?.value) setPic(s.value) })
    window.addEventListener('profile-pic-updated', refresh)
    return () => window.removeEventListener('profile-pic-updated', refresh)
  }, [])

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const dataUrl = await resizeToJpeg(file)
    await db.settings.put({ key: 'profile_pic', value: dataUrl })
    setPic(dataUrl)
    e.target.value = ''
    if (isSignedIn()) uploadProfilePic(dataUrl).catch(() => {})
  }

  return (
    <div
      onClick={() => editable && fileRef.current?.click()}
      className={`${box} rounded-full overflow-hidden shrink-0 relative group
        ${pic
          ? 'ring-2 ring-white/15'
          : 'bg-white/8 ring-2 ring-white/10'
        }
        ${editable ? 'cursor-pointer' : ''}
      `}
    >
      {pic
        ? <img src={pic} alt="Profile" className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center">
            <User size={icon} className="text-slate-400" />
          </div>
      }

      {editable && (
        <div className="absolute inset-0 bg-black/55 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera size={camera} className="text-white" />
        </div>
      )}

      {editable && (
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      )}
    </div>
  )
}
