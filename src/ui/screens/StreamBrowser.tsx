import { BALANCE } from '../../data/balance';
import { PLATFORMS, PLATFORM_IDS } from '../../data/platforms';
import { STREAMERS, findStreamer } from '../../data/streamers';
import { estimateChat, estimateMoment, generateTrends, getSession, segmentAired, streamStatus } from '../../sim/streams';
import { dayOf, formatClock, formatDuration, streamDayOf } from '../../sim/time';
import { useGame } from '../../state/store';
import type { StreamMoment } from '../../types/game';
import { CategoryTag, Empty, Meter, Stars } from '../components/Bits';
import { Portrait } from '../components/Portrait';

export function StreamBrowser(): JSX.Element {
  const game = useGame((s) => s.game)!;
  const selectedId = useGame((s) => s.ui.selectedStreamerId);
  const selectStreamer = useGame((s) => s.selectStreamer);
  const day = streamDayOf(game.minute);
  const overnight = dayOf(game.minute) !== day;

  return (
    <div className="browser">
      <aside className="streamer-list" aria-label="Streamers">
        <h3 className="col-title">{overnight ? `Last night's VODs · expire 0${BALANCE.wakeHour}:00` : `Today's streams · Day ${day}`}</h3>
        {STREAMERS.map((s) => {
          const session = getSession(game.worldSeed, s, day);
          const status = streamStatus(session, game.minute);
          const scanned = game.scanned[session.key]?.length ?? 0;
          return (
            <button
              key={s.id}
              className={`streamer-card${selectedId === s.id ? ' selected' : ''}`}
              onClick={() => selectStreamer(s.id)}
              aria-pressed={selectedId === s.id}
            >
              <Portrait p={s.portrait} size={48} live={status === 'live'} />
              <span className="sc-body">
                <span className="sc-name">{s.name}</span>
                <span className="sc-meta">
                  {s.category} · pop {s.popularity}
                </span>
                <span className={`status status-${status}`}>
                  {status === 'live' ? '● LIVE' : status === 'upcoming' ? `Starts ${formatClock(session.startMinute)}` : 'Ended — VOD'}
                  {scanned > 0 && <em> · {scanned} scanned</em>}
                </span>
              </span>
            </button>
          );
        })}
      </aside>
      <section className="stream-detail">
        {selectedId ? <StreamDetail streamerId={selectedId} /> : (
          <Empty title="Pick a streamer">
            <p>Live streams are still producing moments. Ended streams can be scanned in full, but other clippers have had longer to grab the good stuff.</p>
          </Empty>
        )}
      </section>
    </div>
  );
}

