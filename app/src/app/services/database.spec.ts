import { TestBed } from '@angular/core/testing';
import { Database } from './database';

describe('Database', () => {
  let service: Database;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Database);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
