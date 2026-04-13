import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { Observable, Subject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Member, MemberRole, Room, RoomEvent } from './rooms.types';

interface StoredRoom {
  roomId: string;
  members: Member[];
  votes: Record<string, string>;
  revealed: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, StoredRoom>();
  private readonly roomStreams = new Map<string, Set<Subject<MessageEvent>>>();

  createRoom(): Room {
    const roomId = nanoid(6).toUpperCase();
    const now = new Date().toISOString();

    const room: StoredRoom = {
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

  getRoom(roomId: string): Room {
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

  joinRoom(roomId: string, name: string, role: MemberRole = MemberRole.Participant) {
    const room = this.getRoomOrThrow(roomId);

    const member: Member = {
      id: nanoid(8),
      name,
      role
    };

    room.members.push(member);
    room.updatedAt = new Date().toISOString();
    this.publishRoom(room);

    return {
      member,
      room: this.toView(room)
    };
  }

  vote(roomId: string, memberId: string, value: string): Room {
    const room = this.getRoomOrThrow(roomId);

    const member = room.members.find((entry) => entry.id === memberId);
    if (!member) {
      throw new NotFoundException('Participant introuvable dans ce salon.');
    }

    if (member.role !== MemberRole.Participant) {
      throw new BadRequestException('Un observateur ne peut pas voter.');
    }

    room.votes[memberId] = value;
    room.updatedAt = new Date().toISOString();
    this.publishRoom(room);

    return this.toView(room);
  }

  reveal(roomId: string): Room {
    const room = this.getRoomOrThrow(roomId);

    if (!this.areAllParticipantsVoted(room)) {
      throw new BadRequestException('Tous les participants doivent voter avant de reveler.');
    }

    room.revealed = true;
    room.updatedAt = new Date().toISOString();
    this.publishRoom(room);

    return this.toView(room);
  }

  reset(roomId: string): Room {
    const room = this.getRoomOrThrow(roomId);
    room.revealed = false;
    room.votes = {};
    room.updatedAt = new Date().toISOString();
    this.publishRoom(room);

    return this.toView(room);
  }

  leaveRoom(roomId: string, memberId: string): { left: boolean } {
    const room = this.getRoomOrThrow(roomId);
    const memberIndex = room.members.findIndex((member) => member.id === memberId);

    if (memberIndex === -1) {
      throw new NotFoundException('Participant introuvable dans ce salon.');
    }

    const [member] = room.members.splice(memberIndex, 1);
    delete room.votes[member.id];
    room.updatedAt = new Date().toISOString();

    if (room.members.length === 0) {
      this.rooms.delete(room.roomId);
      const subscribers = this.roomStreams.get(room.roomId);
      if (subscribers) {
        for (const subscriber of subscribers) {
          subscriber.complete();
        }
        this.roomStreams.delete(room.roomId);
      }
      return { left: true };
    }

    this.publishRoom(room);
    return { left: true };
  }

  private getRoomOrThrow(roomId: string): StoredRoom {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      throw new NotFoundException('Salon introuvable.');
    }

    return room;
  }

  private toView(room: StoredRoom): Room {
    const participants = room.members.filter((member) => member.role === MemberRole.Participant);
    const participantsVotedCount = participants.filter((member) => Boolean(room.votes[member.id])).length;
    const allParticipantsVoted = participants.length > 0 && participantsVotedCount === participants.length;

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
      participantsCount: participants.length,
      participantsVotedCount,
      allParticipantsVoted,
      updatedAt: room.updatedAt
    };
  }

  private areAllParticipantsVoted(room: StoredRoom): boolean {
    const participants = room.members.filter((member) => member.role === MemberRole.Participant);
    return participants.length > 0 && participants.every((member) => Boolean(room.votes[member.id]));
  }

  private publishRoom(room: StoredRoom): void {
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
