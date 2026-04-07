import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { LobbyPageComponent } from './pages/lobby/lobby-page.component';
import { RoomPageComponent } from './pages/room/room-page.component';

describe('routes', () => {
  it('defines the lobby, room and fallback routes', () => {
    expect(routes).toEqual([
      { path: '', component: LobbyPageComponent },
      { path: 'room/:roomId', component: RoomPageComponent },
      { path: '**', redirectTo: '' }
    ]);
  });
});
