import { useState } from 'react';
import { BALANCE } from '../../data/balance';
import { CATEGORY_COLOR, CATEGORY_LABEL, MOMENT_CATEGORIES } from '../../data/editorOptions';
import { PLATFORMS, PLATFORM_IDS } from '../../data/platforms';
import { findStreamer } from '../../data/streamers';
import { totalFollowers, totalViews } from '../../sim/engine';
import { isSettled } from '../../sim/publishing';
import { dayOf, formatClock } from '../../sim/time';
import { useGame } from '../../state/store';
import type { DailyStat, PublishedClip } from '../../types/game';
import { Empty, Meter } from '../components/Bits';
import { compact, money } from '../format';

type Sort = 'newest' | 'views' | 'revenue' | 'quality';

export function Analytics(): JSX.Element {
  const game = useGame((s) => s.game)!;
  const [sort, setSort] = useState<Sort>('newest');
  const revenue = PLATFORM_IDS.reduce((a, p) => a + game.platforms[p].revenue, 0);
  const clips = [...game.published].sort((a, b) =>
    sort === 'views' ? b.views - a.views : sort === 'revenue' ? b.revenue - a.revenue : sort === 'quality' ? b.quality - a.quality : b.publishedAtMinute - a.publishedAtMinute,
  );
  const engagement = game.published.reduce((a, c) => a + c.likes + c.comments + c.shares, 0);
  const views = totalViews(game);

  return (
    <div className="analytics detail-scroll">
      <div className="tiles">
        <Tile label="Total views" value={compact(views)} />
        <Tile label="Followers" value={compact(totalFollowers(game))} />
        <Tile label="Engagement rate" value={views ? `${((engagement / views) * 100).toFixed(1)}%` : '—'} />
        <Tile label="Platform revenue" value={money(revenue)} />
        <Tile label="Cash" value={money(game.cash)} />
        <Tile label="Reputation" value={`${Math.round(game.reputation)}/100`} />
        <Tile label="Clips published" value={`${game.stats.clipsPublished}`} />
        <Tile label="Viral hits" value={`${game.stats.viralClips}`} />
      </div>

      <div className="an-row">
        <section className="card">
          <h3 className="section-title">Daily performance</h3>
          <DailyChart days={game.daily.slice(-14)} today={dayOf(game.minute)} />
        </section>
        <section className="card">
          <h3 className="section-title">Creator profile</h3>
          <p>
            Level <b>{game.level}</b> <span className="muted small">({game.xp}/{BALANCE.xpPerLevel(game.level)} XP)</span>
          </p>
          <Meter value={game.xp / BALANCE.xpPerLevel(game.level)} color="#a587ff" label="Level progress" />
          {(['editing', 'trendSense'] as const).map((k) => (
            <div key={k} className="skill-row">
              <span>{k === 'editing' ? 'Editing' : 'Trend Sense'} <b>Lv {game.skills[k].level}</b></span>
              <Meter value={game.skills[k].xp / BALANCE.skillXpPerLevel(game.skills[k].level)} color="#4fd8e8" label={`${k} progress`} />
              <span className="muted small">{k === 'editing' ? 'Raises edit quality, unlocks styles.' : 'Sharper hype & competition estimates.'}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="card">
        <h3 className="section-title">Platforms</h3>
        <div className="plat-table">
          {PLATFORM_IDS.map((id) => {
            const a = game.platforms[id];
            const p = PLATFORMS[id];
            return (
              <div key={id} className="plat-row" style={{ ['--pc' as string]: p.color }}>
                <b className="pr-name">{p.name}</b>
                <span>{compact(a.followers)} followers</span>
                <span>{compact(a.totalViews)} views</span>
                <span>{money(a.revenue)} earned</span>
                <span className={a.monetized ? 'good' : 'muted'}>
                  {a.monetized ? 'Monetized' : `Needs ${p.monetization.minFollowers} followers${p.monetization.minTotalViews ? ` + ${compact(p.monetization.minTotalViews)} views` : ''}`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="muted small">Views are not money: revenue only flows from monetized platforms, at each platform's rate per 1,000 views.</p>
      </section>

      <section className="card">
        <h3 className="section-title">What works</h3>
        <CategoryBreakdown clips={game.published} />
      </section>

      <section className="card">
        <h3 className="section-title">
          All clips
          <span className="sort" role="group" aria-label="Sort clips">
            {(['newest', 'views', 'revenue', 'quality'] as Sort[]).map((s) => (
              <button key={s} className={`chip${sort === s ? ' active' : ''}`} onClick={() => setSort(s)} aria-pressed={sort === s}>
                {s}
              </button>
            ))}
          </span>
        </h3>
        {clips.length === 0 ? (
          <Empty title="No clips published yet">
            <p>Your published clips and their stats will appear here.</p>
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="clips-table">
              <thead>
                <tr>
                  <th>Clip</th>
                  <th>Platform</th>
                  <th>Q</th>
                  <th>Views</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Shares</th>
                  <th>Fans</th>
                  <th>Revenue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clips.map((c) => (
                  <tr key={c.id}>
                    <td className="ct-title">
                      {c.title}
                      {c.factors.viral && <em className="viral-badge">VIRAL</em>}
                      <span className="muted small">{findStreamer(c.streamerId).name} · {CATEGORY_LABEL[c.category]} · Day {dayOf(c.publishedAtMinute)} {formatClock(c.publishedAtMinute)}</span>
                    </td>
                    <td style={{ color: PLATFORMS[c.platform].color }}>{PLATFORMS[c.platform].name}</td>
                    <td>{c.quality}</td>
                    <td>{compact(c.views)}</td>
                    <td>{compact(c.likes)}</td>
                    <td>{compact(c.comments)}</td>
                    <td>{compact(c.shares)}</td>
                    <td>+{compact(c.followersGained)}</td>
                    <td>{money(c.revenue)}</td>
                    <td className={isSettled(c, game.minute) ? 'muted' : 'good'}>{isSettled(c, game.minute) ? 'settled' : 'growing'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="section-title">Ledger</h3>
        <ul className="ledger">
          {[...game.ledger].reverse().slice(0, 12).map((l, i) => (
            <li key={i}>
              <span className="muted small">Day {dayOf(l.minute)} {formatClock(l.minute)}</span>
              <span>{l.label}</span>
              <b className={l.kind === 'income' ? 'good' : 'bad'}>{l.kind === 'income' ? '+' : '-'}{money(l.amount)}</b>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="tile">
      <span className="tile-v">{value}</span>
      <span className="tile-l">{label}</span>
    </div>
  );
}

function DailyChart({ days, today }: { days: DailyStat[]; today: number }): JSX.Element {
  if (days.length === 0) return <p className="muted">No data yet.</p>;
  const maxV = Math.max(1, ...days.map((d) => d.views));
  const maxF = Math.max(1, ...days.map((d) => d.followers));
  const w = 320, h = 120, bw = w / Math.max(days.length, 7);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${w} ${h + 16}`} role="img" aria-label="Views and new followers per day">
        {days.map((d, i) => {
          const bh = (d.views / maxV) * (h - 10);
          return (
            <g key={d.day}>
              <rect x={i * bw + 3} y={h - bh} width={bw - 6} height={bh} fill={d.day === today ? '#4fd8e8' : '#2a8fa8'} />
              <text x={i * bw + bw / 2} y={h + 12} textAnchor="middle" fontSize="8" fill="#9a90c8">D{d.day}</text>
              <title>{`Day ${d.day}: ${d.views.toLocaleString()} views, +${d.followers} followers, ${money(d.revenue)} revenue`}</title>
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke="#ff5fa2"
          strokeWidth="2"
          points={days.map((d, i) => `${i * bw + bw / 2},${h - (d.followers / maxF) * (h - 10)}`).join(' ')}
        />
      </svg>
      <figcaption className="small">
        <span className="legend" style={{ background: '#4fd8e8' }} /> views (max {compact(maxV)}) <span className="legend" style={{ background: '#ff5fa2' }} /> new followers (max {compact(maxF)})
      </figcaption>
    </figure>
  );
}

function CategoryBreakdown({ clips }: { clips: PublishedClip[] }): JSX.Element {
  const rows = MOMENT_CATEGORIES.map((c) => {
    const list = clips.filter((x) => x.category === c);
    const avg = list.length ? list.reduce((a, x) => a + x.views, 0) / list.length : 0;
    return { c, n: list.length, avg };
  }).filter((r) => r.n > 0);
  if (rows.length === 0) return <p className="muted">Publish a few clips to see which moment types perform best.</p>;
  const max = Math.max(...rows.map((r) => r.avg), 1);
  return (
    <div className="cat-break">
      {rows.map((r) => (
        <div key={r.c} className="cb-row">
          <span style={{ color: CATEGORY_COLOR[r.c] }}>{CATEGORY_LABEL[r.c]}</span>
          <Meter value={r.avg / max} color={CATEGORY_COLOR[r.c]} label={`${CATEGORY_LABEL[r.c]} average views`} />
          <span className="small">{compact(r.avg)} avg · {r.n} clip{r.n > 1 ? 's' : ''}</span>
        </div>
      ))}
    </div>
  );
}
