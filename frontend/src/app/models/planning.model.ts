export enum MemberRole {
  Participant = 'participant',
  Observer = 'observer'
}

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
}

export interface Room {
  roomId: string;
  members: Member[];
  revealed: boolean;
  votes: Record<string, string | 'VOTED' | null>;
  participantsCount: number;
  participantsVotedCount: number;
  allParticipantsVoted: boolean;
  updatedAt: string;
}

export interface JoinRoomResponse {
  member: Member;
  room: Room;
}

export interface RoomEvent {
  type: 'room-updated';
  room: Room;
}
