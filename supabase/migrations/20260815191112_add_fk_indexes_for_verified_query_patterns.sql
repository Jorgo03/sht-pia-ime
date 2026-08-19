-- Only the FK columns actually filtered on by real queries in the app
-- (grepped across both src/ and app/ for .eq('<col>', ...) usage). Skipped:
-- messages.sender_id (messages are always fetched by conversation_id, which
-- already has idx_messages_conv) and property_activity.user_id /
-- property_views.user_id (neither is filtered on directly anywhere — the
-- property_activity RLS policy filters via a properties subquery on
-- owner_id/agent_id, not property_activity.user_id itself).

-- conversations.agent_id: .eq('agent_id', user.id) in agent-dashboard (web + RN)
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON public.conversations (agent_id);

-- conversations.property_id: .eq('property_id', property.id) when checking for
-- an existing conversation from a property page (web + RN)
CREATE INDEX IF NOT EXISTS idx_conversations_property_id ON public.conversations (property_id);

-- leads.agent_id: .eq('agent_id', user.id) in agent-dashboard (web + RN)
CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON public.leads (agent_id);

-- saved_searches.user_id: .eq('user_id', user.id) in saved-searches list (web + RN)
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches (user_id);

-- wanted_homes.client_id: .eq('client_id', user.id) in saved-searches wanted tab (web + RN)
CREATE INDEX IF NOT EXISTS idx_wanted_homes_client_id ON public.wanted_homes (client_id);

-- viewings.property_id: .eq('property_id', id) in listing analytics/dashboard (web + RN)
CREATE INDEX IF NOT EXISTS idx_viewings_property_id ON public.viewings (property_id);
