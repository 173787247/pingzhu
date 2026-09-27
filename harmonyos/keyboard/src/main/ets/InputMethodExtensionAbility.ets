/**
 * 平注輸入法 —— HarmonyOS 的 InputMethodExtensionAbility。
 *
 * 這一層只做「鴻蒙要求一個 ExtensionAbility」這件事：面板的生命週期、
 * 跟輸入法框架的連線。**解碼不在這裡。**
 *
 * 跟 Windows、Android、macOS 一樣，選字邏輯在共用的 Rust 核心裡
 * （core-rs/），透過 NAPI 進來。這一版還沒有接上——所以現在的鍵盤
 * 打得出來、但選字是空的。**這一句寫在這裡而不是藏起來。**
 *
 * import 用 Kit 風格（@kit.IMEKit），不是舊的 @ohos.inputMethod.*。
 * 舊寫法在 API 12 的 SDK 裡找不到模組——第一次建置就是這樣失敗的。
 */
import { InputMethodExtensionAbility } from '@kit.IMEKit';
import { Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const TAG = 'PingZhu';
const DOMAIN = 0x0000;

export default class PingZhuInputMethodExtensionAbility extends InputMethodExtensionAbility {
  // One parameter, not two.
  //
  // InputMethodExtensionAbility.onCreate takes (want: Want). UIAbility takes
  // (want, launchParam). Copying the UIAbility shape produces:
  //
  //   Type '(want: any, launchParam: any) => void' is not assignable to
  //   type '(want: Want) => void'
  //
  // ESObject is what I reached for first, and ArkTS only warns about it while
  // the signature mismatch is a hard error. The compiler was right about both.
  onCreate(want: Want): void {
    hilog.info(DOMAIN, TAG, '輸入法 Extension 建立');
  }

  onDestroy(): void {
    hilog.info(DOMAIN, TAG, '輸入法 Extension 結束');
  }
}
