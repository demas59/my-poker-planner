import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { Observable, Subject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Member, Room, RoomEvent, RoomView, VoteValue } from './rooms.types';

const FIBONACCI_VALUES: VoteValue[] = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'];

@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();
  private readonly roomStreams = new Map<string, Set<Subject<MessageEvent>>>();

  createRoom(): RoomView {
    const roomId = nanoid(6).toUpperCase();
    const now = new Date().toISOString();

    const room: Room = {
      roomId,
      members: [],
      votes: {},
      revealed: false,
      createdAt: now,
      updatedAt: now
    };

    this.rooms.set(roomId, room);
    return this.toView(room);
  }

  getRoom(roomId: string): RoomView {
    return this.toView(this.getRoomOrThrow(roomId));
  }

  streamRoom(roomId: string): Observable<MessageEvent> {
    const room = this.getRoomOrThrow(roomId);
    const subject = new Subject<MessageEvent>();
    const roomKey = room.roomId;
    const subscribers = this.roomStreams.get(roomKey) ?? new Set<Subject<MessageEvent>>();

    subscribers.add(subject);
    this.roomStreams.set(roomKey, subscribers);

    subject.next({
      data: {
        type: 'room-updated',
        room: this.toView(room)
      } satisfies RoomEvent
    });

    return subject.asObservable().pipe(
      finalize(() => {
        const currentSubscribers = this.roomStreams.get(roomKey);
        if (!currentSubscribers) {
          return;
        }

        currentSubscribers.delete(subject);
        if (currentSubscribers.size === 0) {
          this.roomStreams.delete(roomKey);
        }
      })
    );
  }

  joinRoom(roomId: string, name: string) {
    const room = this.getRoomOrThrow(roomId);

    const member: Member = {
      id: nanoid(8),
      name
    };

    room.members.push(member);
    room.updatedAt = new Date().toISOString();
    this.publishRoom(room);

    return {
      member,
      room: this.toView(room)
    };
  }

  vote(roomId: string, memberId: string, value: VoteValue): RoomView {
    const room = this.getRoomOrThrow(roomId);

    if (!FIBONACCI_VALUES.includes(value)) {
      throw new BadRequestException('Valeur de vote invalide.');
    }

    if (!room.members.some((member) => member.id === memberId)) {
      throw new NotFoundException('Participant introuvable dans ce salon.');
    }

    room.votes[memberId] = value;
    room.revealed = false;
    room.updatedAt = new Date().toISOString();
    this.publishRoom(room);

    return this.toView(room);
  }

  reveal(roomId: string): RoomView {
    const room = this.getRoomOrThrow(roomId);
    room.revealed = true;
    room.updatedAt = new Date().toISOString();
    this.publishRoom(room);

    return this.toView(room);
  }

  reset(roomId: string): RoomView {
    const room = this.getRoomOrThrow(roomId);
    room.revealed = false;
    room.votes = {};
    room.updatedAt = new Date().toISOString();
    this.publishRoom(room);

    return this.toView(room);
  }

  private getRoomOrThrow(roomId: string): Room {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      throw new NotFoundException('Salon introuvable.');
    }

    return room;
  }

  private toView(room: Room): RoomView {
    const votes = room.revealed
      ? room.votes
      : room.members.reduce<Record<string, 'VOTED' | null>>((acc, member) => {
          acc[member.id] = room.votes[member.id] ? 'VOTED' : null;
          return acc;
        }, {});

    return {
      roomId: room.roomId,
      members: room.members,
      revealed: room.revealed,
      votes,
      fibonacci: FIBONACCI_VALUES,
      updatedAt: room.updatedAt
    };
  }

  private publishRoom(room: Room): void {
    const subscribers = this.roomStreams.get(room.roomId);
    if (!subscribers?.size) {
      return;
    }

    const event: RoomEvent = {
      type: 'room-updated',
      room: this.toView(room)
    };

    for (const subscriber of subscribers) {
      subscriber.next({ data: event });
    }
  }
}
