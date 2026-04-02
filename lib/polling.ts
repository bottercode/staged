export const MESSAGE_POLL_INTERVAL_MS = 3000

export const MESSAGE_POLL_QUERY_OPTIONS = {
  refetchInterval: MESSAGE_POLL_INTERVAL_MS,
  refetchIntervalInBackground: true,
  refetchOnReconnect: true,
  refetchOnWindowFocus: true,
} as const
