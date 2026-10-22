// A booking attempt is identified by the fields that change what the customer
// is asking for. The same attempt keeps its clientKey across retries (including
// an app restart), while editing the date/slot/venue produces a new key.
export const bookingAttemptSignature = ({
  serviceType,
  date,
  hours,
  slot,
  guests,
  address,
  flatNo,
  society,
  landmark,
  city,
  coupon,
}) =>
  [
    serviceType,
    date,
    hours,
    slot?.startTime,
    slot?.endTime,
    guests,
    address,
    flatNo,
    society,
    landmark,
    city,
    coupon,
  ]
    .map((value) => String(value ?? '').trim())
    .join('|');

export const nextBookingClientKey = ({
  userId,
  signature,
  currentKey,
  currentSignature,
  now = Date.now(),
  random = Math.random,
}) => {
  if (currentKey && currentSignature === signature) return currentKey;
  return `bk_${userId}_${now}_${Math.floor(Number(random()) * 1e8).toString(36)}`;
};
