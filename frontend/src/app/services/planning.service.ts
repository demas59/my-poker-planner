import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { JoinRoomResponse, Room, RoomEvent, VoteValue } from '../models/planning.model';

@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  createRoom(): Observable<Room> {
    return this.http.post<Room>(`${this.baseUrl}/rooms`, {});
  }

  joinRoom(roomId: string, name: string): Observable<JoinRoomResponse> {
    return this.http.post<JoinRoomResponse>(`${this.baseUrl}/rooms/${roomId.toUpperCase()}/join`, { name });
  }

  getRoom(roomId: string): Observable<Room> {
    return this.http.get<Room>(`${this.baseUrl}/rooms/${roomId.toUpperCase()}`);
  }

  streamRoom(roomId: string): Observable<RoomEvent> {
    return new Observable<RoomEvent>((observer) => {
      const source = new EventSource(`${this.baseUrl}/rooms/${roomId.toUpperCase()}/events`);

      source.onmessage = (event) => {
        observer.next(JSON.parse(event.data) as RoomEvent);
      };

      source.onerror = () => {
        // EventSource handles reconnection automatically. We keep the stream alive.
      };

      return () => {
        source.close();
      };
    });
  }

  vote(roomId: string, memberId: string, value: VoteValue): Observable<Room> {
    return this.http.post<Room>(`${this.baseUrl}/rooms/${roomId.toUpperCase()}/vote`, {
      memberId,
      value
    });
  }

  reveal(roomId: string): Observable<Room> {
    return this.http.post<Room>(`${this.baseUrl}/rooms/${roomId.toUpperCase()}/reveal`, {});
  }

  reset(roomId: string): Observable<Room> {
    return this.http.post<Room>(`${this.baseUrl}/rooms/${roomId.toUpperCase()}/reset`, {});
  }
}
