"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink, splitLink, createWSClient, wsLink } from "@trpc/client"
import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import superjson from "superjson"

function getBaseUrl() {
  if (typeof window !== "undefined") return ""
  return `http://localhost:3000`
}

function getWsUrl() {
  if (typeof window === "undefined") return ""
  if (window.location.protocol === "https:") {
    return `wss://${window.location.host}`
  }
  return `ws://${window.location.host}`
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            refetchOnWindowFocus: false,
            retry: 2,
            retryDelay: 500,
          },
        },
      })
  )

  const [trpcClient] = useState(() => {
    const httpLink = httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
    })

    let link
    try {
      const wsClient = createWSClient({ url: getWsUrl() })
      link = splitLink({
        condition: (op) => op.type === "subscription",
        true: wsLink({ client: wsClient, transformer: superjson }),
        false: httpLink,
      })
    } catch {
      link = httpLink
    }

    return trpc.createClient({ links: [link] })
  })

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
