export interface CaptionPreset {
  id: string
  name: string
  fontFamily: string
  fontWeight: number
  fontSizePx: number
  uppercase?: boolean
  textColor: string
  highlightColor: string
  strokeColor?: string
  strokeWidth?: number
  backgroundColor?: string
  shadow?: string
  positionY: number // 0..1 from top
  animation: 'pop' | 'highlight' | 'slide' | 'karaoke' | 'none'
  scriptHint?: 'latin' | 'urdu' | 'hindi' | 'arabic'
}

/**
 * Clean-room recreation of the 18 built-in caption presets.
 */
export const BUILTIN_CAPTION_PRESETS: CaptionPreset[] = [
  { id: 'mumbai', name: 'Mumbai', fontFamily: 'Montserrat Variable', fontWeight: 800, fontSizePx: 56, uppercase: true, textColor: '#FFFFFF', highlightColor: '#FACC15', strokeColor: '#000000', strokeWidth: 6, positionY: 0.74, animation: 'pop' },
  { id: 'numaya', name: 'Numaya', fontFamily: 'Noto Nastaliq Urdu Variable', fontWeight: 700, fontSizePx: 48, textColor: '#FFFFFF', highlightColor: '#38BDF8', backgroundColor: 'rgba(0,0,0,0.68)', positionY: 0.78, animation: 'highlight', scriptHint: 'urdu' },
  { id: 'josh', name: 'Josh', fontFamily: 'Anton', fontWeight: 400, fontSizePx: 64, uppercase: true, textColor: '#FFFFFF', highlightColor: '#EF4444', strokeColor: '#000000', strokeWidth: 7, positionY: 0.72, animation: 'pop' },
  { id: 'aks', name: 'Aks', fontFamily: 'Playfair Display Variable', fontWeight: 700, fontSizePx: 50, textColor: '#F8FAFC', highlightColor: '#FDE047', shadow: '0 4px 18px rgba(0,0,0,0.85)', positionY: 0.76, animation: 'slide' },
  { id: 'rawani', name: 'Rawani', fontFamily: 'DM Sans Variable', fontWeight: 700, fontSizePx: 46, textColor: '#FFFFFF', highlightColor: '#22C55E', backgroundColor: 'rgba(15,23,42,0.72)', positionY: 0.78, animation: 'karaoke' },
  { id: 'headline', name: 'Headline', fontFamily: 'Oswald Variable', fontWeight: 700, fontSizePx: 60, uppercase: true, textColor: '#0A0A0A', highlightColor: '#FACC15', backgroundColor: '#FFFFFF', positionY: 0.72, animation: 'pop' },
  { id: 'rang', name: 'Rang', fontFamily: 'Space Grotesk Variable', fontWeight: 700, fontSizePx: 52, uppercase: true, textColor: '#FFFFFF', highlightColor: '#EC4899', strokeColor: '#111827', strokeWidth: 5, positionY: 0.75, animation: 'highlight' },
  { id: 'noor', name: 'Noor', fontFamily: 'Noto Sans Arabic Variable', fontWeight: 700, fontSizePx: 50, textColor: '#FFFBEB', highlightColor: '#F59E0B', shadow: '0 0 18px rgba(245,158,11,0.55)', positionY: 0.76, animation: 'highlight', scriptHint: 'arabic' },
  { id: 'lehar', name: 'Lehar', fontFamily: 'Kaushan Script', fontWeight: 400, fontSizePx: 54, textColor: '#FFFFFF', highlightColor: '#A855F7', shadow: '0 4px 14px rgba(0,0,0,0.9)', positionY: 0.75, animation: 'slide' },
  { id: 'orbit', name: 'Orbit', fontFamily: 'Geist Mono Variable', fontWeight: 700, fontSizePx: 44, uppercase: true, textColor: '#E2E8F0', highlightColor: '#06B6D4', backgroundColor: 'rgba(2,6,23,0.78)', positionY: 0.79, animation: 'karaoke' },
  { id: 'bayan', name: 'Bayan', fontFamily: 'Noto Sans Devanagari Variable', fontWeight: 700, fontSizePx: 48, textColor: '#FFFFFF', highlightColor: '#FB923C', strokeColor: '#000000', strokeWidth: 5, positionY: 0.76, animation: 'highlight', scriptHint: 'hindi' },
  { id: 'lakeer', name: 'Lakeer', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSizePx: 58, uppercase: true, textColor: '#FFFFFF', highlightColor: '#3B82F6', backgroundColor: 'rgba(0,0,0,0.6)', positionY: 0.74, animation: 'slide' },
  { id: 'uchhaal', name: 'Uchhaal', fontFamily: 'Montserrat Variable', fontWeight: 900, fontSizePx: 60, uppercase: true, textColor: '#FFFFFF', highlightColor: '#4ADE80', strokeColor: '#000000', strokeWidth: 7, positionY: 0.7, animation: 'pop' },
  { id: 'ali-abdaal', name: 'Ali Abdaal', fontFamily: 'Inter Variable', fontWeight: 700, fontSizePx: 44, textColor: '#111827', highlightColor: '#2563EB', backgroundColor: 'rgba(255,255,255,0.92)', positionY: 0.8, animation: 'highlight' },
  { id: 'karachi', name: 'Karachi', fontFamily: 'Space Grotesk Variable', fontWeight: 800, fontSizePx: 54, uppercase: true, textColor: '#FFFFFF', highlightColor: '#10B981', strokeColor: '#000000', strokeWidth: 6, positionY: 0.74, animation: 'pop' },
  { id: 'lafz', name: 'Lafz', fontFamily: 'Geist Variable', fontWeight: 700, fontSizePx: 48, textColor: '#FFFFFF', highlightColor: '#F43F5E', shadow: '0 3px 12px rgba(0,0,0,0.85)', positionY: 0.77, animation: 'karaoke' },
  { id: 'shamani', name: 'Shamani', fontFamily: 'Oswald Variable', fontWeight: 700, fontSizePx: 58, uppercase: true, textColor: '#FACC15', highlightColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 6, positionY: 0.73, animation: 'pop' },
  { id: 'saaf', name: 'Saaf', fontFamily: 'Inter Variable', fontWeight: 600, fontSizePx: 42, textColor: '#FFFFFF', highlightColor: '#FFFFFF', shadow: '0 2px 10px rgba(0,0,0,0.9)', positionY: 0.82, animation: 'none' },
]
