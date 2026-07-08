// src/server/integrations/msgraph/notifications.ts
// Pure helper for the Microsoft Graph change-notifications webhook: extracts
// {subscriptionId, resource} pairs from the notification payload. No
// network/DB access here so this is cheap to unit test; the route
// (src/app/api/integrations/msgraph/notifications/route.ts) wires it to
// GraphSubscription lookups + mail ingestion. Never throws on malformed
// input — returns [] instead.
export function parseGraphNotifications(json: unknown): { subscriptionId: string; resource: string }[] {
  const j = json as { value?: unknown } | null | undefined;
  const value = j && typeof j === "object" ? j.value : undefined;
  if (!Array.isArray(value)) return [];

  return value
    .filter((n): n is { subscriptionId: string; resource: string } => {
      const rec = n as { subscriptionId?: unknown; resource?: unknown };
      return Boolean(rec) && typeof rec.subscriptionId === "string" && rec.subscriptionId.length > 0
        && typeof rec.resource === "string" && rec.resource.length > 0;
    })
    .map((n) => ({ subscriptionId: n.subscriptionId, resource: n.resource }));
}
