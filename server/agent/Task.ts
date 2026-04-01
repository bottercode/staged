import { randomBytes } from "crypto"

export type TaskType = "local_bash"

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "killed"

export type TaskState = {
  id: string
  type: TaskType
  status: TaskStatus
  description: string
  startTime: number
  endTime?: number
}

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return status === "completed" || status === "failed" || status === "killed"
}

const TASK_ID_PREFIXES: Record<TaskType, string> = {
  local_bash: "b",
}

const TASK_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"

export function generateTaskId(type: TaskType): string {
  const prefix = TASK_ID_PREFIXES[type]
  const bytes = randomBytes(8)
  let id = prefix

  for (let i = 0; i < 8; i++) {
    id += TASK_ID_ALPHABET[bytes[i]! % TASK_ID_ALPHABET.length]
  }

  return id
}

export class TaskManager {
  private readonly tasks = new Map<string, TaskState>()

  start(type: TaskType, description: string): TaskState {
    const task: TaskState = {
      id: generateTaskId(type),
      type,
      status: "running",
      description,
      startTime: Date.now(),
    }

    this.tasks.set(task.id, task)
    return task
  }

  finish(taskId: string, status: Extract<TaskStatus, "completed" | "failed">) {
    const task = this.tasks.get(taskId)
    if (!task || isTerminalTaskStatus(task.status)) return

    task.status = status
    task.endTime = Date.now()
  }

  fail(taskId: string) {
    this.finish(taskId, "failed")
  }

  complete(taskId: string) {
    this.finish(taskId, "completed")
  }

  get(taskId: string) {
    return this.tasks.get(taskId)
  }
}
