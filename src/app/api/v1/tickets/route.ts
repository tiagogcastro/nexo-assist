import { getActor } from '@/modules/auth/actor';
import { listOwnTickets } from '@/modules/tickets/ticket-service';
import { resultResponse } from '@/lib/http';

export async function GET() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  return resultResponse(await listOwnTickets(actor.data.id));
}
