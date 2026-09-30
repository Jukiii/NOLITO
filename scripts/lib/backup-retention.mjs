// バックアップの世代管理(保管は直近6か月まで。docs/backup.md)。DOM・ファイル・時計に触れない純粋な計算。
export const RETENTION_MONTHS = 6;

const NAME = /^nolito-d1-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.sql$/;

/** nolito-d1-20260920T153000Z.sql の時刻(UTC)。この形でない名前・存在しない日時は null。 */
export function parseBackupName(name) {
  const match = NAME.exec(name);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const same =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour;
  return same ? date : null;
}

/** now の months か月前(UTC。月末は、その月の末日にそろえる)。 */
export function cutoffDate(now, months = RETENTION_MONTHS) {
  const target = new Date(now.getTime());
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() - months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/**
 * 名前の一覧から、消す・残す・対象外を決める。
 *   remove … 期限(cutoff)より古いもの。ただし、いちばん新しい1つは、期限を過ぎていても残す
 *            (書き出しを長く休んだとき、バックアップが1つもなくなるのを防ぐ)
 *   keep   … 残すもの(新しい順)
 *   ignored … バックアップの名前の形でないもの(触らない)
 */
export function planPrune(names, now, months = RETENTION_MONTHS) {
  const cutoff = cutoffDate(now, months);
  const dated = [];
  const ignored = [];
  for (const name of names) {
    const at = parseBackupName(name);
    if (at) dated.push({ name, at });
    else ignored.push(name);
  }
  dated.sort((a, b) => b.at - a.at || (a.name < b.name ? 1 : -1));
  const keep = [];
  const remove = [];
  dated.forEach((entry, index) => {
    if (index > 0 && entry.at < cutoff) remove.push(entry.name);
    else keep.push(entry.name);
  });
  return { cutoff, keep, remove, ignored };
}
