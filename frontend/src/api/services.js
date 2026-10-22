// Cook / payment / profile / notification endpoints — verified against
// backend/routes/{cooks,payments,auth}.js and the website screens.
import API from './client';

export const getCooks = (params = {}) => API.get('/cooks', { params }).then((r) => r.data);
export const getCook = (id) => API.get(`/cooks/${id}`).then((r) => r.data);
export const getMyCookProfile = () => API.get('/cooks/me').then((r) => r.data);
export const createCookProfile = (data) => API.post('/cooks', data).then((r) => r.data);
export const updateCookProfile = (id, data) => API.put(`/cooks/${id}`, data).then((r) => r.data);
export const toggleAvailability = (status) =>
  API.patch('/cooks/me/availability', { status }).then((r) => r.data);
export const getAvailableSlots = (id, params = {}) =>
  API.get(`/cooks/${id}/availability`, { params }).then((r) => r.data);
export const uploadCookDocs = (formData) =>
  API.post('/cooks/upload-docs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const createPaymentOrder = (data) => API.post('/payments/order', data).then((r) => r.data);
export const verifyPayment = (data) => API.post('/payments/verify', data).then((r) => r.data);

export const getCookEarnings = () => API.get('/cook/earnings').then((r) => r.data);
export const getCookPayouts = () => API.get('/cook/payouts').then((r) => r.data);
export const getPayoutStatement = () => API.get('/payouts/statement/me').then((r) => r.data);

export const getMe = () => API.get('/auth/me').then((r) => r.data);
export const getMyStats = () => API.get('/auth/me/stats').then((r) => r.data);
export const updateMe = (data) => API.put('/auth/me', data).then((r) => r.data);
export const changePassword = (data) => API.post('/auth/change-password', data).then((r) => r.data);
export const getMyAddresses = () => API.get('/auth/me/addresses').then((r) => r.data);
export const addAddress = (data) => API.post('/auth/me/addresses', data).then((r) => r.data);
export const updateAddress = (id, data) => API.put(`/auth/me/addresses/${id}`, data).then((r) => r.data);
export const deleteAddress = (id) => API.delete(`/auth/me/addresses/${id}`).then((r) => r.data);
export const setDefaultAddress = (id) =>
  API.patch(`/auth/me/addresses/${id}/default`).then((r) => r.data);

export const getNotifications = () => API.get('/notifications').then((r) => r.data);
export const markAllNotificationsRead = () => API.patch('/notifications/read-all').then((r) => r.data);
export const markNotificationRead = (id) => API.patch(`/notifications/${id}/read`).then((r) => r.data);

export const getMyReviews = () => API.get('/reviews/my').then((r) => r.data);
export const createReview = (data) => API.post('/reviews', data).then((r) => r.data);
export const getCookReviews = (cookId, params = {}) =>
  API.get(`/reviews/cook/${cookId}`, { params }).then((r) => r.data);
export const getCookOwnReviews = () => API.get('/reviews/cook-me').then((r) => r.data);
export const requestRefund = (bookingId, data) =>
  API.post(`/bookings/${bookingId}/refund-request`, data).then((r) => r.data);
export const getWhatsappStatus = () => API.get('/whatsapp/status').then((r) => r.data);
export const createComplaint = (data) => API.post('/complaints', data).then((r) => r.data);
export const getMyComplaints = () => API.get('/complaints/my').then((r) => r.data);
