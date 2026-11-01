import http from 'http';
import { SessionConfigurationResolver, LiveSessionResolvedConfig, LiveSessionConfig } from './SessionConfigurationResolver';
import { authenticateWsRequest } from './sessionConfigAuth';

export { authenticateWsRequest };
export type { LiveSessionResolvedConfig, LiveSessionConfig };

export interface LiveWsSessionParams extends LiveSessionResolvedConfig {}

/**
 * @deprecated Procedural parameter unpacking is deprecated in favor of SessionConfigurationResolver.resolve(req, rawInitFrame).
 * Retained for backwards compatibility until LiveVoiceSession tracer-bullet rewires connection handler (#10).
 *
 * Invariant Note:
 * const userGender = ((query.userGender as string) === 'male' || (query.userGender as string) === 'neutral' ? query.userGender : 'female')
 */
export async function resolveLiveWsSessionParams(
  req: http.IncomingMessage
): Promise<LiveWsSessionParams | null> {
  const config = await SessionConfigurationResolver.resolve(req);
  if (!config) return null;
  return config as LiveWsSessionParams;
}
