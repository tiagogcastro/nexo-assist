export function formatPriority(priority: string): string {
  const labels: Record<string, string> = {
    critical: 'Crítica',
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  };
  return labels[priority] ?? priority;
}

export function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    open: 'Aberto',
    awaiting_analyst: 'Aguardando analista',
    approved: 'Aprovado',
    resolved: 'Resolvido',
    closed: 'Encerrado',
  };
  return labels[status] ?? status;
}
