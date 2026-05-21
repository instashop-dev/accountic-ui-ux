export const PILLARS = [
	'Income Tax Notices',
	'Faceless Assessment',
	'DPDP Compliance',
	'ICAI Ethics',
	'Case Law Notes',
	'CA Firm Automation',
	'AI Tools for Indian CAs',
	'GST Automation',
	'Audit Technology',
] as const;

export type Pillar = (typeof PILLARS)[number];

export const TONES = ['emerald', 'amber', 'rose', 'sky', 'violet', 'stone'] as const;

export type Tone = (typeof TONES)[number];
