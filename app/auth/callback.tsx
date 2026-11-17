import { Redirect } from 'expo-router';

// Website only: the real page is the .web.tsx file next to this one. In the
// phone apps this route only sends people home (for pricing, App Store
// guideline 3.1.1 rules out linking to purchases made outside the app).
export default function WebOnlyRoute() {
  return <Redirect href="/" />;
}
