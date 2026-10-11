/**
 * Host protocol v2 (shared with easyinput-beatbox / drumRhythmGame).
 *
 * Device -> Host frames are UTF-8 JSON, one per line, '\n' terminated.
 *   {t:"hello", v:2, name:"EasyInput", caps:[...], appmode:"english"}
 *   {t:"state", ..., appmode:"english"}
 *   {t:"key",   i:0..7, v:1|0}        // S1..S8, v: down/up
 *   {t:"note",  n:36,   v:127}        // live-pad echo (ignored here)
 *
 * Host -> Device frames we send:
 *   {t:"ping"}                         // ask device to re-send hello+state
 *   {t:"led", px:-1, r,g,b, ms}        // light the 5-LED strip
 *   {t:"tts", text:"...", lang:"en-US"}// optional: ask board to speak (if FW supports)
 *
 * We extend appmode with "english" for this project. The firmware must
 * switch to "english" when S1+S8 are held together (see docs/FIRMWARE-INTEGRATION.md).
 * NOTE: S1+S7 stays reserved for the maker appmode (maker-bridge) and is NOT used here.
 */

export const ESPRESSIF_VID = 0x303a;
export const BAUD_RATE = 115200;

/** Physical key indices. S1 = 0 ... S8 = 7. */
export const KEY = {
  S1: 0,
  S2: 1,
  S3: 2,
  S4: 3,
  S5: 4,
  S6: 5,
  S7: 6,
  S8: 7,
};

export const ENGLISH_MODE = "english";

/** Button roles inside the English app (appmode = english). */
export const ROLE = {
  PTT: KEY.S1, // push-to-talk: press to start recording, press again to stop & submit
  OPTION_B: KEY.S2, // listening answer B
  OPTION_C: KEY.S3, // listening answer C
  REPEAT: KEY.S4, // replay current audio
  NEXT: KEY.S5, // next item
  HOME: KEY.S6, // back to home / module menu
  ENTER: KEY.S8, // part of S1+S8 enter combo (toggle english; S1+S7 stays reserved for maker)
};

/**
 * Parse a single device line into a typed message, or null if not a
 * valid protocol line (e.g. bootloader noise, non-'{' lines).
 * @param {string} line
 */
export function parseHostLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const msg = JSON.parse(trimmed);
    if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return null;
    return msg;
  } catch {
    return null;
  }
}
