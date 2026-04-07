import { computed, signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomPageComponent } from './room-page.component';
import { Member, Room } from '../../models/planning.model';

describe('RoomPageComponent', () => {
  const currentMember: Member = { id: 'member-1', name: 'Alice' };
  const room: Room = {
    roomId: 'ABCD',
    members: [currentMember],
    revealed: false,
    votes: { 'member-1': 'VOTED' },
    fibonacci: ['1', '2', '3', '5', '8'],
    updatedAt: '2026-04-07T00:00:00.000Z'
  };

  const createComponent = (roomId = 'abcd') => {
    const planningService = {
      joinRoom: vi.fn(),
      vote: vi.fn(),
      reveal: vi.fn(),
      reset: vi.fn(),
      getRoom: vi.fn(),
      streamRoom: vi.fn()
    };
    const route = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue(roomId)
        }
      }
    };

    const component = Object.create(RoomPageComponent.prototype) as RoomPageComponent & {
      document: Document;
      planningService: typeof planningService;
      route: typeof route;
      destroyRef: { onDestroy: (callback: () => void) => void };
    };

    component.document = document;
    component.planningService = planningService;
    component.route = route;
    component.destroyRef = { onDestroy: vi.fn() };
    component.roomCode = signal('');
    component.room = signal<Room | null>(null);
    component.currentMember = signal<Member | null>(null);
    component.selectedVote = signal<Room['fibonacci'][number] | null>(null);
    component.userName = signal('');
    component.joinLoading = signal(false);
    component.voteLoading = signal(false);
    component.error = signal('');
    component.roomUrl = computed(() => `${component.document.location?.origin ?? ''}/room/${component.roomCode()}`);

    return { component, planningService, route };
  };

  beforeEach(() => {
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('builds the room url from the current origin', () => {
    const { component } = createComponent();

    component.roomCode.set('ABCD');

    expect(component.roomUrl()).toContain('/room/ABCD');
  });

  it('stops initialization when the room id is missing', () => {
    const { component } = createComponent(null as unknown as string);

    component.ngOnInit();

    expect(component.error()).toBe('Code room invalide.');
  });

  it('hydrates, restores and starts synchronization on init', () => {
    const { component } = createComponent();
    const hydrateSpy = vi.spyOn(component as never, 'hydrateFromNavigationState' as never);
    const restoreSpy = vi.spyOn(component as never, 'restoreMember' as never);
    const fetchSpy = vi.spyOn(component as never, 'fetchRoomOnce' as never);
    const streamSpy = vi.spyOn(component as never, 'startRoomStream' as never);

    component.ngOnInit();

    expect(component.roomCode()).toBe('ABCD');
    expect(hydrateSpy).toHaveBeenCalledOnce();
    expect(restoreSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(streamSpy).toHaveBeenCalledOnce();
  });

  it('requires a username before joining a room', () => {
    const { component, planningService } = createComponent();

    component.joinRoom();

    expect(component.error()).toBe('Ton nom est obligatoire.');
    expect(planningService.joinRoom).not.toHaveBeenCalled();
  });

  it('joins a room and persists the member', () => {
    const { component, planningService } = createComponent();

    component.roomCode.set('ABCD');
    component.userName.set(' Alice ');
    planningService.joinRoom.mockReturnValue(of({ member: currentMember, room }));

    component.joinRoom();

    expect(planningService.joinRoom).toHaveBeenCalledWith('ABCD', 'Alice');
    expect(component.currentMember()).toEqual(currentMember);
    expect(component.room()).toEqual(room);
    expect(component.joinLoading()).toBe(false);
    expect(sessionStorage.getItem('pp_member_ABCD')).toBe(JSON.stringify({ memberId: 'member-1', name: 'Alice' }));
  });

  it('handles join errors', () => {
    const { component, planningService } = createComponent();

    component.roomCode.set('ABCD');
    component.userName.set('Alice');
    planningService.joinRoom.mockReturnValue(throwError(() => new Error('boom')));

    component.joinRoom();

    expect(component.error()).toBe('Impossible de rejoindre cette room.');
    expect(component.joinLoading()).toBe(false);
  });

  it('casts a vote when the room and member are available', () => {
    const { component, planningService } = createComponent();
    const updatedRoom: Room = { ...room, votes: { 'member-1': '8' } };

    component.roomCode.set('ABCD');
    component.room.set(room);
    component.currentMember.set(currentMember);
    planningService.vote.mockReturnValue(of(updatedRoom));

    component.castVote('8');

    expect(planningService.vote).toHaveBeenCalledWith('ABCD', 'member-1', '8');
    expect(component.selectedVote()).toBe('8');
    expect(component.room()).toEqual(updatedRoom);
    expect(component.voteLoading()).toBe(false);
  });

  it('ignores vote requests when voting is not allowed', () => {
    const { component, planningService } = createComponent();

    component.castVote('8');
    component.voteLoading.set(true);
    component.castVote('13');

    expect(planningService.vote).not.toHaveBeenCalled();
  });

  it('handles vote errors', () => {
    const { component, planningService } = createComponent();

    component.roomCode.set('ABCD');
    component.room.set(room);
    component.currentMember.set(currentMember);
    planningService.vote.mockReturnValue(throwError(() => new Error('boom')));

    component.castVote('8');

    expect(component.error()).toBe('Vote impossible.');
    expect(component.voteLoading()).toBe(false);
  });

  it('reveals votes only when a room is loaded', () => {
    const { component, planningService } = createComponent();
    const revealedRoom: Room = { ...room, revealed: true, votes: { 'member-1': '8' } };

    component.revealVotes();
    expect(planningService.reveal).not.toHaveBeenCalled();

    component.roomCode.set('ABCD');
    component.room.set(room);
    planningService.reveal.mockReturnValue(of(revealedRoom));

    component.revealVotes();

    expect(planningService.reveal).toHaveBeenCalledWith('ABCD');
    expect(component.room()).toEqual(revealedRoom);
  });

  it('handles reveal errors', () => {
    const { component, planningService } = createComponent();

    component.roomCode.set('ABCD');
    component.room.set(room);
    planningService.reveal.mockReturnValue(throwError(() => new Error('boom')));

    component.revealVotes();

    expect(component.error()).toBe('Impossible de reveler les votes.');
  });

  it('resets the round and clears the selected vote', () => {
    const { component, planningService } = createComponent();
    const resetRoom: Room = { ...room, votes: {} };

    component.roomCode.set('ABCD');
    component.room.set(room);
    component.selectedVote.set('8');
    planningService.reset.mockReturnValue(of(resetRoom));

    component.resetRound();

    expect(planningService.reset).toHaveBeenCalledWith('ABCD');
    expect(component.selectedVote()).toBe(null);
    expect(component.room()).toEqual(resetRoom);
  });

  it('handles reset errors', () => {
    const { component, planningService } = createComponent();

    component.roomCode.set('ABCD');
    component.room.set(room);
    planningService.reset.mockReturnValue(throwError(() => new Error('boom')));

    component.resetRound();

    expect(component.error()).toBe('Impossible de reinitialiser le tour.');
  });

  it('returns placeholders when votes are missing', () => {
    const { component } = createComponent();

    expect(component.memberVote('member-1')).toBe('-');

    component.room.set(room);
    expect(component.memberVote('unknown')).toBe('-');
    expect(component.memberVote('member-1')).toBe('VOTED');
  });

  it('fetches the room once and handles errors', () => {
    const { component, planningService } = createComponent();
    const applySpy = vi.spyOn(component as never, 'applyRoomUpdate' as never);

    component.roomCode.set('ABCD');
    planningService.getRoom.mockReturnValueOnce(of(room));
    (component as never).fetchRoomOnce();
    expect(planningService.getRoom).toHaveBeenCalledWith('ABCD');
    expect(applySpy).toHaveBeenCalledWith(room);

    planningService.getRoom.mockReturnValueOnce(throwError(() => new Error('boom')));
    (component as never).fetchRoomOnce();
    expect(component.error()).toBe('Impossible de charger la room.');
  });

  it('applies room updates coming from the event stream and handles stream errors', () => {
    const { component, planningService } = createComponent();
    const stream = new Subject<{ type: 'room-updated'; room: Room }>();
    const applySpy = vi.spyOn(component as never, 'applyRoomUpdate' as never);

    component.roomCode.set('ABCD');
    planningService.streamRoom.mockReturnValueOnce(stream.asObservable());
    (component as never).startRoomStream();

    stream.next({ type: 'room-updated', room });
    expect(planningService.streamRoom).toHaveBeenCalledWith('ABCD');
    expect(applySpy).toHaveBeenCalledWith(room);

    stream.error(new Error('boom'));
    expect(component.error()).toBe('Erreur de synchronisation avec la room.');
  });

  it('hydrates from navigation state when it matches the current room', () => {
    const { component } = createComponent();

    component.roomCode.set('ABCD');
    window.history.pushState({ room, member: currentMember }, '', '/room/ABCD');
    (component as never).hydrateFromNavigationState();

    expect(component.room()).toEqual(room);
    expect(component.currentMember()).toEqual(currentMember);
    expect(component.userName()).toBe('Alice');
    expect(sessionStorage.getItem('pp_member_ABCD')).toBe(JSON.stringify({ memberId: 'member-1', name: 'Alice' }));
  });

  it('restores the member from session storage and clears invalid data', () => {
    const { component } = createComponent();

    component.roomCode.set('ABCD');
    sessionStorage.setItem('pp_member_ABCD', JSON.stringify({ memberId: 'member-1', name: 'Alice' }));
    (component as never).restoreMember();
    expect(component.currentMember()).toEqual(currentMember);
    expect(component.userName()).toBe('Alice');

    sessionStorage.setItem('pp_member_ABCD', '{invalid');
    (component as never).restoreMember();
    expect(sessionStorage.getItem('pp_member_ABCD')).toBe(null);
  });

  it('clears the member when a room update removes them and resets the vote when needed', () => {
    const { component } = createComponent();

    component.roomCode.set('ABCD');
    component.currentMember.set(currentMember);
    component.selectedVote.set('8');
    (component as never).applyRoomUpdate({ ...room, members: [] });
    expect(component.currentMember()).toBe(null);
    expect(component.selectedVote()).toBe(null);

    component.currentMember.set(currentMember);
    component.selectedVote.set('8');
    (component as never).applyRoomUpdate({ ...room, votes: {} });
    expect(component.selectedVote()).toBe(null);

    (component as never).applyRoomUpdate({ ...room, revealed: true, votes: { 'member-1': '13' } });
    expect(component.selectedVote()).toBe('13');
  });
});
