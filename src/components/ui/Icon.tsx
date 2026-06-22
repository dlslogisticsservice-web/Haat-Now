import React from 'react';

type IconFill = 0 | 1;
type IconWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700;
type IconGrade = -25 | 0 | 200;
type IconSize = 20 | 24 | 40 | 48;

interface IconProps {
  /** Material Symbol name, e.g. "location_on", "search", "star" */
  name: string;
  /** Fill: 0 = outlined, 1 = filled */
  fill?: IconFill;
  /** Font weight 100–700 */
  weight?: IconWeight;
  /** Grade */
  grade?: IconGrade;
  /** Optical size */
  opticalSize?: IconSize;
  /** Pixel size override */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}

/**
 * Material Symbols Outlined icon component.
 *
 * Usage:
 *   <Icon name="search" />
 *   <Icon name="star" fill={1} size={20} className="text-[var(--color-neon)]" />
 */
export const Icon: React.FC<IconProps> = ({
  name,
  fill = 0,
  weight = 400,
  grade = 0,
  opticalSize = 24,
  size,
  className = '',
  style,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden = true,
}) => {
  const varSettings = `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`;

  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontVariationSettings: varSettings,
        // Design System: explicit size wins; otherwise follow the global icon-size token.
        fontSize: size ? `${size}px` : 'var(--icon-size, 24px)',
        ...style,
      }}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      role={ariaLabel ? 'img' : undefined}
    >
      {name}
    </span>
  );
};

export default Icon;