function StreamDetail({ streamerId }: { streamerId: string }): JSX.Element {
  const game = useGame((s) => s.game)!;
  const scan = useGame((s) => s.scan);
  const streamer = findStreamer(streamerId);
  const day = streamDayOf(game.minute);
  const session = getSession(game.worldSeed, streamer, day);
  const status = streamStatus(session, game.minute);
  const scanned = game.scanned[session.key] ?? [];
  const found: StreamMoment[] = session.segments
    .filter((s) => scanned.includes(s.index))
    .flatMap((s) => s.momentIds.map((id) => session.moments[id]!))
    .sort((a, b) => b.airMinute - a.airMinute);
  const canScan = game.energy >= BALANCE.scan.energy;

  return (
    <div className="detail-scroll">
      <header className="sd-head">
        <Portrait p={streamer.portrait} size={72} live={status === 'live'} />
        <div>
          <h2>{streamer.name}</h2>
          <p className="muted">{streamer.tagline}</p>
          <div className="traits">
            {streamer.traits.map((t) => (
              <span key={t} className="trait">{t}</span>
            ))}
          </div>
        </div>
        <dl className="audience">
          <dt>Audience</dt>
          <dd><span>Teens</span><Meter value={streamer.audience.teens} color="#ff5fa2" label="Teens" /></dd>
          <dd><span>18–29</span><Meter value={streamer.audience.youngAdults} color="#4fd8e8" label="Young adults" /></dd>
          <dd><span>30+</span><Meter value={streamer.audience.adults} color="#ffd166" label="Adults" /></dd>
        </dl>
      </header>

      <h3 className="section-title">
        Stream timeline <span className="muted">{formatClock(session.startMinute)}–{formatClock(session.endMinute)} · scan costs {BALANCE.scan.minutes} min & {BALANCE.scan.energy} energy</span>
      </h3>
      {status === 'upcoming' ? (
        <p className="notice">{streamer.name} goes live at {formatClock(session.startMinute)}. Check back then — or scan someone who is live now.</p>
      ) : null}
      <div className="timeline" role="list">
        {session.segments.map((seg) => {
          const aired = segmentAired(seg, game.minute);
          const airing = !aired && game.minute >= seg.startMinute;
          const done = scanned.includes(seg.index);
          return (
            <div key={seg.index} role="listitem" className={`seg${done ? ' done' : ''}${aired ? '' : ' locked'}${airing ? ' airing' : ''}`}>
              <span className="seg-time">{formatClock(seg.startMinute)}</span>
              <span className="seg-chat" title={aired ? 'Chat activity (noisy hint)' : 'Not aired yet'}>
                {aired ? <span style={{ height: `${Math.round(estimateChat(session.key, seg, game.skills.trendSense.level) * 100)}%` }} /> : null}
              </span>
              {done ? (
                <span className="seg-result">{seg.momentIds.length ? `${seg.momentIds.length}★` : '—'}</span>
              ) : aired ? (
                <button className="btn tiny" disabled={!canScan} onClick={() => scan(streamerId, seg.index)} title={canScan ? 'Scan this half hour' : 'Not enough energy'}>
                  Scan
                </button>
              ) : (
                <span className="seg-result muted">{airing ? 'live' : '…'}</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="hint">Chat bars are only a hint — chat hypes giveaways and drama too, and real moments can pass quietly. Your Trend Sense (Lv {game.skills.trendSense.level}) sharpens every estimate.</p>

      <h3 className="section-title">Discovered moments <span className="muted">{found.length}</span></h3>
      {found.length === 0 ? (
        <Empty title="No moments yet">
          <p>Scan an aired segment to search it for clip-worthy moments.</p>
        </Empty>
      ) : (
        <div className="moment-grid">
          {found.map((m) => (
            <MomentCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MomentCard({ m }: { m: StreamMoment }): JSX.Element {
  const game = useGame((s) => s.game)!;
  const selectMoment = useGame((s) => s.selectMoment);
  const est = estimateMoment(m, game.minute, game.skills.trendSense.level);
  const used = game.usedMomentIds.includes(m.id);
  const age = game.minute - m.airMinute;
  const trends = generateTrends(game.worldSeed, streamDayOf(game.minute));
  const bestPlatform = [...PLATFORM_IDS].sort(
    (a, b) => PLATFORMS[b].categoryPref[m.category] * trends[b][m.category] - PLATFORMS[a].categoryPref[m.category] * trends[a][m.category],
  )[0]!;
  return (
    <article className={`moment${used ? ' used' : ''}`}>
      <header>
        <CategoryTag c={m.category} />
        <span className="muted small">aired {formatDuration(age)} ago</span>
      </header>
      <p className="m-desc">{m.description}</p>
      <blockquote>"{m.quote}"</blockquote>
      <dl className="m-stats">
        <div>
          <dt>Hype</dt>
          <dd><Stars value={est.hypeStars} label="Hype estimate" /> <span className={`conf conf-${est.confidence}`}>{est.confidence} confidence</span></dd>
        </div>
        <div>
          <dt>Clippers on it</dt>
          <dd className={est.clippers > 8 ? 'bad' : est.clippers < 4 ? 'good' : ''}>about {est.clippers}</dd>
        </div>
        <div>
          <dt>Angle</dt>
          <dd className={est.originality === 'Fresh angle' ? 'good' : est.originality === 'Overdone' ? 'bad' : ''}>{est.originality}</dd>
        </div>
        <div>
          <dt>Freshness</dt>
          <dd><Meter value={est.freshnessPct / 100} color="#5fd38a" label="Freshness" /></dd>
        </div>
      </dl>
      <p className="small m-fit">
        Best fit today: <b style={{ color: PLATFORMS[bestPlatform].color }}>{PLATFORMS[bestPlatform].name}</b>
        {trends[bestPlatform][m.category] > 1.05 ? ' (trending)' : ''}
      </p>
      <button className="btn primary" disabled={used} onClick={() => selectMoment(m.streamerId, m.day, m.id)}>
        {used ? 'Already clipped' : 'Clip this moment →'}
      </button>
    </article>
  );
}
