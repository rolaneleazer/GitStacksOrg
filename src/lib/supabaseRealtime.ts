import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Safely subscribe to a Supabase Realtime channel and ensure proper cleanup
 * so idle WebSocket sockets do not accumulate and trigger Supabase Free Tier connection limits.
 *
 * @param client Supabase client instance (must be a singleton)
 * @param channelName Unique name for the realtime channel
 * @param configure Callback to attach event listeners (.on(...)) before subscribing
 * @returns Cleanup function that calls supabase.removeChannel(channel)
 */
export function subscribeSafeRealtimeChannel(
  client: SupabaseClient,
  channelName: string,
  configure: (channel: RealtimeChannel) => void
): () => void {
  const channel = client.channel(channelName);
  configure(channel);
  channel.subscribe();

  return () => {
    try {
      client.removeChannel(channel);
    } catch {
      // ignore cleanup errors during unmount
    }
  };
}
