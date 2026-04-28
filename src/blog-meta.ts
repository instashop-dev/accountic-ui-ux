export const PILLARS = [
	'Income Tax Notices',
	'Faceless Assessment',
	'DPDP Compliance',
	'ICAI Ethics',
	'Case Law Notes',
	'Firm Operations',
] as const;

export type Pillar = (typeof PILLARS)[number];

export const TONES = ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone'] as const;

export type Tone = (typeof TONES)[number];
