import { Redirect } from 'expo-router';

/**
 * The old single-scroll listing form used to live here. It wrote different
 * columns from the wizard (it set agent_id for clients and no owner_type), and
 * nothing linked to it any more, so it was retired (docs/LAUNCH_TASKS.md L08).
 * The route stays so an old deep link to /listing/create lands on the wizard.
 */
export default function LegacyCreateListingRedirect() {
  return <Redirect href="/listing/new" />;
}
