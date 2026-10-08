import { redirect } from 'next/navigation';

/** Feedback is now a quick star rating on My Tickets; old links land there. */
export default function FeedbackRedirect() {
  redirect('/events/mytickets');
}
