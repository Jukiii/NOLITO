// Markdown → HTML。記事は運営者が書くが、将来は管理画面(Phase 26)などからも書かれる前提で、安全側に倒す。
//   - 本文の生の HTML は、実行せず文字としてエスケープする
//   - 危険なリンク(javascript: など)は、黙って捨てず、ビルドを失敗させる(書いた人が気づけるように)
//   - 画像には代替テキスト(alt)を必須にする。画像の場所は、サイト内か https のみ
//   - 本文の見出し1(#)は使えない(題名は先頭情報の title。ページの h1 は1つにする)
import { Marked } from "marked";
import { escapeHtml } from "./html.mjs";

/**
 * リンク・画像の URL を分類する。
 *   anchor(#見出し)/ internal(サイト内・相対)/ external(他のサイト)/ mail / unsafe
 * new URL は、間に入れた改行やタブ("java\nscript:")も取り除いてから解釈する。同じ解釈で判定する。
 */
export function classifyUrl(href, siteHost = "") {
  const value = String(href).trim();
  if (value === "") return "unsafe";
  if (value.startsWith("#")) return "anchor";
  if (value.startsWith("//")) return "unsafe"; // 「//host/...」は、どの通信方式か曖昧
  let url;
  try {
    url = new URL(value);
  } catch {
    return "internal"; // 通信方式がない = サイト内の相対パス(/articles/ や ./a など)
  }
  if (url.protocol === "mailto:") return "mail";
  if (url.protocol === "http:" || url.protocol === "https:") {
    return url.hostname === siteHost ? "internal" : "external";
  }
  return "unsafe";
}

// 画像の場所は、サイト内か https だけ(http や data: は不可)
function isAllowedImageSource(src, siteHost) {
  const kind = classifyUrl(src, siteHost);
  if (kind === "internal") return true;
  return kind === "external" && new URL(src.trim()).protocol === "https:";
}

export function createMarkdownRenderer({ siteHost = "" } = {}) {
  return new Marked({
    gfm: true,
    breaks: false,
    renderer: {
      html(token) {
        const escaped = escapeHtml(token.text);
        return token.block ? `<p>${escaped}</p>\n` : escaped;
      },
      heading(token) {
        if (token.depth === 1) {
          throw new Error(
            `本文に見出し1(#)は使えません(題名は先頭情報の title に書き、本文は ## から始めてください): "${token.text}"`,
          );
        }
        return `<h${token.depth}>${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
      },
      link(token) {
        const kind = classifyUrl(token.href, siteHost);
        if (kind === "unsafe") {
          throw new Error(`使えないリンクです(http・https・mailto・サイト内のみ): "${token.href}"`);
        }
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        const rel = kind === "external" ? ' rel="noopener noreferrer"' : "";
        return `<a href="${escapeHtml(token.href.trim())}"${title}${rel}>${this.parser.parseInline(token.tokens)}</a>`;
      },
      image(token) {
        if (!token.text.trim()) {
          throw new Error(`画像には代替テキスト(alt)が必要です: ![代替テキスト](${token.href})`);
        }
        if (!isAllowedImageSource(token.href, siteHost)) {
          throw new Error(`使えない画像の場所です(サイト内か https のみ): "${token.href}"`);
        }
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        return `<img src="${escapeHtml(token.href.trim())}" alt="${escapeHtml(token.text)}"${title} loading="lazy" decoding="async">`;
      },
    },
  });
}

export function renderMarkdown(body, options) {
  return createMarkdownRenderer(options).parse(body, { async: false });
}
