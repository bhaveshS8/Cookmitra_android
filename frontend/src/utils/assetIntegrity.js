// Bundled-image integrity helpers.
//
// Metro copies `assets/*` into
// `android/app/build/generated/res/react/<variant>/drawable-*`, where AAPT2
// compiles each file according to its extension. A JPEG stored as `.png` is
// accepted by Metro and by the debug build (which serves images through the
// packager), but fails a release build with:
//
//   AAPT: error: file failed to compile.
//
// Sniffing the bytes at test time keeps that failure out of the release job.

const ascii = (bytes, start, end) => {
  let out = '';
  for (let i = start; i < end && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
};

// Returns 'png' | 'jpeg' | 'webp' | 'gif' | 'unknown' | null.
export const sniffImageFormat = (bytes) => {
  if (!bytes || typeof bytes.length !== 'number' || bytes.length < 8) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  // RIFF....WEBP
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  const gif = ascii(bytes, 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'gif';
  return 'unknown';
};

// The format the file extension claims, or null for a non-image extension.
export const expectedFormatForExtension = (filename) => {
  const match = /\.([a-z0-9]+)$/i.exec(String(filename || '').trim());
  if (!match) return null;
  switch (match[1].toLowerCase()) {
    case 'png':
      return 'png';
    case 'jpg':
    case 'jpeg':
      return 'jpeg';
    case 'webp':
      return 'webp';
    case 'gif':
      return 'gif';
    default:
      return null;
  }
};

// Null when the bytes match the extension (or the extension is not an image),
// otherwise { filename, expected, actual }.
export const imageExtensionMismatch = (filename, bytes) => {
  const expected = expectedFormatForExtension(filename);
  if (!expected) return null;
  const actual = sniffImageFormat(bytes);
  if (actual === expected) return null;
  return { filename: String(filename), expected, actual };
};
