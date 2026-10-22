import { parseSseEvents } from '../src/utils/sse';

describe('parseSseEvents', () => {
  test('parses complete named events and keeps an incomplete tail', () => {
    const raw =
      ': keep-alive\n\n' +
      'event: booking_request\n' +
      'data: {"bookingId":"b1"}\n\n' +
      'event: booking_expired\n' +
      'data: {"bookingId":"b2"}\n\n' +
      'event: booking_assigned\n' +
      'data: {"bookingId":"b3"';

    const { events, rest } = parseSseEvents(raw);

    expect(events).toEqual([
      { event: 'booking_request', id: undefined, data: '{"bookingId":"b1"}' },
      { event: 'booking_expired', id: undefined, data: '{"bookingId":"b2"}' },
    ]);
    expect(rest).toBe('event: booking_assigned\ndata: {"bookingId":"b3"');
  });

  test('joins multi-line data and normalizes CRLF', () => {
    const { events } = parseSseEvents(
      'event: booking_request\r\ndata: {"a":1,\r\ndata: "b":2}\r\n\r\n',
    );

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('booking_request');
    expect(events[0].data).toBe('{"a":1,\n"b":2}');
  });

  test('ignores comment-only and data-less blocks', () => {
    const { events } = parseSseEvents(': ping\n\nevent: idle\n\n');
    expect(events).toEqual([]);
  });
});
