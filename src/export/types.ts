import type { PlatformAchievement } from '../platform'

/** An icon file the caller rasterises: the package names it and sizes it, the game draws it. */
export type IconFile = {
  /** Where the icon goes under the export directory, such as `play/first-win.png`. */
  readonly path: string
  /** The achievement it is for. */
  readonly key: string
  /** Width and height in pixels; icons are square. */
  readonly size: number
  readonly format: 'png' | 'jpeg'
  /** The greyed, not-yet-earned variant (Steam asks for one). */
  readonly locked: boolean
}

/** Generated submission files for one or more consoles. */
export type Submission = {
  /** Text files by path under the export directory. */
  readonly files: Readonly<Record<string, string>>
  readonly icons: readonly IconFile[]
}

export interface ExportOptions {
  /** The locale the definitions' text is written in. Defaults to `en-US`. */
  readonly locale?: string
}

/** Play Games asks for 512 px icons. */
export const PLAY_ICON = 512
/** App Store Connect asks for 1024 px icons. */
export const GAME_CENTER_ICON = 1024
/** Steamworks asks for 256 px icons. */
export const STEAM_ICON = 256

export const DEFAULT_LOCALE = 'en-US'

/** The file name stem an achievement's icons share: its key with anything but `a-z`, `0-9`, `.`, `_` made `-`. */
export const fileStem = (a: PlatformAchievement): string => a.key.replaceAll(/[^a-z0-9._]+/g, '-')
