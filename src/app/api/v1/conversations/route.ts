import { getActor } from '@/modules/auth/actor';
import {
  createConversation,
  listOwnConversations,
} from '@/modules/conversations/conversation-service';
import { resultResponse } from '@/lib/http';

export async function GET() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  return resultResponse(await listOwnConversations(actor.data.id));
}

export async function POST() {
  const actor = await getActor();
  if (actor.error) {
    return resultResponse(actor);
  }

  return resultResponse(await createConversation(actor.data.id));
}
