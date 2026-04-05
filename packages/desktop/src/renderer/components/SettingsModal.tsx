import { useState, useEffect } from "react"

type Settings = {
  modelId: string
  providerApiKeys: Record<string, string>
}

const KEY_FIELDS = [
  { key: "anthropicApiKey", label: "Anthropic API Key", placeholder: "sk-ant-..." },
  { key: "openaiApiKey", label: "OpenAI API Key", placeholder: "sk-..." },
  { key: "googleApiKey", label: "Google AI API Key", placeholder: "AIza..." },
  { key: "mistralApiKey", label: "Mistral API Key", placeholder: "..." },
  { key: "xaiApiKey", label: "xAI API Key", placeholder: "xai-..." },
]

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>({
    modelId: "anthropic:claude-sonnet-4-5-20251001",
    providerApiKeys: {},
  })
  const [models, setModels] = useState<{ id: string; label: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.getSettings().then((s) =>
      setSettings({ modelId: s.modelId, providerApiKeys: s.providerApiKeys as Record<string, string> })
    )
    window.api.listModels().then(setModels)
  }, [])

  const save = async () => {
    setSaving(true)
    await window.api.setSettings(settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-white/90">Settings</h2>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Model picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-white/40 uppercase">Model</label>
            <select
              value={settings.modelId}
              onChange={(e) => setSettings((s) => ({ ...s, modelId: e.target.value }))}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-white/80 focus:border-white/20 focus:outline-none"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#111]">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Keys */}
          <div className="space-y-3">
            <p className="text-[11px] font-medium text-white/40 uppercase">API Keys</p>
            {KEY_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-[12px] text-white/50">{label}</label>
                <input
                  type="password"
                  value={settings.providerApiKeys[key] ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      providerApiKeys: { ...s.providerApiKeys, [key]: e.target.value },
                    }))
                  }
                  placeholder={placeholder}
                  className="selectable w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[12px] text-white/70 placeholder-white/20 focus:border-white/20 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-white/90 px-4 py-2 text-[13px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saved ? "Saved!" : saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
