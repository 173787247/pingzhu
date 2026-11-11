/**
 * 接续表 —— 「打了某个词之后，下一个词最可能是什么」。
 *
 * 数据来自 `data/bigram.tsv`，由 `tools/build-bigram.mjs` 从语料统计出来。格式是三列：
 *
 *     word<TAB>next<TAB>count
 *
 * 设计上与 `Dictionary` 刻意保持同一种形状（`fromText` / `lookup` / `size`）—— 它们是
 * 同一类东西：一份只读的派生数据。读取文件是调用方的事，这个模块保持纯函数，所以浏览器里
 * 也能跑。
 *
 * **它不参与解码。** 接续是「已经送出一个词之后」的提示，不是候选列的一部分：候选列回答
 * 「这个读音有哪些字」，接续回答「接下来大概会写什么」。混在一起会让候选列在空缓冲区时
 * 也冒出东西来，那不是输入法该有的样子。
 */

export interface Association {
  next: string;
  count: number;
}

export interface AssociationOptions {
  /** 每个词最多保留多少个接续。表再大也要能塞进内存。 */
  maxPerWord?: number;
  /** 频次低于这个值的不收。太小的频次是噪声。 */
  minCount?: number;
}

export class Associations {
  private readonly byWord = new Map<string, Association[]>();
  readonly source: string;

  private constructor(source: string) {
    this.source = source;
  }

  /**
   * 从编译好的 TSV 文本建出来。
   *
   * 与 `Dictionary.fromText` 一样，读文件由调用方负责 —— 这样同一份代码在 Node 与浏览器
   * 里都能用。
   */
  static fromText(text: string, source = "<text>", options: AssociationOptions = {}): Associations {
    const maxPerWord = options.maxPerWord ?? 8;
    const minCount = options.minCount ?? 1;
    const table = new Associations(source);

    for (const line of text.split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const first = line.indexOf("\t");
      const second = line.indexOf("\t", first + 1);
      if (first < 0 || second < 0) continue;
      const word = line.slice(0, first);
      const next = line.slice(first + 1, second);
      const count = Number.parseInt(line.slice(second + 1), 10);
      if (!word || !next || !Number.isFinite(count) || count < minCount) continue;

      let list = table.byWord.get(word);
      if (!list) {
        list = [];
        table.byWord.set(word, list);
      }
      if (list.length >= maxPerWord) continue;
      list.push({ next, count });
    }
    for (const list of table.byWord.values()) list.sort((a, b) => b.count - a.count);
    return table;
  }

  /** 某个词之后最可能的接续词，最好的在前。没有就是空数组。 */
  lookup(word: string): Association[] {
    return this.byWord.get(word) ?? [];
  }

  /** 只知道词，不知道频次时的便捷方法。 */
  suggestions(word: string, limit = 5): string[] {
    return this.lookup(word)
      .slice(0, limit)
      .map((a) => a.next);
  }

  get size(): number {
    let n = 0;
    for (const list of this.byWord.values()) n += list.length;
    return n;
  }

  /** 有多少个词有接续。与 `size` 不同：一个词可以有好几个接续。 */
  get words(): number {
    return this.byWord.size;
  }
}
