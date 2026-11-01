import http from 'http';
import { envConfig } from '../../config/env';
import { authService } from '../authService';
import { parseCookies } from '../../middleware/auth';

export function authenticateWsRequest(req: http.IncomingMessage, query: any): any | null {
  if (query?.ticket) {
    const res = authService.verifyAndConsumeWsTicket(query.ticket as string);
    if (res) return res.user;
  }
  const token = parseCookies(req.headers?.cookie)['session_token'];
  if (token) {
    const res = authService.validateSession(token);
    if (res) return res.user;
  }
  const auth = (req.headers?.authorization as string) || '';
  const qToken = (query?.token as string) || (query?.auth_token as string) || '';
  if (envConfig.proxy.apiKey && (auth === `Bearer ${envConfig.proxy.apiKey}` || qToken === envConfig.proxy.apiKey)) {
    return { id: 'user_master', name: 'Automated Test Runner', role: 'owner', created_at: new Date().toISOString() };
  }
  return null;
}
