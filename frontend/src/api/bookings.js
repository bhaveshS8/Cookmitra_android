// Booking endpoints — verified against backend/routes/bookings.js
// and the website's CookBooking/BookingDetails/BookingPayment flows.
import API from '../api/client';

export const createBooking = (payload) => API.post('/bookings', payload).then((r) => r.data);
export const getBooking = (id) => API.get(`/bookings/${id}`).then((r) => r.data);
export const getMyBookings = () => API.get('/bookings/my').then((r) => r.data);
export const getCookBookings = () => API.get('/bookings/cook').then((r) => r.data);
export const getCookRequests = () => API.get('/bookings/cook/requests').then((r) => r.data);
export const acceptBooking = (id, data = {}) =>
  API.patch(`/bookings/${id}/accept`, data).then((r) => r.data);
export const rejectBooking = (id, data = {}) =>
  API.patch(`/bookings/${id}/reject`, data).then((r) => r.data);
export const startService = (id, otp) =>
  API.patch(`/bookings/${id}/start-service`, { otp }).then((r) => r.data);
export const completeBooking = (id) => API.patch(`/bookings/${id}/complete`).then((r) => r.data);
export const cancelBooking = (id, data = {}) =>
  API.patch(`/bookings/${id}/cancel`, data).then((r) => r.data);
export const rescheduleBooking = (id, data) =>
  API.patch(`/bookings/${id}/reschedule`, data).then((r) => r.data);
export const getRescheduleOptions = (id, params = {}) =>
  API.get(`/bookings/${id}/reschedule-options`, { params }).then((r) => r.data);
export const markNoShow = (id, data) =>
  API.post(`/bookings/${id}/no-show`, data).then((r) => r.data);
export const payBooking = (id, { method, payment }) =>
  API.patch(`/bookings/${id}/pay`, { method, payment }).then((r) => r.data);
export const getCancellationPreview = (id) =>
  API.get(`/bookings/${id}/cancellation-preview`).then((r) => r.data);
export const getRefundEligibility = (id) =>
  API.get(`/bookings/${id}/refund-eligibility`).then((r) => r.data);
export const submitWomanDecline = () =>
  API.post('/bookings/verification/decline').then((r) => r.data);
export const getWomanVerificationStatus = () =>
  API.get('/bookings/verification/status').then((r) => r.data);
export const searchAvailability = (params) =>
  API.get('/availability/search', { params }).then((r) => r.data);
export const validateCoupon = (code, data = {}) =>
  API.post('/coupons/validate', { code, ...data }).then((r) => r.data);
