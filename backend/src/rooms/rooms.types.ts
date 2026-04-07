export type VoteValue = '0' | '1' | '2' | '3' | '5' | '8' | '13' | '21' | '34' | '55' | '89' | '?';

export interface Member {
  id: string;
  name: string;
}

export interface Room {
  roomId: string;
  members: Member[];
  votes: Record<string, VoteValue>;
  revealed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoomView {
  roomId: string;
  members: Member[];
  revealed: boolean;
  votes: Record<string, VoteValue | 'VOTED' | null>;
  fibonacci: VoteValue[];
  updatedAt: string;
}

export interface RoomEvent {
  type: 'room-updated';
  room: RoomView;
}
