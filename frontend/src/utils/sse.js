// Minimal Server-Sent Events framing parser. Kept free of React Native and
// network imports so it can be unit-tested with plain strings.
//
// The backend emits blocks like:
//   event: booking_request
//   data: {"bookingId":"..."}
//
// A block is only emitted when it carries at least one `data:` line; comment
// blocks (`: keep-alive`) and unknown fields are ignored as the SSE spec says.
export const parseSseEvents = (buffer = '') => {
  const normalized = String(buffer).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events = [];

  for (const block of blocks) {
    if (!block) continue;
    let event = 'message';
    let id;
    const data = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value || 'message';
      else if (field === 'data') data.push(value);
      else if (field === 'id') id = value;
    }
    if (data.length) events.push({ event, id, data: data.join('\n') });
  }

  return { events, rest };
};

export const SSE_MAX_BUFFER = 1024 * 1024;
