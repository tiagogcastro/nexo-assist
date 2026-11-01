import { z } from 'zod';

export const ticketContentSchema = z.object({
  title: z.string().trim().min(8).max(140),
  description: z.string().trim().min(15).max(4000),
  type: z.enum(['INC', 'REQ']),
  category: z.enum(['Acesso', 'Rede e VPN', 'Hardware', 'Software', 'E-mail', 'Outros']),
  teamBlocked: z.boolean(),
  personBlocked: z.boolean(),
  sameDayCommitment: z.boolean(),
  hasWorkaround: z.boolean(),
});

export const createDraftSchema = ticketContentSchema.extend({
  conversationId: z.uuid(),
  ticketId: z.uuid().optional(),
});

export type TicketContent = z.infer<typeof ticketContentSchema>;
export type CreateDraftInput = z.infer<typeof createDraftSchema>;
