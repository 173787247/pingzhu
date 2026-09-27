/**
 * 平注输入法 —— HarmonyOS 的 InputMethodExtensionAbility。
 *
 * 这一层做两件事：跟输入法框架连线（拿到可以送字的 InputClient），
 * 以及把语言模型从 HAP 解出来给引擎。**解码不在这里**——
 * 它在共用的 Rust 核心里（core-rs/），透过 NAPI 进来。
 *
 * import 用 Kit 风格（@kit.IMEKit），不是旧的 @ohos.inputMethod.*。
 * 旧写法在 API 12 的 SDK 里找不到模组——第一次建置就是这样失败的。
 *
 * 而 InputClient 的介面是**问 SDK 得到的**，不是猜的：
 *   insertText(text): Promise<boolean>
 *   insertTextSync(text): void
 *   deleteBackwardSync(length): void
 *   on('inputStart', (kbController, inputClient) => void)
 */
import { InputMethodExtensionAbility, inputMethodEngine } from '@kit.IMEKit';
import { Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { fileIo } from '@kit.CoreFileKit';
import pingzhu from 'libpingzhu.so';

const TAG = 'PingZhu';
const DOMAIN = 0x0000;

/** The model files that ship inside the HAP, and where they go at runtime. */
const MODEL_FILES: string[] = ['bopomofo-lm.tsv', 'ts-conversion.tsv'];

export default class PingZhuInputMethodExtensionAbility extends InputMethodExtensionAbility {
  /** Where text goes. Null whenever no editor is focused. */
  private client: inputMethodEngine.InputClient | null = null;

  // One parameter, not two.
  //
  // InputMethodExtensionAbility.onCreate takes (want: Want); UIAbility takes
  // (want, launchParam). Copying the UIAbility shape produces a compile error,
  // which is how this was found.
  onCreate(want: Want): void {
    hilog.info(DOMAIN, TAG, '输入法 Extension 建立');

    const ability = inputMethodEngine.getInputMethodAbility();

    // The editor comes and goes; the keyboard stays. `inputStart` is the only
    // moment a client exists, and holding one after `inputStop` means writing
    // into something that is gone.
    ability.on('inputStart', (kbController: inputMethodEngine.KeyboardController,
                              textInputClient: inputMethodEngine.InputClient) => {
      this.client = textInputClient;
      hilog.info(DOMAIN, TAG, '编辑器连上了');
      this.prepareEngine();
    });

    ability.on('inputStop', () => {
      this.client = null;
      hilog.info(DOMAIN, TAG, '编辑器断开了');
    });
  }

  onDestroy(): void {
    hilog.info(DOMAIN, TAG, '输入法 Extension 结束');
    this.client = null;
  }

  /**
   * Unpacks the language model and hands it to the engine.
   *
   * The native side cannot read the HAP, so the files are copied out once and
   * the path is passed in. A failure here is reported rather than swallowed:
   * an input method with no dictionary types nothing, and looks identical to
   * one that is working, until someone tries.
   */
  private prepareEngine(): void {
    try {
      const dir: string = `${this.context.filesDir}/model`;
      fileIo.mkdirSync(dir, true);

      for (const name of MODEL_FILES) {
        const target: string = `${dir}/${name}`;
        if (fileIo.accessSync(target)) continue;   // already unpacked
        const bytes: Uint8Array = this.context.resourceManager.getRawFileContentSync(name);
        const file = fileIo.openSync(target, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE);
        try {
          fileIo.writeSync(file.fd, bytes.buffer as ArrayBuffer);
        } finally {
          fileIo.closeSync(file);
        }
      }

      const ok: boolean = pingzhu.create(dir);
      if (ok) {
        hilog.info(DOMAIN, TAG, '引擎载入完成，ABI %{public}d', pingzhu.abiVersion);
      } else {
        hilog.error(DOMAIN, TAG, '引擎读不到模型：%{public}s', dir);
      }
    } catch (error) {
      hilog.error(DOMAIN, TAG, '解模型失败：%{public}s', JSON.stringify(error));
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
      hilog.warn(DOMAIN, TAG, '没有编辑器，%{public}d 个字没有送出去', text.length);
      return text;
    }
    try {
      this.client.insertTextSync(text);
    } catch (error) {
      hilog.error(DOMAIN, TAG, '送出失败：%{public}s', JSON.stringify(error));
    }
    return text;
  }

  /** Deletes one character backwards — the editor's, not ours. */
  deleteBackward(): void {
    if (this.client === null) return;
    try {
      this.client.deleteBackwardSync(1);
    } catch (error) {
      hilog.error(DOMAIN, TAG, '退格失败：%{public}s', JSON.stringify(error));
    }
  }
}
