import { router } from "./trpc"
import { userRouter } from "./routers/user"
import { workspaceRouter } from "./routers/workspace"
import { channelRouter } from "./routers/channel"
import { messageRouter } from "./routers/message"
import { dmRouter } from "./routers/dm"
import { boardRouter } from "./routers/board"
import { taskRouter } from "./routers/task"
import { portalRouter } from "./routers/portal"
import { docRouter } from "./routers/doc"

export const appRouter = router({
  user: userRouter,
  workspace: workspaceRouter,
  channel: channelRouter,
  message: messageRouter,
  dm: dmRouter,
  board: boardRouter,
  task: taskRouter,
  portal: portalRouter,
  doc: docRouter,
})

export type AppRouter = typeof appRouter
