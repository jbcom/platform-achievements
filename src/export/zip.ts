/**
 * A minimal, dependency-free ZIP writer (stored entries, no compression), enough for the Play Console's
 * bulk-import archive. Output is byte-for-byte deterministic: the same entries in the same order always
 * give the same bytes, because every entry carries the same fixed timestamp.
 */

export type ZipEntries = Readonly<Record<string, string | Uint8Array>>

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** The CRC-32 (IEEE) of `bytes`, as an unsigned integer. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** 1980-01-01 00:00:00, the earliest time a ZIP can hold. */
const DOS_TIME = 0
const DOS_DATE = 0x0021
/** General purpose flag bit 11: entry names are UTF-8. */
const UTF8_NAMES = 0x0800

/**
 * Zip `entries` (path to text or bytes) in insertion order.
 *
 * @throws RangeError when an entry is 4 GiB or larger or there are 65,535 entries or more (the plain ZIP limits).
 */
export function createZip(entries: ZipEntries): Uint8Array {
  const encoder = new TextEncoder()
  const names = Object.keys(entries)
  if (names.length >= 0xffff) throw new RangeError('too many zip entries')

  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  const header = (size: number): { view: DataView; bytes: Uint8Array } => {
    const bytes = new Uint8Array(size)
    return { view: new DataView(bytes.buffer), bytes }
  }

  for (const name of names) {
    const raw = entries[name] as string | Uint8Array
    const data = typeof raw === 'string' ? encoder.encode(raw) : raw
    if (data.length >= 0xffffffff) throw new RangeError(`${name} is too large to zip`)
    const nameBytes = encoder.encode(name)
    const crc = crc32(data)

    const local = header(30)
    local.view.setUint32(0, 0x04034b50, true)
    local.view.setUint16(4, 20, true)
    local.view.setUint16(6, UTF8_NAMES, true)
    local.view.setUint16(8, 0, true)
    local.view.setUint16(10, DOS_TIME, true)
    local.view.setUint16(12, DOS_DATE, true)
    local.view.setUint32(14, crc, true)
    local.view.setUint32(18, data.length, true)
    local.view.setUint32(22, data.length, true)
    local.view.setUint16(26, nameBytes.length, true)
    local.view.setUint16(28, 0, true)
    chunks.push(local.bytes, nameBytes, data)

    const entry = header(46)
    entry.view.setUint32(0, 0x02014b50, true)
    entry.view.setUint16(4, 20, true)
    entry.view.setUint16(6, 20, true)
    entry.view.setUint16(8, UTF8_NAMES, true)
    entry.view.setUint16(10, 0, true)
    entry.view.setUint16(12, DOS_TIME, true)
    entry.view.setUint16(14, DOS_DATE, true)
    entry.view.setUint32(16, crc, true)
    entry.view.setUint32(20, data.length, true)
    entry.view.setUint32(24, data.length, true)
    entry.view.setUint16(28, nameBytes.length, true)
    entry.view.setUint32(42, offset, true)
    central.push(entry.bytes, nameBytes)

    offset += local.bytes.length + nameBytes.length + data.length
  }

  const centralSize = central.reduce((sum, c) => sum + c.length, 0)
  const end = header(22)
  end.view.setUint32(0, 0x06054b50, true)
  end.view.setUint16(8, names.length, true)
  end.view.setUint16(10, names.length, true)
  end.view.setUint32(12, centralSize, true)
  end.view.setUint32(16, offset, true)

  const parts = [...chunks, ...central, end.bytes]
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/**
 * The Play Console's import archive: the entries under `play/` (the CSVs and the icons), zipped flat,
 * because the console wants no subdirectories.
 *
 * @param files Every generated file by its submission path: the text from a `Submission`, plus the
 *   rasterised icons keyed by `IconFile.path`.
 */
export function playConsoleZip(files: ZipEntries): Uint8Array {
  const flat: Record<string, string | Uint8Array> = {}
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith('play/')) flat[path.slice('play/'.length)] = content
  }
  return createZip(flat)
}
