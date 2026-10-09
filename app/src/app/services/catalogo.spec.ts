import { TestBed } from '@angular/core/testing';
import { Catalogo } from './catalogo';

describe('Catalogo', () => {
  let service: Catalogo;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Catalogo);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
