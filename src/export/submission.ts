/**
 * The platforms' submission files, generated from the achievement list, so nothing is configured by
 * hand in a console and nothing drifts from the code. Pure: the functions return text files and the
 * list of icons to draw; writing files and rasterising icons is the caller's job.
 *
 * - Play Console: the bulk-import CSVs and icons (`playConsoleSubmission`, zipped by `playConsoleZip`).
 * - App Store Connect: `app-store-connect.json` and icons (`appStoreConnectSubmission`).
 * - Steamworks: `steamworks.json` and icons (`steamworksSubmission`). Steam has no bulk import.
 *
 * Text comes from the definitions, so a translation is another call with the translated list and
 * its `locale`.
 */
import type { PlatformAchievement } from '../platform.js'
import { appStoreConnectSubmission } from './app-store-connect.js'
import { playConsoleSubmission } from './play.js'
import { steamworksSubmission } from './steamworks.js'
import type { ExportOptions, Submission } from './types.js'

/** All three consoles' submissions in one. */
export function submission(
  achievements: readonly PlatformAchievement[],
  options: ExportOptions = {},
): Submission {
  const parts = [
    playConsoleSubmission(achievements, options),
    appStoreConnectSubmission(achievements, options),
    steamworksSubmission(achievements),
  ]
  return {
    files: Object.assign({}, ...parts.map((p) => p.files)),
    icons: parts.flatMap((p) => p.icons),
  }
}
