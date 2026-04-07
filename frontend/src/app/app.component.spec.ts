import { describe, expect, it } from 'vitest';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('creates the root component class', () => {
    expect(new AppComponent()).toBeInstanceOf(AppComponent);
  });
});
