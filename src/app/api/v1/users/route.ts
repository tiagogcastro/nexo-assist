import { getActor } from '@/modules/auth/actor';
import { listUsers } from '@/modules/users/user-service';
import { resultResponse } from '@/lib/http';

export async function GET() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  return resultResponse(await listUsers(actor.data.id));
}
