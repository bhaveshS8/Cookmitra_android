// Stable action values mirrored from the website/backend. Labels are for the
// mobile picker only; the codes are what get persisted/audited.

export const CUSTOMER_CANCEL_REASONS = [
  { value: 'CHANGE_OF_PLANS', label: 'Change of plans' },
  { value: 'WRONG_BOOKING_DETAILS', label: 'Wrong booking details' },
  { value: 'WRONG_ADDRESS', label: 'Wrong address' },
  { value: 'SERVICE_NO_LONGER_REQUIRED', label: 'Service no longer required' },
  { value: 'OTHER', label: 'Something else' },
];

export const COOK_CANCEL_REASONS = [
  { value: 'MEDICAL_EMERGENCY', label: 'Medical or family emergency' },
  { value: 'ILLNESS', label: 'Illness or health concern' },
  { value: 'PERSONAL_UNAVAILABILITY', label: 'Unexpected personal unavailability' },
  { value: 'TRANSPORT_ISSUE', label: 'Transport or travel problem' },
  { value: 'LOCATION_UNREACHABLE', label: "Unable to reach the customer's location" },
  { value: 'SCHEDULING_CONFLICT', label: 'Scheduling conflict or incorrect details' },
  { value: 'CUSTOMER_REQUESTED', label: 'Customer requested cancellation' },
  { value: 'OTHER', label: 'Something else' },
];

export const REFUND_REASONS = [
  { value: 'Service was not provided', label: 'Service was not provided' },
  { value: 'Cook did not arrive', label: 'Cook did not arrive' },
  { value: 'Service was partially completed', label: 'Service was partially completed' },
  { value: 'Service was not completed', label: 'Service was not completed' },
  { value: 'Other', label: 'Something else' },
];

export const CUSTOMER_COMPLAINT_REASONS = [
  { value: 'COOK_DID_NOT_ARRIVE', label: 'Cook did not arrive' },
  { value: 'MAJOR_SERVICE_DEVIATION', label: 'Service very different from confirmed' },
  { value: 'SERVICE_QUALITY_ISSUE', label: 'Food quality or taste issue' },
  { value: 'UNPROFESSIONAL_BEHAVIOR', label: 'Unprofessional behaviour' },
  { value: 'OTHER', label: 'Something else' },
];

export const COOK_COMPLAINT_REASONS = [
  { value: 'behaviour', label: 'Rude or uncooperative behaviour' },
  { value: 'payment', label: 'Payment issue' },
  { value: 'address', label: 'Wrong or unreachable address' },
  { value: 'no_show', label: 'Customer not available' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'other', label: 'Something else' },
];

export const NO_SHOW_REASONS = [
  { value: 'Customer not present at the venue', label: 'Customer not present at the venue' },
  { value: 'No response at the door or phone', label: 'No response at the door or phone' },
  { value: 'Address unreachable or incorrect', label: 'Address unreachable or incorrect' },
  { value: 'Other', label: 'Something else' },
];

export const RESCHEDULE_REASONS = [
  { value: 'Change of plans', label: 'Change of plans' },
  { value: 'Personal reason', label: 'Personal reason' },
  { value: 'Wrong date/time selected', label: 'Wrong date/time selected' },
  { value: 'Cook unavailable', label: 'Cook unavailable' },
  { value: 'Family/event schedule changed', label: 'Family/event schedule changed' },
  { value: 'Other', label: 'Something else' },
];

// Where the waiting screen should hand off once a booking leaves the dispatch
// queue. Paid/confirmed bookings must go to details, never back to checkout;
// accepted bookings go to checkout only when money is actually due.
export const bookingWaitDestination = (booking) => {
  if (!booking) return null;
  const status = booking.status;
  const paid = booking.payment?.status === 'paid';
  if (['confirmed', 'in_progress', 'completed'].includes(status) || paid) {
    return { screen: 'BookingDetail', delayMs: 0 };
  }
  if (status === 'accepted') {
    return {
      screen: Number(booking.amount) <= 0 ? 'BookingDetail' : 'BookingPayment',
      delayMs: 1200,
    };
  }
  return null;
};
