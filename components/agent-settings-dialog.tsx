"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  DEFAULT_AGENT_SETTINGS,
  readAgentSettings,
  writeAgentSettings,
} from "@/lib/agent-settings"

type FieldKey =
  | "anthropicApiKey"
  | "openaiApiKey"
  | "googleApiKey"
  | "mistralApiKey"
  | "xaiApiKey"

const FIELDS: Array<{ key: FieldKey; label: string; placeholder: string }> = [
  { key: "anthropicApiKey", label: "Anthropic", placeholder: "sk-ant-..." },
  { key: "openaiApiKey", label: "OpenAI", placeholder: "sk-..." },
  { key: "googleApiKey", label: "Google", placeholder: "AIza..." },
  { key: "mistralApiKey", label: "Mistral", placeholder: "..." },
  { key: "xaiApiKey", label: "xAI", placeholder: "xai-..." },
]

export function AgentSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    anthropicApiKey: readAgentSettings().providerApiKeys.anthropicApiKey || "",
    openaiApiKey: readAgentSettings().providerApiKeys.openaiApiKey || "",
    googleApiKey: readAgentSettings().providerApiKeys.googleApiKey || "",
    mistralApiKey: readAgentSettings().providerApiKeys.mistralApiKey || "",
    xaiApiKey: readAgentSettings().providerApiKeys.xaiApiKey || "",
  })

  const handleSave = () => {
    writeAgentSettings({
      providerApiKeys: {
        anthropicApiKey: values.anthropicApiKey.trim() || undefined,
        openaiApiKey: values.openaiApiKey.trim() || undefined,
        googleApiKey: values.googleApiKey.trim() || undefined,
        mistralApiKey: values.mistralApiKey.trim() || undefined,
        xaiApiKey: values.xaiApiKey.trim() || undefined,
      },
    })
    onOpenChange(false)
  }

  const handleClear = () => {
    writeAgentSettings(DEFAULT_AGENT_SETTINGS)
    setValues({
      anthropicApiKey: "",
      openaiApiKey: "",
      googleApiKey: "",
      mistralApiKey: "",
      xaiApiKey: "",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent BYOK Settings</DialogTitle>
          <DialogDescription>
            Add provider API keys to run models with your own credentials. Keys
            are stored locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {field.label}
              </p>
              <Input
                type="password"
                value={values[field.key]}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.key]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
