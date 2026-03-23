import { getFlagEmoji } from '../data/countries';
import type { Profile } from '../types';

interface AvatarProps {
  profile: Profile;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCrown?: boolean;
  showFlag?: boolean;
}

const SIZES = {
  sm:  { width: 32,  height: 32,  fontSize: '0.8rem',  className: '',         flagSize: '0.65rem' },
  md:  { width: 48,  height: 48,  fontSize: '1.2rem',  className: '',         flagSize: '0.9rem'  },
  lg:  { width: 96,  height: 96,  fontSize: '2.5rem',  className: 'avatar-lg', flagSize: '1.4rem' },
  xl:  { width: 128, height: 128, fontSize: '3.5rem',  className: 'avatar-xl', flagSize: '1.8rem' },
};

export default function Avatar({ profile, size = 'md', showCrown = false, showFlag = true }: AvatarProps) {
  const s = SIZES[size];
  const flagEmoji = showFlag && profile.nationality ? getFlagEmoji(profile.nationality) : null;

  const avatar = profile.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt={profile.username}
      className={`avatar ${s.className}`}
      style={{ width: s.width, height: s.height }}
    />
  ) : (
    <div
      className={`avatar avatar-placeholder ${s.className}`}
      style={{ width: s.width, height: s.height, fontSize: s.fontSize }}
    >
      {profile.username[0]?.toUpperCase() ?? '?'}
    </div>
  );

  const wrapperClasses = [
    'avatar-wrapper',
    `avatar-wrapper-${size}`,
    showCrown ? 'crown-wrapper' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses} style={{ width: s.width, height: s.height, flexShrink: 0 }}>
      {avatar}
      {flagEmoji && (
        <span className="avatar-flag" style={{ fontSize: s.flagSize }}>
          {flagEmoji}
        </span>
      )}
    </div>
  );
}
