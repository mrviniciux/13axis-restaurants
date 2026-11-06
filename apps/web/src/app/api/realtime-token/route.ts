import { SignJWT } from 'jose';
import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { ApiProblemError, problemResponse } from '@/lib/server/problem';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await getAuthenticatedServerContext();
    const secret = process.env.REALTIME_JWT_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new ApiProblemError(
        503,
        'REALTIME_UNAVAILABLE',
        'Tempo real indisponível',
        'O serviço de atualizações em tempo real não está configurado.',
      );
    }

    const builder = new SignJWT({
      userId: context.userId,
      restaurantId: context.restaurantId,
      role: context.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m');
    const issuer = process.env.REALTIME_JWT_ISSUER;
    const audience = process.env.REALTIME_JWT_AUDIENCE;
    if (issuer) builder.setIssuer(issuer);
    if (audience) builder.setAudience(audience);

    return Response.json(
      { token: await builder.sign(new TextEncoder().encode(secret)) },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}
