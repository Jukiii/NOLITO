// 折れ線グラフ(成長グラフ)。座標の計算は DOM に依存しない純粋な関数、描画はその下の renderLineChart。
// ライブラリは使わない。マークの仕様: 線 2px・丸い端、点 8px 以上(周りに 2px の背景色の縁)、
// グリッドは実線のヘアライン。全点に数値は付けず、最新値と最高値だけをラベルにする。
import { el } from "../../components/dom.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}, ...children) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  node.append(...children);
  return node;
};

// ---- 純粋な計算 ----

// 範囲 [min, max] を含む、きりのよい目盛り(1・2・5 × 10のべき)。target は目盛りの数の目安。
export function niceTicks(min, max, target = 4) {
  let lo = min;
  let hi = max;
  if (!(hi > lo)) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  // 1・2・5 × 10のべき の刻み幅のうち、区間の数が target に最も近いものを選ぶ(同じなら大きい刻み)
  const exponent = Math.floor(Math.log10((hi - lo) / target));
  let step = 0;
  let bestDistance = Infinity;
  for (let e = exponent - 1; e <= exponent + 1; e++) {
    for (const multiple of [1, 2, 5]) {
      const candidate = multiple * 10 ** e;
      const intervals = Math.ceil(hi / candidate) - Math.floor(lo / candidate);
      const distance = Math.abs(intervals - target);
      if (distance < bestDistance || (distance === bestDistance && candidate > step)) {
        step = candidate;
        bestDistance = distance;
      }
    }
  }
  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let i = 0; niceMin + i * step <= niceMax + step / 2; i++) {
    ticks.push(Number((niceMin + i * step).toFixed(10)));
  }
  return { min: niceMin, max: niceMax, step, ticks };
}

/**
 * 縦軸の範囲。データの最小・最大に少し余白を足して、きりのよい値に広げる。
 * floor(下限)・cap(上限)を超えないようにする(正確率は 0〜100 など)。
 */
export function domainFor(values, { floor = 0, cap = Infinity } = {}) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.15 || Math.max(Math.abs(hi) * 0.1, 1);
  const nice = niceTicks(Math.max(floor, lo - pad), Math.min(cap, hi + pad));
  const min = Math.max(floor, nice.min);
  const max = Math.min(cap, nice.max);
  return { min, max, ticks: nice.ticks.filter((tick) => tick >= min && tick <= max) };
}

// 横軸に目盛りを付ける点(最初と最後を含め、最大 max 個。均等に間引く)
export function tickIndices(count, max = 6) {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const indices = new Set();
  for (let i = 0; i < max; i++) indices.add(Math.round((i * (count - 1)) / (max - 1)));
  return [...indices];
}

/**
 * 点の並びから、描画に必要な座標をすべて計算する。
 * points: [{ n, value, status, ... }](古い順)。width・height は描画領域の大きさ(px)。
 * 各点の hit は、その点が担当する横方向の範囲(隣との中間まで)。ポインタは最も近い点に吸着する。
 */
export function layoutLine(
  points,
  {
    width,
    height,
    margin = { top: 24, right: 16, bottom: 44, left: 52 },
    floor = 0,
    cap = Infinity,
  },
) {
  const plot = {
    left: margin.left,
    top: margin.top,
    width: Math.max(1, width - margin.left - margin.right),
    height: Math.max(1, height - margin.top - margin.bottom),
  };
  plot.right = plot.left + plot.width;
  plot.bottom = plot.top + plot.height;

  const domain = domainFor(
    points.map((p) => p.value),
    { floor, cap },
  );
  const xOf = (i) =>
    points.length === 1
      ? plot.left + plot.width / 2
      : plot.left + (i / (points.length - 1)) * plot.width;
  const yOf = (value) =>
    plot.bottom - ((value - domain.min) / (domain.max - domain.min || 1)) * plot.height;

  const dots = points.map((p, index) => ({ ...p, index, x: xOf(index), y: yOf(p.value) }));
  dots.forEach((dot, i) => {
    dot.hit = {
      x0: i === 0 ? plot.left : (dots[i - 1].x + dot.x) / 2,
      x1: i === dots.length - 1 ? plot.right : (dot.x + dots[i + 1].x) / 2,
    };
  });

  return {
    plot,
    domain,
    dots,
    linePath: dots
      .map((d, i) => `${i === 0 ? "M" : "L"}${d.x.toFixed(1)} ${d.y.toFixed(1)}`)
      .join(" "),
    yTicks: domain.ticks.map((value) => ({ value, y: yOf(value) })),
    xTicks: tickIndices(points.length).map((i) => ({ n: points[i].n, x: xOf(i) })),
  };
}

