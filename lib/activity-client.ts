export type ActivityAction =
  | 'page_view'
  | 'form_started'
  | 'form_submitted'
  | 'slot_selected'
  | 'confirmation_viewed'
  | 'booking_completed'
  | 'feedback_submitted'
  | 'feedback_skipped';

export async function trackActivity(
  action: ActivityAction,
  options: {
    eventId?: string;
    metadata?: Record<string, unknown>;
    path?: string;
  } = {},
): Promise<boolean> {
  try {
    const response = await fetch(
      '/api/activity',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify({
          action,
          eventId: options.eventId,
          path:
            options.path ||
            window.location.pathname,
          metadata: options.metadata,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Activity request failed with status ${response.status}.`,
      );
    }

    return true;
  } catch (error) {
    console.error(
      'Unable to record user activity:',
      error,
    );

    return false;
  }
}
