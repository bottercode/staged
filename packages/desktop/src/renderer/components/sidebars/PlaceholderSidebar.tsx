export function PlaceholderSidebar({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
          {label}
        </span>
      </div>
    </div>
  )
}
