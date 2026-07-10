import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CHANNEL_LABELS } from '../constants.js';
import EmptyState from '../components/EmptyState.jsx';

const CAMPAIGN_STATUS_BADGE = {
  completed: <span className="badge badge-success">Concluída</span>,
  failed: <span className="badge badge-danger">Falhou</span>,
  running: <span className="badge badge-warning">Em andamento</span>,
  scheduled: <span className="badge badge-neutral">Agendada</span>,
  cancelled: <span className="badge badge-neutral">Cancelada</span>,
};

function formatShortDate(isoDate) {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

function TrendChart({ trend }) {
  const maxValue = Math.max(1, ...trend.map((d) => d.sent + d.failed));
  const width = 640;
  const height = 160;
  const barGap = 4;
  const barWidth = width / trend.length - barGap;

  return (
    <div className="trend-chart-wrap">
      <svg
        className="trend-chart"
        viewBox={`0 0 ${width} ${height + 20}`}
        aria-label="Envios e falhas nos últimos 14 dias"
      >
        {trend.map((day, i) => {
          const x = i * (barWidth + barGap);
          const sentHeight = (day.sent / maxValue) * height;
          const failedHeight = (day.failed / maxValue) * height;
          return (
            <g key={day.date}>
              <title>{`${day.date}: ${day.sent} enviadas, ${day.failed} falharam`}</title>
              <rect
                x={x}
                y={height - sentHeight - failedHeight}
                width={barWidth}
                height={sentHeight}
                fill="var(--primary)"
                rx="2"
              />
              <rect
                x={x}
                y={height - failedHeight}
                width={barWidth}
                height={failedHeight}
                fill="var(--danger)"
                rx="2"
              />
              {i % 2 === 0 && (
                <text x={x + barWidth / 2} y={height + 15} textAnchor="middle" className="trend-chart-label">
                  {formatShortDate(day.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="trend-chart-legend">
        <span><i style={{ background: 'var(--primary)' }} /> Enviadas</span>
        <span><i style={{ background: 'var(--danger)' }} /> Falharam</span>
      </div>
    </div>
  );
}

function ChannelBreakdown({ byChannel }) {
  return (
    <div className="channel-breakdown">
      {byChannel.map((c) => {
        const pct = (n) => (c.total > 0 ? (n / c.total) * 100 : 0);
        return (
          <div key={c.channel} className="channel-row">
            <div className="channel-row-header">
              <span>{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
              <span className="helper-text">{c.total} mensagens</span>
            </div>
            <div className="channel-bar">
              <div className="channel-bar-segment" style={{ width: `${pct(c.sent)}%`, background: 'var(--primary)' }} />
              <div className="channel-bar-segment" style={{ width: `${pct(c.failed)}%`, background: 'var(--danger)' }} />
              <div className="channel-bar-segment" style={{ width: `${pct(c.pending)}%`, background: 'var(--warning)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .reportDashboard()
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Visão geral dos seus disparos: volume, taxa de entrega e tendência recente.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="skeleton-stat-grid" aria-hidden="true">
          <span className="sr-only">Carregando...</span>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-stat-card">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ))}
        </div>
      ) : data && data.totals.messagesTotal === 0 ? (
        <div className="card">
          <EmptyState icon="M4 20V10m6 10V4m6 16v-7">
            Nenhum envio registrado ainda. <Link to="/upload">Importe uma planilha</Link> e faça seu primeiro disparo para ver os números aqui.
          </EmptyState>
        </div>
      ) : data && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{data.totals.messagesSent}</div>
              <div className="stat-label">Mensagens enviadas</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.deliveryRate === null ? '—' : `${data.deliveryRate}%`}</div>
              <div className="stat-label">Taxa de entrega</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.totals.messagesFailed}</div>
              <div className="stat-label">Falhas</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.totals.campaigns}</div>
              <div className="stat-label">Disparos realizados</div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="card">
              <h3>Últimos 14 dias</h3>
              <TrendChart trend={data.trend} />
            </div>

            <div className="card">
              <h3>Por canal</h3>
              {data.byChannel.length === 0 ? (
                <p className="helper-text">Sem envios por canal ainda.</p>
              ) : (
                <ChannelBreakdown byChannel={data.byChannel} />
              )}
            </div>
          </div>

          <div className="card">
            <h3>Disparos recentes</h3>
            {data.recentCampaigns.length === 0 ? (
              <p className="helper-text">Nenhum disparo realizado ainda.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Campanha</th>
                      <th>Status</th>
                      <th>Enviadas</th>
                      <th>Falhas</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentCampaigns.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{CAMPAIGN_STATUS_BADGE[c.status] || c.status}</td>
                        <td>{c.sent}</td>
                        <td>{c.failed}</td>
                        <td>{c.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
