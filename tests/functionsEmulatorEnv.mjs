// Writes emulator-only, git-ignored env files for the demo project. Never overwrites an existing file.
import { existsSync, writeFileSync } from 'node:fs';
const put = (f, body) => { if (!existsSync(f)) writeFileSync(f, body); };
put('functions/.env.demo-notify', 'OWNER_NOTIFY_EMAIL=owner@example.com\nRAZORPAY_KEY_ID=rzp_test_x\nADMIN_UIDS=u\n');
put('functions/.secret.local', 'RESEND_API_KEY=\nRAZORPAY_KEY_SECRET=x\nRAZORPAY_WEBHOOK_SECRET=x\n');
