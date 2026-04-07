import { Routes } from '@angular/router';
import { LobbyPageComponent } from './pages/lobby/lobby-page.component';
import { RoomPageComponent } from './pages/room/room-page.component';

export const routes: Routes = [
  { path: '', component: LobbyPageComponent },
  { path: 'room/:roomId', component: RoomPageComponent },
  { path: '**', redirectTo: '' }
];
