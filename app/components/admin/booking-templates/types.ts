export type BookingFormTemplate =
  | 'practitioner-institutional'
  | 'template-2'
  | 'template-3';

export interface BookingTemplateDefinition {
  id: BookingFormTemplate;
  name: string;
  description: string;
  available: boolean;
}

export const DEFAULT_BOOKING_TEMPLATE: BookingFormTemplate =
  'practitioner-institutional';

export const BOOKING_TEMPLATES: BookingTemplateDefinition[] = [
  {
    id: 'practitioner-institutional',
    name: 'Template 1',
    description: 'Practitioner & Institutional registration form.',
    available: true,
  },
  {
    id: 'template-2',
    name: 'Template 2',
    description:
      'Practitioner & Institutional registration form without Faculty / Delegate placeholder.',
    available: true,
  },
  {
    id: 'template-3',
    name: 'Template 3',
    description: 'This registration template will be configured later.',
    available: false,
  },
];

export const BOOKING_TEMPLATE_VALUES =
  BOOKING_TEMPLATES.map((template) => template.id);

export function isBookingFormTemplate(
  value: unknown,
): value is BookingFormTemplate {
  return (
    typeof value === 'string' &&
    BOOKING_TEMPLATE_VALUES.includes(
      value as BookingFormTemplate,
    )
  );
}