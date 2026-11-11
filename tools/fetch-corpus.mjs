#!/usr/bin/env node
/**
 * 采集 gov.cn 政策文件正文，存成纯文本语料。
 *
 * 为什么要这个脚本：政府的政策文件库是一个 Vue 单页应用，正文由 JS 注入 —— WSL 里
 * `curl` 拿到的 HTML 只有页面骨架。所以每一篇都要经过一次真实渲染（obscura）。
 *
 * 通道也不直：WSL 的默认路由走 VPN 隧道，境外出口到不了 gov.cn。必须指定 `eth2`
 * （家里的路由器）才有 200。这个细节写死在 fetchList() 里，理由写在下面。
 *
 * 语料授权见 docs/12-corpus-sources.md（政府資料開放授權條款 第 1 版）。
 *
 * 用法：
 *   node tools/fetch-corpus.mjs --limit 5            # 采 5 篇，干跑不写盘
 *   node tools/fetch-corpus.mjs --limit 5 --write    # 真的写进 data/corpus/
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CORPUS = join(ROOT, "data", "corpus");

/** obscura 在 Windows 上，路径固定。它负责执行 JS，curl 做不到。 */
const OBSCURA = "/mnt/c/Users/rchua/Desktop/AIFullStackDevelopment/obscura/target/release/obscura.exe";

/** 走家里路由器那条网卡。VPN 的出口到不了 gov.cn，见文件头。 */
const IFACE = "eth2";

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf("--limit") + 1]) || 5;
const write = args.includes("--write");

/**
 * 政策文件列表页。这些页面是静态的，curl 就能取。
 *
 * 两个入口加起来约 19 篇。gov.cn 的列表页不翻页（`index_1.htm` 是 404），所以要更多
 * 语料得另找入口 —— 那是后面的事，先把这 19 篇采完，看统计能不能稳住。
 */
const LISTS = [
  "https://www.gov.cn/zhengce/xxgk/",
  "https://www.gov.cn/zhengce/",
];

function curl(url) {
  return execFileSync(
    "curl",
    ["-s", "--interface", IFACE, "--noproxy", "*", "-H", "User-Agent: Mozilla/5.0", url],
    { encoding: "utf8", timeout: 60000, maxBuffer: 32 * 1024 * 1024 },
  );
}

/** 从列表页取出政策文章的相对/绝对 URL，保持页面顺序。 */
function articleUrls(html) {
  const urls = new Set();
  const re = /href="([^"]*\/zhengce\/content\/\d{6}\/content_\d+\.htm)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    let u = m[1];
    if (u.startsWith("./")) u = `https://www.gov.cn/zhengce/${u.slice(2)}`;
    else if (u.startsWith("/")) u = `https://www.gov.cn${u}`;
    urls.add(u);
  }
  return [...urls];
}

/** 用 obscura 渲染一篇，返回纯文本。 */
function render(url) {
  const out = execFileSync(OBSCURA, ["--stealth", "fetch", url, "--dump", "text", "--timeout", "45"], {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return out;
}

/**
 * 从渲染结果里切出正文。
 *
 * gov.cn 的正文在两段「链接：」之间 —— 上面是标题与正文，下面是站点导航。这是从几篇
 * 样本里确认的结构，比按 `<div class>` 抽更稳（那个类名各页不一致）。
 */
function bodyText(rendered) {
  const lines = rendered.split("\n").map((l) => l.trim());
  const start = lines.findIndex((l) => /^首页\s*>/.test(l));
  const end = lines.findLastIndex ? lines.findLastIndex((l) => l === "链接：") : -1;
  const slice = lines.slice(start > 0 ? start + 1 : 0, end > start ? end : lines.length);
  return slice
    .filter((l) => l && !/^(字号：|打印|收藏|\||扫一扫|相关稿件|国务院客户端|电脑版|客户端|小程序|微博|微信|邮箱|退出|注册|登录|网站纠错)/.test(l))
    .join("\n");
}

const seen = new Set();
for (const list of LISTS) {
  for (const url of articleUrls(curl(list))) seen.add(url);
}
const urls = [...seen].slice(0, limit);
console.log(`列表页 ${LISTS.length} 个，去重后 ${seen.size} 篇候选（上限 ${limit}）\n`);

if (write) {
  mkdirSync(CORPUS, { recursive: true });
  const sourcesPath = join(CORPUS, "SOURCES.md");
  if (!existsSync(sourcesPath)) {
    writeFileSync(
      sourcesPath,
      `# 语料来源\n\n依「政府資料開放授權條款－第 1 版」利用，见 docs/12-corpus-sources.md。\n\n| 文件 | 标题 | URL | 采集时间 |\n|---|---|---|---|\n`,
    );
  }
}

let ok = 0;
for (const [i, url] of urls.entries()) {
  process.stdout.write(`  [${i + 1}/${urls.length}] ${url}\n`);
  let rendered;
  try {
    rendered = render(url);
  } catch (error) {
    console.log(`      ✗ 渲染失败：${String(error.message).slice(0, 80)}`);
    continue;
  }
  const text = bodyText(rendered);
  const chars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  if (chars < 200) {
    console.log(`      ✗ 正文只有 ${chars} 个汉字，跳过`);
    continue;
  }
  const title =
    (rendered.match(/标　　题：\s*(.+)/) || [])[1] ||
    (rendered.match(/^\s*(\S[^\n]{4,60})\s*$/m) || [])[1] ||
    url.split("/").pop();
  const id = url.split("/").pop().replace(/\.htm$/, "");
  console.log(`      ✓ ${chars} 汉字  ${String(title).slice(0, 40)}`);
  ok += 1;
  if (write) {
    const path = join(CORPUS, `govcn-${id}.txt`);
    writeFileSync(path, `# ${title}\n# 来源：${url}\n# 授权：政府資料開放授權條款 第 1 版\n\n${text}\n`);
    appendFileSync(
      join(CORPUS, "SOURCES.md"),
      `| govcn-${id}.txt | ${String(title).replace(/\|/g, "\\|")} | ${url} | ${new Date().toISOString().slice(0, 10)} |\n`,
    );
  }
}

console.log(`\n  ${ok}/${urls.length} 篇可用${write ? `，已写入 ${CORPUS}` : "（干跑，未写盘）"}`);
if (!write) console.log("  加 --write 才会写盘。");
