import React from 'react';

type Edition = 'pro' | 'enterprise';

interface EditionBadgeProps {
  edition: Edition;
}

/**
 * Marks a feature as requiring a paid edition.
 *
 * The two tiers are distinguished by weight rather than by hue: Pro is an
 * outline, Enterprise is filled. That keeps the page within the single-accent
 * palette the product uses, and reads as a hierarchy — the heavier badge is the
 * higher tier. Colours come from CSS variables so both follow the light/dark
 * theme without a second set of values here.
 */
export default function EditionBadge({ edition }: EditionBadgeProps): React.ReactElement {
  return (
    <span className={`editionBadge editionBadge--${edition}`}>{edition.toUpperCase()}</span>
  );
}
