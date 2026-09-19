import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  domainFor,
  layoutLine,
  nearestIndex,
  niceTicks,
  pickLabels,
  tickIndices,
} from "../public/assets/js/games/escape-boss/chart.js";

const points = (values, statuses = []) =>
  values.map((value, i) => ({ n: i + 1, value, status: statuses[i] ?? "cleared" }));

describe("目盛り", () => {
  it("1・2・5 × 10のべきの、きりのよい値になる", () => {
    assert.equal(niceTicks(0, 100, 4).step, 20);
    assert.deepEqual(niceTicks(0, 100, 4).ticks, [0, 20, 40, 60, 80, 100]);
    assert.deepEqual(niceTicks(0, 1000, 4).ticks, [0, 200, 400, 600, 800, 1000]);
  });

  it("刻み幅は 1・2・5 のどれかの10のべき倍で、目盛りは3〜7個に収まる", () => {
    for (const [min, max] of [
      [3, 47],
      [0, 7],
      [12.3, 98.7],
      [1234, 5678],
      [0, 100000],
      [50, 51],
    ]) {
      const { step, ticks } = niceTicks(min, max);
      const mantissa = step / 10 ** Math.floor(Math.log10(step));
      assert.ok(
        [1, 2, 5].some((m) => Math.abs(m - mantissa) < 1e-9),
        `${min}-${max}: ${step}`,
      );
      assert.ok(ticks.length >= 3 && ticks.length <= 7, `${min}-${max}: ${ticks.length}個`);
    }
  });

  it("範囲を必ず含む", () => {
    for (const [min, max] of [
      [0, 7],
      [12.3, 98.7],
      [1234, 5678],
      [0.01, 0.09],
    ]) {
      const nice = niceTicks(min, max);
      assert.ok(nice.min <= min && nice.max >= max, `${min}-${max}`);
      assert.equal(nice.ticks[0], nice.min);
      assert.equal(nice.ticks.at(-1), nice.max);
    }
  });

  it("小数の目盛りも誤差なく並ぶ", () => {
    assert.deepEqual(niceTicks(0, 1, 5).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it("最小と最大が同じでも(幅ゼロ)、範囲を作る", () => {
    const nice = niceTicks(50, 50);
    assert.ok(nice.min < 50 && nice.max > 50);
    assert.ok(niceTicks(0, 0).max > 0);
  });
});

describe("縦軸の範囲", () => {
  it("データに余白を足して、きりのよい値にする", () => {
    const domain = domainFor([120, 150, 180]);
    assert.ok(domain.min <= 120 && domain.max >= 180);
    assert.ok(domain.ticks.length >= 3);
    assert.equal(domain.ticks[0], domain.min);
    assert.equal(domain.ticks.at(-1), domain.max);
  });

  it("下限(floor)を下回らない", () => {
    assert.equal(domainFor([1, 2, 3], { floor: 0 }).min, 0);
    assert.ok(domainFor([100, 101], { floor: 0 }).min > 0, "データが高ければ 0 から始めない");
  });

  it("上限(cap)を超えない(正確率は 100%)", () => {
    const domain = domainFor([92, 96, 100], { floor: 0, cap: 100 });
    assert.equal(domain.max, 100);
    assert.ok(domain.ticks.every((t) => t <= 100));
    assert.ok(domain.ticks.includes(100));
  });

  it("値が1つ・同じ値でも範囲がある", () => {
    for (const values of [[100], [50, 50, 50], [0]]) {
      const domain = domainFor(values);
      assert.ok(domain.max > domain.min, values.join());
    }
  });
});

describe("横軸の目盛り", () => {
  it("少なければ全部、多ければ最初と最後を含めて間引く", () => {
    assert.deepEqual(tickIndices(1), [0]);
    assert.deepEqual(tickIndices(4), [0, 1, 2, 3]);
    assert.deepEqual(tickIndices(30), [0, 6, 12, 17, 23, 29]);
    assert.equal(tickIndices(200).length, 6);
    assert.equal(tickIndices(200)[0], 0);
    assert.equal(tickIndices(200).at(-1), 199);
  });

  it("重複しない", () => {
    for (const count of [7, 8, 9, 10, 31, 101]) {
      const indices = tickIndices(count);
      assert.equal(new Set(indices).size, indices.length);
    }
  });
});

describe("レイアウト", () => {
  const size = { width: 400, height: 240 };
  const margin = { top: 20, right: 10, bottom: 40, left: 50 };

  it("点は左から右へ均等に並び、値が大きいほど上(y が小さい)", () => {
    const layout = layoutLine(points([100, 200, 150]), { ...size, margin });
    const { dots, plot } = layout;
    assert.equal(dots[0].x, plot.left);
    assert.equal(dots[2].x, plot.right);
    assert.equal(dots[1].x, (plot.left + plot.right) / 2);
    assert.ok(dots[1].y < dots[2].y && dots[2].y < dots[0].y);
    assert.ok(dots.every((d) => d.y >= plot.top && d.y <= plot.bottom));
  });

  it("描画領域は、余白を除いた大きさ", () => {
    const { plot } = layoutLine(points([1, 2]), { ...size, margin });
    assert.deepEqual([plot.left, plot.top, plot.width, plot.height], [50, 20, 340, 180]);
    assert.deepEqual([plot.right, plot.bottom], [390, 200]);
  });

  it("点が1つなら、横の中央に置く", () => {
    const { dots, plot } = layoutLine(points([120]), { ...size, margin });
    assert.equal(dots[0].x, plot.left + plot.width / 2);
  });

  it("値の目盛りの位置は、点の位置の計算と一致する", () => {
    const layout = layoutLine(points([0, 100]), { ...size, margin, floor: 0, cap: 100 });
    const top = layout.yTicks.find((t) => t.value === 100);
    const bottom = layout.yTicks.find((t) => t.value === 0);
    assert.equal(top.y, layout.plot.top);
    assert.equal(bottom.y, layout.plot.bottom);
    assert.equal(layout.dots[1].y, layout.plot.top);
    assert.equal(layout.dots[0].y, layout.plot.bottom);
  });

  it("折れ線のパスは、点をたどる", () => {
    const { linePath, dots } = layoutLine(points([1, 5, 3]), { ...size, margin });
    assert.equal(linePath.split(" L").length, dots.length);
    assert.ok(linePath.startsWith("M"));
  });

  it("横軸の目盛りに、プレイの番号(n)と点の x が入る", () => {
    const layout = layoutLine(points([1, 2, 3, 4]), { ...size, margin });
    assert.deepEqual(
      layout.xTicks.map((t) => t.n),
      [1, 2, 3, 4],
    );
    assert.deepEqual(
      layout.xTicks.map((t) => t.x),
      layout.dots.map((d) => d.x),
    );
  });

  it("各点のホバー範囲は隣との中間までで、すき間なく敷き詰められる(24px 以上を保証するための土台)", () => {
    const { dots, plot } = layoutLine(points([1, 2, 3, 4, 5]), { ...size, margin });
    assert.equal(dots[0].hit.x0, plot.left);
    assert.equal(dots.at(-1).hit.x1, plot.right);
    for (let i = 1; i < dots.length; i++) assert.equal(dots[i].hit.x0, dots[i - 1].hit.x1);
    const width = dots[1].hit.x1 - dots[1].hit.x0;
    assert.ok(width >= 24, `幅 ${width}`);
  });

  it("細かい画面でも、領域が負にならない", () => {
    const { plot } = layoutLine(points([1, 2]), { width: 30, height: 30, margin });
    assert.ok(plot.width >= 1 && plot.height >= 1);
  });
});

describe("ポインタの吸着", () => {
  const { dots } = layoutLine(points([1, 2, 3, 4]), {
    width: 400,
    height: 200,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  it("最も近い点の番号を返す", () => {
    assert.equal(nearestIndex(dots, -50), 0);
    assert.equal(nearestIndex(dots, 5), 0);
    assert.equal(nearestIndex(dots, 140), 1);
    assert.equal(nearestIndex(dots, 260), 2);
    assert.equal(nearestIndex(dots, 9999), 3);
  });

  it("点と点のちょうど中間より左は前の点、右は次の点", () => {
    const mid = (dots[1].x + dots[2].x) / 2;
    assert.equal(nearestIndex(dots, mid - 0.1), 1);
    assert.equal(nearestIndex(dots, mid + 0.1), 2);
  });
});

describe("直接ラベル", () => {
  const layout = (values) => layoutLine(points(values), { width: 600, height: 240 }).dots;

  it("最新と最高の2つだけ(全点には付けない)", () => {
    const labels = pickLabels(layout([100, 180, 120, 130, 140, 150, 160]));
    assert.deepEqual(
      labels.map((l) => l.kind),
      ["best", "latest"],
    );
    assert.equal(labels[0].dot.value, 180);
    assert.equal(labels[1].dot.value, 160);
  });

  it("最新が最高なら、1つにまとめる", () => {
    const labels = pickLabels(layout([100, 120, 150]));
    assert.deepEqual(
      labels.map((l) => l.kind),
      ["latest-best"],
    );
  });

  it("最高が最新の近くにあって重なるなら、最高のラベルを省く", () => {
    const labels = pickLabels(layout([100, 100, 100, 100, 100, 100, 100, 100, 100, 190, 150]));
    assert.deepEqual(
      labels.map((l) => l.kind),
      ["latest"],
    );
  });

  it("最高が同じ値なら、新しいほうを最高とする", () => {
    const labels = pickLabels(layout([200, 100, 200, 100, 100, 100, 100, 100, 100, 100, 150]));
    assert.equal(labels.find((l) => l.kind === "best").dot.n, 3);
  });

  it("点がなければ空", () => {
    assert.deepEqual(pickLabels([]), []);
  });
});
