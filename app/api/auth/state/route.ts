import { cloudConfigured } from '@/lib/auth';
import { countUsers, signupOpen } from '@/lib/server/accounts';
import { failFrom, ok } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

// Public: what the sign-in page should show (first-time setup, sign-up open, local single password).
export async function GET() {
  if (!cloudConfigured()) return ok({ mode: 'local', needsSetup: false, signupOpen: false });
  try {
    const users = await countUsers();
    return ok({ mode: 'cloud', needsSetup: users === 0, setupNeedsPassword: Boolean(process.env.ADMIN_PASSWORD?.trim()), signupOpen: signupOpen() && users > 0 });
  } catch (e) {
    return failFrom(e);
  }
}