// x に最も近い点の番号(x はグラフ内の座標)
export function nearestIndex(dots, x) {
  let best = 0;
  for (let i = 1; i < dots.length; i++) {
    if (Math.abs(dots[i].x - x) < Math.abs(dots[best].x - x)) best = i;
  }
  return best;
}

/**
 * 直接ラベルを付ける点。最新の点と、最高の点だけ(全点にはラベルを付けない)。
 * 同じ点なら1つにまとめ、近すぎて重なるときは最高のラベルを省く(値はツールチップと表で読める)。
 */
export function pickLabels(dots, { minGap = 56 } = {}) {
  if (dots.length === 0) return [];
  const latest = dots[dots.length - 1];
  const best = dots.reduce((top, dot) => (dot.value >= top.value ? dot : top), dots[0]);
  if (best === latest) return [{ kind: "latest-best", dot: latest }];
  const labels = [{ kind: "latest", dot: latest }];
  if (latest.x - best.x >= minGap) labels.unshift({ kind: "best", dot: best });
  return labels;
}

// ---- 描画 ----

const HEIGHT = 240;
const LABEL_TEXT = { "latest-best": "最新・最高", latest: "最新", best: "最高" };

/**
 * 折れ線グラフを container に描く(前の内容は置き換える)。
 * options: { points, title, unit, format(value), floor, cap, describePoint(point) => { heading, detail } }
 * 表(値の一覧)・ホバー/キーボードのツールチップ・スクリーンリーダー向けの説明も作る。
 */
