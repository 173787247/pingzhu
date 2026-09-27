/**
 * The bridge between the keyboard panel and the editor.
 *
 * The panel and the extension run in the same process but are separate ArkUI
 * contexts, so they cannot reach each other's variables. The `InputClient` —
 * the only way to put text into whatever the user is typing in — is handed to
 * the extension on `inputStart`, and the panel is what knows when a key was
 * pressed.
 *
 * This is where they meet. A module-level class, because there is exactly one
 * editor focused at a time and exactly one engine.
 *
 * ## Why this exists at all
 *
 * The first version of the panel called `pingzhu.commit()` and showed the result
 * on itself. The word was decoded, selected, and displayed `（已選：哈）` — and
 * then dropped, because nothing ever called `insertText`. The screenshot showed
 * a working keyboard, a selected candidate, and an empty notepad.
 *
 * The engine and the editor are two different things, and this is the seam.
 */
import { inputMethodEngine } from '@kit.IMEKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const TAG = 'PingZhu';
const DOMAIN = 0x0000;

export class Session {
  private static client: inputMethodEngine.InputClient | null = null;

  /** Called by the extension on inputStart / inputStop. */
  static setClient(client: inputMethodEngine.InputClient | null): void {
    Session.client = client;
    hilog.info(DOMAIN, TAG, client === null ? '編輯器離開' : '編輯器就緒');
  }

  static hasClient(): boolean {
    return Session.client !== null;
  }

  /**
   * Puts text into the focused editor.
   *
   * Returns whether it went. A false here is worth showing: text that is
   * decoded and then dropped looks exactly like text that was never typed.
   */
  static insertText(text: string): boolean {
    if (text.length === 0) return false;
    if (Session.client === null) {
      hilog.warn(DOMAIN, TAG, '沒有編輯器，%{public}d 個字沒有送出去', text.length);
      return false;
    }
    try {
      Session.client.insertTextSync(text);
      hilog.info(DOMAIN, TAG, '送出 %{public}d 個字', text.length);
      return true;
    } catch (error) {
      hilog.error(DOMAIN, TAG, '送出失敗：%{public}s', JSON.stringify(error));
      return false;
    }
  }

  /** Deletes one character backwards — the editor's, not ours. */
  static deleteBackward(): boolean {
    if (Session.client === null) return false;
    try {
      Session.client.deleteBackwardSync(1);
      return true;
    } catch (error) {
      hilog.error(DOMAIN, TAG, '退格失敗：%{public}s', JSON.stringify(error));
      return false;
    }
  }
}
