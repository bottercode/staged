# Next.js template

This is a Next.js template with shadcn/ui.

## Google Auth Setup

This project now uses NextAuth (Auth.js) with Google login.

Add these environment variables:

```bash
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your-random-secret
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL="Staged <noreply@yourdomain.com>"
```

Then open `/auth/signin` and continue with Google.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
