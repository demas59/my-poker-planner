import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LobbyPageComponent } from './lobby-page.component';
import { JoinRoomResponse, Room } from '../../models/planning.model';

describe('LobbyPageComponent', () => {
  const room: Room = {
    roomId: 'ABCD',
    members: [],
    revealed: false,
    votes: {},
    fibonacci: ['1', '2', '3', '5', '8'],
    updatedAt: '2026-04-07T00:00:00.000Z'
  };

  const createComponent = () => {
    const planningService = {
      createRoom: vi.fn(),
      joinRoom: vi.fn()
    };
    const router = {
      navigate: vi.fn()
    };

    const component = Object.create(LobbyPageComponent.prototype) as LobbyPageComponent & {
      planningService: typeof planningService;
      router: typeof router;
    };

    component.planningService = planningService;
    component.router = router;
    component.roomCode = signal('');
    component.userName = signal('');
    component.loading = signal(false);
    component.error = signal('');

    return { component, planningService, router };
  };

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('rejects room creation when the username is missing', () => {
    const { component, planningService } = createComponent();

    component.createRoom();

    expect(component.error()).toBe('Ton nom est obligatoire pour creer un salon.');
    expect(planningService.createRoom).not.toHaveBeenCalled();
  });

  it('creates a room, joins it and persists the member before navigating', () => {
    const { component, planningService, router } = createComponent();
    const response: JoinRoomResponse = {
      member: { id: 'member-1', name: 'Alice' },
      room
    };

    component.userName.set(' Alice ');
    planningService.createRoom.mockReturnValue(of(room));
    planningService.joinRoom.mockReturnValue(of(response));

    component.createRoom();

    expect(planningService.createRoom).toHaveBeenCalledOnce();
    expect(planningService.joinRoom).toHaveBeenCalledWith('ABCD', 'Alice');
    expect(sessionStorage.getItem('pp_member_ABCD')).toBe(JSON.stringify({ memberId: 'member-1', name: 'Alice' }));
    expect(router.navigate).toHaveBeenCalledWith(['/room', 'ABCD'], {
      state: { room, member: response.member }
    });
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('');
  });

  it('handles room creation errors', () => {
    const { component, planningService } = createComponent();

    component.userName.set('Alice');
    planningService.createRoom.mockReturnValue(throwError(() => new Error('boom')));

    component.createRoom();

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Impossible de creer le salon.');
  });

  it('rejects empty room codes and uppercases navigation room codes', () => {
    const { component, router } = createComponent();

    component.goToRoom();
    expect(component.error()).toBe('Le code du salon est obligatoire.');

    component.roomCode.set(' ab12 ');
    component.goToRoom();

    expect(router.navigate).toHaveBeenCalledWith(['/room', 'AB12']);
  });
});
