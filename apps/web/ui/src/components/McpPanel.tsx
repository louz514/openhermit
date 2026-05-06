import { useCallback, useEffect, useState } from 'react';
import { fetchMcpServers, disableMcpServer, type McpServerInfo } from '../api';
import { useToast } from './Toast';

export function McpPanel() {
  const { toast } = useToast();
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setServers(await fetchMcpServers());
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDisable = async (serverId: string) => {
    const target = servers.find((s) => s.id === serverId);
    const snapshot = servers;
    setServers((arr) => arr.filter((s) => s.id !== serverId));
    try {
      await disableMcpServer(serverId);
      toast(`Disabled ${target?.name ?? serverId}`, 'success');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast(`Failed to disable: ${msg}`, 'error');
      setServers(snapshot);
    }
  };

  if (loading) return <p className="manage__empty">Loading...</p>;
  if (error) return <p className="manage__error">{error}</p>;
  if (servers.length === 0) return <p className="manage__empty">No MCP servers enabled.</p>;

  return (
    <div className="manage__list">
      {servers.map((s) => (
        <div className="manage__card" key={s.id}>
          <div className="manage__card-info">
            <div className="manage__card-header">
              <span className="manage__card-name">{s.name}</span>
              <span className="manage__card-id">{s.id}</span>
            </div>
            <div className="manage__card-desc">{s.description}</div>
            <div className="manage__card-meta">{s.url}</div>
          </div>
          <div className="manage__card-actions">
            <button className="btn btn--sm btn--ghost" onClick={() => void handleDisable(s.id)}>
              Disable
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
