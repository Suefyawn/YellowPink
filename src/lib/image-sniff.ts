// Identify an image from its first bytes rather than from the type the client
// declared.
//
// The automation uploader used to key off `file.type` alone, so a perfectly
// valid WebP posted with `curl -F "file=@hero.webp"` was rejected with 415:
// curl sends `application/octet-stream` unless the caller appends
// `;type=image/webp` by hand, which is a workaround nobody should have to
// discover (and one that was discovered the hard way on 13 Sep 2026).
//
// Sniffing is also the safer order of trust. A declared content type is
// attacker-controlled; the magic number is the file. Checking the bytes means
// a caller cannot get a non-image stored by labelling it image/png.

export type SniffedImage = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';

const ASCII = (bytes: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...bytes.subarray(start, start + len));

/** The image type the bytes actually are, or null when they are not one of the
 *  four types the store accepts. */
export function sniffImageType(input: ArrayBuffer | Uint8Array): SniffedImage | null {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length < 12) return null;

  // JPEG: SOI marker FF D8 FF.
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';

  // PNG: the 8-byte signature.
  if (b[0] === 0x89 && ASCII(b, 1, 3) === 'PNG' && b[4] === 0x0d
      && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';

  // WebP: RIFF container whose form type is WEBP (bytes 8-11). Checking only
  // "RIFF" would also match WAV and AVI.
  if (ASCII(b, 0, 4) === 'RIFF' && ASCII(b, 8, 4) === 'WEBP') return 'image/webp';

  // AVIF: ISO-BMFF box, 'ftyp' at byte 4, brand at byte 8. Covers the 'avif'
  // still-image brand and the 'avis' sequence brand.
  if (ASCII(b, 4, 4) === 'ftyp') {
    const brand = ASCII(b, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }

  return null;
}

/** Resolve the type to trust for an upload: the bytes first, then the declared
 *  type as a fallback for a format we do not sniff but do accept. Returns null
 *  when neither yields an accepted image type. */
export function resolveImageType(
  bytes: ArrayBuffer | Uint8Array,
  declaredType: string | null | undefined,
  accepted: readonly string[],
): SniffedImage | string | null {
  const sniffed = sniffImageType(bytes);
  if (sniffed) return sniffed;
  const declared = (declaredType ?? '').split(';')[0].trim().toLowerCase();
  return accepted.includes(declared) ? declared : null;
}