export function renderLineChart(container, options) {
  container.__chartObserver?.disconnect();
  const { points, title, unit, format, floor = 0, cap = Infinity, describePoint } = options;
  const uid = `chart-${Math.random().toString(36).slice(2, 8)}`;

  const values = points.map((p) => p.value);
  const summary = `直近${points.length}回の${title}。最新は${format(values.at(-1))}${unit}、最高は${format(Math.max(...values))}${unit}、最低は${format(Math.min(...values))}${unit}。`;

  const hasCleared = points.some((p) => p.status === "cleared");
  const hasOver = points.some((p) => p.status !== "cleared");
  const keyItem = (shape, label) =>
    el("span", { class: "chart__key-item" }, shapeIcon(shape), label);

  const plotBox = el("div", {
    class: "chart__plot",
    tabindex: "0",
    role: "group",
    "aria-label": `${title}のグラフ。左右の矢印キーで1回ずつ値を確認できます。`,
  });
  const tooltip = el("div", { class: "chart__tooltip", hidden: true });
  const live = el("p", { class: "visually-hidden", role: "status", "aria-live": "polite" });
  plotBox.append(tooltip);

  const table = el(
    "table",
    { class: "chart__table" },
    el("caption", { class: "visually-hidden" }, `${title}の値の一覧(古い順)`),
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        ...["回", "日付", "役職・職種", "結果", `${title}(${unit})`].map((name) =>
          el("th", { scope: "col" }, name),
        ),
      ),
    ),
    el(
      "tbody",
      {},
      ...points.map((point) => {
        const { heading, detail, result } = describePoint(point);
        return el(
          "tr",
          {},
          el("th", { scope: "row" }, String(point.n)),
          el("td", {}, heading),
          el("td", {}, detail),
          el("td", {}, result),
          el("td", { class: "chart__table-value" }, format(point.value)),
        );
      }),
    ),
  );

  container.replaceChildren(
    el(
      "figure",
      { class: "chart" },
      el(
        "figcaption",
        { class: "chart__title" },
        title,
        el("span", { class: "chart__unit" }, `(${unit})`),
      ),
      el(
        "p",
        { class: "chart__key" },
        hasCleared ? keyItem("circle", "クリア") : "",
        hasOver ? keyItem("diamond", "ゲームオーバー") : "",
      ),
      plotBox,
      live,
      el("details", { class: "chart__data" }, el("summary", {}, "値の一覧(表)を見る"), table),
    ),
  );

  let active = null;
  let model = null;
  let dotNodes = [];
  let crosshair = null;

  function describe(index) {
    const point = points[index];
    const { heading, detail, result } = describePoint(point);
    return { point, heading, detail, result };
  }

  function showTooltip(index) {
    const { point, heading, detail, result } = describe(index);
    const dot = model.dots[index];
    tooltip.replaceChildren(
      el(
        "p",
        { class: "chart__tooltip-value" },
        format(point.value),
        el("span", { class: "chart__tooltip-unit" }, ` ${unit}`),
      ),
      el("p", { class: "chart__tooltip-meta" }, `${point.n}回目 ・ ${heading}`),
      el("p", { class: "chart__tooltip-meta" }, `${detail} ・ ${result}`),
    );
    tooltip.hidden = false;
    // 点の右上に出す。右にはみ出すなら左側に出す
    const width = tooltip.offsetWidth;
    const boxWidth = plotBox.clientWidth;
    const left = dot.x + 14 + width > boxWidth ? dot.x - 14 - width : dot.x + 14;
    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = `${Math.max(0, dot.y - tooltip.offsetHeight - 10)}px`;
  }

  function setActive(index) {
    active = index;
    dotNodes.forEach((node, i) => node.classList.toggle("is-active", i === index));
    if (index === null) {
      crosshair.setAttribute("visibility", "hidden");
      tooltip.hidden = true;
      return;
    }
    crosshair.setAttribute("x1", model.dots[index].x);
    crosshair.setAttribute("x2", model.dots[index].x);
    crosshair.setAttribute("visibility", "visible");
    showTooltip(index);
    const { point, heading, detail, result } = describe(index);
    live.textContent = `${point.n}回目、${format(point.value)}${unit}。${heading}、${detail}、${result}。`;
  }

  function draw() {
    const width = Math.round(plotBox.clientWidth) || 320;
    model = layoutLine(points, { width, height: HEIGHT, floor, cap });
    const { plot } = model;

    const svg = svgEl(
      "svg",
      {
        class: "chart__svg",
        width,
        height: HEIGHT,
        viewBox: `0 0 ${width} ${HEIGHT}`,
        role: "img",
        "aria-labelledby": `${uid}-title ${uid}-desc`,
      },
      svgEl("title", { id: `${uid}-title` }, `${title}の推移`),
      svgEl("desc", { id: `${uid}-desc` }, summary),
      ...model.yTicks.map((tick) =>
        svgEl("line", {
          class: "chart__grid",
          x1: plot.left,
          x2: plot.right,
          y1: tick.y,
          y2: tick.y,
        }),
      ),
      ...model.yTicks.map((tick) =>
        svgEl(
          "text",
          { class: "chart__tick", x: plot.left - 8, y: tick.y + 4, "text-anchor": "end" },
          tick.value.toLocaleString("ja-JP"),
        ),
      ),
      svgEl("line", {
        class: "chart__axis",
        x1: plot.left,
        x2: plot.right,
        y1: plot.bottom,
        y2: plot.bottom,
      }),
      ...model.xTicks.map((tick) =>
        svgEl(
          "text",
          { class: "chart__tick", x: tick.x, y: plot.bottom + 18, "text-anchor": "middle" },
          String(tick.n),
        ),
      ),
      svgEl(
        "text",
        {
          class: "chart__axis-title",
          x: plot.left + plot.width / 2,
          y: HEIGHT - 6,
          "text-anchor": "middle",
        },
        "プレイ順(右が新しい)",
      ),
    );

    if (model.dots.length > 1)
      svg.append(svgEl("path", { class: "chart__line", d: model.linePath }));
    crosshair = svgEl("line", {
      class: "chart__crosshair",
      x1: 0,
      x2: 0,
      y1: plot.top,
      y2: plot.bottom,
      visibility: "hidden",
    });
    svg.append(crosshair);

    dotNodes = model.dots.map((dot) => {
      const cleared = dot.status === "cleared";
      const node = cleared
        ? svgEl("circle", { class: "chart__dot", cx: dot.x, cy: dot.y, r: 4.5 })
        : svgEl("path", {
            class: "chart__dot chart__dot--over",
            d: `M${dot.x} ${dot.y - 6} L${dot.x + 6} ${dot.y} L${dot.x} ${dot.y + 6} L${dot.x - 6} ${dot.y} Z`,
          });
      svg.append(node);
      return node;
    });

    // 最新・最高だけに直接ラベル。文字は文字色で、データの色にはしない
    for (const { kind, dot } of pickLabels(model.dots)) {
      const anchor = dot.x > plot.right - 60 ? "end" : dot.x < plot.left + 40 ? "start" : "middle";
      svg.append(
        svgEl(
          "text",
          { class: "chart__label", x: dot.x, y: Math.max(12, dot.y - 12), "text-anchor": anchor },
          `${LABEL_TEXT[kind]} ${format(dot.value)}`,
        ),
      );
    }

    plotBox.querySelector("svg")?.remove();
    plotBox.prepend(svg);
    if (active !== null && active < points.length) setActive(active);
  }

  // ポインタ: 最も近い点に吸着する(点は小さいので、細い線や点に合わせなくてよい)
  const track = (event) => {
    const rect = plotBox.getBoundingClientRect();
    const index = nearestIndex(model.dots, event.clientX - rect.left);
    if (index !== active) setActive(index);
  };
  plotBox.addEventListener("pointermove", track);
  // タッチでは、なぞらずにタップしただけでも値が出るようにする
  plotBox.addEventListener("pointerdown", track);
  plotBox.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && document.activeElement !== plotBox) setActive(null);
  });
  plotBox.addEventListener("focus", () => {
    if (active === null) setActive(points.length - 1);
  });
  plotBox.addEventListener("blur", () => setActive(null));
  plotBox.addEventListener("keydown", (event) => {
    const last = points.length - 1;
    const current = active ?? last;
    const moves = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(last, current + 1),
      Home: 0,
      End: last,
    };
    if (event.key === "Escape") {
      setActive(null);
    } else if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]);
    }
  });

  draw();
  if (typeof ResizeObserver === "function") {
    let lastWidth = plotBox.clientWidth;
    const observer = new ResizeObserver(() => {
      if (plotBox.clientWidth !== lastWidth) {
        lastWidth = plotBox.clientWidth;
        draw();
      }
    });
    observer.observe(plotBox);
    container.__chartObserver = observer;
  }
}

// 凡例(キー)用の小さなマーク。グラフの点と同じ形
function shapeIcon(shape) {
  const icon = svgEl("svg", {
    class: "chart__key-icon",
    width: 14,
    height: 14,
    viewBox: "0 0 14 14",
    "aria-hidden": "true",
  });
  icon.append(
    shape === "circle"
      ? svgEl("circle", { class: "chart__key-mark", cx: 7, cy: 7, r: 4.5 })
      : svgEl("path", { class: "chart__key-mark", d: "M7 1 L13 7 L7 13 L1 7 Z" }),
  );
  return icon;
}
