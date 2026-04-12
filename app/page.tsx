import Image from "next/image"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import {
  Hash,
  CheckSquare,
  FileText,
  Globe,
  Sparkles,
  ArrowRight,
  Users,
  Zap,
  MessageSquare,
  Bot,
  Layers,
  Star,
} from "lucide-react"

export const metadata = {
  title: "Staged — The workspace where work moves forward",
  description:
    "Channels, tasks, docs, and AI — everything your team needs, in one place.",
}

const features = [
  {
    icon: Hash,
    title: "Channels",
    description:
      "Organized conversations by topic. Threads, mentions, and rich messaging that stays focused.",
    gradient: "from-blue-500 to-cyan-500",
    shadow: "shadow-blue-500/25",
  },
  {
    icon: CheckSquare,
    title: "Tasks & Boards",
    description:
      "Kanban boards with assignees, priorities, and due dates. Ship work without leaving your chat.",
    gradient: "from-purple-500 to-pink-500",
    shadow: "shadow-purple-500/25",
  },
  {
    icon: FileText,
    title: "Live Docs",
    description:
      "Collaborative documents that live next to your conversations. Write, edit, ship together.",
    gradient: "from-orange-500 to-red-500",
    shadow: "shadow-orange-500/25",
  },
  {
    icon: Globe,
    title: "Portals",
    description:
      "Share progress with clients and stakeholders without giving away your workspace.",
    gradient: "from-emerald-500 to-teal-500",
    shadow: "shadow-emerald-500/25",
  },
  {
    icon: Bot,
    title: "AI Agent",
    description:
      "A built-in agent that understands your workspace. Ask, automate, and accelerate.",
    gradient: "from-violet-500 to-indigo-500",
    shadow: "shadow-violet-500/25",
  },
  {
    icon: Users,
    title: "One Workspace",
    description:
      "A single home for your team. Invite members, manage roles, stay aligned — always.",
    gradient: "from-pink-500 to-rose-500",
    shadow: "shadow-pink-500/25",
  },
]

const stats = [
  { value: "6+", label: "Tools in one" },
  { value: "∞", label: "Channels" },
  { value: "24/7", label: "AI on standby" },
  { value: "<100ms", label: "Real-time sync" },
]

