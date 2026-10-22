// wa.me / maps deep links ported from website utils/constants.js.
// window.location usage replaced with the configured WEB_ORIGIN.
import { Linking } from 'react-native';
import { normalizeIndianMobile } from './format';
import { getApiConfig } from '../config';

export const openUrl = async (url) => {
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};

export const mapsNavigateUrl = (booking) => {
  const lat = booking?.location?.lat;
  const lng = booking?.location?.lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (booking?.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`;
  }
  return null;
};

export const bookingCustomerWhatsAppUrl = ({ customerPhone, cookName, cookPhone, booking }) => {
  const mobile = normalizeIndianMobile(customerPhone);
  if (!mobile) return null;
  const lines = [
    `Service: ${(booking?.serviceType || '').replace(/_/g, ' ')}`,
    `Cook: ${cookName || 'Assigned cook'}`,
    `Date: ${booking?.date ? new Date(booking.date).toLocaleDateString() : ''}`,
    `Venue: ${booking?.address || ''}`,
  ];
  if (booking?._id) lines.push(`Booking ID: ${booking._id}`);
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(lines.join('\n'))}`;
};

export const bookingReviewLink = (bookingId) => {
  if (!bookingId) return null;
  return `${getApiConfig().webOrigin}/bookings/${bookingId}`;
};
