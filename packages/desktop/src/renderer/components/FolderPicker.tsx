export function FolderPicker({ onSelect }: { onSelect: (path: string) => void }) {
  const open = async () => {
    const folder = await window.api.openFolder()
    if (folder) onSelect(folder)
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/50">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-[15px] font-semibold text-white/90">Open a project</h1>
          <p className="text-[13px] text-white/40">
            Choose a folder to start coding with AI
          </p>
        </div>

        <button
          onClick={open}
          className="flex items-center gap-2 rounded-lg bg-white/90 px-5 py-2.5 text-[13px] font-medium text-black transition-opacity hover:opacity-90 active:opacity-75"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Browse folder
        </button>
      </div>
    </div>
  )
}
