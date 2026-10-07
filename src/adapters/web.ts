/**
 * The web build's achievements service: there is no platform profile in a browser, so nothing is ever
 * signed in and nothing is sent. The player's achievements stay outstanding for whichever platform
 * they sign in to later.
 */
import type { PlatformAchievements } from '../platform.js'

export const webAchievements: PlatformAchievements = {
  platform: null,
  reportsProgress: false,
  signedIn: async () => false,
  knows: () => false,
  unlock: async (a) => {
    throw new Error(`no achievements service on the web (${a.key})`)
  },
  setProgress: async (a) => {
    throw new Error(`no achievements service on the web (${a.key})`)
  },
  show: async () => {},
}
