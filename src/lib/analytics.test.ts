import { describe, it, expect, vi } from 'vitest';
import { logEvent } from './analytics';
import type { PipelineEvent } from './analytics';

const EVENT: PipelineEvent = {
  event: 'humanizer_success',
  stage: 'humanizer',
  article_id: 'draft-abc-123',
  tokens_used: 1500,
  duration_ms: 4200,
  quality_score: 73.5,
  outcome: 'success',
};

describe('logEvent', () => {
  it('calls writeDataPoint with correct blobs and doubles', () => {
    const writeDataPoint = vi.fn();
    const env = { BLOG_ANALYTICS: { writeDataPoint } as unknown as AnalyticsEngineDataset };
    logEvent(env, EVENT);
    expect(writeDataPoint).toHaveBeenCalledOnce();
    const call = writeDataPoint.mock.calls[0][0] as { blobs: string[]; doubles: number[]; indexes: string[] };
    expect(call.blobs[0]).toBe('humanizer_success');
    expect(call.blobs[1]).toBe('humanizer');
    expect(call.blobs[2]).toBe('draft-abc-123');
    expect(call.blobs[3]).toBe('success');
    expect(call.doubles[0]).toBe(1500);
    expect(call.doubles[1]).toBe(4200);
    expect(call.doubles[2]).toBe(73.5);
    expect(call.indexes[0]).toBe('draft-abc-123');
  });

  it('includes reason blob when provided', () => {
    const writeDataPoint = vi.fn();
    const env = { BLOG_ANALYTICS: { writeDataPoint } as unknown as AnalyticsEngineDataset };
    logEvent(env, { ...EVENT, reason: 'disabled' });
    const call = writeDataPoint.mock.calls[0][0] as { blobs: string[] };
    expect(call.blobs[4]).toBe('disabled');
  });

  it('includes failed_gate blob when provided', () => {
    const writeDataPoint = vi.fn();
    const env = { BLOG_ANALYTICS: { writeDataPoint } as unknown as AnalyticsEngineDataset };
    logEvent(env, { ...EVENT, failed_gate: 'compliance_entity' });
    const call = writeDataPoint.mock.calls[0][0] as { blobs: string[] };
    expect(call.blobs[5]).toBe('compliance_entity');
  });

  it('does not throw when BLOG_ANALYTICS binding is absent', () => {
    expect(() => logEvent({}, EVENT)).not.toThrow();
  });

  it('does not throw when writeDataPoint throws', () => {
    const writeDataPoint = vi.fn().mockImplementation(() => { throw new Error('analytics error'); });
    const env = { BLOG_ANALYTICS: { writeDataPoint } as unknown as AnalyticsEngineDataset };
    expect(() => logEvent(env, EVENT)).not.toThrow();
  });

  it('does not log the ANTHROPIC_API_KEY value in any event field', () => {
    const written: unknown[] = [];
    const writeDataPoint = vi.fn((data: unknown) => written.push(data));
    const env = { BLOG_ANALYTICS: { writeDataPoint } as unknown as AnalyticsEngineDataset };
    logEvent(env, { ...EVENT, reason: 'api error' });
    const allText = JSON.stringify(written);
    expect(allText).not.toContain('sk-ant-');
    expect(allText).not.toContain('ANTHROPIC_API_KEY');
  });
});
