import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const GST_ITC_ARTICLE = readFileSync(resolve(__dirname, 'gst-itc-claim.md'), 'utf-8');
export const TDS_194C_ARTICLE = readFileSync(resolve(__dirname, 'tds-194c-contractor.md'), 'utf-8');
export const ITR_FILING_ARTICLE = readFileSync(resolve(__dirname, 'itr-filing-ay.md'), 'utf-8');
