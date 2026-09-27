/**
 * 平注輸入法 —— HarmonyOS 的 InputMethodExtensionAbility。
 *
 * 這一層做三件事：
 *   1. 建立鍵盤面板視窗（createPanel）並把 UI 載進去（setUiContent）
 *   2. 跟輸入法框架連線，拿到可以送字的 InputClient
 *   3. 把語言模型從 HAP 解出來給引擎
 *
 * **解碼不在這裡**——它在共用的 Rust 核心裡（core-rs/），透過 NAPI 進來。
 *
 * ## 面板是怎麼來的
 *
 * 第一版**根本沒有建立面板**，所以啟用之後螢幕上什麼都沒有。
 * 輸入法不是一個普通的 App：它不會自己開視窗，要跟系統要一個面板。
 * 形狀是從華為自己的 KikaInput 範例學來的：
 *
 *   inputMethodAbility.createPanel(context, panelInfo)
 *     .then(panel => panel.resize(w, h))
 *     .then(() => panel.moveTo(0, y))
 *     .then(() => panel.setUiContent('InputMethodExtensionAbility/pages/Index'))
 *
 * import 用 Kit 風格（@kit.IMEKit）。舊的 @ohos.inputMethod.* 在
 * API 12 的 SDK 裡找不到模組——第一次建置就是這樣失敗的。
 *
 * 而 InputClient 的介面是問 SDK 得到的，不是猜的：
 *   insertText(text): Promise<boolean> / insertTextSync(text): void
 *   deleteBackwardSync(length): void
 *   on('inputStart', (kbController, inputClient) => void)
 */
import { InputMethodExtensionAbility, inputMethodEngine } from '@kit.IMEKit';
import { Want } from '@kit.AbilityKit';
import { display } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { fileIo } from '@kit.CoreFileKit';
import pingzhu from 'libpingzhu.so';

const TAG = 'PingZhu';
const DOMAIN = 0x0000;

/** The model files that ship inside the HAP, and where they go at runtime. */
const MODEL_FILES: string[] = ['bopomofo-lm.tsv', 'ts-conversion.tsv'];

/** How much of the screen the keyboard takes. */
const KEYBOARD_HEIGHT_RATE = 0.42;

export default class PingZhuInputMethodExtensionAbility extends InputMethodExtensionAbility {
  /** Where text goes. Null whenever no editor is focused. */
  private client: inputMethodEngine.InputClient | null = null;

  /** The keyboard panel. Null until onCreate has run. */
  private panel: inputMethodEngine.Panel | null = null;

  private ability: inputMethodEngine.InputMethodAbility | null = null;

  // One parameter, not two.
  //
  // InputMethodExtensionAbility.onCreate takes (want: Want); UIAbility takes
  // (want, launchParam). Copying the UIAbility shape is a compile error, which
  // is how this was found.
  onCreate(want: Want): void {
    hilog.info(DOMAIN, TAG, '輸入法 Extension 建立');
    this.ability = inputMethodEngine.getInputMethodAbility();
    this.createKeyboardPanel();
    this.registerListener();
  }

  onDestroy(): void {
    hilog.info(DOMAIN, TAG, '輸入法 Extension 結束');
    if (this.panel !== null && this.ability !== null) {
      this.ability.destroyPanel(this.panel);
      this.panel = null;
    }
    this.client = null;
  }

  /**
   * Asks the system for a keyboard panel and puts the UI in it.
   *
   * An input method does not open a window of its own — it asks for a panel.
   * Without this the extension starts, reports no error, and nothing appears on
   * screen, which is exactly what happened the first time this ran on a phone.
   */
  private createKeyboardPanel(): void {
    if (this.ability === null) return;
    try {
      const screen = display.getDefaultDisplaySync();
      const width = screen.width;
      const height = Math.round(screen.height * KEYBOARD_HEIGHT_RATE);
      const top = screen.height - height;

      const panelInfo: inputMethodEngine.PanelInfo = {
        type: inputMethodEngine.PanelType.SOFT_KEYBOARD,
        flag: inputMethodEngine.PanelFlag.FLG_FIXED
      };

      this.ability.createPanel(this.context, panelInfo).then((panel: inputMethodEngine.Panel) => {
        this.panel = panel;
        panel.resize(width, height)
          .then(() => panel.moveTo(0, top))
          .then(() => panel.setUiContent('InputMethodExtensionAbility/pages/Index'))
          .then(() => {
            hilog.info(DOMAIN, TAG, '鍵盤面板就緒 %{public}dx%{public}d', width, height);
          })
          .catch((error: Error) => {
            hilog.error(DOMAIN, TAG, '面板設定失敗：%{public}s', JSON.stringify(error));
          });
      }).catch((error: Error) => {
        // Not swallowed: an input method with no panel is invisible, and
        // "invisible" is indistinguishable from "not installed" without a log.
        hilog.error(DOMAIN, TAG, 'createPanel 失敗：%{public}s', JSON.stringify(error));
      });
    } catch (error) {
      hilog.error(DOMAIN, TAG, '建立面板擲出例外：%{public}s', JSON.stringify(error));
    }
  }

