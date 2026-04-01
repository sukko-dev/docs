import React from 'react';

type Edition = 'pro' | 'enterprise';

const colors: Record<Edition, { bg: string; text: string }> = {
  pro: { bg: '#2563eb', text: '#ffffff' },
  enterprise: { bg: '#7c3aed', text: '#ffffff' },
};

interface EditionBadgeProps {
  edition: Edition;
}

export default function EditionBadge({ edition }: EditionBadgeProps): React.ReactElement {
  const { bg, text } = colors[edition];
  const label = edition.toUpperCase();

  return (
    <span
      style={{
        backgroundColor: bg,
        color: text,
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: '4px',
        marginLeft: '8px',
        verticalAlign: 'middle',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </span>
  );
}
