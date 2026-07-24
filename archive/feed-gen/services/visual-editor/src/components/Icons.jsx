import React from 'react'

/**
 * SVG Icons for condition blocks
 * All icons are 20x20 viewBox, can be scaled with CSS
 */

export const TextIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M3 4h14M3 8h14M3 12h10M3 16h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const RegexIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
)

export const LanguageIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M3 10h14M10 3v14" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6 5l8 10M14 5l-8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const PostTypeIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="4" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M3 8h14" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="6" cy="6" r="0.5" fill="currentColor"/>
    <circle cx="8" cy="6" r="0.5" fill="currentColor"/>
    <circle cx="10" cy="6" r="0.5" fill="currentColor"/>
  </svg>
)

export const HashtagIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M7 3v14M13 3v14M3 7h14M3 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const LabelsIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 3L3 10l7 7 7-7-7-7z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="10" cy="10" r="2" fill="currentColor"/>
  </svg>
)

export const PostDateIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="4" width="14" height="13" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M3 8h14" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="6" cy="6" r="0.5" fill="currentColor"/>
    <circle cx="8" cy="6" r="0.5" fill="currentColor"/>
    <path d="M6 11h8M6 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const AuthorIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M3 18c0-3.5 3-6.5 7-6.5s7 3 7 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const MediaIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="11" y="5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="3" y="13" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="11" y="13" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
)

export const LikesIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 17l-1.5-1.5C5.5 12.5 3 10.5 3 7.5 3 5.5 4.5 4 6.5 4c1.3 0 2.5.7 3.5 1.5C11 4.7 12.2 4 13.5 4c2 0 3.5 1.5 3.5 3.5 0 3-2.5 5-5.5 8L10 17z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const EngagementIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="12" width="2" height="5" rx="0.5" fill="currentColor"/>
    <rect x="6" y="9" width="2" height="8" rx="0.5" fill="currentColor"/>
    <rect x="9" y="6" width="2" height="11" rx="0.5" fill="currentColor"/>
    <rect x="12" y="10" width="2" height="7" rx="0.5" fill="currentColor"/>
    <rect x="15" y="8" width="2" height="9" rx="0.5" fill="currentColor"/>
    <path d="M3 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const MentionsIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M3 18c0-3.5 3-6.5 7-6.5s7 3 7 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M15 4l2-2M17 4l-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const LinksIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M8 6h4M8 10h6M8 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6 4h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M4 7l2-2M16 7l-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const ImageIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="5" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="7" cy="9" r="1.5" fill="currentColor"/>
    <path d="M3 13l4-3 3 3 4-4 2 2v2H3v-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const VideoFeedIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Portrait phone frame — vertical video */}
    <rect x="5" y="2" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    {/* Top speaker slot */}
    <line x1="8" y1="4.5" x2="12" y2="4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    {/* Play triangle */}
    <polygon points="8,9 8,14 13.5,11.5" fill="currentColor"/>
  </svg>
)

export const VideoIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="5" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M8 8l4 2-4 2V8z" fill="currentColor"/>
  </svg>
)

export const PostStructureIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="3" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M3 7h14" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M7 3v14M13 3v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
  </svg>
)

export const StartIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <polygon points="8,6 8,14 14,10" fill="currentColor"/>
  </svg>
)

export const EndIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="3" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="8" y="8" width="4" height="4" rx="0.5" fill="currentColor" />
  </svg>
)

export const PlusIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const RecencyIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const ScoreIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 3l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1 2-4z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
  </svg>
)

export const CustomScoreIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const RotatingPostsIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M10 6l-3 4h6l-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
  </svg>
)

export const ChronologicalIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const ByScoreIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 3l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1 2-4z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
  </svg>
)

export const MostLikesIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 6c-1-2-3-2-3-4 0-2 2-2 3 0 1-2 3-2 3 0 0 2-2 2-3 4z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
    <path d="M10 6v8M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const MostEngagementIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
  </svg>
)

export const RandomIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M5 8l3-3M15 12l-3 3M5 12l3 3M15 8l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="5" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
  </svg>
)

export const WhitelistIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M4 10l4 4 8-8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.45" />
  </svg>
)

export const DynamicPinnedIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
    <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
  </svg>
)

export const FeaturedPostIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M10 2l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1 2-4z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
)

export const GearIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export const PencilIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M14.5 2.5l3 3L6 17H3v-3L14.5 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
  </svg>
)