export default async function LandingPage() {
  const session = await getServerSession(authOptions)
  if (session?.user) redirect("/workspace")

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#0a0a14] text-white">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-blob absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-purple-600/30 blur-3xl" />
        <div className="animate-blob animation-delay-2000 absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-blue-600/30 blur-3xl" />
        <div className="animate-blob animation-delay-4000 absolute bottom-0 left-1/3 h-[500px] w-[500px] rounded-full bg-pink-600/20 blur-3xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Nav */}
        <header className="flex h-16 items-center justify-between px-6 sm:px-10">
          <div className="animate-fade-up flex items-center gap-2">
            <div className="relative">
              <div className="animate-glow absolute inset-0 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 blur-md" />
              <Image
                src="/logo.png"
                alt="Staged"
                width={32}
                height={32}
                priority
                className="relative h-8 w-8 rounded-lg"
              />
            </div>
            <span className="text-lg font-bold tracking-tight">staged</span>
          </div>
          <nav className="animate-fade-up animation-delay-100 hidden items-center gap-8 text-sm text-white/70 sm:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#stats" className="transition-colors hover:text-white">
              Why Staged
            </a>
          </nav>
          <Link
            href="/auth/signin"
            className="group animate-fade-up animation-delay-200 relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#0a0a14] transition-all hover:scale-105"
          >
            <span className="relative z-10">Sign in</span>
            <ArrowRight className="relative z-10 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center px-4 pt-20 pb-32 text-center sm:pt-28">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/80 backdrop-blur-sm">
            <Sparkles className="h-3 w-3 text-yellow-400" />
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text font-medium text-transparent">
              Chat · Tasks · Docs · Portals · AI — one tool
            </span>
          </div>

          <h1 className="animate-fade-up animation-delay-100 mt-8 max-w-4xl text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Everything your team needs.{" "}
            <span className="relative inline-block">
              <span className="animate-gradient bg-[linear-gradient(90deg,#a78bfa,#ec4899,#f97316,#a78bfa)] bg-clip-text text-transparent">
                One
              </span>
            </span>{" "}
            <span className="relative inline-block">
              tool.
              <svg
                className="absolute -bottom-2 left-0 h-3 w-full"
                viewBox="0 0 300 12"
                fill="none"
              >
                <path
                  d="M2 9C50 3 150 3 298 9"
                  stroke="url(#underline)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="underline" x1="0" x2="1">
                    <stop stopColor="#a78bfa" />
                    <stop offset="0.5" stopColor="#ec4899" />
                    <stop offset="1" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h1>

          <p className="animate-fade-up animation-delay-200 mt-8 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">
            Stop juggling a dozen apps to get work done. Staged brings channels,
            tasks, docs, client portals, and an AI agent into a single,
            beautifully focused workspace.
          </p>

          {/* All-in-one badge row */}
          <div className="animate-fade-up animation-delay-250 mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { icon: Hash, label: "Channels", color: "text-violet-300" },
              { icon: CheckSquare, label: "Tasks", color: "text-pink-300" },
              { icon: FileText, label: "Docs", color: "text-orange-300" },
              { icon: Globe, label: "Portals", color: "text-emerald-300" },
              { icon: Bot, label: "AI Agent", color: "text-sky-300" },
            ].map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-white/[0.08]"
              >
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                {label}
              </div>
            ))}
          </div>

          <div className="animate-fade-up animation-delay-300 mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/auth/signin"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-violet-500 via-pink-500 to-orange-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition-all hover:scale-105 hover:shadow-pink-500/50"
            >
              <div className="animate-shimmer absolute inset-0" />
              <span className="relative z-10">Get started free</span>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              See features
              <Layers className="h-4 w-4 transition-transform group-hover:rotate-12" />
            </a>
          </div>

          {/* App preview mockup */}
          <div className="animate-fade-up animation-delay-400 relative mt-20 w-full max-w-5xl">
            <div className="relative">
              {/* Ambient glow */}
              <div className="absolute -inset-8 -z-10 rounded-[2rem] bg-gradient-to-r from-violet-600/30 via-pink-600/20 to-orange-600/30 blur-3xl" />

              {/* Window frame */}
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-1 shadow-2xl backdrop-blur-sm">
                {/* Window chrome */}
                <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div className="h-3 w-3 rounded-full bg-green-500/80" />
                  <div className="ml-4 flex-1 rounded-md bg-white/5 px-3 py-1 text-left text-[10px] text-white/40">
                    staged.codula.in/workspace
                  </div>
                </div>

                {/* App body */}
                <div className="grid grid-cols-12 gap-0 bg-[#0a0a14]/90 text-left">
                  {/* Sidebar */}
                  <aside className="col-span-3 border-r border-white/5 p-3 text-xs">
                    <div className="flex items-center gap-2 rounded-md bg-white/5 p-2">
                      <div className="h-5 w-5 rounded bg-gradient-to-br from-violet-500 to-pink-500" />
                      <span className="font-semibold text-white/90">
                        Acme Inc.
                      </span>
                    </div>
                    <div className="mt-4 space-y-0.5">
                      <p className="px-2 py-1 text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                        Channels
                      </p>
                      {[
                        { name: "general", active: false },
                        { name: "engineering", active: true },
                        { name: "design", active: false },
                        { name: "launch", active: false, unread: 3 },
                      ].map((ch) => (
                        <div
                          key={ch.name}
                          className={`flex items-center justify-between rounded px-2 py-1 ${
                            ch.active
                              ? "bg-gradient-to-r from-violet-500/20 to-pink-500/10 text-white"
                              : "text-white/60"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Hash className="h-3 w-3" />
                            {ch.name}
                          </span>
                          {ch.unread && (
                            <span className="rounded-full bg-pink-500 px-1.5 text-[9px] font-bold text-white">
                              {ch.unread}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 space-y-0.5">
                      <p className="px-2 py-1 text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                        Workspace
                      </p>
                      {[
                        { icon: CheckSquare, label: "Tasks" },
                        { icon: FileText, label: "Docs" },
                        { icon: Bot, label: "AI Agent" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-1.5 rounded px-2 py-1 text-white/60"
                        >
                          <item.icon className="h-3 w-3" />
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </aside>

                  {/* Main content */}
                  <main className="col-span-6 flex flex-col border-r border-white/5">
                    {/* Channel header */}
                    <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5 text-xs">
                      <Hash className="h-3.5 w-3.5 text-white/60" />
                      <span className="font-semibold text-white/90">
                        engineering
                      </span>
                      <span className="text-white/30">|</span>
                      <span className="text-[10px] text-white/50">
                        Shipping the future
                      </span>
                      <div className="ml-auto flex -space-x-1.5">
                        <div className="h-4 w-4 rounded-full border border-[#0a0a14] bg-violet-500" />
                        <div className="h-4 w-4 rounded-full border border-[#0a0a14] bg-pink-500" />
                        <div className="h-4 w-4 rounded-full border border-[#0a0a14] bg-orange-500" />
                        <div className="h-4 w-4 rounded-full border border-[#0a0a14] bg-emerald-500" />
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 space-y-3 p-4">
                      <div className="flex gap-2">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-purple-600" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white">
                              Maya
                            </span>
                            <span className="text-[9px] text-white/40">
                              2:14 PM
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-white/70">
                            Just pushed the new onboarding flow. Can someone
                            review? 🚀
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-pink-400 to-rose-600" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white">
                              Jordan
                            </span>
                            <span className="text-[9px] text-white/40">
                              2:15 PM
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-white/70">
                            On it — I&apos;ll have notes in 10 min.
                          </p>
                        </div>
                      </div>

                      {/* Task attachment */}
                      <div className="flex gap-2">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-red-600" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white">
                              Alex
                            </span>
                            <span className="text-[9px] text-white/40">
                              2:17 PM
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-white/70">
                            Created a task to track this:
                          </p>
                          <div className="mt-1.5 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
                            <div className="rounded bg-purple-500/20 p-1">
                              <CheckSquare className="h-3 w-3 text-purple-400" />
                            </div>
                            <span className="text-[10px] font-medium text-white/80">
                              Review onboarding PR
                            </span>
                            <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-orange-300">
                              HIGH
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Typing indicator */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600" />
                        <div className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                          <span className="h-1 w-1 animate-bounce rounded-full bg-white/60" />
                          <span
                            className="h-1 w-1 animate-bounce rounded-full bg-white/60"
                            style={{ animationDelay: "0.15s" }}
                          />
                          <span
                            className="h-1 w-1 animate-bounce rounded-full bg-white/60"
                            style={{ animationDelay: "0.3s" }}
                          />
                        </div>
                        <span className="text-[9px] text-white/40">
                          Sam is typing...
                        </span>
                      </div>
                    </div>

                    {/* Input */}
                    <div className="border-t border-white/5 p-3">
                      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5">
                        <span className="text-[11px] text-white/40">
                          Message #engineering
                        </span>
                        <span className="ml-auto h-3 w-px animate-pulse bg-white/60" />
                      </div>
                    </div>
                  </main>

                  {/* AI panel */}
                  <aside className="col-span-3 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-white/40 uppercase">
                      <Bot className="h-3 w-3" />
                      AI Agent
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-lg border border-white/10 bg-gradient-to-br from-violet-500/10 to-pink-500/5 p-2.5">
                        <div className="flex items-center gap-1 text-[9px] font-semibold text-violet-300">
                          <Sparkles className="h-2.5 w-2.5" />
                          SUGGESTED
                        </div>
                        <p className="mt-1 text-[10px] text-white/80">
                          Summarize the last 20 messages in #engineering
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                        <p className="text-[10px] text-white/80">
                          3 tasks due this week
                        </p>
                        <div className="mt-1.5 flex gap-1">
                          <div className="h-1 flex-1 rounded-full bg-pink-500/80" />
                          <div className="h-1 flex-1 rounded-full bg-orange-500/80" />
                          <div className="h-1 flex-1 rounded-full bg-emerald-500/80" />
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-orange-400" />
                          <span className="text-[10px] font-semibold text-white/80">
                            Launch brief
                          </span>
                        </div>
                        <p className="mt-1 text-[9px] text-white/50">
                          Updated 5 min ago
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>

              {/* Floating badges */}
              <div className="animate-float absolute top-1/3 -left-4 hidden rounded-xl border border-white/10 bg-[#0a0a14]/90 p-3 shadow-xl backdrop-blur-xl lg:block">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-500/20 p-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-white">
                      AI ready
                    </p>
                    <p className="text-[9px] text-white/50">Zero setup</p>
                  </div>
                </div>
              </div>
              <div
                className="animate-float absolute top-1/2 -right-4 hidden rounded-xl border border-white/10 bg-[#0a0a14]/90 p-3 shadow-xl backdrop-blur-xl lg:block"
                style={{ animationDelay: "1.5s" }}
              >
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-pink-500/20 p-1.5">
                    <Zap className="h-3.5 w-3.5 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-white">
                      Real-time
                    </p>
                    <p className="text-[9px] text-white/50">&lt;100ms sync</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section
          id="stats"
          className="border-y border-white/5 bg-white/[0.02] px-4 py-16 backdrop-blur-sm"
        >
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="animate-fade-up text-center"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="bg-gradient-to-br from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
                  {stat.value}
                </div>
                <div className="mt-2 text-xs tracking-wider text-white/50 uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-4 py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
                <Star className="h-3 w-3 text-yellow-400" />
                Built for modern teams
              </div>
              <h2 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
                Everything your team{" "}
                <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                  actually
                </span>{" "}
                needs
              </h2>
              <p className="mt-4 text-base text-white/60">
                Stop paying for five tools that don&apos;t talk to each other.
                Staged brings them together, then makes them smarter with AI.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
                >
                  {/* Hover gradient */}
                  <div
                    className={`absolute inset-0 -z-10 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-10`}
                  />

                  <div
                    className={`inline-flex rounded-xl bg-gradient-to-br ${feature.gradient} p-3 shadow-lg ${feature.shadow} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                  >
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {feature.description}
                  </p>

                  {/* Corner accent */}
                  <div
                    className={`pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${feature.gradient} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30`}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Big CTA */}
        <section className="px-4 py-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-pink-600/20 to-orange-600/20 p-12 text-center sm:p-20">
            {/* Animated background */}
            <div className="absolute inset-0 -z-10">
              <div className="animate-blob absolute top-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-600/40 blur-3xl" />
              <div className="animate-blob animation-delay-2000 absolute right-1/4 bottom-0 h-64 w-64 rounded-full bg-pink-600/40 blur-3xl" />
            </div>

            <MessageSquare className="mx-auto h-10 w-10 text-white/80" />
            <h2 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
              Ready to move work forward?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/70">
              Join your team on Staged. Setup takes 30 seconds. Your future
              productive self will thank you.
            </p>
            <Link
              href="/auth/signin"
              className="group relative mt-8 inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#0a0a14] transition-all hover:scale-105"
            >
              <span>Open your workspace</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 px-6 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Staged"
                width={24}
                height={24}
                className="h-6 w-6 rounded-md"
              />
              <span className="text-sm font-semibold">staged</span>
              <span className="text-white/30">·</span>
              <span className="text-xs text-white/50">staged.codula.in</span>
            </div>
            <p className="text-xs text-white/40">
              © {new Date().getFullYear()} Staged. Crafted with care.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
