import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanningService } from './planning.service';
import { environment } from '../../environments/environment';

describe('PlanningService', () => {
  const http = {
    post: vi.fn(),
    get: vi.fn()
  };

  const createService = (): PlanningService => {
    const service = Object.create(PlanningService.prototype) as PlanningService & {
      http: typeof http;
      baseUrl: string;
    };

    service.http = http;
    service.baseUrl = environment.apiUrl;
    return service;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and joins room endpoints with uppercased room ids', () => {
    const service = createService();

    service.createRoom();
    service.joinRoom('ab12', 'Alice');
    service.getRoom('ab12');
    service.vote('ab12', 'member-1', '8');
    service.reveal('ab12');
    service.reset('ab12');

    expect(http.post).toHaveBeenNthCalledWith(1, 'http://localhost:3000/rooms', {});
    expect(http.post).toHaveBeenNthCalledWith(2, 'http://localhost:3000/rooms/AB12/join', { name: 'Alice' });
    expect(http.get).toHaveBeenCalledWith('http://localhost:3000/rooms/AB12');
    expect(http.post).toHaveBeenNthCalledWith(3, 'http://localhost:3000/rooms/AB12/vote', {
      memberId: 'member-1',
      value: '8'
    });
    expect(http.post).toHaveBeenNthCalledWith(4, 'http://localhost:3000/rooms/AB12/reveal', {});
    expect(http.post).toHaveBeenNthCalledWith(5, 'http://localhost:3000/rooms/AB12/reset', {});
  });

  it('streams room events and closes the event source on unsubscribe', () => {
    const service = createService();
    const close = vi.fn();
    let source: {
      onmessage: ((event: MessageEvent<string>) => void) | null;
      onerror: (() => void) | null;
      close: () => void;
    } | undefined;

    vi.stubGlobal(
      'EventSource',
      vi.fn().mockImplementation(() => {
        source = {
          onmessage: null,
          onerror: null,
          close
        };

        return source;
      })
    );

    const next = vi.fn();
    const subscription = service.streamRoom('room').subscribe(next);

    source?.onmessage?.({ data: JSON.stringify({ type: 'room-updated', room: { roomId: 'ROOM' } }) } as MessageEvent<string>);
    source?.onerror?.();
    subscription.unsubscribe();

    expect(EventSource).toHaveBeenCalledWith('http://localhost:3000/rooms/ROOM/events');
    expect(next).toHaveBeenCalledWith({ type: 'room-updated', room: { roomId: 'ROOM' } });
    expect(close).toHaveBeenCalledOnce();
  });
});