  private registerListener(): void {
    if (this.ability === null) return;

    // The editor comes and goes; the keyboard stays. `inputStart` is the only
    // moment a client exists, and holding one after `inputStop` means writing
    // into something that is gone.
    this.ability.on('inputStart', (kbController: inputMethodEngine.KeyboardController,
                                   textInputClient: inputMethodEngine.InputClient) => {
      this.client = textInputClient;
      hilog.info(DOMAIN, TAG, '編輯器連上了');
      this.prepareEngine();
    });

    this.ability.on('inputStop', () => {
      this.client = null;
      hilog.info(DOMAIN, TAG, '編輯器斷開了');
    });
  }

  /**
   * Unpacks the language model and hands it to the engine.
   *
   * The native side cannot read the HAP, so the files are copied out once and
   * the path is passed in. A failure here is reported rather than swallowed: an
   * input method with no dictionary types nothing, and looks identical to one
   * that is working, until someone tries.
   */
  private prepareEngine(): void {
    // Every step reports itself.
    //
    // The first version wrapped all of this in one try/catch that logged
    // `{"code":13900015}` — which is `fileIo`'s "File exists", from an
    // unguarded `mkdirSync` on the second run. The whole block aborted, the
    // model was never written, `create()` never ran, and the keyboard appeared
    // on screen and threw `feedKey() before create()` on every key.
    //
    // One error code and no idea which line. Hence the step names.
    let step = 'start';
    try {
      const dir: string = `${this.context.filesDir}/model`;

      step = 'mkdir';
      if (!fileIo.accessSync(dir)) {
        // mkdirSync throws 13900015 when the directory is already there, and
        // `recursion` does not change that. Guarding is the only safe form.
        fileIo.mkdirSync(dir, true);
      }

      for (const name of MODEL_FILES) {
        const target: string = `${dir}/${name}`;

        step = `access ${name}`;
        if (fileIo.accessSync(target)) continue;

        step = `read rawfile ${name}`;
        const bytes: Uint8Array = this.context.resourceManager.getRawFileContentSync(name);

        step = `write ${name}`;
        const file = fileIo.openSync(target, fileIo.OpenMode.CREATE |
                                             fileIo.OpenMode.READ_WRITE |
                                             fileIo.OpenMode.TRUNC);
        try {
          fileIo.writeSync(file.fd, bytes.buffer as ArrayBuffer);
        } finally {
          fileIo.closeSync(file);
        }
        hilog.info(DOMAIN, TAG, '%{public}s 已解出：%{public}d bytes', name, bytes.byteLength);
      }

      step = 'engine create';
      const ok: boolean = pingzhu.create(dir);
      if (ok) {
        hilog.info(DOMAIN, TAG, '引擎載入完成，ABI %{public}d', pingzhu.abiVersion);
        hilog.info(DOMAIN, TAG, '鍵面：%{public}s', pingzhu.keyboardRows('standard'));
      } else {
        hilog.error(DOMAIN, TAG, '引擎讀不到模型：%{public}s', dir);
      }
    } catch (error) {
      // Which step, not just which code.
      hilog.error(DOMAIN, TAG, '解模型失敗於「%{public}s」：%{public}s',
        step, JSON.stringify(error));
    }
  }

  /**
   * Commits the current sentence into the editor.
   *
   * Returns the text so the panel can show what happened. An empty string means
   * there was nothing to commit — not that something failed, which is why the
   * client case is logged separately.
   */
  commitText(): string {
    const text: string = pingzhu.commit();
    if (text.length === 0) return text;
    if (this.client === null) {
      hilog.warn(DOMAIN, TAG, '沒有編輯器，%{public}d 個字沒有送出去', text.length);
      return text;
    }
    try {
      this.client.insertTextSync(text);
    } catch (error) {
      hilog.error(DOMAIN, TAG, '送出失敗：%{public}s', JSON.stringify(error));
    }
    return text;
  }

  /** Deletes one character backwards — the editor's, not ours. */
  deleteBackward(): void {
    if (this.client === null) return;
    try {
      this.client.deleteBackwardSync(1);
    } catch (error) {
      hilog.error(DOMAIN, TAG, '退格失敗：%{public}s', JSON.stringify(error));
    }
  }
}
