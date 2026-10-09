import { TestBed } from '@angular/core/testing';
import { Sync } from './sync';

describe('Sync', () => {
  let service: Sync;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sync);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
