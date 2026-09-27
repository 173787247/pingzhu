/**
 * 鍵盤頁面。
 *
 * 這是 setUiContent 載入的那一頁——整個輸入法面板的入口。
 *
 * 它自己幾乎什麼都不做：把 KeyboardPanel 放進一個填滿的容器裡。
 * 鍵面在 KeyboardPanel 裡，而鍵面本身是向引擎要的。
 */
import { KeyboardPanel } from '../../components/Keyboard';

@Entry
@Component
struct Index {
  build() {
    Column() {
      KeyboardPanel()
    }
    .width('100%')
    .height('100%')
  }
}
