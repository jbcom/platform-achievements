import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { crc32, createZip, playConsoleZip } from '../src/export'

/** Read a ZIP back through its central directory, the way an importer does. */
function readZip(bytes: Uint8Array): Map<string, { data: Buffer; crc: number }> {
  const buffer = Buffer.from(bytes)
  const end = buffer.length - 22
  expect(buffer.readUInt32LE(end)).toBe(0x06054b50)
  const count = buffer.readUInt16LE(end + 10)
  let at = buffer.readUInt32LE(end + 16)
  const entries = new Map<string, { data: Buffer; crc: number }>()
  for (let i = 0; i < count; i++) {
    expect(buffer.readUInt32LE(at)).toBe(0x02014b50)
    const method = buffer.readUInt16LE(at + 10)
    const crc = buffer.readUInt32LE(at + 16)
    const size = buffer.readUInt32LE(at + 20)
    const nameLength = buffer.readUInt16LE(at + 28)
    const local = buffer.readUInt32LE(at + 42)
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength)
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    const raw = buffer.subarray(start, start + size)
    entries.set(name, { data: method === 8 ? inflateRawSync(raw) : raw, crc })
    at += 46 + nameLength
  }
  return entries
}

describe('crc32', () => {
  it('matches the standard check values', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('createZip', () => {
  it('stores text and bytes under their names, with correct checksums', () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 255])
    const zip = readZip(createZip({ 'a.csv': 'x,y\n', 'icon.png': png, 'naïve.txt': 'ünï' }))
    expect([...zip.keys()]).toEqual(['a.csv', 'icon.png', 'naïve.txt'])
    expect(zip.get('a.csv')?.data.toString()).toBe('x,y\n')
    expect([...(zip.get('icon.png')?.data ?? [])]).toEqual([...png])
    expect(zip.get('naïve.txt')?.data.toString()).toBe('ünï')
    for (const { data, crc } of zip.values()) expect(crc32(data)).toBe(crc)
  })

  it('is byte-for-byte deterministic', () => {
    const entries = { 'a.csv': 'one', 'b.csv': 'two' }
    expect(Buffer.from(createZip(entries)).equals(Buffer.from(createZip(entries)))).toBe(true)
  })

  it('writes an empty archive that is still valid', () => {
    expect(readZip(createZip({})).size).toBe(0)
  })

  it('is accepted by the system unzip when one is installed', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'zip-test-'))
    try {
      const file = path.join(dir, 'out.zip')
      writeFileSync(file, createZip({ 'one.txt': 'hello', 'two.txt': 'world' }))
      let output: string
      try {
        output = execFileSync('unzip', ['-t', file], { encoding: 'utf8' })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
      }
      expect(output).toMatch(/No errors detected/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('playConsoleZip', () => {
  it('keeps only the Play files and zips them flat', () => {
    const zip = readZip(
      playConsoleZip({
        'play/AchievementsMetadata.csv': 'a',
        'play/first-win.png': Uint8Array.from([1, 2, 3]),
        'steamworks/steamworks.json': '{}',
        'app-store-connect/first-win.png': Uint8Array.from([4]),
      }),
    )
    expect([...zip.keys()]).toEqual(['AchievementsMetadata.csv', 'first-win.png'])
  })
})
