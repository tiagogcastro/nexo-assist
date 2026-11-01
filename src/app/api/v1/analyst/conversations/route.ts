import { getActor } from '@/modules/auth/actor';
import { listAnalystQueue } from '@/modules/handoffs/handoff-service';
import { resultResponse } from '@/lib/http';

export async function GET() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  return resultResponse(await listAnalystQueue(actor.data.id));
}
